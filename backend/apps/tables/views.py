from django.db import models
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.accounts.models import User
from apps.events.models import Event
from apps.events.event_lifecycle import require_event_live
from apps.guests.models import Guest
from apps.platforms.platform_permissions import (
    get_platform_for_user,
    is_platform_coordinator,
    require_event_access,
    require_staff_event_assignment,
    staff_assigned_event_ids,
)

from .models import SeatingPlan, Table, TableSeat
from .serializers import SeatingPlanSerializer, TableSeatSerializer, TableSerializer

# الأدوار المسموح لها بإدارة توزيع المقاعد (المخططات والطاولات والكراسي)
SEATING_MANAGER_ROLES = (
    User.Role.SYSTEM_MANAGER,
    User.Role.PLATFORM_ADMIN,
    User.Role.EVENT_MANAGER,
    User.Role.EVENT_ORGANIZER,
)


def scope_queryset_by_event(qs, user, event_path: str = "event"):
    """يقصر الاستعلام على الفعاليات التي يملك المستخدم صلاحية الوصول إليها."""
    if user.role == User.Role.SYSTEM_MANAGER:
        return qs
    if user.role == User.Role.PLATFORM_ADMIN:
        platform = get_platform_for_user(user)
        if platform:
            return qs.filter(**{f"{event_path}__platform_id": platform.id})
        return qs.none()
    if user.role == User.Role.STAFF:
        event_ids = staff_assigned_event_ids(user)
        if not event_ids:
            return qs.none()
        return qs.filter(**{f"{event_path}_id__in": event_ids})
    if user.role in (
        User.Role.EVENT_MANAGER,
        User.Role.EVENT_ORGANIZER,
    ):
        return qs.filter(
            models.Q(**{f"{event_path}__created_by": user})
            | models.Q(**{f"{event_path}__managers": user})
        ).distinct()
    return qs.none()


def require_seating_manager(user, event: Event) -> None:
    """توزيع المقاعد من صلاحيات مدير/منظم الفعالية (والمنسق ومدير المنصة والنظام)."""
    if user.role in SEATING_MANAGER_ROLES or is_platform_coordinator(user):
        require_event_access(user, event)
        require_staff_event_assignment(user, event)
        return
    raise PermissionDenied("توزيع المقاعد يقتصر على مدير الفعالية ومنظمها والمنسق")


class SeatingPlanViewSet(viewsets.ModelViewSet):
    serializer_class = SeatingPlanSerializer
    filterset_fields = ["event"]

    def get_queryset(self):
        return scope_queryset_by_event(
            SeatingPlan.objects.select_related("event"), self.request.user
        )

    def perform_create(self, serializer):
        event = serializer.validated_data["event"]
        require_seating_manager(self.request.user, event)
        serializer.save()

    def perform_update(self, serializer):
        require_seating_manager(self.request.user, serializer.instance.event)
        serializer.save()

    def perform_destroy(self, instance):
        require_seating_manager(self.request.user, instance.event)
        instance.delete()


class TableViewSet(viewsets.ModelViewSet):
    serializer_class = TableSerializer
    filterset_fields = ["event", "section", "group", "plan"]

    def get_queryset(self):
        return scope_queryset_by_event(
            Table.objects.select_related("section", "group", "plan").prefetch_related(
                "seats__guest"
            ),
            self.request.user,
        )

    def _validate_relations(self, event: Event, section, group) -> None:
        if section and section.event_id != event.id:
            raise ValidationError({"section": "القسم لا يخص هذه الفعالية"})
        if group and group.event_id != event.id:
            raise ValidationError({"group": "المجموعة لا تخص هذه الفعالية"})

    def perform_create(self, serializer):
        event = serializer.validated_data["event"]
        require_seating_manager(self.request.user, event)
        self._validate_relations(
            event,
            serializer.validated_data.get("section"),
            serializer.validated_data.get("group"),
        )
        serializer.save()

    def perform_update(self, serializer):
        event = serializer.instance.event
        require_seating_manager(self.request.user, event)
        self._validate_relations(
            event,
            serializer.validated_data.get("section", serializer.instance.section),
            serializer.validated_data.get("group", serializer.instance.group),
        )
        serializer.save()

    def perform_destroy(self, instance):
        require_seating_manager(self.request.user, instance.event)
        instance.delete()

    def _seat_guest(self, table: Table, guest: Guest, seat_number=None) -> None:
        """منطق مشترك لإجلاس ضيف على مقعد — يتحقق من المجموعة والسعة."""
        # كل طاولة مخصصة لمجموعة واحدة — لا يُسند إلا ضيوف نفس المجموعة
        if table.group_id and guest.group_id != table.group_id:
            raise ValidationError(
                {"guest_id": "هذه الطاولة مخصصة لمجموعة أخرى — اختر ضيفاً من مجموعة الطاولة"}
            )

        occupied = table.seats.filter(guest__isnull=False).count()
        already_here = table.seats.filter(guest_id=guest.id).exists()
        if not already_here and occupied >= table.capacity:
            raise ValidationError({"guest_id": "الطاولة مكتملة — لا توجد مقاعد شاغرة"})

        # إزالة أي مقعد سابق لهذا الضيف (مقعد واحد لكل ضيف)
        TableSeat.objects.filter(guest_id=guest.id).update(guest=None)

        if seat_number:
            seat_number = int(seat_number)
        else:
            taken = set(
                table.seats.filter(guest__isnull=False).values_list(
                    "seat_number", flat=True
                )
            )
            seat_number = next(
                (n for n in range(1, table.capacity + 1) if n not in taken), 1
            )

        seat, _ = TableSeat.objects.get_or_create(
            table=table,
            seat_number=seat_number,
            defaults={"guest": guest},
        )
        if seat.guest_id != guest.id:
            seat.guest = guest
            seat.save(update_fields=["guest"])

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """إسناد ضيف إلى مقعد في الطاولة يدوياً (طريقة الإدراج) — مع التحقق من المجموعة."""
        table = self.get_object()
        require_seating_manager(request.user, table.event)
        require_event_live(table.event)

        guest_id = request.data.get("guest_id") or request.data.get("guest")
        if not guest_id:
            raise ValidationError({"guest_id": "معرّف الضيف مطلوب"})
        guest = Guest.objects.filter(id=guest_id, event_id=table.event_id).first()
        if not guest:
            raise ValidationError({"guest_id": "الضيف غير موجود في هذه الفعالية"})

        self._seat_guest(table, guest, request.data.get("seat_number"))
        if guest.status != Guest.Status.SEATED:
            guest.status = Guest.Status.SEATED
            guest.save(update_fields=["status"])
        from apps.platforms.notification_service import notify_guest_seated

        notify_guest_seated(table.event, guest.full_name, actor=request.user)
        return Response(TableSerializer(table).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="scan-seat")
    def scan_seat(self, request, pk=None):
        """إجلاس ضيف عبر مسح رمز QR (طريقة المسح).

        يتطلب أن يكون الضيف قد سُجّل حضوره (حالة "حضر")، ثم يصبح "جلس".
        """
        table = self.get_object()
        require_seating_manager(request.user, table.event)
        require_event_live(table.event)

        token = request.data.get("token")
        if not token:
            raise ValidationError({"token": "رمز QR مطلوب"})

        guest = Guest.objects.filter(
            public_token=token, event_id=table.event_id
        ).first()
        if not guest:
            return Response(
                {"detail": "رمز غير معروف أو لا يخص هذه الفعالية"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if guest.status not in (Guest.Status.ATTENDED, Guest.Status.SEATED):
            return Response(
                {
                    "detail": "يجب تسجيل حضور الضيف أولاً قبل إجلاسه",
                    "guest_status": guest.status,
                    "guest_name": guest.full_name,
                },
                status=status.HTTP_409_CONFLICT,
            )

        self._seat_guest(table, guest, request.data.get("seat_number"))

        if guest.status != Guest.Status.SEATED:
            guest.status = Guest.Status.SEATED
            guest.save(update_fields=["status"])

        from apps.platforms.notification_service import notify_guest_seated

        notify_guest_seated(table.event, guest.full_name, actor=request.user)
        data = TableSerializer(table).data
        data["seated_guest"] = {"id": guest.id, "full_name": guest.full_name}
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="unassign")
    def unassign(self, request, pk=None):
        """إزالة ضيف من مقعد الطاولة."""
        table = self.get_object()
        require_seating_manager(request.user, table.event)

        guest_id = request.data.get("guest_id") or request.data.get("guest")
        seat_number = request.data.get("seat_number")
        seats = table.seats.all()
        if guest_id:
            seats = seats.filter(guest_id=guest_id)
        elif seat_number:
            seats = seats.filter(seat_number=int(seat_number))
        else:
            raise ValidationError({"detail": "حدّد الضيف أو رقم المقعد"})
        seats.update(guest=None)
        return Response(TableSerializer(table).data, status=status.HTTP_200_OK)


class TableSeatViewSet(viewsets.ModelViewSet):
    serializer_class = TableSeatSerializer
    filterset_fields = ["table"]

    def get_queryset(self):
        return scope_queryset_by_event(
            TableSeat.objects.select_related("table", "guest"),
            self.request.user,
            event_path="table__event",
        )

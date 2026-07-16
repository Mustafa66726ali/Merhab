from django.db import transaction
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.accounts.models import User
from apps.events.event_lifecycle import require_event_guest_editable, require_event_live
from apps.platforms.platform_permissions import (
    PERM_EDIT_GUESTS,
    PERM_SCAN_QR,
    get_platform_for_user,
    require_event_access,
    require_platform_permission,
    require_staff_event_assignment,
    staff_assigned_event_ids,
)

from .models import Guest, GuestQrScanLog
from .serializers import GuestSerializer, GuestImportSerializer
from .stats import aggregate_guest_stats


def _normalize_phone(phone: str) -> str:
    import re

    return re.sub(r"\D", "", (phone or "").strip())


def _guest_identity_key(guest: Guest) -> str:
    phone = _normalize_phone(guest.phone)
    if phone:
        return f"phone:{phone}"
    email = (guest.email or "").strip().lower()
    if email:
        return f"email:{email}"
    return f"name:{(guest.full_name or '').strip().lower()}"


class GuestPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 1000


class GuestViewSet(viewsets.ModelViewSet):
    serializer_class = GuestSerializer
    pagination_class = GuestPagination
    filterset_fields = ["event", "status", "section", "group"]
    search_fields = ["full_name", "email", "phone"]
    ordering_fields = ["full_name", "status", "created_at"]

    def get_queryset(self):
        qs = Guest.objects.select_related(
            "section", "group", "event", "event__platform"
        )
        user = self.request.user
        if user.role == User.Role.PLATFORM_ADMIN:
            platform = get_platform_for_user(user)
            if platform:
                qs = qs.filter(event__platform_id=platform.id)
            else:
                return Guest.objects.none()
        elif user.role == User.Role.STAFF:
            event_ids = staff_assigned_event_ids(user)
            if not event_ids:
                return Guest.objects.none()
            qs = qs.filter(event_id__in=event_ids)
        elif user.role in (
            User.Role.EVENT_MANAGER,
            User.Role.EVENT_ORGANIZER,
        ):
            qs = qs.filter(
                Q(event__created_by=user) | Q(event__managers=user)
            ).distinct()
        return qs

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """إحصائيات الضيوف من قاعدة البيانات (مع نفس فلاتر القائمة)."""
        qs = self.filter_queryset(self.get_queryset())
        return Response(aggregate_guest_stats(qs))

    def _event_from_request_data(self) -> int | None:
        event_id = self.request.data.get("event")
        if event_id:
            return int(event_id)
        guests = self.request.data.get("guests")
        if isinstance(guests, list) and guests:
            first = guests[0]
            if isinstance(first, dict) and first.get("event"):
                return int(first["event"])
        return None

    @action(detail=False, methods=["get"], url_path="directory")
    def directory(self, request):
        """قائمة ضيوف مميّزين من مناسبات المنصة — للاختيار عند الإضافة لمناسبة أخرى."""
        qs = self.filter_queryset(self.get_queryset()).select_related("event")
        exclude_event = request.query_params.get("exclude_event")
        if exclude_event:
            qs = qs.exclude(event_id=exclude_event)
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(full_name__icontains=search)
                | Q(email__icontains=search)
                | Q(phone__icontains=search)
            )
        seen: dict[str, dict] = {}
        for guest in qs.order_by("-created_at"):
            key = _guest_identity_key(guest)
            if key in seen:
                seen[key]["event_count"] += 1
                continue
            seen[key] = {
                "id": guest.id,
                "full_name": guest.full_name,
                "email": guest.email or "",
                "phone": guest.phone or "",
                "event_count": 1,
                "last_event_title": guest.event.title,
            }
        results = sorted(seen.values(), key=lambda row: row["full_name"])
        return Response(results[:200])

    def perform_create(self, serializer):
        user = self.request.user
        require_platform_permission(user, PERM_EDIT_GUESTS, "غير مصرح — لا تملك صلاحية تعديل الضيوف")
        event = serializer.validated_data.get("event")
        require_event_access(user, event)
        require_event_guest_editable(event)
        guest = serializer.save()
        from apps.platforms.notification_service import maybe_notify_preparation_complete

        maybe_notify_preparation_complete(guest.event)

    def perform_update(self, serializer):
        user = self.request.user
        require_platform_permission(user, PERM_EDIT_GUESTS, "غير مصرح — لا تملك صلاحية تعديل الضيوف")
        require_event_access(user, serializer.instance.event)
        require_event_guest_editable(serializer.instance.event)
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        require_platform_permission(user, PERM_EDIT_GUESTS, "غير مصرح — لا تملك صلاحية تعديل الضيوف")
        require_event_access(user, instance.event)
        instance.delete()

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request):
        """حذف مجموعة ضيوف دفعة واحدة ضمن صلاحيات المستخدم."""
        require_platform_permission(
            request.user,
            PERM_EDIT_GUESTS,
            "غير مصرح — لا تملك صلاحية تعديل الضيوف",
        )
        raw_ids = request.data.get("guest_ids") or request.data.get("ids") or []
        if not isinstance(raw_ids, list) or not raw_ids:
            return Response(
                {"detail": "أرسل قائمة guest_ids غير فارغة"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ids: list[int] = []
        for value in raw_ids:
            try:
                ids.append(int(value))
            except (TypeError, ValueError):
                continue
        # إزالة التكرار مع الحفاظ على الترتيب
        ids = list(dict.fromkeys(ids))
        if not ids:
            return Response(
                {"detail": "معرّفات الضيوف غير صالحة"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(ids) > 500:
            return Response(
                {"detail": "الحد الأقصى لحذف دفعة واحدة هو 500 ضيف"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = self.get_queryset().filter(id__in=ids).select_related("event")
        found = {g.id: g for g in qs}
        deleted_ids: list[int] = []
        skipped: list[dict] = []

        for gid in ids:
            guest = found.get(gid)
            if not guest:
                skipped.append({"id": gid, "detail": "الضيف غير موجود أو خارج صلاحيتك"})
                continue
            try:
                require_event_access(request.user, guest.event)
            except PermissionDenied as exc:
                detail = exc.detail
                if isinstance(detail, list):
                    detail = detail[0] if detail else "غير مصرح"
                skipped.append(
                    {"id": gid, "name": guest.full_name, "detail": str(detail)}
                )
                continue
            deleted_ids.append(guest.id)

        if not deleted_ids:
            return Response(
                {
                    "detail": skipped[0]["detail"] if skipped else "لم يُحذف أي ضيف",
                    "deleted": [],
                    "deleted_count": 0,
                    "skipped": skipped,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            Guest.objects.filter(id__in=deleted_ids).delete()

        return Response(
            {
                "deleted": deleted_ids,
                "deleted_count": len(deleted_ids),
                "skipped": skipped,
                "detail": (
                    f"تم حذف {len(deleted_ids)} ضيف"
                    + (f" — تُخطّي {len(skipped)}" if skipped else "")
                ),
            }
        )

    @action(detail=False, methods=["post"])
    def import_guests(self, request):
        from rest_framework.exceptions import ValidationError as DRFValidationError

        require_platform_permission(
            request.user,
            PERM_EDIT_GUESTS,
            "غير مصرح — لا تملك صلاحية تعديل الضيوف",
        )
        serializer = GuestImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = []
        row_errors: list[str] = []
        for row_idx, guest_data in enumerate(serializer.validated_data["guests"], start=1):
            from apps.events.models import Event

            try:
                event = Event.objects.select_related("platform").get(pk=guest_data.get("event"))
                require_event_access(request.user, event)
                require_event_guest_editable(event)
                row = dict(guest_data)
                row.pop("id", None)
                guest_ser = GuestSerializer(data=row)
                guest_ser.is_valid(raise_exception=True)
                guest = guest_ser.save()
                created.append(GuestSerializer(guest, context={"request": request}).data)
            except DRFValidationError as exc:
                name = (guest_data.get("full_name") or "").strip() or f"صف {row_idx}"
                detail = exc.detail
                if isinstance(detail, dict):
                    if "detail" in detail:
                        msg = detail["detail"]
                    else:
                        first = next(iter(detail.values()), "")
                        msg = first
                else:
                    msg = detail
                if isinstance(msg, list):
                    msg = msg[0] if msg else "بيانات غير صالحة"
                row_errors.append(f"{name}: {msg}")
            except Event.DoesNotExist:
                row_errors.append(f"صف {row_idx}: المناسبة غير موجودة")

        if not created:
            return Response(
                {
                    "detail": row_errors[0] if row_errors else "لم يُستورد أي ضيف",
                    "errors": row_errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload: dict = {"created": created, "count": len(created)}
        if row_errors:
            payload["errors"] = row_errors
            payload["partial"] = True
            payload["detail"] = f"تم استيراد {len(created)} ضيف مع {len(row_errors)} أخطاء"
            return Response(payload, status=status.HTTP_201_CREATED)

        return Response(created, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def check_in(self, request, pk=None):
        guest = self.get_object()
        require_platform_permission(
            request.user,
            PERM_SCAN_QR,
            "غير مصرح — لا تملك صلاحية مسح QR / تسجيل الحضور",
        )
        require_event_access(request.user, guest.event)
        require_staff_event_assignment(request.user, guest.event)
        require_event_live(guest.event)
        guest.status = Guest.Status.ATTENDED
        guest.save(update_fields=["status"])
        GuestQrScanLog.objects.create(
            guest=guest,
            event=guest.event,
            scanner=request.user,
        )
        from apps.platforms.notification_service import notify_guest_checked_in

        notify_guest_checked_in(guest.event, guest.full_name, actor=request.user)
        return Response(GuestSerializer(guest, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="scan-qr")
    def scan_qr(self, request, pk=None):
        """تسجيل حضور الضيف عبر مسح QR — يتطلب perm_scan_qr."""
        return self.check_in(request, pk=pk)

    @action(detail=False, methods=["post"], url_path="scan")
    def scan(self, request):
        """تسجيل الحضور عبر مسح رمز QR (الرمز الفريد للضيف) — يتطلب perm_scan_qr.

        ينتقل الضيف من "مؤكد الحضور" إلى "حضر". لا يُخفَّض من حالة "جلس".
        """
        token = request.data.get("token")
        if not token:
            raise ValidationError({"token": "رمز QR مطلوب"})

        guest = self.get_queryset().filter(public_token=token).first()
        if not guest:
            return Response(
                {"detail": "رمز غير معروف أو خارج نطاق صلاحياتك"},
                status=status.HTTP_404_NOT_FOUND,
            )

        require_platform_permission(
            request.user,
            PERM_SCAN_QR,
            "غير مصرح — لا تملك صلاحية مسح QR / تسجيل الحضور",
        )
        require_event_access(request.user, guest.event)
        require_staff_event_assignment(request.user, guest.event)
        require_event_live(guest.event)

        already = guest.status in (Guest.Status.ATTENDED, Guest.Status.SEATED)
        if not already:
            guest.status = Guest.Status.ATTENDED
            guest.save(update_fields=["status"])
            from apps.platforms.notification_service import notify_guest_checked_in

            notify_guest_checked_in(guest.event, guest.full_name, actor=request.user)

        GuestQrScanLog.objects.create(
            guest=guest,
            event=guest.event,
            scanner=request.user,
        )
        data = GuestSerializer(guest, context={"request": request}).data
        data["already_checked_in"] = already
        return Response(data)

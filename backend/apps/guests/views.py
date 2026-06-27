from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models import User
from apps.platforms.platform_permissions import (
    PERM_EDIT_GUESTS,
    PERM_SCAN_QR,
    get_platform_for_user,
    require_event_access,
    require_platform_permission,
)

from .models import Guest, GuestQrScanLog
from .serializers import GuestSerializer, GuestImportSerializer


class GuestViewSet(viewsets.ModelViewSet):
    serializer_class = GuestSerializer
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
            # المنسق ومدير الدخول: ضيوف كامل فعاليات منصتهم (لمسح الحضور والإجلاس)
            platform = get_platform_for_user(user)
            if platform:
                qs = qs.filter(event__platform_id=platform.id)
            else:
                return Guest.objects.none()
        elif user.role in (
            User.Role.EVENT_MANAGER,
            User.Role.EVENT_ORGANIZER,
        ):
            qs = qs.filter(
                Q(event__created_by=user) | Q(event__managers=user)
            ).distinct()
        return qs

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

    def perform_create(self, serializer):
        user = self.request.user
        require_platform_permission(user, PERM_EDIT_GUESTS, "غير مصرح — لا تملك صلاحية تعديل الضيوف")
        event = serializer.validated_data.get("event")
        require_event_access(user, event)
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        require_platform_permission(user, PERM_EDIT_GUESTS, "غير مصرح — لا تملك صلاحية تعديل الضيوف")
        require_event_access(user, serializer.instance.event)
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        require_platform_permission(user, PERM_EDIT_GUESTS, "غير مصرح — لا تملك صلاحية تعديل الضيوف")
        require_event_access(user, instance.event)
        instance.delete()

    @action(detail=False, methods=["post"])
    def import_guests(self, request):
        require_platform_permission(
            request.user,
            PERM_EDIT_GUESTS,
            "غير مصرح — لا تملك صلاحية تعديل الضيوف",
        )
        serializer = GuestImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = []
        for guest_data in serializer.validated_data["guests"]:
            from apps.events.models import Event

            event = Event.objects.select_related("platform").get(pk=guest_data.get("event"))
            require_event_access(request.user, event)
            guest, _ = Guest.objects.get_or_create(
                event_id=guest_data.get("event"),
                email=guest_data.get("email", ""),
                defaults=guest_data,
            )
            created.append(GuestSerializer(guest).data)
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
        guest.status = Guest.Status.ATTENDED
        guest.save(update_fields=["status"])
        GuestQrScanLog.objects.create(
            guest=guest,
            event=guest.event,
            scanner=request.user,
        )
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

        already = guest.status in (Guest.Status.ATTENDED, Guest.Status.SEATED)
        if not already:
            guest.status = Guest.Status.ATTENDED
            guest.save(update_fields=["status"])

        GuestQrScanLog.objects.create(
            guest=guest,
            event=guest.event,
            scanner=request.user,
        )
        data = GuestSerializer(guest, context={"request": request}).data
        data["already_checked_in"] = already
        return Response(data)

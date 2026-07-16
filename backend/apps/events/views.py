import mimetypes

from django.db import models
from django.db.models import Count, Prefetch, Q
from django.http import FileResponse, Http404, HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.models import User
from apps.guests.models import Guest
from apps.guests.status_utils import CONFIRMED_ATTENDANCE_STATUSES, PHYSICAL_PRESENCE_STATUSES
from apps.platforms.platform_permissions import (
    get_platform_for_user,
    require_event_access,
    staff_assigned_event_ids,
)
from config.cache_utils import invalidate_platform_event_caches

from apps.events.event_lifecycle import end_event, start_event
from .live_media import (
    LiveMediaMode,
    STREAM_MODES,
    build_live_media_payload,
    ensure_broadcast_token,
    youtube_embed_url,
)
from .live_broadcast_send import send_broadcast_link_to_present_guests
from .analytics import events_overview
from .event_seating_overview import build_seating_overview
from .event_groups_overview import build_groups_guests_csv, build_groups_overview
from .models import Event, Section, Schedule, Group
from .serializers import (
    EventListSerializer,
    EventDetailSerializer,
    EventCreateSerializer,
    SectionSerializer,
    ScheduleSerializer,
    GroupSerializer,
)


LIVE_MEDIA_ROLES = (
    User.Role.EVENT_MANAGER,
    User.Role.EVENT_ORGANIZER,
    User.Role.PLATFORM_ADMIN,
    User.Role.SYSTEM_MANAGER,
)


class EventPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 1000


class EventViewSet(viewsets.ModelViewSet):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = EventPagination
    filterset_fields = ["status", "platform"]
    search_fields = ["title", "venue", "description", "platform__name"]
    ordering_fields = ["date", "title", "created_at"]

    def _require_live_media_access(self, request, event: Event) -> None:
        require_event_access(request.user, event)
        if request.user.role not in LIVE_MEDIA_ROLES:
            raise PermissionDenied("غير مصرح — إدارة البث لمنظم/مدير الفعالية فقط")

    def get_queryset(self):
        user = self.request.user
        qs = Event.objects.select_related("platform", "created_by")

        if self.action == "list":
            qs = qs.annotate(
                sections_count=Count("sections", distinct=True),
                guests_count=Count("guests", distinct=True),
                attended_count=Count(
                    "guests",
                    filter=Q(guests__status__in=PHYSICAL_PRESENCE_STATUSES),
                    distinct=True,
                ),
                confirmed_count=Count(
                    "guests",
                    filter=Q(guests__status__in=CONFIRMED_ATTENDANCE_STATUSES),
                    distinct=True,
                ),
            )
        else:
            qs = qs.prefetch_related(
                "sections",
                "groups",
                Prefetch(
                    "guests",
                    queryset=Guest.objects.select_related("group", "section"),
                ),
                "managers",
            ).annotate(
                guests_count=Count("guests", distinct=True),
                attended_count=Count(
                    "guests",
                    filter=Q(guests__status__in=PHYSICAL_PRESENCE_STATUSES),
                    distinct=True,
                ),
                confirmed_count=Count(
                    "guests",
                    filter=Q(guests__status__in=CONFIRMED_ATTENDANCE_STATUSES),
                    distinct=True,
                ),
            )
        if user.role not in ["system_manager"]:
            if user.role == User.Role.PLATFORM_ADMIN:
                platform = get_platform_for_user(user)
                if platform:
                    qs = qs.filter(platform_id=platform.id)
                else:
                    qs = qs.none()
            elif user.role == User.Role.STAFF:
                event_ids = staff_assigned_event_ids(user)
                if event_ids:
                    qs = qs.filter(id__in=event_ids)
                else:
                    qs = qs.none()
            else:
                qs = qs.filter(
                    models.Q(created_by=user) | models.Q(managers=user)
                ).distinct()

        platform_id = self.request.query_params.get("platform")
        if platform_id:
            qs = qs.filter(platform_id=platform_id)

        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)

        return qs.order_by("-created_at", "-id")

    def get_serializer_class(self):
        if self.action == "list":
            return EventListSerializer
        if self.action in ("create", "update", "partial_update"):
            return EventCreateSerializer
        return EventDetailSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        user = self.request.user
        if user.role == User.Role.PLATFORM_ADMIN:
            context["platform"] = get_platform_for_user(user)
        return context

    def list(self, request, *args, **kwargs):
        from apps.platforms.member_profile import _guest_stats_bulk

        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        objects = page if page is not None else list(queryset)
        stats_map = _guest_stats_bulk([obj.id for obj in objects])
        serializer = self.get_serializer(
            objects,
            many=True,
            context={**self.get_serializer_context(), "guest_stats_map": stats_map},
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def perform_create(self, serializer):
        user = self.request.user
        extra = {"created_by": user}
        if user.role == User.Role.PLATFORM_ADMIN:
            platform = get_platform_for_user(user)
            if platform:
                extra["platform"] = platform
        if not serializer.validated_data.get("status"):
            extra["status"] = Event.Status.DRAFT
        event = serializer.save(**extra)
        invalidate_platform_event_caches(event.platform_id)
        from apps.platforms.notification_service import notify_event_created

        notify_event_created(event, actor=user)

    def perform_update(self, serializer):
        event = serializer.save()
        invalidate_platform_event_caches(event.platform_id)

    def perform_destroy(self, instance):
        platform_id = instance.platform_id
        instance.delete()
        invalidate_platform_event_caches(platform_id)

    @action(
        detail=True,
        methods=["get"],
        url_path="cover",
        permission_classes=[AllowAny],
        authentication_classes=[],
    )
    def cover(self, request, pk=None):
        """عرض غلاف المناسبة من التخزين عبر API بغض النظر عن إعدادات /media."""
        event = Event.objects.only("cover_image", "updated_at").filter(pk=pk).first()
        if not event or not event.cover_image:
            raise Http404("صورة المناسبة غير موجودة")
        try:
            file_handle = event.cover_image.open("rb")
        except (FileNotFoundError, OSError, ValueError):
            raise Http404("ملف صورة المناسبة غير موجود") from None

        content_type = (
            mimetypes.guess_type(event.cover_image.name)[0]
            or "application/octet-stream"
        )
        response = FileResponse(file_handle, content_type=content_type)
        response["Cache-Control"] = "public, max-age=86400, immutable"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    @action(detail=False, methods=["get"], url_path="overview")
    def overview(self, request):
        platform_id = request.query_params.get("platform")
        pid = int(platform_id) if platform_id else None
        return Response(events_overview(pid, request))

    @action(detail=True, methods=["get"], url_path="groups-overview")
    def groups_overview(self, request, pk=None):
        event = self.get_object()
        event = Event.objects.prefetch_related("sections", "groups").get(pk=event.pk)
        return Response(build_groups_overview(event))

    @action(detail=True, methods=["get"], url_path="seating-overview")
    def seating_overview(self, request, pk=None):
        event = self.get_object()
        return Response(build_seating_overview(event))

    @action(detail=True, methods=["get"], url_path="export-groups-guests")
    def export_groups_guests(self, request, pk=None):
        event = self.get_object()
        csv_content = build_groups_guests_csv(event)
        response = HttpResponse(csv_content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="event-{event.id}-groups-guests.csv"'
        )
        return response

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        """بدء تشغيل الفعالية — تصبح «تعمل الآن»."""
        event = self.get_object()
        require_event_access(request.user, event)
        if request.user.role not in (
            User.Role.EVENT_MANAGER,
            User.Role.EVENT_ORGANIZER,
            User.Role.PLATFORM_ADMIN,
            User.Role.SYSTEM_MANAGER,
        ):
            raise PermissionDenied("غير مصرح — بدء الفعالية لمدير الفعالية فقط")
        start_event(event)
        event.refresh_from_db()
        from apps.platforms.notification_service import notify_event_started

        notify_event_started(event, actor=request.user)
        return Response(EventDetailSerializer(event, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="end")
    def end(self, request, pk=None):
        """إنهاء الفعالية — تصبح «منتهية»."""
        event = self.get_object()
        require_event_access(request.user, event)
        if request.user.role not in (
            User.Role.EVENT_MANAGER,
            User.Role.EVENT_ORGANIZER,
            User.Role.PLATFORM_ADMIN,
            User.Role.SYSTEM_MANAGER,
        ):
            raise PermissionDenied("غير مصرح — إنهاء الفعالية لمدير الفعالية فقط")
        end_event(event)
        event.refresh_from_db()
        from apps.platforms.notification_service import notify_event_ended

        notify_event_ended(event, actor=request.user)
        return Response(EventDetailSerializer(event, context={"request": request}).data)

    @action(detail=True, methods=["get", "patch"], url_path="live-media")
    def live_media(self, request, pk=None):
        """عرض/تحديث إعدادات البث الصوتي أو المرئي للضيوف."""
        event = self.get_object()
        self._require_live_media_access(request, event)

        if request.method == "GET":
            if event.live_media_enabled:
                ensure_broadcast_token(event)
                event.refresh_from_db()
            return Response(build_live_media_payload(event, request, include_broadcast_url=True))

        enabled = request.data.get("enabled")
        mode = request.data.get("mode")
        youtube_url = request.data.get("youtube_url")
        audio_file = request.FILES.get("audio_file")

        update_fields: list[str] = []

        if enabled is not None:
            event.live_media_enabled = str(enabled).lower() in ("1", "true", "yes", "on")
            update_fields.append("live_media_enabled")

        if mode is not None:
            mode = str(mode).strip()
            valid = {choice.value for choice in LiveMediaMode}
            if mode not in valid:
                raise ValidationError({"mode": "نوع البث غير صالح"})
            event.live_media_mode = mode
            update_fields.append("live_media_mode")
            if mode not in STREAM_MODES:
                event.live_stream_active = False
                update_fields.append("live_stream_active")

        if youtube_url is not None:
            event.live_youtube_url = str(youtube_url).strip()[:500]
            update_fields.append("live_youtube_url")
            if event.live_youtube_url and not youtube_embed_url(event.live_youtube_url):
                raise ValidationError({"youtube_url": "رابط يوتيوب غير صالح"})

        if audio_file:
            event.live_audio_file = audio_file
            update_fields.append("live_audio_file")

        if not update_fields:
            return Response(
                {"detail": "لا توجد حقول للتحديث"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event.save(update_fields=list(set(update_fields)))
        ensure_broadcast_token(event)
        event.refresh_from_db()
        return Response(build_live_media_payload(event, request, include_broadcast_url=True))

    @action(detail=True, methods=["post"], url_path="live-media/stream-start")
    def live_media_stream_start(self, request, pk=None):
        """بدء البث المباشر من الميكروفون أو الكاميرا."""
        event = self.get_object()
        self._require_live_media_access(request, event)

        if event.live_media_mode not in STREAM_MODES:
            return Response(
                {"detail": "فعّل وضع الميكروفون أو الكاميرا أولاً"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not event.live_media_enabled:
            return Response(
                {"detail": "فعّل البث للضيوف أولاً"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event.live_stream_active = True
        event.save(update_fields=["live_stream_active"])
        return Response(build_live_media_payload(event, request))

    @action(detail=True, methods=["post"], url_path="live-media/stream-chunk")
    def live_media_stream_chunk(self, request, pk=None):
        """استقبال مقطع بث (كل ~3 ثوانٍ) من المتصفح."""
        event = self.get_object()
        self._require_live_media_access(request, event)

        if not event.live_stream_active:
            return Response(
                {"detail": "البث غير نشط — ابدأ البث أولاً"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if event.live_media_mode not in STREAM_MODES:
            return Response(
                {"detail": "وضع البث الحالي لا يدعم المقاطع المباشرة"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        chunk = request.FILES.get("chunk")
        if not chunk:
            return Response(
                {"detail": "المقطع مطلوب"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if event.live_stream_file:
            event.live_stream_file.delete(save=False)
        event.live_stream_file.save(f"event-{event.id}-live.webm", chunk, save=False)
        event.live_stream_rev = (event.live_stream_rev or 0) + 1
        event.save(update_fields=["live_stream_file", "live_stream_rev"])
        return Response(build_live_media_payload(event, request))

    @action(detail=True, methods=["post"], url_path="live-media/stream-stop")
    def live_media_stream_stop(self, request, pk=None):
        """إيقاف البث المباشر."""
        event = self.get_object()
        self._require_live_media_access(request, event)

        event.live_stream_active = False
        event.save(update_fields=["live_stream_active"])
        return Response(build_live_media_payload(event, request))

    @action(detail=True, methods=["post"], url_path="live-media/send-link")
    def live_media_send_link(self, request, pk=None):
        """إرسال رابط البث العام لجميع الضيوف الحاضرين أو الجالسين."""
        event = self.get_object()
        self._require_live_media_access(request, event)
        result = send_broadcast_link_to_present_guests(event, request.user)
        if not result.get("ok"):
            return Response({"detail": result.get("detail")}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)


class SectionViewSet(viewsets.ModelViewSet):
    serializer_class = SectionSerializer
    filterset_fields = ["event"]

    def get_queryset(self):
        user = self.request.user
        qs = Section.objects.select_related("event")
        if user.role == User.Role.SYSTEM_MANAGER:
            return qs
        if user.role == User.Role.PLATFORM_ADMIN:
            platform = get_platform_for_user(user)
            if platform:
                return qs.filter(event__platform_id=platform.id)
            return qs.none()
        if user.role in (
            User.Role.EVENT_MANAGER,
            User.Role.EVENT_ORGANIZER,
            User.Role.STAFF,
        ):
            return qs.filter(
                models.Q(event__created_by=user) | models.Q(event__managers=user)
            ).distinct()
        return qs.none()

    def _require_section_manager(self, event: Event) -> None:
        """الأقسام والمجموعات يُديرها مدير الفعالية فقط."""
        if self.request.user.role != User.Role.EVENT_MANAGER:
            raise PermissionDenied("إضافة وتعديل الأقسام يقتصر على مدير الفعالية")
        require_event_access(self.request.user, event)

    def perform_create(self, serializer):
        event = serializer.validated_data["event"]
        self._require_section_manager(event)
        serializer.save()
        from apps.platforms.notification_service import maybe_notify_preparation_complete

        maybe_notify_preparation_complete(event)

    def perform_update(self, serializer):
        event = serializer.instance.event
        self._require_section_manager(event)
        serializer.save()
        from apps.platforms.notification_service import maybe_notify_preparation_complete

        maybe_notify_preparation_complete(event)

    def perform_destroy(self, instance):
        self._require_section_manager(instance.event)
        instance.delete()


class ScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = ScheduleSerializer
    filterset_fields = ["event"]

    def get_queryset(self):
        user = self.request.user
        qs = Schedule.objects.select_related("event")
        if user.role == User.Role.SYSTEM_MANAGER:
            return qs
        if user.role == User.Role.PLATFORM_ADMIN:
            platform = get_platform_for_user(user)
            if platform:
                return qs.filter(event__platform_id=platform.id)
            return qs.none()
        if user.role in (
            User.Role.EVENT_MANAGER,
            User.Role.EVENT_ORGANIZER,
            User.Role.STAFF,
        ):
            return qs.filter(
                models.Q(event__created_by=user) | models.Q(event__managers=user)
            ).distinct()
        return qs.none()

    def _require_schedule_manager(self, event: Event) -> None:
        if self.request.user.role != User.Role.EVENT_MANAGER:
            raise PermissionDenied("إضافة وتعديل الجدول الزمني يقتصر على مدير الفعالية")
        require_event_access(self.request.user, event)

    def perform_create(self, serializer):
        event = serializer.validated_data["event"]
        self._require_schedule_manager(event)
        serializer.save()
        from apps.platforms.notification_service import maybe_notify_preparation_complete

        maybe_notify_preparation_complete(event)

    def perform_update(self, serializer):
        event = serializer.instance.event
        self._require_schedule_manager(event)
        serializer.save()
        from apps.platforms.notification_service import maybe_notify_preparation_complete

        maybe_notify_preparation_complete(event)

    def perform_destroy(self, instance):
        self._require_schedule_manager(instance.event)
        instance.delete()


class GroupViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSerializer
    filterset_fields = ["event"]

    def get_queryset(self):
        user = self.request.user
        qs = Group.objects.select_related("event")
        if user.role == User.Role.SYSTEM_MANAGER:
            return qs
        if user.role == User.Role.PLATFORM_ADMIN:
            platform = get_platform_for_user(user)
            if platform:
                return qs.filter(event__platform_id=platform.id)
            return qs.none()
        if user.role in (
            User.Role.EVENT_MANAGER,
            User.Role.EVENT_ORGANIZER,
            User.Role.STAFF,
        ):
            return qs.filter(
                models.Q(event__created_by=user) | models.Q(event__managers=user)
            ).distinct()
        return qs.none()

    def _require_group_manager(self, event: Event) -> None:
        if self.request.user.role != User.Role.EVENT_MANAGER:
            raise PermissionDenied("إضافة وتعديل المجموعات يقتصر على مدير الفعالية")
        require_event_access(self.request.user, event)

    def perform_create(self, serializer):
        event = serializer.validated_data["event"]
        self._require_group_manager(event)
        serializer.save()
        from apps.platforms.notification_service import maybe_notify_preparation_complete

        maybe_notify_preparation_complete(event)

    def perform_update(self, serializer):
        event = serializer.instance.event
        self._require_group_manager(event)
        serializer.save()
        from apps.platforms.notification_service import maybe_notify_preparation_complete

        maybe_notify_preparation_complete(event)

    def perform_destroy(self, instance):
        self._require_group_manager(instance.event)
        instance.delete()

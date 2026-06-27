from django.db import models
from django.db.models import Count, Prefetch, Q
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import User
from apps.guests.models import Guest
from apps.platforms.platform_permissions import (
    get_platform_for_user,
    require_event_access,
)

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


class EventViewSet(viewsets.ModelViewSet):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ["status", "platform"]
    search_fields = ["title", "venue", "description", "platform__name"]
    ordering_fields = ["date", "title", "created_at"]

    def get_queryset(self):
        user = self.request.user
        qs = Event.objects.select_related("platform", "created_by")

        if self.action == "list":
            qs = qs.annotate(
                sections_count=Count("sections", distinct=True),
                guests_count=Count("guests", distinct=True),
                attended_count=Count(
                    "guests",
                    filter=Q(guests__status=Guest.Status.ATTENDED),
                    distinct=True,
                ),
                confirmed_count=Count(
                    "guests",
                    filter=Q(guests__status__in=[Guest.Status.CONFIRMED, Guest.Status.ATTENDED]),
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
                    filter=Q(guests__status=Guest.Status.ATTENDED),
                    distinct=True,
                ),
                confirmed_count=Count(
                    "guests",
                    filter=Q(guests__status__in=[Guest.Status.CONFIRMED, Guest.Status.ATTENDED]),
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
                # المنسق ومدير الدخول يعملان على مستوى كامل فعاليات منصتهم
                platform = get_platform_for_user(user)
                if platform:
                    qs = qs.filter(platform_id=platform.id)
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

        return qs

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

    def perform_create(self, serializer):
        user = self.request.user
        extra = {"created_by": user}
        if user.role == User.Role.PLATFORM_ADMIN:
            platform = get_platform_for_user(user)
            if platform:
                extra["platform"] = platform
        if not serializer.validated_data.get("status"):
            extra["status"] = Event.Status.DRAFT
        serializer.save(**extra)

    @action(detail=False, methods=["get"], url_path="overview")
    def overview(self, request):
        platform_id = request.query_params.get("platform")
        pid = int(platform_id) if platform_id else None
        return Response(events_overview(pid))

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

    def perform_update(self, serializer):
        event = serializer.instance.event
        self._require_section_manager(event)
        serializer.save()

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

    def perform_update(self, serializer):
        event = serializer.instance.event
        self._require_schedule_manager(event)
        serializer.save()

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

    def perform_update(self, serializer):
        self._require_group_manager(serializer.instance.event)
        serializer.save()

    def perform_destroy(self, instance):
        self._require_group_manager(instance.event)
        instance.delete()

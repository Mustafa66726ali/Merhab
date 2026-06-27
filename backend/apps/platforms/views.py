from datetime import datetime
from io import BytesIO

from django.db.models import Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import User

from .event_manager_events import build_event_manager_events_dashboard
from .event_manager_sections import build_event_manager_sections_dashboard
from .event_manager_overview import build_event_manager_overview
from .event_manager_team import (
    build_event_manager_staff_list,
    build_event_manager_team_list,
    get_event_manager_staff_row,
)
from .member_context import (
    get_event_manager_context,
    get_event_organizer_context,
    membership_payload,
)
from .analytics import (
    cached_platform_overview_payload,
    compute_kpis,
    compute_kpi_cards,
    event_growth_summary,
    rsvp_charts,
    recent_activities,
)
from .staff_preview import (
    platform_staff_preview,
    platform_staff_list,
    all_platforms_staff_list,
    platform_team_list,
    user_platform_event_participation,
    get_platform_member_row,
)
from .member_profile import (
    build_member_profile,
    list_managed_events,
    list_member_messages,
    list_member_qr_scans,
)
from .member_profile_export import export_member_pdf, export_member_xlsx
from .platform_settings_serializers import PlatformMySettingsSerializer
from .platform_events import build_platform_events_dashboard
from apps.reports.platform_analytics import build_platform_reports_dashboard
from .comms_serializers import DirectMessageSerializer, UserNotificationSerializer
from .team_actions import (
    apply_platform_member_profile,
    get_active_platform_for_admin,
    get_platform_member,
    remove_team_member,
)
from .platform_permissions import get_platform_permissions
from .team_serializers import (
    ADD_ROLE_OPTIONS,
    FILTER_ROLE_OPTIONS,
    STATUS_FILTER_OPTIONS,
    PERMISSION_OPTIONS,
    ACCOUNT_STATUS_LABELS,
    USER_ROLE_MAP,
    parse_bool,
    PlatformTeamMemberCreateSerializer,
    PlatformTeamMemberUpdateSerializer,
    PlatformTeamPermissionToggleSerializer,
    PERMISSION_FIELD_MAP,
)
from .models import Platform, PlatformMember, DirectMessage, UserNotification
from .serializers import (
    PlatformSerializer,
    PlatformCreateSerializer,
    PlatformUpdateSerializer,
)


class PlatformPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 1000


class PlatformViewSet(viewsets.ModelViewSet):
    filterset_fields = ["status"]
    search_fields = ["name", "owner__email", "owner__first_name", "owner__last_name"]
    ordering_fields = ["created_at", "name", "status"]
    pagination_class = PlatformPagination

    def get_queryset(self):
        qs = Platform.objects.select_related("owner").annotate(
            events_count=Count("events", distinct=True),
            members_count=Count("members", distinct=True),
        )
        created_date = self.request.query_params.get("created_date")
        if created_date:
            try:
                day = datetime.strptime(created_date, "%Y-%m-%d").date()
                qs = qs.filter(created_at__date=day)
            except ValueError:
                pass
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return PlatformCreateSerializer
        if self.action in ("update", "partial_update"):
            return PlatformUpdateSerializer
        return PlatformSerializer

    @action(detail=True, methods=["get"], url_path="overview")
    def overview(self, request, pk=None):
        platform = self.get_object()
        serializer = PlatformSerializer(platform, context={"request": request})
        data = serializer.data
        return Response({
            "platform": data,
            "kpis": compute_kpis(platform.id),
            "recent_activities": recent_activities(platform.id),
            "rsvp_charts": rsvp_charts(platform.id),
            "staff_preview": platform_staff_preview(platform.id, 10),
        })

    @action(detail=True, methods=["get"], url_path="staff")
    def staff(self, request, pk=None):
        platform = self.get_object()
        data = platform_staff_list(platform.id)
        return Response({
            "platform": PlatformSerializer(platform, context={"request": request}).data,
            "staff": data["staff"],
            "stats": data["stats"],
            "role_options": data["role_options"],
        })

    @action(detail=False, methods=["get"], url_path="all-staff")
    def all_staff(self, request):
        data = all_platforms_staff_list()
        return Response({
            "staff": data["staff"],
            "stats": data["stats"],
            "role_options": data["role_options"],
            "platform_options": data["platform_options"],
        })

    @action(detail=False, methods=["get"], url_path="system-overview")
    def system_overview(self, request):
        return Response({
            "kpis": compute_kpis(None),
            "recent_activities": recent_activities(None, limit=8),
            "rsvp_charts": rsvp_charts(None),
        })

    @action(detail=False, methods=["get"], url_path="my-overview")
    def my_overview(self, request):
        if request.user.role != User.Role.PLATFORM_ADMIN:
            return Response(
                {"detail": "غير مصرح"},
                status=status.HTTP_403_FORBIDDEN,
            )
        platform = Platform.objects.filter(owner=request.user).first()
        if not platform:
            return Response(
                {"detail": "لا توجد منصة مرتبطة بهذا الحساب"},
                status=status.HTTP_404_NOT_FOUND,
            )
        if platform.status != Platform.Status.ACTIVE:
            return Response(
                {"detail": "منصتك محظورة أو غير نشطة"},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PlatformSerializer(platform, context={"request": request})
        overview = cached_platform_overview_payload(platform.id)
        return Response({
            "platform": serializer.data,
            **overview,
            "staff_preview": platform_staff_preview(platform.id, 10),
        })

    @action(detail=False, methods=["get"], url_path="my-member-overview")
    def my_member_overview(self, request):
        if request.user.role != User.Role.EVENT_MANAGER:
            return Response(
                {"detail": "غير مصرح"},
                status=status.HTTP_403_FORBIDDEN,
            )
        ctx = get_event_manager_context(request.user)
        if not ctx:
            return Response(
                {"detail": "لا توجد منصة نشطة مرتبطة بحسابك"},
                status=status.HTTP_404_NOT_FOUND,
            )
        platform, pm = ctx
        serializer = PlatformSerializer(platform, context={"request": request})
        overview = build_event_manager_overview(request.user.id, platform.id)
        return Response({
            "platform": serializer.data,
            "membership": membership_payload(pm),
            **overview,
        })

    @action(detail=False, methods=["get"], url_path="my-organizer-overview")
    def my_organizer_overview(self, request):
        """نظرة عامة للوحة منظم الفعالية — بنفس بنية لوحة مدير الفعالية
        لكن مع تحديد البيانات على فعاليات المنظّم فقط."""
        if request.user.role != User.Role.EVENT_ORGANIZER:
            return Response(
                {"detail": "غير مصرح"},
                status=status.HTTP_403_FORBIDDEN,
            )
        ctx = get_event_organizer_context(request.user)
        if not ctx:
            return Response(
                {"detail": "لا توجد منصة نشطة مرتبطة بحسابك"},
                status=status.HTTP_404_NOT_FOUND,
            )
        platform, pm = ctx
        serializer = PlatformSerializer(platform, context={"request": request})
        overview = build_event_manager_overview(request.user.id, platform.id)
        return Response({
            "platform": serializer.data,
            "membership": membership_payload(pm),
            **overview,
        })

    @action(detail=False, methods=["get"], url_path="my-managed-events")
    def my_managed_events(self, request):
        if request.user.role != User.Role.EVENT_MANAGER:
            return Response(
                {"detail": "غير مصرح"},
                status=status.HTTP_403_FORBIDDEN,
            )
        ctx = get_event_manager_context(request.user)
        if not ctx:
            return Response(
                {"detail": "لا توجد منصة نشطة مرتبطة بحسابك"},
                status=status.HTTP_404_NOT_FOUND,
            )
        platform, _ = ctx
        status_filter = request.query_params.get("status")
        rows, total = list_managed_events(
            request.user.id,
            platform.id,
            status=status_filter,
            date_from=request.query_params.get("date_from"),
            date_to=request.query_params.get("date_to"),
        )
        return Response({"total": total, "events": rows})

    @action(detail=False, methods=["get"], url_path="my-member-events")
    def my_member_events(self, request):
        if request.user.role != User.Role.EVENT_MANAGER:
            return Response(
                {"detail": "غير مصرح"},
                status=status.HTTP_403_FORBIDDEN,
            )
        ctx = get_event_manager_context(request.user)
        if not ctx:
            return Response(
                {"detail": "لا توجد منصة نشطة مرتبطة بحسابك"},
                status=status.HTTP_404_NOT_FOUND,
            )
        platform, _ = ctx
        return Response(
            build_event_manager_events_dashboard(
                request.user.id, platform.id, platform.name
            )
        )

    @action(detail=False, methods=["get"], url_path="my-member-sections")
    def my_member_sections(self, request):
        if request.user.role != User.Role.EVENT_MANAGER:
            return Response(
                {"detail": "غير مصرح"},
                status=status.HTTP_403_FORBIDDEN,
            )
        ctx = get_event_manager_context(request.user)
        if not ctx:
            return Response(
                {"detail": "لا توجد منصة نشطة مرتبطة بحسابك"},
                status=status.HTTP_404_NOT_FOUND,
            )
        platform, _ = ctx
        return Response(build_event_manager_sections_dashboard(request.user.id, platform.id))

    @action(detail=False, methods=["get"], url_path="my-organizer-events")
    def my_organizer_events(self, request):
        if request.user.role != User.Role.EVENT_ORGANIZER:
            return Response(
                {"detail": "غير مصرح"},
                status=status.HTTP_403_FORBIDDEN,
            )
        ctx = get_event_organizer_context(request.user)
        if not ctx:
            return Response(
                {"detail": "لا توجد منصة نشطة مرتبطة بحسابك"},
                status=status.HTTP_404_NOT_FOUND,
            )
        platform, _ = ctx
        return Response(
            build_event_manager_events_dashboard(
                request.user.id, platform.id, platform.name
            )
        )

    @action(detail=False, methods=["get"], url_path="my-member-team")
    def my_member_team(self, request):
        if request.user.role != User.Role.EVENT_MANAGER:
            return Response(
                {"detail": "غير مصرح"},
                status=status.HTTP_403_FORBIDDEN,
            )
        ctx = get_event_manager_context(request.user)
        if not ctx:
            return Response(
                {"detail": "لا توجد منصة نشطة مرتبطة بحسابك"},
                status=status.HTTP_404_NOT_FOUND,
            )
        platform, _ = ctx
        return Response(build_event_manager_team_list(platform.id))

    # ===== إدارة الطاقم التشغيلي (منسق/مدير دخول) لمدير الفعالية =====

    EM_STAFF_ROLE_OPTIONS = [
        {"value": "coordinator", "label": "منسق (رجال/نساء)"},
        {"value": "entry_manager", "label": "مدير دخول"},
    ]

    def _event_manager_platform(self, request):
        """منصة مدير الفعالية النشطة أو None."""
        if request.user.role != User.Role.EVENT_MANAGER:
            return None
        ctx = get_event_manager_context(request.user)
        return ctx[0] if ctx else None

    @action(detail=False, methods=["get"], url_path="my-staff-team")
    def my_staff_team(self, request):
        """قائمة المنسقين ومدراء الدخول الذين يديرهم مدير الفعالية."""
        platform = self._event_manager_platform(request)
        if not platform:
            return Response(
                {"detail": "لا توجد منصة نشطة مرتبطة بحسابك"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response({
            "assignable_roles": self.EM_STAFF_ROLE_OPTIONS,
            "permission_options": PERMISSION_OPTIONS,
            **build_event_manager_staff_list(platform.id),
        })

    @action(detail=False, methods=["post"], url_path="my-staff-team/add")
    def my_staff_team_add(self, request):
        """إنشاء حساب منسق أو مدير دخول مرتبط بمنصة مدير الفعالية."""
        platform = self._event_manager_platform(request)
        if not platform:
            return Response(
                {"detail": "لا توجد منصة نشطة مرتبطة بحسابك"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PlatformTeamMemberCreateSerializer(
            data=self._parse_member_payload(request)
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data["role_key"] not in ("coordinator", "entry_manager"):
            return Response(
                {"role_key": "يمكنك إنشاء حسابات المنسق ومدير الدخول فقط"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.create_user(
            username=data["email"],
            email=data["email"],
            first_name=(data.get("first_name") or "").strip(),
            last_name=(data.get("last_name") or "").strip(),
            password=data["password"],
            role=User.Role.STAFF,
        )
        apply_platform_member_profile(
            platform,
            user,
            data["role_key"],
            data.get("coordinator_label", ""),
            # المسح صلاحية أساسية لكلا الدورين، والمنسق يجلس الضيوف
            perm_scan_qr=True,
            perm_edit_guests=data.get("perm_edit_guests", False),
            perm_send_messages=data.get("perm_send_messages", False),
        )

        row = get_event_manager_staff_row(platform.id, user.id)
        return Response(row, status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=["delete"],
        url_path=r"my-staff-team/(?P<user_id>[0-9]+)/remove",
    )
    def my_staff_team_remove(self, request, user_id=None):
        """إزالة حساب منسق/مدير دخول من منصة مدير الفعالية."""
        platform = self._event_manager_platform(request)
        if not platform:
            return Response(
                {"detail": "لا توجد منصة نشطة مرتبطة بحسابك"},
                status=status.HTTP_403_FORBIDDEN,
            )
        row = get_event_manager_staff_row(platform.id, int(user_id))
        if not row:
            return Response(
                {"detail": "العضو غير موجود ضمن طاقمك"},
                status=status.HTTP_404_NOT_FOUND,
            )
        user = get_object_or_404(User, pk=user_id)
        remove_team_member(platform, user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="my-reports")
    def my_reports(self, request):
        if request.user.role != User.Role.PLATFORM_ADMIN:
            return Response(
                {"detail": "غير مصرح"},
                status=status.HTTP_403_FORBIDDEN,
            )
        platform = Platform.objects.filter(owner=request.user).first()
        if not platform:
            return Response(
                {"detail": "لا توجد منصة مرتبطة بهذا الحساب"},
                status=status.HTTP_404_NOT_FOUND,
            )
        if platform.status != Platform.Status.ACTIVE:
            return Response(
                {"detail": "منصتك محظورة أو غير نشطة"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(build_platform_reports_dashboard(platform.id, platform.name))

    @action(detail=False, methods=["get"], url_path="my-events")
    def my_events(self, request):
        platform = get_active_platform_for_admin(request.user)
        if not platform:
            return Response(
                {"detail": "غير مصرح أو لا توجد منصة نشطة"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(
            build_platform_events_dashboard(platform.id, platform.name)
        )

    @action(
        detail=False,
        methods=["get", "patch"],
        url_path="my-settings",
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def my_settings(self, request):
        platform = get_active_platform_for_admin(request.user)
        if not platform:
            return Response(
                {"detail": "غير مصرح أو لا توجد منصة نشطة"},
                status=status.HTTP_403_FORBIDDEN,
            )
        platform = Platform.objects.select_related("owner").get(pk=platform.id)
        if request.method == "GET":
            return Response(
                PlatformMySettingsSerializer(
                    platform,
                    context={"request": request},
                ).data
            )
        serializer = PlatformMySettingsSerializer(
            platform,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            PlatformMySettingsSerializer(
                platform,
                context={"request": request},
            ).data
        )

    @action(detail=False, methods=["get"], url_path="my-staff")
    def my_staff(self, request):
        if request.user.role != User.Role.PLATFORM_ADMIN:
            return Response(
                {"detail": "غير مصرح"},
                status=status.HTTP_403_FORBIDDEN,
            )
        platform = Platform.objects.filter(owner=request.user).first()
        if not platform:
            return Response(
                {"detail": "لا توجد منصة مرتبطة بهذا الحساب"},
                status=status.HTTP_404_NOT_FOUND,
            )
        if platform.status != Platform.Status.ACTIVE:
            return Response(
                {"detail": "منصتك محظورة أو غير نشطة"},
                status=status.HTTP_403_FORBIDDEN,
            )
        data = platform_team_list(platform.id)
        serializer = PlatformSerializer(platform, context={"request": request})
        return Response({
            "platform": serializer.data,
            "assignable_roles": ADD_ROLE_OPTIONS,
            "filter_roles": FILTER_ROLE_OPTIONS,
            "status_options": STATUS_FILTER_OPTIONS,
            "permission_options": PERMISSION_OPTIONS,
            **data,
        })

    @action(detail=False, methods=["get"], url_path="my-permissions")
    def my_permissions(self, request):
        perms = get_platform_permissions(request.user)
        return Response({
            "permissions": perms,
            "perm_scan_qr": perms["perm_scan_qr"],
            "perm_edit_guests": perms["perm_edit_guests"],
            "perm_send_messages": perms["perm_send_messages"],
        })

    def _parse_member_payload(self, request) -> dict:
        payload = request.data.copy()
        for field in ("perm_scan_qr", "perm_edit_guests", "perm_send_messages"):
            if field in request.data:
                payload[field] = parse_bool(request.data.get(field))
        return payload

    def _staff_row_for_user(self, platform_id: int, user_id: int) -> dict | None:
        return get_platform_member_row(platform_id, user_id)

    @action(detail=False, methods=["post"], url_path="my-staff/add")
    def my_staff_add(self, request):
        platform = get_active_platform_for_admin(request.user)
        if not platform:
            return Response(
                {"detail": "غير مصرح أو لا توجد منصة نشطة"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PlatformTeamMemberCreateSerializer(data=self._parse_member_payload(request))
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        role = USER_ROLE_MAP[data["role_key"]]

        user = User.objects.create_user(
            username=data["email"],
            email=data["email"],
            first_name=(data.get("first_name") or "").strip(),
            last_name=(data.get("last_name") or "").strip(),
            password=data["password"],
            role=role,
        )
        apply_platform_member_profile(
            platform,
            user,
            data["role_key"],
            data.get("coordinator_label", ""),
            data.get("perm_scan_qr", False),
            data.get("perm_edit_guests", False),
            data.get("perm_send_messages", False),
        )

        avatar = request.FILES.get("avatar")
        if avatar:
            user.avatar = avatar
            user.save(update_fields=["avatar"])

        row = self._staff_row_for_user(platform.id, user.id)
        return Response(row, status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=["get"],
        url_path=r"my-staff/(?P<user_id>[0-9]+)/detail",
    )
    def my_staff_detail(self, request, user_id=None):
        platform = get_active_platform_for_admin(request.user)
        if not platform:
            return Response(
                {"detail": "غير مصرح أو لا توجد منصة نشطة"},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = get_object_or_404(User, pk=user_id)
        row = self._staff_row_for_user(platform.id, user.id)
        if not row:
            return Response(
                {"detail": "المستخدم غير مرتبط بمنصتك"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response({
            **row,
            "phone": user.phone,
            "is_active": user.is_active,
            "account_status": user.account_status,
            "status_label": ACCOUNT_STATUS_LABELS.get(user.account_status, "نشط"),
            "first_name": user.first_name,
            "last_name": user.last_name,
            "participated_events": user_platform_event_participation(
                user.id, platform.id
            ),
        })

    @action(
        detail=False,
        methods=["patch"],
        url_path=r"my-staff/(?P<user_id>[0-9]+)/update",
    )
    def my_staff_update(self, request, user_id=None):
        platform = get_active_platform_for_admin(request.user)
        if not platform:
            return Response(
                {"detail": "غير مصرح أو لا توجد منصة نشطة"},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = get_object_or_404(User, pk=user_id)
        if platform.owner_id == user.id:
            return Response(
                {"detail": "لا يمكن تعديل مالك المنصة"},
                status=status.HTTP_403_FORBIDDEN,
            )

        row = self._staff_row_for_user(platform.id, user.id)
        if not row:
            return Response(
                {"detail": "المستخدم غير مرتبط بمنصتك"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PlatformTeamMemberUpdateSerializer(
            data=self._parse_member_payload(request),
            partial=True,
            context={"user": user},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if "first_name" in data:
            user.first_name = (data["first_name"] or "").strip()
        if "last_name" in data:
            user.last_name = (data["last_name"] or "").strip()
        if "email" in data:
            user.email = data["email"]
            user.username = data["email"]
        if "role_key" in data:
            user.role = USER_ROLE_MAP[data["role_key"]]
        if "account_status" in data:
            user.account_status = data["account_status"]
        if data.get("password"):
            user.set_password(data["password"])

        avatar = request.FILES.get("avatar")
        if avatar:
            user.avatar = avatar

        user.save()

        pm = get_platform_member(platform, user.id)
        role_key = data.get("role_key") or (pm.member_role if pm else "event_manager")
        coordinator_label = data.get("coordinator_label", pm.coordinator_label if pm else "")
        apply_platform_member_profile(
            platform,
            user,
            role_key,
            coordinator_label,
            data.get("perm_scan_qr", pm.perm_scan_qr if pm else False),
            data.get("perm_edit_guests", pm.perm_edit_guests if pm else False),
            data.get("perm_send_messages", pm.perm_send_messages if pm else False),
        )

        updated = self._staff_row_for_user(platform.id, user.id)
        return Response(updated)

    @action(
        detail=False,
        methods=["patch"],
        url_path=r"my-staff/(?P<user_id>[0-9]+)/permission",
    )
    def my_staff_toggle_permission(self, request, user_id=None):
        platform = get_active_platform_for_admin(request.user)
        if not platform:
            return Response(
                {"detail": "غير مصرح أو لا توجد منصة نشطة"},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = get_object_or_404(User, pk=user_id)
        if platform.owner_id == user.id:
            return Response(
                {"detail": "لا يمكن تعديل مالك المنصة"},
                status=status.HTTP_403_FORBIDDEN,
            )

        pm = get_platform_member(platform, user.id)
        if not pm:
            return Response(
                {"detail": "المستخدم غير مرتبط بمنصتك"},
                status=status.HTTP_404_NOT_FOUND,
            )

        payload = request.data.copy()
        if "enabled" in request.data:
            payload["enabled"] = parse_bool(request.data.get("enabled"))
        serializer = PlatformTeamPermissionToggleSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        field = PERMISSION_FIELD_MAP[data["permission"]]
        setattr(pm, field, data["enabled"])
        pm.save(update_fields=[field])

        row = self._staff_row_for_user(platform.id, user.id)
        return Response(row)

    @action(
        detail=False,
        methods=["delete"],
        url_path=r"my-staff/(?P<user_id>[0-9]+)/remove",
    )
    def my_staff_remove(self, request, user_id=None):
        platform = get_active_platform_for_admin(request.user)
        if not platform:
            return Response(
                {"detail": "غير مصرح أو لا توجد منصة نشطة"},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = get_object_or_404(User, pk=user_id)
        if platform.owner_id == user.id:
            return Response(
                {"detail": "لا يمكن حذف مالك المنصة"},
                status=status.HTTP_403_FORBIDDEN,
            )

        row = self._staff_row_for_user(platform.id, user.id)
        if not row:
            return Response(
                {"detail": "المستخدم غير مرتبط بمنصتك"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            remove_team_member(platform, user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

        return Response(status=status.HTTP_204_NO_CONTENT)

    def _member_context(self, request, user_id: int) -> tuple | Response:
        platform = get_active_platform_for_admin(request.user)
        if not platform:
            return Response(
                {"detail": "غير مصرح أو لا توجد منصة نشطة"},
                status=status.HTTP_403_FORBIDDEN,
            )
        user = get_object_or_404(User, pk=user_id)
        row = self._staff_row_for_user(platform.id, user.id)
        if not row:
            return Response(
                {"detail": "المستخدم غير مرتبط بمنصتك"},
                status=status.HTTP_404_NOT_FOUND,
            )
        row["platform_id"] = platform.id
        return platform, user, row

    def _filter_params(self, request) -> dict:
        return {
            "event_id": request.query_params.get("event_id") or request.query_params.get("event"),
            "date_from": request.query_params.get("date_from"),
            "date_to": request.query_params.get("date_to"),
            "time_from": request.query_params.get("time_from"),
            "time_to": request.query_params.get("time_to"),
            "status": request.query_params.get("status"),
        }

    @action(
        detail=False,
        methods=["get"],
        url_path=r"my-staff/(?P<user_id>[0-9]+)/profile",
    )
    def my_staff_profile(self, request, user_id=None):
        ctx = self._member_context(request, int(user_id))
        if isinstance(ctx, Response):
            return ctx
        platform, user, row = ctx
        profile = build_member_profile(user.id, platform.id, row["role_key"])
        return Response({
            "member": {
                **row,
                "phone": user.phone,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
            **profile,
        })

    @action(
        detail=False,
        methods=["get"],
        url_path=r"my-staff/(?P<user_id>[0-9]+)/messages",
    )
    def my_staff_messages(self, request, user_id=None):
        ctx = self._member_context(request, int(user_id))
        if isinstance(ctx, Response):
            return ctx
        platform, user, row = ctx
        if not build_member_profile(user.id, platform.id, row["role_key"])["sections"]["show_messages"]:
            return Response({"detail": "غير متاح لهذا الدور"}, status=status.HTTP_403_FORBIDDEN)
        params = self._filter_params(request)
        rows, total = list_member_messages(
            user.id,
            platform.id,
            event_id=params["event_id"],
            date_from=params["date_from"],
            date_to=params["date_to"],
            time_from=params["time_from"],
            time_to=params["time_to"],
        )
        return Response({"total": total, "messages": rows})

    @action(
        detail=False,
        methods=["get"],
        url_path=r"my-staff/(?P<user_id>[0-9]+)/qr-scans",
    )
    def my_staff_qr_scans(self, request, user_id=None):
        ctx = self._member_context(request, int(user_id))
        if isinstance(ctx, Response):
            return ctx
        platform, user, row = ctx
        if not build_member_profile(user.id, platform.id, row["role_key"])["sections"]["show_qr_scans"]:
            return Response({"detail": "غير متاح لهذا الدور"}, status=status.HTTP_403_FORBIDDEN)
        params = self._filter_params(request)
        rows, total = list_member_qr_scans(
            user.id,
            platform.id,
            event_id=params["event_id"],
            date_from=params["date_from"],
            date_to=params["date_to"],
            time_from=params["time_from"],
            time_to=params["time_to"],
        )
        return Response({"total": total, "qr_scans": rows})

    @action(
        detail=False,
        methods=["get"],
        url_path=r"my-staff/(?P<user_id>[0-9]+)/managed-events",
    )
    def my_staff_managed_events(self, request, user_id=None):
        ctx = self._member_context(request, int(user_id))
        if isinstance(ctx, Response):
            return ctx
        platform, user, row = ctx
        if not build_member_profile(user.id, platform.id, row["role_key"])["sections"]["show_managed_events"]:
            return Response({"detail": "غير متاح لهذا الدور"}, status=status.HTTP_403_FORBIDDEN)
        params = self._filter_params(request)
        rows, total = list_managed_events(
            user.id,
            platform.id,
            status=params["status"],
            date_from=params["date_from"],
            date_to=params["date_to"],
        )
        return Response({"total": total, "events": rows})

    @action(
        detail=False,
        methods=["get"],
        url_path=r"my-staff/(?P<user_id>[0-9]+)/export",
    )
    def my_staff_export(self, request, user_id=None):
        ctx = self._member_context(request, int(user_id))
        if isinstance(ctx, Response):
            return ctx
        platform, user, row = ctx
        profile = build_member_profile(user.id, platform.id, row["role_key"])
        fmt = (request.query_params.get("format") or "xlsx").lower()
        safe_name = (row.get("name") or "member").replace(" ", "_")

        if fmt == "pdf":
            try:
                content = export_member_pdf(row, profile)
            except RuntimeError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            response = HttpResponse(content, content_type="application/pdf")
            response["Content-Disposition"] = f"attachment; filename={safe_name}_report.pdf"
            return response

        try:
            content = export_member_xlsx(row, profile)
        except ImportError:
            return Response(
                {"detail": "مكتبة openpyxl غير مثبتة"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        response = HttpResponse(
            content,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f"attachment; filename={safe_name}_report.xlsx"
        return response

    @action(detail=True, methods=["post"], url_path="send-message")
    def send_message(self, request, pk=None):
        platform = self.get_object()
        body = (request.data.get("body") or "").strip()
        subject = (request.data.get("subject") or "رسالة من مدير النظام").strip()
        if not body:
            return Response({"detail": "محتوى الرسالة مطلوب"}, status=status.HTTP_400_BAD_REQUEST)
        msg = DirectMessage.objects.create(
            sender=request.user,
            recipient=platform.owner,
            platform=platform,
            subject=subject,
            body=body,
        )
        return Response(
            DirectMessageSerializer(msg, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="send-notification")
    def send_notification(self, request, pk=None):
        platform = self.get_object()
        title = (request.data.get("title") or "إشعار من مدير النظام").strip()
        body = (request.data.get("body") or "").strip()
        if not body:
            return Response({"detail": "محتوى الإشعار مطلوب"}, status=status.HTTP_400_BAD_REQUEST)
        notif = UserNotification.objects.create(
            user=platform.owner,
            sender=request.user,
            platform=platform,
            title=title,
            body=body,
        )
        return Response(UserNotificationSerializer(notif).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = self.get_queryset()
        total = qs.count()
        blocked = qs.filter(status=Platform.Status.BLOCKED).count()
        most_active = qs.order_by("-events_count", "-members_count").first()
        least_active = qs.order_by("events_count", "members_count").first()

        def pack(p):
            if not p:
                return None
            return {
                "id": p.id,
                "name": p.name,
                "events_count": p.events_count,
                "members_count": p.members_count,
            }

        return Response({
            "total": total,
            "blocked": blocked,
            "most_active": pack(most_active),
            "least_active": pack(least_active),
        })

    @action(detail=False, methods=["get"])
    def export(self, request):
        try:
            from openpyxl import Workbook
        except ImportError:
            return Response(
                {"detail": "مكتبة openpyxl غير مثبتة"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        qs = self.filter_queryset(self.get_queryset())
        wb = Workbook()
        ws = wb.active
        ws.title = "المنصات"
        headers = [
            "ID",
            "اسم المنصة",
            "اسم المالك",
            "بريد المالك",
            "إجمالي الفعاليات",
            "إجمالي الأعضاء",
            "الحالة",
            "تاريخ الإنشاء",
        ]
        ws.append(headers)

        for p in qs:
            owner_name = p.owner.get_full_name().strip() or p.owner.email
            ws.append([
                p.id,
                p.name,
                owner_name,
                p.owner.email,
                p.events_count,
                p.members_count,
                p.get_status_display(),
                timezone.localtime(p.created_at).strftime("%Y-%m-%d %H:%M"),
            ])

        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = "attachment; filename=platforms_export.xlsx"
        return response

"""قائمة فريق المنصة لمدير الفعالية — منظمين ومنسقين فقط."""

from apps.accounts.models import User
from apps.events.models import Event
from apps.platforms.models import PlatformMember
from apps.platforms.staff_preview import coordinator_role_label, member_role_label
from apps.staff.models import StaffMember

# الأدوار التي يديرها مدير الفعالية مباشرة (إنشاء حسابات تشغيلية)
EM_MANAGEABLE_ROLES = (
    PlatformMember.MemberRole.COORDINATOR,
    PlatformMember.MemberRole.ENTRY_MANAGER,
)


def _staff_row(pm: PlatformMember) -> dict:
    user = pm.user
    name = user.get_full_name().strip() or user.email
    return {
        "id": user.id,
        "name": name,
        "email": user.email,
        "role_key": pm.member_role,
        "role_label": member_role_label(pm.member_role, pm.coordinator_label),
        "coordinator_label": pm.coordinator_label or "",
        "perm_scan_qr": pm.perm_scan_qr,
        "perm_edit_guests": pm.perm_edit_guests,
        "perm_send_messages": pm.perm_send_messages,
        "account_status": user.account_status,
        "is_active": user.is_active,
        "avatar_initial": (name[0] if name else "?").upper(),
    }


def build_event_manager_staff_list(platform_id: int) -> dict:
    """المنسقون ومدراء الدخول على المنصة (حسابات تشغيلية لمدير الفعالية)."""
    members = (
        PlatformMember.objects.filter(
            platform_id=platform_id,
            member_role__in=EM_MANAGEABLE_ROLES,
        )
        .select_related("user")
        .order_by("user__first_name", "user__email")
    )
    rows = [_staff_row(pm) for pm in members]
    coordinators = sum(
        1 for r in rows if r["role_key"] == PlatformMember.MemberRole.COORDINATOR
    )
    entry_managers = sum(
        1 for r in rows if r["role_key"] == PlatformMember.MemberRole.ENTRY_MANAGER
    )
    return {
        "staff": rows,
        "stats": {
            "total": len(rows),
            "coordinators": coordinators,
            "entry_managers": entry_managers,
        },
    }


def get_event_manager_staff_row(platform_id: int, user_id: int) -> dict | None:
    pm = (
        PlatformMember.objects.filter(
            platform_id=platform_id,
            user_id=user_id,
            member_role__in=EM_MANAGEABLE_ROLES,
        )
        .select_related("user")
        .first()
    )
    return _staff_row(pm) if pm else None


def build_event_manager_team_list(platform_id: int) -> dict:
    """
    صفوف فريق الفعاليات على المنصة:
    - منظم فعالية (من event.managers + PlatformMember/event_organizer)
    - منسق (من StaffMember coordinator) مع نوع المنسق من PlatformMember
    """
    pm_by_user = {
        pm.user_id: pm
        for pm in PlatformMember.objects.filter(platform_id=platform_id).select_related("user")
    }

    events = (
        Event.objects.filter(platform_id=platform_id)
        .prefetch_related("managers", "staff_members__user")
        .order_by("-date", "title")
    )

    rows: list[dict] = []
    seen: set[tuple[int, int, str]] = set()

    def append_row(user: User, event: Event, role_key: str, role_label: str) -> None:
        key = (user.id, event.id, role_key)
        if key in seen:
            return
        seen.add(key)
        name = user.get_full_name().strip() or user.email
        rows.append({
            "id": user.id,
            "name": name,
            "email": user.email,
            "event_id": event.id,
            "event_title": event.title,
            "role_key": role_key,
            "role_label": role_label,
            "avatar_initial": (name[0] if name else "?").upper(),
        })

    for event in events:
        for user in event.managers.all():
            pm = pm_by_user.get(user.id)
            is_organizer = (
                user.role == User.Role.EVENT_ORGANIZER
                or (pm and pm.member_role == PlatformMember.MemberRole.EVENT_ORGANIZER)
            )
            if is_organizer:
                append_row(
                    user,
                    event,
                    "event_organizer",
                    member_role_label(
                        PlatformMember.MemberRole.EVENT_ORGANIZER,
                        pm.coordinator_label if pm else "",
                    ),
                )

        for sm in event.staff_members.filter(is_active=True):
            if sm.role != StaffMember.Role.COORDINATOR:
                continue
            user = sm.user
            pm = pm_by_user.get(user.id)
            coord_extra = (pm.coordinator_label or "").strip() if pm else ""
            if not coord_extra and pm and pm.member_role == PlatformMember.MemberRole.COORDINATOR:
                coord_extra = ""
            role_label = coordinator_role_label(coord_extra)
            append_row(user, event, "coordinator", role_label)

    organizers = sum(1 for r in rows if r["role_key"] == "event_organizer")
    coordinators = sum(1 for r in rows if r["role_key"] == "coordinator")

    return {
        "team": rows,
        "stats": {
            "total": len(rows),
            "organizers": organizers,
            "coordinators": coordinators,
        },
    }

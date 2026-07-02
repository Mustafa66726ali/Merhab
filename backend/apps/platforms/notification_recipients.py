"""تحديد المستلمين للإشعارات حسب الدور والفعالية."""

from __future__ import annotations

from apps.accounts.models import User
from apps.events.models import Event
from apps.platforms.models import Platform, PlatformMember
from apps.platforms.platform_permissions import user_can_access_event
from apps.staff.models import StaffMember


def _unique_users(users: list[User]) -> list[User]:
    seen: set[int] = set()
    result: list[User] = []
    for user in users:
        if not user or not user.is_active or user.id in seen:
            continue
        seen.add(user.id)
        result.append(user)
    return result


def platform_admins(platform: Platform | None) -> list[User]:
    if not platform:
        return []
    users: list[User] = []
    if platform.owner_id and platform.owner.is_active:
        users.append(platform.owner)
    users.extend(
        User.objects.filter(
            is_active=True,
            platform_memberships__platform=platform,
            role=User.Role.PLATFORM_ADMIN,
        )
    )
    return _unique_users(users)


def event_managers(event: Event) -> list[User]:
    if not event.platform_id:
        return _unique_users(list(event.managers.all()))
    role_map = {
        pm.user_id: pm.member_role
        for pm in PlatformMember.objects.filter(
            platform_id=event.platform_id,
            user_id__in=event.managers.values_list("id", flat=True),
        )
    }
    managers = [
        user
        for user in event.managers.filter(is_active=True)
        if role_map.get(user.id) == PlatformMember.MemberRole.EVENT_MANAGER
    ]
    if managers:
        return _unique_users(managers)
    return _unique_users(list(event.managers.filter(is_active=True)))


def event_organizers(event: Event) -> list[User]:
    if not event.platform_id:
        return []
    role_map = {
        pm.user_id: pm.member_role
        for pm in PlatformMember.objects.filter(
            platform_id=event.platform_id,
            user_id__in=event.managers.values_list("id", flat=True),
        )
    }
    return _unique_users(
        [
            user
            for user in event.managers.filter(is_active=True)
            if role_map.get(user.id) == PlatformMember.MemberRole.EVENT_ORGANIZER
        ]
    )


def event_operational_team(event: Event) -> list[User]:
    return _unique_users(event_managers(event) + event_organizers(event))


def staff_on_event(event: Event, roles: tuple[str, ...] | None = None) -> list[User]:
    qs = StaffMember.objects.filter(event=event, is_active=True).select_related("user")
    if roles:
        qs = qs.filter(role__in=roles)
    return _unique_users([sm.user for sm in qs if sm.user.is_active])


def event_stakeholders(event: Event) -> list[User]:
    """مدراء + منظمون + طاقم الفعالية + مالك المنصة."""
    users = event_operational_team(event)
    users.extend(staff_on_event(event))
    if event.platform_id:
        users.extend(platform_admins(event.platform))
    return _unique_users(users)


def users_with_event_access(event: Event) -> list[User]:
    """كل المستخدمين الذين يمكنهم الوصول للفعالية."""
    candidates: list[User] = []
    if event.platform_id:
        candidates.extend(
            User.objects.filter(
                is_active=True,
                platform_memberships__platform_id=event.platform_id,
                role__in=(
                    User.Role.PLATFORM_ADMIN,
                    User.Role.EVENT_MANAGER,
                    User.Role.EVENT_ORGANIZER,
                ),
            )
        )
    candidates.extend(event.managers.filter(is_active=True))
    candidates.extend(staff_on_event(event))
    return _unique_users([u for u in candidates if user_can_access_event(u, event)])


def action_path_for(user: User, event: Event | None, suffix: str = "") -> str:
    """مسار الواجهة المناسب لدور المستخدم."""
    event_id = event.id if event else 0
    base = {
        User.Role.SYSTEM_MANAGER: f"/platforms",
        User.Role.PLATFORM_ADMIN: f"/platform/events/{event_id}" if event_id else "/platform/dashboard",
        User.Role.EVENT_MANAGER: f"/event-manager/events/{event_id}" if event_id else "/event-manager/dashboard",
        User.Role.EVENT_ORGANIZER: f"/event-organizer/dashboard",
        User.Role.STAFF: "/coordinator/check-in",
    }.get(user.role, "/dashboard")
    if suffix:
        return f"{base.rstrip('/')}/{suffix.lstrip('/')}" if event_id else base
    return base


def staff_action_path(user: User, event: Event, staff_role: str) -> str:
    if staff_role == StaffMember.Role.ENTRY_MANAGER:
        return "/entry-manager/check-in"
    if staff_role == StaffMember.Role.COORDINATOR:
        return "/coordinator/seating"
    return action_path_for(user, event)

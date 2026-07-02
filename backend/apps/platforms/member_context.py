"""سياق مدير الفعالية والعضو في المنصة."""

from apps.accounts.models import User
from apps.platforms.models import Platform, PlatformMember
from apps.platforms.staff_preview import member_role_label


def get_platform_member_for_user(user: User) -> tuple[Platform, PlatformMember] | None:
    """منصة وعضوية المستخدم (مدير فعالية / منظم / طاقم)."""
    if user.role not in (
        User.Role.EVENT_MANAGER,
        User.Role.EVENT_ORGANIZER,
        User.Role.STAFF,
    ):
        return None
    pm = (
        PlatformMember.objects.select_related("platform")
        .filter(user=user, platform__status=Platform.Status.ACTIVE)
        .first()
    )
    if not pm or not pm.platform:
        return None
    return pm.platform, pm


def get_event_organizer_context(user: User) -> tuple[Platform, PlatformMember] | None:
    """منظم فعالية نشط مرتبط بمنصة."""
    if user.role != User.Role.EVENT_ORGANIZER:
        return None
    pm = (
        PlatformMember.objects.select_related("platform")
        .filter(
            user=user,
            member_role=PlatformMember.MemberRole.EVENT_ORGANIZER,
            platform__status=Platform.Status.ACTIVE,
        )
        .first()
    )
    if not pm:
        pm = (
            PlatformMember.objects.select_related("platform")
            .filter(user=user, platform__status=Platform.Status.ACTIVE)
            .first()
        )
    if not pm or not pm.platform:
        return None
    return pm.platform, pm


def get_event_manager_context(user: User) -> tuple[Platform, PlatformMember] | None:
    """مدير فعالية نشط مرتبط بمنصة."""
    if user.role != User.Role.EVENT_MANAGER:
        return None
    pm = (
        PlatformMember.objects.select_related("platform")
        .filter(
            user=user,
            member_role=PlatformMember.MemberRole.EVENT_MANAGER,
            platform__status=Platform.Status.ACTIVE,
        )
        .first()
    )
    if not pm:
        pm = (
            PlatformMember.objects.select_related("platform")
            .filter(user=user, platform__status=Platform.Status.ACTIVE)
            .first()
        )
    if not pm or not pm.platform:
        return None
    return pm.platform, pm


def membership_payload(pm: PlatformMember) -> dict:
    from apps.platforms.platform_permissions import staff_assigned_event_ids

    payload = {
        "id": pm.id,
        "member_role": pm.member_role,
        "role_label": member_role_label(pm.member_role, pm.coordinator_label),
        "perm_scan_qr": pm.perm_scan_qr,
        "perm_edit_guests": pm.perm_edit_guests,
        "perm_send_messages": pm.perm_send_messages,
        "coordinator_label": pm.coordinator_label or "",
    }
    if pm.user.role == User.Role.STAFF:
        payload["assigned_event_ids"] = staff_assigned_event_ids(pm.user)
    return payload

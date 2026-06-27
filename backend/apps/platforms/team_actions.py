from apps.accounts.models import User
from apps.events.models import Event
from apps.platforms.models import Platform, PlatformMember
from apps.staff.models import StaffMember


def get_active_platform_for_admin(user: User) -> Platform | None:
    if user.role != User.Role.PLATFORM_ADMIN:
        return None
    platform = Platform.objects.filter(owner=user).first()
    if not platform or platform.status != Platform.Status.ACTIVE:
        return None
    return platform


def member_role_label(member_role: str, coordinator_label: str = "") -> str:
    from apps.platforms.staff_preview import member_role_label as _label
    return _label(member_role, coordinator_label)


def apply_platform_member_profile(
    platform: Platform,
    user: User,
    role_key: str,
    coordinator_label: str = "",
    perm_scan_qr: bool = False,
    perm_edit_guests: bool = False,
    perm_send_messages: bool = False,
) -> PlatformMember:
    pm, _ = PlatformMember.objects.get_or_create(platform=platform, user=user)
    pm.member_role = role_key
    pm.coordinator_label = (
        coordinator_label.strip()
        if role_key == PlatformMember.MemberRole.COORDINATOR
        else ""
    )
    pm.perm_scan_qr = perm_scan_qr
    pm.perm_edit_guests = perm_edit_guests
    pm.perm_send_messages = perm_send_messages
    pm.save()
    return pm


def get_platform_member(platform: Platform, user_id: int) -> PlatformMember | None:
    return PlatformMember.objects.filter(platform=platform, user_id=user_id).first()


def remove_team_member(platform: Platform, user: User) -> None:
    if platform.owner_id == user.id:
        raise ValueError("لا يمكن إزالة مالك المنصة")

    PlatformMember.objects.filter(platform=platform, user=user).delete()

    for event in Event.objects.filter(platform_id=platform.id):
        event.managers.remove(user)

    event_ids = Event.objects.filter(platform_id=platform.id).values_list("id", flat=True)
    if event_ids:
        StaffMember.objects.filter(event_id__in=event_ids, user=user).delete()

    user.account_status = User.AccountStatus.INACTIVE
    user.save(update_fields=["account_status", "is_active"])

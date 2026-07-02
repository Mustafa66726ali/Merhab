from apps.accounts.models import User
from apps.events.models import Event
from apps.platforms.models import Platform, PlatformMember
from apps.staff.models import StaffMember


def staff_role_for_member(pm: PlatformMember) -> str | None:
    if pm.member_role == PlatformMember.MemberRole.COORDINATOR:
        return StaffMember.Role.COORDINATOR
    if pm.member_role == PlatformMember.MemberRole.ENTRY_MANAGER:
        return StaffMember.Role.ENTRY_MANAGER
    return None


def assign_staff_to_event(platform: Platform, user: User, event_id: int) -> StaffMember:
    """تعيين منسق/مدير دخول على فعالية محددة."""
    pm = PlatformMember.objects.filter(platform=platform, user=user).first()
    if not pm:
        raise ValueError("المستخدم ليس عضواً في منصتك")
    staff_role = staff_role_for_member(pm)
    if not staff_role:
        raise ValueError("يمكن تعيين المنسقين ومدراء الدخول فقط")

    event = Event.objects.filter(pk=event_id, platform_id=platform.id).first()
    if not event:
        raise ValueError("الفعالية غير موجودة على منصتك")

    sm, _ = StaffMember.objects.update_or_create(
        event=event,
        user=user,
        defaults={"role": staff_role, "is_active": True},
    )
    return sm


def unassign_staff_from_event(platform: Platform, user: User, event_id: int) -> None:
    event = Event.objects.filter(pk=event_id, platform_id=platform.id).first()
    if not event:
        raise ValueError("الفعالية غير موجودة على منصتك")
    StaffMember.objects.filter(event=event, user=user).delete()


def assigned_events_for_users(platform_id: int, user_ids: list[int]) -> dict[int, list[dict]]:
    """{user_id: [{id, title}, ...]}"""
    if not user_ids:
        return {}
    rows: dict[int, list[dict]] = {uid: [] for uid in user_ids}
    qs = (
        StaffMember.objects.filter(
            event__platform_id=platform_id,
            user_id__in=user_ids,
            is_active=True,
            role__in=(StaffMember.Role.COORDINATOR, StaffMember.Role.ENTRY_MANAGER),
        )
        .select_related("event")
        .order_by("event__date", "event__title")
    )
    for sm in qs:
        rows.setdefault(sm.user_id, []).append(
            {"id": sm.event_id, "title": sm.event.title}
        )
    return rows


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

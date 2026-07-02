"""صلاحيات أعضاء المنصة — تخزين على PlatformMember وتطبيق في API."""

from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import User
from apps.events.models import Event
from apps.platforms.models import Platform, PlatformMember
from apps.staff.models import StaffMember

PERM_SCAN_QR = "perm_scan_qr"
PERM_EDIT_GUESTS = "perm_edit_guests"
PERM_SEND_MESSAGES = "perm_send_messages"

ALL_PERMS = (PERM_SCAN_QR, PERM_EDIT_GUESTS, PERM_SEND_MESSAGES)


def _full_permissions() -> dict[str, bool]:
    return {key: True for key in ALL_PERMS}


def _empty_permissions() -> dict[str, bool]:
    return {key: False for key in ALL_PERMS}


def get_platform_for_user(user: User) -> Platform | None:
    if user.role == User.Role.PLATFORM_ADMIN:
        return Platform.objects.filter(owner=user).first()
    membership = (
        PlatformMember.objects.filter(user=user).select_related("platform").first()
    )
    return membership.platform if membership else None


def get_platform_member(user: User, platform: Platform | None = None) -> PlatformMember | None:
    platform = platform or get_platform_for_user(user)
    if not platform or platform.owner_id == user.id:
        return None
    return PlatformMember.objects.filter(platform=platform, user=user).first()


def is_platform_coordinator(user: User) -> bool:
    """منسق (رجال/نساء) — عضو منصة بدور منسق (حساب طاقم العمل)."""
    if user.role != User.Role.STAFF:
        return False
    return PlatformMember.objects.filter(
        user=user,
        member_role=PlatformMember.MemberRole.COORDINATOR,
    ).exists()


def is_platform_entry_manager(user: User) -> bool:
    """مدير الدخول — عضو منصة بدور مدير دخول (حساب طاقم العمل)."""
    if user.role != User.Role.STAFF:
        return False
    return PlatformMember.objects.filter(
        user=user,
        member_role=PlatformMember.MemberRole.ENTRY_MANAGER,
    ).exists()


def staff_assigned_event_ids(user: User) -> list[int]:
    """معرّفات الفعاليات التي عُيِّن فيها المستخدم كطاقم تشغيلي."""
    return list(
        StaffMember.objects.filter(user=user, is_active=True).values_list(
            "event_id", flat=True
        )
    )


def user_assigned_to_event(user: User, event: Event) -> bool:
    """هل المستخدم (طاقم) معيّن نشطاً على هذه الفعالية؟"""
    if user.role != User.Role.STAFF:
        return True
    return StaffMember.objects.filter(
        event_id=event.id, user=user, is_active=True
    ).exists()


def require_staff_event_assignment(
    user: User,
    event: Event,
    message: str = "غير مصرح — لم تُعيَّن لهذه الفعالية بعد",
) -> None:
    if user.role != User.Role.STAFF:
        return
    if user_assigned_to_event(user, event):
        return
    raise PermissionDenied(message)


def get_platform_permissions(user: User) -> dict[str, bool]:
    if user.role == User.Role.SYSTEM_MANAGER:
        return _full_permissions()

    platform = get_platform_for_user(user)
    if not platform:
        return _empty_permissions()

    if platform.owner_id == user.id:
        return _full_permissions()

    member = get_platform_member(user, platform)
    if not member:
        return _empty_permissions()

    return {
        PERM_SCAN_QR: member.perm_scan_qr,
        PERM_EDIT_GUESTS: member.perm_edit_guests,
        PERM_SEND_MESSAGES: member.perm_send_messages,
    }


def has_platform_permission(user: User, permission_field: str) -> bool:
    return get_platform_permissions(user).get(permission_field, False)


def require_platform_permission(
    user: User,
    permission_field: str,
    message: str = "غير مصرح — لا تملك هذه الصلاحية",
) -> None:
    if has_platform_permission(user, permission_field):
        return
    raise PermissionDenied(message)


def user_can_access_event(user: User, event: Event) -> bool:
    if not event or not event.platform_id:
        return False
    if user.role == User.Role.SYSTEM_MANAGER:
        return True

    platform = event.platform
    if platform.owner_id == user.id:
        return True

    if user.role == User.Role.STAFF:
        if not PlatformMember.objects.filter(platform_id=platform.id, user=user).exists():
            return False
        return StaffMember.objects.filter(
            event_id=event.id, user=user, is_active=True
        ).exists()

    if PlatformMember.objects.filter(platform_id=platform.id, user=user).exists():
        return True

    if event.created_by_id == user.id:
        return True

    if event.managers.filter(id=user.id).exists():
        return True

    return False


def require_event_access(user: User, event: Event) -> None:
    if user_can_access_event(user, event):
        return
    raise PermissionDenied("غير مصرح للوصول إلى فعاليات هذه المنصة")


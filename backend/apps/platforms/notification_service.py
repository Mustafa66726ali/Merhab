"""خدمة إشعارات النظام — مركزية حسب الدور والفعالية."""

from __future__ import annotations

from apps.accounts.models import User
from apps.events.models import Event
from apps.platforms.models import Platform, UserNotification
from apps.platforms.notification_recipients import (
    action_path_for,
    event_managers,
    event_operational_team,
    event_stakeholders,
    platform_admins,
    staff_action_path,
    staff_on_event,
    users_with_event_access,
)
from apps.platforms.platform_events import _completion_meta
from apps.staff.models import StaffMember


class Kind:
    SYSTEM = "system"
    EVENT_CREATED = "event_created"
    EVENT_STARTED = "event_started"
    EVENT_ENDED = "event_ended"
    PREPARATION_COMPLETE = "preparation_complete"
    RSVP_STARTED = "rsvp_started"
    RSVP_CONFIRMED = "rsvp_confirmed"
    RSVP_DECLINED = "rsvp_declined"
    CHECKIN_STARTED = "checkin_started"
    GUEST_CHECKED_IN = "guest_checked_in"
    SEATING_STARTED = "seating_started"
    SEATING_FULL = "seating_full"
    TEAM_ASSIGNED = "team_assigned"
    DIRECT_MESSAGE = "direct_message"


KIND_ICONS = {
    Kind.SYSTEM: "campaign",
    Kind.EVENT_CREATED: "event",
    Kind.EVENT_STARTED: "play_circle",
    Kind.EVENT_ENDED: "stop_circle",
    Kind.PREPARATION_COMPLETE: "task_alt",
    Kind.RSVP_STARTED: "how_to_reg",
    Kind.RSVP_CONFIRMED: "check_circle",
    Kind.RSVP_DECLINED: "cancel",
    Kind.CHECKIN_STARTED: "qr_code_scanner",
    Kind.GUEST_CHECKED_IN: "person_check",
    Kind.SEATING_STARTED: "event_seat",
    Kind.SEATING_FULL: "chair_alt",
    Kind.TEAM_ASSIGNED: "groups",
    Kind.DIRECT_MESSAGE: "mail",
}


def notify_users(
    users: list[User],
    *,
    kind: str,
    title: str,
    body: str,
    platform: Platform | None = None,
    event: Event | None = None,
    sender: User | None = None,
    action_path: str | None = None,
    per_user_paths: dict[int, str] | None = None,
) -> list[UserNotification]:
    icon = KIND_ICONS.get(kind, "notifications")
    created: list[UserNotification] = []
    seen: set[int] = set()
    for user in users:
        if not user or not user.is_active or user.id in seen:
            continue
        seen.add(user.id)
        path = (per_user_paths or {}).get(user.id)
        if not path:
            path = action_path or (action_path_for(user, event) if event else "")
        created.append(
            UserNotification.objects.create(
                user=user,
                sender=sender,
                platform=platform or (event.platform if event and event.platform_id else None),
                event=event,
                kind=kind,
                title=title,
                body=body,
                action_path=path,
                icon=icon,
            )
        )
    return created


def _notify_event_once(
    event: Event,
    kind: str,
    title: str,
    body: str,
    users: list[User],
    sender: User | None = None,
) -> list[UserNotification]:
    if UserNotification.objects.filter(event=event, kind=kind).exists():
        return []
    per_user_paths = {u.id: action_path_for(u, event) for u in users}
    return notify_users(
        users,
        kind=kind,
        title=title,
        body=body,
        event=event,
        sender=sender,
        per_user_paths=per_user_paths,
    )


def notify_event_created(event: Event, actor: User | None = None) -> list[UserNotification]:
    title = "فعالية جديدة"
    body = f"تم إنشاء المناسبة «{event.title}»"
    users = platform_admins(event.platform) + event_managers(event)
    if event.created_by_id:
        users = [u for u in users if u.id != event.created_by_id]
    per_user_paths = {u.id: action_path_for(u, event) for u in users}
    return notify_users(
        users,
        kind=Kind.EVENT_CREATED,
        title=title,
        body=body,
        event=event,
        sender=actor,
        per_user_paths=per_user_paths,
    )


def notify_event_started(event: Event, actor: User | None = None) -> list[UserNotification]:
    return _notify_event_once(
        event,
        Kind.EVENT_STARTED,
        "بدء تشغيل الفعالية",
        f"المناسبة «{event.title}» تعمل الآن — يمكن تسجيل الحضور والإجلاس.",
        event_stakeholders(event),
        sender=actor,
    )


def notify_event_ended(event: Event, actor: User | None = None) -> list[UserNotification]:
    return _notify_event_once(
        event,
        Kind.EVENT_ENDED,
        "انتهاء الفعالية",
        f"المناسبة «{event.title}» انتهت بنجاح.",
        event_stakeholders(event),
        sender=actor,
    )


def maybe_notify_preparation_complete(event: Event) -> list[UserNotification]:
    meta = _completion_meta(event)
    if meta["completion_percent"] < 100:
        return []
    return _notify_event_once(
        event,
        Kind.PREPARATION_COMPLETE,
        "اكتمال التجهيزات",
        f"اكتملت تحضيرات «{event.title}» بنسبة 100% — جاهزة للتشغيل.",
        event_operational_team(event),
    )


def notify_rsvp_response(event: Event, guest_name: str, confirmed: bool) -> list[UserNotification]:
    from apps.guests.models import Guest

    kind = Kind.RSVP_CONFIRMED if confirmed else Kind.RSVP_DECLINED
    title = "تأكيد حضور ضيف" if confirmed else "اعتذار ضيف"
    body = f"{'أكّد' if confirmed else 'اعتذر'} الضيف «{guest_name}» عن حضور «{event.title}»"

    created: list[UserNotification] = []
    if confirmed and not UserNotification.objects.filter(event=event, kind=Kind.RSVP_STARTED).exists():
        if Guest.objects.filter(event=event, status=Guest.Status.CONFIRMED).count() == 1:
            created.extend(
                _notify_event_once(
                    event,
                    Kind.RSVP_STARTED,
                    "بدء تأكيدات الحضور",
                    f"بدأ الضيوف بتأكيد الحضور لمناسبة «{event.title}».",
                    event_operational_team(event),
                )
            )

    per_user_paths = {u.id: action_path_for(u, event, "guests") for u in event_operational_team(event)}
    created.extend(
        notify_users(
            event_operational_team(event),
            kind=kind,
            title=title,
            body=body,
            event=event,
            per_user_paths=per_user_paths,
        )
    )
    return created


def notify_guest_checked_in(event: Event, guest_name: str, actor: User | None = None) -> list[UserNotification]:
    from apps.guests.models import Guest

    created: list[UserNotification] = []
    if not UserNotification.objects.filter(event=event, kind=Kind.CHECKIN_STARTED).exists():
        if Guest.objects.filter(event=event, status=Guest.Status.ATTENDED).count() == 1:
            created.extend(
                _notify_event_once(
                    event,
                    Kind.CHECKIN_STARTED,
                    "بدء تسجيل الحضور",
                    f"بدأ تسجيل حضور الضيوف في «{event.title}».",
                    event_operational_team(event) + staff_on_event(event, (StaffMember.Role.ENTRY_MANAGER,)),
                    sender=actor,
                )
            )

    per_user_paths = {u.id: action_path_for(u, event) for u in event_operational_team(event)}
    created.extend(
        notify_users(
            event_operational_team(event),
            kind=Kind.GUEST_CHECKED_IN,
            title="تسجيل حضور ضيف",
            body=f"حضر الضيف «{guest_name}» إلى «{event.title}».",
            event=event,
            sender=actor,
            per_user_paths=per_user_paths,
        )
    )
    return created


def notify_guest_seated(event: Event, guest_name: str, actor: User | None = None) -> list[UserNotification]:
    from apps.guests.models import Guest
    from apps.tables.models import TableSeat

    created: list[UserNotification] = []
    coordinators = staff_on_event(event, (StaffMember.Role.COORDINATOR,))
    managers = event_operational_team(event)

    if not UserNotification.objects.filter(event=event, kind=Kind.SEATING_STARTED).exists():
        if Guest.objects.filter(event=event, status=Guest.Status.SEATED).count() >= 1:
            paths = {u.id: staff_action_path(u, event, StaffMember.Role.COORDINATOR) for u in coordinators}
            paths.update({u.id: action_path_for(u, event, "seating") for u in managers})
            created.extend(
                notify_users(
                    coordinators + managers,
                    kind=Kind.SEATING_STARTED,
                    title="بدء إجلاس الضيوف",
                    body=f"بدأ إجلاس الضيوف في «{event.title}».",
                    event=event,
                    sender=actor,
                    per_user_paths=paths,
                )
            )

    total = TableSeat.objects.filter(table__event=event).count()
    filled = TableSeat.objects.filter(table__event=event, guest__isnull=False).count()
    if total > 0 and filled >= total:
        if not UserNotification.objects.filter(event=event, kind=Kind.SEATING_FULL).exists():
            paths = {u.id: staff_action_path(u, event, StaffMember.Role.COORDINATOR) for u in coordinators}
            paths.update({u.id: action_path_for(u, event, "seating") for u in managers})
            created.extend(
                notify_users(
                    coordinators + managers,
                    kind=Kind.SEATING_FULL,
                    title="اكتمال الإجلاس",
                    body=f"امتلأت جميع المقاعد في «{event.title}» ({filled}/{total}).",
                    event=event,
                    sender=actor,
                    per_user_paths=paths,
                )
            )
    return created


def notify_team_assigned(event: Event, member_name: str, staff_role: str, user: User) -> list[UserNotification]:
    role_label = dict(StaffMember.Role.choices).get(staff_role, staff_role)
    return notify_users(
        [user],
        kind=Kind.TEAM_ASSIGNED,
        title="تعيين على فعالية",
        body=f"تم تعيينك كـ{role_label} على «{event.title}».",
        event=event,
        action_path=staff_action_path(user, event, staff_role),
    )


def notify_direct_message(recipient: User, sender: User, subject: str, body: str, platform: Platform | None) -> UserNotification | None:
    if not recipient.is_active:
        return None
    path = {
        User.Role.SYSTEM_MANAGER: "/messages",
        User.Role.PLATFORM_ADMIN: "/platform/messages",
        User.Role.EVENT_MANAGER: "/event-manager/messages",
        User.Role.EVENT_ORGANIZER: "/event-organizer/messages",
    }.get(recipient.role, "/messages")
    items = notify_users(
        [recipient],
        kind=Kind.DIRECT_MESSAGE,
        title=subject or "رسالة جديدة",
        body=body[:500],
        platform=platform,
        sender=sender,
        action_path=path,
    )
    return items[0] if items else None


def notify_system_broadcast(
    recipient: User,
    title: str,
    body: str,
    platform: Platform | None,
    sender: User | None,
) -> UserNotification | None:
    path = action_path_for(recipient, None)
    items = notify_users(
        [recipient],
        kind=Kind.SYSTEM,
        title=title,
        body=body,
        platform=platform,
        sender=sender,
        action_path=path,
    )
    return items[0] if items else None

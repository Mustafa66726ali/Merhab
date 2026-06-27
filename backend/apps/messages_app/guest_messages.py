"""مراسلة الضيوف — تسجيل داخلي + إرسال واتساب."""

from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import User
from apps.guests.models import Guest
from apps.integrations.whatsapp_send import build_whatsapp_url, send_whatsapp_text
from apps.messages_app.models import Message
from apps.messages_app.serializers import MessageSerializer
from apps.platforms.platform_permissions import (
    PERM_SEND_MESSAGES,
    get_platform_for_user,
    has_platform_permission,
    require_event_access,
    user_can_access_event,
)


def _user_can_message_guests(user: User) -> bool:
    if user.role in (User.Role.SYSTEM_MANAGER, User.Role.PLATFORM_ADMIN):
        return True
    if user.role == User.Role.EVENT_ORGANIZER:
        return get_platform_for_user(user) is not None
    if user.role == User.Role.EVENT_MANAGER:
        return has_platform_permission(user, PERM_SEND_MESSAGES)
    return False


def guest_messages_queryset(user: User, event_id=None, guest_id=None):
    if not _user_can_message_guests(user):
        return Message.objects.none()

    qs = Message.objects.select_related("guest", "sender", "event").filter(guest__isnull=False)

    if user.role == User.Role.SYSTEM_MANAGER:
        pass
    elif user.role == User.Role.PLATFORM_ADMIN:
        platform = get_platform_for_user(user)
        if not platform:
            return Message.objects.none()
        qs = qs.filter(event__platform_id=platform.id)
    else:
        platform = get_platform_for_user(user)
        if not platform:
            return Message.objects.none()
        accessible_event_ids = []
        from apps.events.models import Event

        for event in Event.objects.filter(platform_id=platform.id).prefetch_related("managers"):
            if user_can_access_event(user, event):
                accessible_event_ids.append(event.id)
        qs = qs.filter(event_id__in=accessible_event_ids)

    if event_id:
        qs = qs.filter(event_id=event_id)
    if guest_id:
        qs = qs.filter(guest_id=guest_id)
    return qs.order_by("-created_at")


def guest_contacts_for_user(user: User, event_id=None):
    if not _user_can_message_guests(user):
        return []

    from apps.events.models import Event

    platform = get_platform_for_user(user)
    if user.role == User.Role.SYSTEM_MANAGER:
        events = Event.objects.all()
    elif user.role == User.Role.PLATFORM_ADMIN and platform:
        events = Event.objects.filter(platform_id=platform.id)
    elif platform:
        events = Event.objects.filter(platform_id=platform.id)
        events = [e for e in events.prefetch_related("managers") if user_can_access_event(user, e)]
    else:
        return []

    if event_id:
        events = [e for e in events if e.id == int(event_id)]

    event_ids = [e.id for e in events]
    guests = Guest.objects.filter(event_id__in=event_ids).select_related("event").order_by(
        "full_name"
    )

    contacts = []
    for guest in guests:
        contacts.append(
            {
                "id": guest.id,
                "name": guest.full_name,
                "phone": guest.phone or "",
                "email": guest.email or "",
                "event_id": guest.event_id,
                "event_title": guest.event.title if hasattr(guest.event, "title") else str(guest.event),
                "whatsapp_url": build_whatsapp_url(guest.phone) if guest.phone else "",
            }
        )
    return contacts


def send_guest_message(user: User, guest_id: int, content: str, via_whatsapp: bool = False):
    if not _user_can_message_guests(user):
        raise PermissionDenied("غير مصرح — لا تملك صلاحية إرسال الرسائل")

    body = (content or "").strip()
    if not body:
        raise ValidationError({"content": "محتوى الرسالة مطلوب"})

    guest = Guest.objects.select_related("event", "event__platform").filter(pk=guest_id).first()
    if not guest:
        raise ValidationError({"guest_id": "الضيف غير موجود"})

    require_event_access(user, guest.event)

    msg = Message.objects.create(
        event=guest.event,
        guest=guest,
        sender=user,
        direction=Message.Direction.OUTGOING,
        content=body,
    )

    whatsapp_result = {"sent": False, "whatsapp_url": "", "detail": ""}
    if via_whatsapp:
        if not guest.phone:
            whatsapp_result = {
                "sent": False,
                "whatsapp_url": "",
                "detail": "الضيف لا يملك رقم هاتف",
            }
        else:
            whatsapp_result = send_whatsapp_text(guest.phone, body)
    elif guest.phone:
        whatsapp_result["whatsapp_url"] = build_whatsapp_url(guest.phone, body)

    data = MessageSerializer(msg).data
    data["whatsapp_sent"] = whatsapp_result.get("sent", False)
    data["whatsapp_url"] = whatsapp_result.get("whatsapp_url", "")
    data["whatsapp_detail"] = whatsapp_result.get("detail", "")
    return data

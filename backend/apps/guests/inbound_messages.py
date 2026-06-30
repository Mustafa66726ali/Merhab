"""رسائل الضيوف الواردة من صفحة الدعوة (تهنئة / استفسار للمنسق)."""

from __future__ import annotations

from apps.guests.models import Guest
from apps.integrations.whatsapp_send import dispatch_whatsapp
from apps.messages_app.models import Message
from apps.platforms.models import UserNotification
from apps.staff.models import StaffMember


def resolve_event_coordinator(event):
    """أول منسّق نشط للفعالية، وإلا منشئ الفعالية."""
    sm = (
        StaffMember.objects.filter(
            event=event,
            role=StaffMember.Role.COORDINATOR,
            is_active=True,
        )
        .select_related("user")
        .first()
    )
    if sm:
        return sm.user
    return event.created_by if event.created_by_id else None


def record_guest_greeting(guest: Guest, text: str) -> Message:
    """يحفظ التهنئة على الضيف ويسجّلها في قسم التهنئات."""
    guest.greeting = text
    guest.save(update_fields=["greeting"])
    Message.objects.filter(guest=guest, kind=Message.Kind.GREETING).delete()
    return Message.objects.create(
        event=guest.event,
        guest=guest,
        direction=Message.Direction.INCOMING,
        kind=Message.Kind.GREETING,
        content=text,
    )


def record_guest_inquiry(guest: Guest, text: str) -> tuple[Message, object | None]:
    """يرسل استفساراً مباشرة للمنسّق: تسجيل داخلي + إشعار + واتساب."""
    coordinator = resolve_event_coordinator(guest.event)
    msg = Message.objects.create(
        event=guest.event,
        guest=guest,
        direction=Message.Direction.INCOMING,
        kind=Message.Kind.INQUIRY,
        recipient=coordinator,
        content=text,
    )
    if coordinator:
        platform = guest.event.platform if guest.event.platform_id else None
        UserNotification.objects.create(
            user=coordinator,
            platform=platform,
            title=f"استفسار من {guest.full_name}",
            body=text[:500],
        )
        phone = getattr(coordinator, "phone", "") or ""
        if phone:
            wa_body = (
                f"استفسار من ضيف: {guest.full_name}\n"
                f"مناسبة: {guest.event.title}\n\n"
                f"{text}"
            )
            dispatch_whatsapp(phone, wa_body)
    return msg, coordinator

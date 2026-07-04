"""إرسال رابط البث العام للضيوف الحاضرين أو الجالسين."""

from __future__ import annotations

from apps.accounts.models import User
from apps.guests.models import Guest
from apps.guests.status_utils import PHYSICAL_PRESENCE_STATUSES
from apps.integrations.whatsapp_broadcast import (
    WATCH_LINK_BODY,
    broadcast_body,
    send_guest_broadcast_link,
)
from apps.messages_app.models import Message

from .live_media import (
    STREAM_MODES,
    broadcast_public_url,
    build_live_media_payload,
    ensure_broadcast_token,
)


def _broadcast_ready(event) -> tuple[bool, str]:
    payload = build_live_media_payload(event)
    if not payload.get("enabled"):
        return False, "فعّل البث واحفظ الإعدادات أولاً"
    mode = payload.get("mode")
    if mode == "youtube" and not payload.get("youtube_embed_url"):
        return False, "أدخل رابط يوتيوب صالحاً واحفظ الإعدادات"
    if mode == "audio_file" and not payload.get("audio_url"):
        return False, "ارفع ملفاً صوتياً واحفظ الإعدادات"
    if mode in STREAM_MODES and not payload.get("stream_active"):
        return False, "ابدأ البث المباشر أولاً ثم أرسل الرابط"
    return True, ""


def _message_body(guest: Guest, broadcast_url: str) -> str:
    return f"{broadcast_body(guest)}\n\n{WATCH_LINK_BODY}\n{broadcast_url}"


def send_broadcast_link_to_present_guests(event, sender: User) -> dict:
    """يُنشئ رابط البث ويرسله لكل ضيف بحالة «حضر» أو «جلس»."""
    ready, detail = _broadcast_ready(event)
    if not ready:
        return {"ok": False, "detail": detail}

    ensure_broadcast_token(event)
    event.refresh_from_db()
    broadcast_url = broadcast_public_url(event)

    guests = list(
        Guest.objects.filter(
            event_id=event.id,
            status__in=PHYSICAL_PRESENCE_STATUSES,
        ).select_related("event")
    )

    results = []
    sent_count = 0
    skipped_count = 0
    failed_count = 0

    for guest in guests:
        if not (guest.phone or "").strip():
            skipped_count += 1
            results.append(
                {
                    "guest_id": guest.id,
                    "full_name": guest.full_name,
                    "status": guest.status,
                    "sent": False,
                    "skipped": True,
                    "detail": "لا يوجد رقم هاتف",
                }
            )
            continue

        body = _message_body(guest, broadcast_url)
        outcome = send_guest_broadcast_link(guest, broadcast_url)
        sent = bool(outcome.get("sent"))

        Message.objects.create(
            event=event,
            guest=guest,
            sender=sender,
            direction=Message.Direction.OUTGOING,
            content=body,
        )

        if sent:
            sent_count += 1
        else:
            failed_count += 1

        results.append(
            {
                "guest_id": guest.id,
                "full_name": guest.full_name,
                "status": guest.status,
                "sent": sent,
                "skipped": False,
                "detail": outcome.get("detail", ""),
                "whatsapp_url": outcome.get("whatsapp_url") or None,
            }
        )

    return {
        "ok": True,
        "broadcast_url": broadcast_url,
        "total": len(guests),
        "sent": sent_count,
        "skipped": skipped_count,
        "failed": failed_count,
        "manual_pending": failed_count,
        "results": results,
    }

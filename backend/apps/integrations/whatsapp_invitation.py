"""بناء دعوة واتساب التفاعلية — نص + خريطة + رابط + تذكير مسبق."""

from __future__ import annotations

import urllib.parse

from apps.guests.models import Guest


RSVP_YES = "نعم"
RSVP_NO = "لا"
BTN_MAP = "فتح الخريطة"
BTN_INVITE = "فتح الدعوة"
INVITE_LINK_BODY = "عرض تفاصيل الدعوة"
REMIND_YES = "نعم ذكرني"
REMIND_NO = "لا اعتذر عن الحضور"


def event_maps_url(event) -> str | None:
    lat, lng = event.latitude, event.longitude
    if lat is not None and lng is not None:
        return f"https://www.google.com/maps?q={lat},{lng}"
    parts = []
    if (event.venue or "").strip():
        parts.append(event.venue.strip())
    if (event.geo_address or "").strip():
        parts.append(event.geo_address.strip())
    label = " — ".join(parts)
    if label:
        return (
            "https://www.google.com/maps/search/"
            + urllib.parse.quote(label)
        )
    return None


def map_template_variable(event) -> str | None:
    """قيمة استعلام الخريطة لـ maps?q={{n}}."""
    lat, lng = event.latitude, event.longitude
    if lat is not None and lng is not None:
        return f"{lat},{lng}"
    parts = []
    if (event.venue or "").strip():
        parts.append(event.venue.strip())
    if (event.geo_address or "").strip():
        parts.append(event.geo_address.strip())
    label = " — ".join(parts)
    return label or None


def _event_date_label(guest: Guest) -> str:
    event = guest.event
    if event.date:
        return event.date.strftime("%Y-%m-%d")
    return "-"


def _event_time_label(guest: Guest) -> str:
    event = guest.event
    if event.time:
        return event.time.strftime("%H:%M")
    return "-"


def _event_datetime_label(guest: Guest) -> str:
    parts = []
    d, t = _event_date_label(guest), _event_time_label(guest)
    if d != "-":
        parts.append(d)
    if t != "-":
        parts.append(t)
    return " - ".join(parts) if parts else "-"


def invitation_twilio_variables(guest: Guest) -> dict[str, str]:
    """متغيرات قديمة {{1}}..{{4}} (مسار Meta/legacy)."""
    event = guest.event
    venue = (event.venue or event.geo_address or "-").strip() or "-"
    return {
        "1": guest.full_name or "ضيف",
        "2": event.title or "مناسبة",
        "3": _event_datetime_label(guest),
        "4": venue,
    }


def invitation_card_twilio_variables(guest: Guest) -> dict[str, str]:
    """متغيرات قوالب الدعوة والتذكير (Call to action / واتساب).

    صيغة موافقة واتساب (5 متغيرات فقط + زر رابط واحد):
    {{1}} الاسم · {{2}} المناسبة · {{3}} التاريخ والوقت
    {{4}} المكان · {{5}} رمز الضيف لرابط /i/{{5}}
    """
    event = guest.event
    venue = (event.venue or event.geo_address or "-").strip() or "-"
    venue = " ".join(venue.split()) or "-"
    return {
        "1": (guest.full_name or "ضيف").strip() or "ضيف",
        "2": (event.title or "مناسبة").strip() or "مناسبة",
        "3": _event_datetime_label(guest),
        "4": venue,
        "5": str(guest.public_token),
    }


def reminder_optin_twilio_variables(guest: Guest) -> dict[str, str]:
    """متغيرات رسالة التذكير المسبق (Quick Reply)."""
    return {
        "1": (guest.full_name or "ضيف").strip() or "ضيف",
        "2": str(guest.public_token),
    }


def invite_url(guest: Guest, base: str) -> str:
    return f"{base.rstrip('/')}/i/{guest.public_token}"


def invitation_body(guest: Guest, *, headline: str = "دعوة الضيف") -> str:
    event = guest.event
    venue = (event.venue or event.geo_address or "-").strip() or "-"
    return (
        f"{headline}\n\n"
        f"مرحبا بك يا {guest.full_name or 'ضيف'} نشكر دعوتكم لحضور مناسبة "
        f"{event.title or 'مناسبتنا'}\n\n"
        f"الموعد يوم {_event_datetime_label(guest)} والمكان {venue}\n\n"
        "للاطلاع على التفاصيل وتأكيد الحضور افتح رابط الدعوة وشكرا لثقتكم بمرحاب"
    )


def reminder_optin_body(guest: Guest) -> str:
    return (
        f"مرحبا {guest.full_name or 'ضيف'}\n\n"
        "حرصا منا على تذكيركم بموعد المناسبة هل تودون ان نرسل لكم رسالة تذكير "
        "قبل الموعد بيوم تتضمن تفاصيل الدعوة ورمز الدخول الخاصة بكم؟"
    )


def rsvp_button_id(guest: Guest, confirm: bool) -> str:
    """معرّف قديم — يُبقى للتوافق."""
    action = "yes" if confirm else "no"
    return f"merhab_rsvp_{action}_{guest.public_token}"


def remind_button_id(guest: Guest, opt_in: bool) -> str:
    action = "yes" if opt_in else "no"
    return f"merhab_remind_{action}_{guest.public_token}"


def parse_rsvp_button_id(button_id: str) -> tuple[bool, str] | None:
    """يُرجع (confirm, public_token) أو None — أزرار RSVP القديمة."""
    for prefix, confirm in (("merhab_rsvp_yes_", True), ("merhab_rsvp_no_", False)):
        if button_id.startswith(prefix):
            token = button_id[len(prefix) :].strip()
            if token:
                return confirm, token
    return None


def parse_remind_button_id(button_id: str) -> tuple[bool, str] | None:
    """يُرجع (opt_in, public_token) — نعم ذكرني / لا اعتذر."""
    for prefix, opt_in in (("merhab_remind_yes_", True), ("merhab_remind_no_", False)):
        if button_id.startswith(prefix):
            token = button_id[len(prefix) :].strip()
            if token:
                return opt_in, token
    return None


def normalize_rsvp_reply(text: str) -> bool | None:
    t = (text or "").strip().lower()
    if t in ("نعم", "yes", "اه", "أيوه", "ايوه", "موافق", "نعم ذكرني"):
        return True
    if t in ("لا", "no", "لأ", "اعتذار", "معتذر", "لا اعتذر عن الحضور"):
        return False
    return None

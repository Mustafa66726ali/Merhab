"""بناء دعوة واتساب التفاعلية — نص + خريطة + رابط + RSVP."""

from __future__ import annotations

import urllib.parse

from apps.guests.models import Guest


RSVP_YES = "نعم"
RSVP_NO = "لا"
BTN_MAP = "اضغط لعرض الخريطة"
BTN_INVITE = "فتح"
INVITE_LINK_BODY = "📩 اضغط لفتح تفاصيل الدعوة"


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
    """قيمة استعلام الخريطة لـ maps?q={{n}} — لا تُرجع فارغاً إن أمكن."""
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


def invitation_twilio_variables(guest: Guest) -> dict[str, str]:
    """متغيرات نص الدعوة {{1}}..{{4}} (مسار قديم / Meta)."""
    event = guest.event
    venue = (event.venue or event.geo_address or "—").strip() or "—"
    return {
        "1": guest.full_name or "ضيف",
        "2": event.title or "مناسبة",
        "3": _event_datetime_label(guest),
        "4": venue,
    }


def invitation_card_twilio_variables(guest: Guest) -> dict[str, str]:
    """متغيرات قالب twilio/card الواحد للدعوة.

    {{1}} الاسم · {{2}} المناسبة · {{3}} التاريخ · {{4}} المكان
    {{5}} استعلام الخريطة (maps?q={{5}}) · {{6}} رمز الضيف (/i/{{6}} و RSVP)
    """
    event = guest.event
    venue = (event.venue or event.geo_address or "—").strip() or "—"
    map_q = map_template_variable(event) or venue or (event.title or "مناسبة")
    # واتساب يرفض المتغيرات الفارغة أو المسافات الزائدة
    map_q = " ".join(str(map_q).split()) or "مناسبة"
    return {
        "1": (guest.full_name or "ضيف").strip() or "ضيف",
        "2": (event.title or "مناسبة").strip() or "مناسبة",
        "3": _event_datetime_label(guest),
        "4": venue,
        "5": map_q,
        "6": str(guest.public_token),
    }


def _event_datetime_label(guest: Guest) -> str:
    event = guest.event
    parts = []
    if event.date:
        parts.append(event.date.strftime("%Y-%m-%d"))
    if event.time:
        parts.append(event.time.strftime("%H:%M"))
    return " - ".join(parts) if parts else "—"


def invite_url(guest: Guest, base: str) -> str:
    return f"{base.rstrip('/')}/i/{guest.public_token}"


def invitation_body(guest: Guest, *, headline: str = "دعوة الضيف") -> str:
    event = guest.event
    venue = (event.venue or event.geo_address or "—").strip() or "—"
    return (
        f"{headline}\n\n"
        f"مرحبا {guest.full_name or 'ضيف'}\n"
        f"يسعدنا دعوتك لحضور: {event.title or 'مناسبتنا'}\n\n"
        f"التاريخ: {_event_datetime_label(guest)}\n"
        f"المكان: {venue}"
    )


def rsvp_button_id(guest: Guest, confirm: bool) -> str:
    action = "yes" if confirm else "no"
    return f"merhab_rsvp_{action}_{guest.public_token}"


def parse_rsvp_button_id(button_id: str) -> tuple[bool, str] | None:
    """يُرجع (confirm, public_token) أو None."""
    for prefix, confirm in (("merhab_rsvp_yes_", True), ("merhab_rsvp_no_", False)):
        if button_id.startswith(prefix):
            token = button_id[len(prefix) :].strip()
            if token:
                return confirm, token
    return None


def normalize_rsvp_reply(text: str) -> bool | None:
    t = (text or "").strip().lower()
    if t in ("نعم", "yes", "اه", "أيوه", "ايوه", "موافق"):
        return True
    if t in ("لا", "no", "لأ", "اعتذار", "معتذر"):
        return False
    return None

"""لوحة أقسام مدير الفعالية — قائمة شاملة مع إحصائيات."""

from __future__ import annotations

from django.db.models import Count, Q

from apps.events.models import Event, Group, Section
from apps.guests.models import Guest
from apps.guests.status_utils import CONFIRMED_ATTENDANCE_STATUSES, PHYSICAL_PRESENCE_STATUSES, rate_percent
from apps.platforms.member_profile import managed_events_queryset
from apps.platforms.platform_events import STATUS_OPTIONS

SECTION_STATUS_OPTIONS = [
    {"value": "full", "label": "مؤكد بالكامل"},
    {"value": "pending", "label": "في انتظار الرد"},
    {"value": "partial", "label": "تأكيد جزئي"},
    {"value": "empty", "label": "بدون مدعوين"},
]

CONFIRMED_STATUSES = set(CONFIRMED_ATTENDANCE_STATUSES)


def _section_status_key(guests_total: int, guests_confirmed: int, guests_pending: int) -> str:
    if guests_total == 0:
        return "empty"
    if guests_confirmed >= guests_total:
        return "full"
    if guests_pending == guests_total:
        return "pending"
    return "partial"


def _section_status_label(key: str) -> str:
    for item in SECTION_STATUS_OPTIONS:
        if item["value"] == key:
            return item["label"]
    return key


def build_event_manager_sections_dashboard(user_id: int, platform_id: int) -> dict:
    event_ids = list(
        managed_events_queryset(user_id, platform_id).values_list("id", flat=True)
    )
    if not event_ids:
        return {
            "sections": [],
            "events": [],
            "event_status_options": STATUS_OPTIONS,
            "section_status_options": SECTION_STATUS_OPTIONS,
        }

    sections = list(
        Section.objects.filter(event_id__in=event_ids)
        .select_related("event")
        .order_by("-created_at", "-id")
    )
    section_ids = [s.id for s in sections]

    stats_map: dict[int, dict] = {}
    if section_ids:
        for row in Guest.objects.filter(section_id__in=section_ids).values("section_id").annotate(
            guests_total=Count("id"),
            guests_confirmed=Count(
                "id",
                filter=Q(status__in=CONFIRMED_STATUSES),
            ),
            guests_attended=Count(
                "id", filter=Q(status__in=PHYSICAL_PRESENCE_STATUSES)
            ),
            guests_pending=Count("id", filter=Q(status=Guest.Status.INVITED)),
        ):
            stats_map[row["section_id"]] = row

        groups_map = {
            row["section_id"]: row["groups_count"]
            for row in Group.objects.filter(section_id__in=section_ids)
            .values("section_id")
            .annotate(groups_count=Count("id"))
        }
    else:
        groups_map = {}

    events = list(
        Event.objects.filter(id__in=event_ids).order_by("-date", "-time").values(
            "id", "title", "status"
        )
    )
    event_status_labels = dict(Event.Status.choices)

    sections_payload = []
    for section in sections:
        stats = stats_map.get(section.id, {})
        guests_total = stats.get("guests_total") or 0
        guests_confirmed = stats.get("guests_confirmed") or 0
        guests_attended = stats.get("guests_attended") or 0
        guests_pending = stats.get("guests_pending") or 0
        confirmation_rate = rate_percent(guests_confirmed, guests_total)
        attendance_rate = rate_percent(guests_attended, guests_total)
        status_key = _section_status_key(guests_total, guests_confirmed, guests_pending)

        sections_payload.append(
            {
                "id": section.id,
                "name": section.name,
                "description": section.description,
                "location": section.location or "",
                "color": section.color or "#5b2eff",
                "order": section.order,
                "created_at": section.created_at.isoformat(),
                "event_id": section.event_id,
                "event_title": section.event.title,
                "event_status": section.event.status,
                "event_status_label": event_status_labels.get(
                    section.event.status, section.event.status
                ),
                "groups_count": groups_map.get(section.id, 0),
                "guests_count": guests_total,
                "guests_confirmed": guests_confirmed,
                "confirmation_rate": confirmation_rate,
                "attendance_rate": attendance_rate,
                "status": status_key,
                "status_label": _section_status_label(status_key),
            }
        )

    events_payload = [
        {
            "id": e["id"],
            "title": e["title"],
            "status": e["status"],
            "status_label": event_status_labels.get(e["status"], e["status"]),
        }
        for e in events
    ]

    return {
        "sections": sections_payload,
        "events": events_payload,
        "event_status_options": STATUS_OPTIONS,
        "section_status_options": SECTION_STATUS_OPTIONS,
    }

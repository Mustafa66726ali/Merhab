"""تجميع بيانات الأقسام والمجموعات لصفحة إدارة مجموعات الفعالية."""

from __future__ import annotations

from apps.events.models import Event
from apps.guests.models import Guest
from apps.guests.status_utils import (
    CONFIRMED_ATTENDANCE_STATUSES,
    PHYSICAL_PRESENCE_STATUSES,
    RESPONDED_STATUSES,
    rate_percent,
)


def _group_section_label(event: Event, group, guests_by_group: dict) -> tuple[int | None, str, str]:
    """قسم المجموعة المعتمد، مع fallback تقديري للبيانات القديمة."""
    if group.section_id:
        section = group.section
        if section:
            return section.id, section.name, section.color or "#5b2eff"
        return group.section_id, "", ""

    group_id = group.id
    # Fallback: في البيانات القديمة قد لا يكون group.section مضبوطاً.
    section_counts: dict[int, int] = {}
    for guest in guests_by_group.get(group_id, []):
        if guest.section_id:
            section_counts[guest.section_id] = section_counts.get(guest.section_id, 0) + 1
    if not section_counts:
        return None, "", ""
    section_id = max(section_counts, key=section_counts.get)
    section = next((s for s in event.sections.all() if s.id == section_id), None)
    if not section:
        return section_id, "", ""
    return section.id, section.name, section.color or "#5b2eff"


def build_groups_overview(event: Event) -> dict:
    guests = list(
        Guest.objects.filter(event_id=event.id).select_related("section", "group")
    )
    guests_by_group: dict[int, list[Guest]] = {}
    for guest in guests:
        if guest.group_id:
            guests_by_group.setdefault(guest.group_id, []).append(guest)

    confirmed_statuses = set(CONFIRMED_ATTENDANCE_STATUSES)
    present_statuses = set(PHYSICAL_PRESENCE_STATUSES)

    groups_payload = []
    for group in event.groups.all():
        group_guests = guests_by_group.get(group.id, [])
        guests_total = len(group_guests)
        guests_confirmed = sum(1 for g in group_guests if g.status in confirmed_statuses)
        guests_attended = sum(1 for g in group_guests if g.status in present_statuses)
        guests_declined = sum(1 for g in group_guests if g.status == Guest.Status.DECLINED)
        guests_pending = sum(1 for g in group_guests if g.status == Guest.Status.INVITED)
        rate = rate_percent(guests_confirmed, guests_total)

        section_id, section_name, section_color = _group_section_label(event, group, guests_by_group)

        groups_payload.append(
            {
                "id": group.id,
                "name": group.name,
                "description": group.description,
                "color": group.color or "#5b2eff",
                "section_id": section_id,
                "section_name": section_name,
                "section_color": section_color,
                "guests_total": guests_total,
                "guests_confirmed": guests_confirmed,
                "guests_attended": guests_attended,
                "guests_declined": guests_declined,
                "guests_pending": guests_pending,
                "confirmation_rate": rate,
            }
        )

    groups_payload.sort(key=lambda g: (-g["guests_total"], g["name"]))

    stats = {
        "groups_total": event.groups.count(),
        "sections_total": event.sections.count(),
        "guests_total": len(guests),
        "confirmed_total": sum(1 for g in guests if g.status in confirmed_statuses),
        "pending_total": sum(1 for g in guests if g.status == Guest.Status.INVITED),
        "declined_total": sum(1 for g in guests if g.status == Guest.Status.DECLINED),
        "attended_total": sum(1 for g in guests if g.status in present_statuses),
    }

    sections_payload = [
        {
            "id": s.id,
            "name": s.name,
            "color": s.color or "#5b2eff",
            "location": s.location or "",
            "order": s.order,
        }
        for s in event.sections.all()
    ]

    return {
        "event": {
            "id": event.id,
            "title": event.title,
            "status": event.status,
            "status_label": event.get_status_display(),
        },
        "stats": stats,
        "sections": sections_payload,
        "groups": groups_payload,
    }


def build_groups_guests_csv(event: Event) -> str:
    """CSV بترميز UTF-8 مع BOM لدعم Excel العربي."""
    guests = (
        Guest.objects.filter(event_id=event.id)
        .select_related("section", "group")
        .order_by("section__order", "group__name", "full_name")
    )
    lines = ["القسم,المجموعة,الاسم,البريد,الجوال,الحالة"]
    for guest in guests:
        section = guest.section.name if guest.section else ""
        group = guest.group.name if guest.group else ""
        row = [
            section,
            group,
            guest.full_name,
            guest.email or "",
            guest.phone or "",
            guest.get_status_display(),
        ]
        lines.append(",".join(f'"{str(v).replace(chr(34), "")}"' for v in row))
    return "\ufeff" + "\n".join(lines)

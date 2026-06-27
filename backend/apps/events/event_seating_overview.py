"""تجميع بيانات صفحة توزيع الجلوس (عرض فقط لمدير المنصة)."""

from __future__ import annotations

from apps.events.models import Event
from apps.guests.models import Guest
from apps.tables.models import SeatingPlan, Table, TableSeat


def _guest_initials(name: str) -> str:
    parts = [p for p in name.strip().split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[1][0]).upper()


def _is_vip_label(section_name: str, group_name: str) -> bool:
    blob = f"{section_name} {group_name}".lower()
    return "vip" in blob or "كبار" in blob or "vip" in section_name.lower()


def _serialize_seat(
    seat: TableSeat | None, seat_number: int, custom_pos: dict | None = None
) -> dict:
    guest = seat.guest if seat else None
    section_name = ""
    group_name = ""
    if guest:
        section_name = guest.section.name if guest.section else ""
        group_name = guest.group.name if guest.group else ""

    is_vip = _is_vip_label(section_name, group_name) if guest else False
    occupied = guest is not None

    pos_x = None
    pos_y = None
    if isinstance(custom_pos, dict):
        try:
            pos_x = float(custom_pos.get("x"))
            pos_y = float(custom_pos.get("y"))
        except (TypeError, ValueError):
            pos_x = None
            pos_y = None

    return {
        "id": seat.id if seat else None,
        "seat_number": seat_number,
        "guest_id": guest.id if guest else None,
        "guest_name": guest.full_name if guest else "",
        "initials": _guest_initials(guest.full_name) if guest else "",
        "occupied": occupied,
        "is_vip": is_vip and occupied,
        "section_name": section_name,
        "group_name": group_name,
        "pos_x": pos_x,
        "pos_y": pos_y,
    }


def _serialize_table(table: Table) -> dict:
    seats_qs = list(table.seats.select_related("guest__section", "guest__group").order_by("seat_number"))
    seat_map = {s.seat_number: s for s in seats_qs}
    capacity = max(table.capacity, len(seats_qs), 1)
    custom = table.seat_positions if isinstance(table.seat_positions, dict) else {}
    seats = [
        _serialize_seat(seat_map.get(n), n, custom.get(str(n)) or custom.get(n))
        for n in range(1, capacity + 1)
    ]

    occupied = sum(1 for s in seats if s["occupied"])
    section_name = table.section.name if table.section else ""
    group_name = table.group.name if table.group else ""

    if occupied == 0:
        status_label = "متاحة بالكامل"
    elif occupied >= capacity:
        status_label = "مكتملة"
    else:
        status_label = table.name

    return {
        "id": table.id,
        "name": table.name,
        "shape": table.shape,
        "capacity": capacity,
        "position_x": table.position_x,
        "position_y": table.position_y,
        "section_id": table.section_id,
        "section_name": section_name,
        "section_color": table.section.color if table.section else "",
        "group_id": table.group_id,
        "group_name": group_name,
        "group_color": table.group.color if table.group else "",
        "occupied_seats": occupied,
        "status_label": status_label,
        "seat_positions": custom,
        "seats": seats,
    }


def build_seating_overview(event: Event) -> dict:
    plans = list(
        SeatingPlan.objects.filter(event_id=event.id).prefetch_related(
            "tables__section",
            "tables__group",
            "tables__seats__guest__section",
            "tables__seats__guest__group",
        ).order_by("order", "id")
    )

    assigned_guest_ids: set[int] = set(
        TableSeat.objects.filter(table__event_id=event.id, guest_id__isnull=False).values_list(
            "guest_id", flat=True
        )
    )

    unassigned = Guest.objects.filter(event_id=event.id).exclude(id__in=assigned_guest_ids).select_related(
        "section", "group"
    )

    unassigned_payload = [
        {
            "id": g.id,
            "full_name": g.full_name,
            "section_id": g.section_id,
            "section_name": g.section.name if g.section else "",
            "group_id": g.group_id,
            "group_name": g.group.name if g.group else "",
            "initials": _guest_initials(g.full_name),
            "is_vip": _is_vip_label(
                g.section.name if g.section else "",
                g.group.name if g.group else "",
            ),
        }
        for g in unassigned.order_by("full_name")
    ]

    plans_payload = []
    for plan in plans:
        tables = list(plan.tables.all())
        plans_payload.append(
            {
                "id": plan.id,
                "name": plan.name,
                "description": plan.description,
                "order": plan.order,
                "tables": [_serialize_table(t) for t in tables],
            }
        )

    # طاولات بلا مخطط (احتياط)
    orphan_tables = Table.objects.filter(event_id=event.id, plan__isnull=True).select_related(
        "section", "group"
    ).prefetch_related("seats__guest__section", "seats__guest__group")
    if orphan_tables.exists():
        plans_payload.append(
            {
                "id": 0,
                "name": "مخطط غير مصنّف",
                "description": "",
                "order": 9999,
                "tables": [_serialize_table(t) for t in orphan_tables],
            }
        )

    total_guests = Guest.objects.filter(event_id=event.id).count()
    assigned_count = len(assigned_guest_ids)
    total_seats = sum(t["capacity"] for p in plans_payload for t in p["tables"])
    occupied_seats = sum(
        t["occupied_seats"] for p in plans_payload for t in p["tables"]
    )
    occupancy_rate = round(assigned_count / total_guests * 100, 1) if total_guests else 0.0

    return {
        "event": {
            "id": event.id,
            "title": event.title,
        },
        "stats": {
            "total_guests": total_guests,
            "assigned_guests": assigned_count,
            "unassigned_guests": len(unassigned_payload),
            "total_tables": sum(len(p["tables"]) for p in plans_payload),
            "total_seats": total_seats,
            "occupied_seats": occupied_seats,
            "occupancy_rate": occupancy_rate,
        },
        "unassigned_guests": unassigned_payload,
        "plans": plans_payload,
    }

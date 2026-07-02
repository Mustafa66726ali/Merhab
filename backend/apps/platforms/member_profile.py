"""تجميع بيانات صفحة معلومات العضو في لوحة المنصة."""

from datetime import datetime, time

from django.db.models import Count, Q
from django.utils import timezone

from apps.accounts.models import User
from apps.events.models import Event
from apps.guests.models import Guest, GuestQrScanLog
from apps.guests.status_utils import (
    CONFIRMED_ATTENDANCE_STATUSES,
    PHYSICAL_PRESENCE_STATUSES,
    RESPONDED_STATUSES,
    rate_percent,
)
from apps.messages_app.models import Message
from apps.platforms.models import PlatformMember
from apps.staff.models import StaffMember


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return None


def _parse_time(value: str | None) -> time | None:
    if not value:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(value, fmt).time()
        except ValueError:
            continue
    return None


def _apply_datetime_filters(qs, date_from: str | None, date_to: str | None, time_from: str | None, time_to: str | None, field: str):
    start = _parse_date(date_from)
    end = _parse_date(date_to)
    t_from = _parse_time(time_from)
    t_to = _parse_time(time_to)

    if start:
        qs = qs.filter(**{f"{field}__date__gte": start.date()})
    if end:
        qs = qs.filter(**{f"{field}__date__lte": end.date()})
    if t_from:
        qs = qs.filter(**{f"{field}__time__gte": t_from})
    if t_to:
        qs = qs.filter(**{f"{field}__time__lte": t_to})
    return qs


def member_role_sections(role_key: str) -> dict[str, bool]:
    """تحديد الأقسام المعروضة حسب دور العضو."""
    if role_key == "event_manager":
        return {"show_messages": False, "show_qr_scans": False, "show_managed_events": True}
    if role_key == "event_organizer":
        return {"show_messages": True, "show_qr_scans": False, "show_managed_events": True}
    if role_key == "entry_manager":
        return {"show_messages": False, "show_qr_scans": True, "show_managed_events": False}
    if role_key == "coordinator":
        return {"show_messages": True, "show_qr_scans": True, "show_managed_events": False}
    return {"show_messages": False, "show_qr_scans": False, "show_managed_events": False}


def member_event_stats(user_id: int, platform_id: int) -> dict[str, int]:
    event_ids: set[int] = set()
    event_qs = Event.objects.filter(platform_id=platform_id).prefetch_related("managers")

    for event in event_qs:
        if event.created_by_id == user_id:
            event_ids.add(event.id)
        elif event.managers.filter(id=user_id).exists():
            event_ids.add(event.id)

    staff_ids = StaffMember.objects.filter(
        event__platform_id=platform_id,
        user_id=user_id,
    ).values_list("event_id", flat=True)
    event_ids.update(staff_ids)

    total = len(event_ids)
    active = 0
    completed = 0
    if event_ids:
        agg = Event.objects.filter(id__in=event_ids).aggregate(
            active=Count("id", filter=Q(status=Event.Status.ACTIVE)),
            completed=Count("id", filter=Q(status=Event.Status.COMPLETED)),
        )
        active = agg["active"] or 0
        completed = agg["completed"] or 0

    return {"total": total, "active": active, "completed": completed}


def platform_events_for_filter(platform_id: int) -> list[dict]:
    return [
        {"id": e.id, "title": e.title}
        for e in Event.objects.filter(platform_id=platform_id).order_by("-date", "-time")
    ]


def serialize_message_row(msg: Message) -> dict:
    guest_name = msg.guest.full_name if msg.guest else "—"
    return {
        "id": msg.id,
        "guest_name": guest_name,
        "guest_id": msg.guest_id,
        "event_id": msg.event_id,
        "event_title": msg.event.title,
        "created_at": timezone.localtime(msg.created_at).isoformat(),
        "date": timezone.localtime(msg.created_at).strftime("%Y-%m-%d"),
        "time": timezone.localtime(msg.created_at).strftime("%H:%M"),
    }


def member_messages_queryset(user_id: int, platform_id: int):
    return Message.objects.filter(
        sender_id=user_id,
        direction=Message.Direction.OUTGOING,
        event__platform_id=platform_id,
    ).select_related("guest", "event")


def list_member_messages(
    user_id: int,
    platform_id: int,
    event_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    time_from: str | None = None,
    time_to: str | None = None,
    limit: int | None = None,
) -> tuple[list[dict], int]:
    qs = member_messages_queryset(user_id, platform_id)
    if event_id:
        qs = qs.filter(event_id=int(event_id))
    qs = _apply_datetime_filters(qs, date_from, date_to, time_from, time_to, "created_at")
    total = qs.count()
    if limit:
        qs = qs[:limit]
    return [serialize_message_row(m) for m in qs], total


def serialize_qr_scan_row(log: GuestQrScanLog) -> dict:
    local_dt = timezone.localtime(log.scanned_at)
    return {
        "id": log.id,
        "guest_name": log.guest.full_name,
        "guest_id": log.guest_id,
        "event_id": log.event_id,
        "event_title": log.event.title,
        "scanned_at": local_dt.isoformat(),
        "date": local_dt.strftime("%Y-%m-%d"),
        "time": local_dt.strftime("%H:%M"),
    }


def member_qr_scans_queryset(user_id: int, platform_id: int):
    return GuestQrScanLog.objects.filter(
        scanner_id=user_id,
        event__platform_id=platform_id,
    ).select_related("guest", "event")


def list_member_qr_scans(
    user_id: int,
    platform_id: int,
    event_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    time_from: str | None = None,
    time_to: str | None = None,
    limit: int | None = None,
) -> tuple[list[dict], int]:
    qs = member_qr_scans_queryset(user_id, platform_id)
    if event_id:
        qs = qs.filter(event_id=int(event_id))
    qs = _apply_datetime_filters(qs, date_from, date_to, time_from, time_to, "scanned_at")
    total = qs.count()
    if limit:
        qs = qs[:limit]
    return [serialize_qr_scan_row(log) for log in qs], total


def managed_events_queryset(user_id: int, platform_id: int):
    return Event.objects.filter(platform_id=platform_id).filter(
        Q(created_by_id=user_id) | Q(managers__id=user_id)
    ).distinct()


def _guest_stats_for_event(event_id: int) -> dict:
    agg = Guest.objects.filter(event_id=event_id).aggregate(
        total=Count("id"),
        invited=Count("id", filter=Q(status=Guest.Status.INVITED)),
        confirmed=Count(
            "id", filter=Q(status__in=CONFIRMED_ATTENDANCE_STATUSES)
        ),
        attended=Count(
            "id", filter=Q(status__in=PHYSICAL_PRESENCE_STATUSES)
        ),
        seated=Count("id", filter=Q(status=Guest.Status.SEATED)),
        declined=Count("id", filter=Q(status=Guest.Status.DECLINED)),
        cancelled=Count("id", filter=Q(status=Guest.Status.CANCELLED)),
    )
    total = agg["total"] or 0
    confirmed = agg["confirmed"] or 0
    attended = agg["attended"] or 0
    seated = agg["seated"] or 0
    declined = agg["declined"] or 0
    invited = agg["invited"] or 0

    responded = Guest.objects.filter(
        event_id=event_id, status__in=RESPONDED_STATUSES
    ).count()
    confirmation_rate = rate_percent(confirmed, total)
    rsvp_only = max(confirmed - attended, 0)
    absence_rate = rate_percent(rsvp_only, confirmed) if confirmed else 0.0
    attendance_rate = rate_percent(attended, total)

    return {
        "guests_total": total,
        "invited": invited,
        "confirmed": confirmed,
        "attended": attended,
        "seated": seated,
        "declined": declined,
        "cancelled": agg["cancelled"] or 0,
        "responded": responded,
        "confirmation_rate": confirmation_rate,
        "absence_count": rsvp_only,
        "absence_rate": absence_rate,
        "attendance_rate": attendance_rate,
    }


def _empty_guest_stats() -> dict:
    return {
        "guests_total": 0,
        "invited": 0,
        "confirmed": 0,
        "attended": 0,
        "seated": 0,
        "declined": 0,
        "cancelled": 0,
        "responded": 0,
        "confirmation_rate": 0.0,
        "absence_count": 0,
        "absence_rate": 0.0,
        "attendance_rate": 0.0,
    }


def _stats_from_aggregate_row(row: dict) -> dict:
    total = row.get("total") or 0
    confirmed = row.get("confirmed") or 0
    attended = row.get("attended") or 0
    seated = row.get("seated") or 0
    declined = row.get("declined") or 0
    responded = row.get("responded") or 0
    rsvp_only = max(confirmed - attended, 0)
    return {
        "guests_total": total,
        "invited": row.get("invited") or 0,
        "confirmed": confirmed,
        "attended": attended,
        "seated": seated,
        "declined": declined,
        "cancelled": row.get("cancelled") or 0,
        "responded": responded,
        "confirmation_rate": rate_percent(confirmed, total),
        "absence_count": rsvp_only,
        "absence_rate": rate_percent(rsvp_only, confirmed) if confirmed else 0.0,
        "attendance_rate": rate_percent(attended, total),
    }


def _guest_stats_bulk(event_ids: list[int]) -> dict[int, dict]:
    """إحصائيات ضيوف لعدة فعاليات في استعلام واحد."""
    if not event_ids:
        return {}
    rows = (
        Guest.objects.filter(event_id__in=event_ids)
        .values("event_id")
        .annotate(
            total=Count("id"),
            invited=Count("id", filter=Q(status=Guest.Status.INVITED)),
            confirmed=Count("id", filter=Q(status__in=CONFIRMED_ATTENDANCE_STATUSES)),
            attended=Count("id", filter=Q(status__in=PHYSICAL_PRESENCE_STATUSES)),
            seated=Count("id", filter=Q(status=Guest.Status.SEATED)),
            declined=Count("id", filter=Q(status=Guest.Status.DECLINED)),
            cancelled=Count("id", filter=Q(status=Guest.Status.CANCELLED)),
            responded=Count("id", filter=Q(status__in=RESPONDED_STATUSES)),
        )
    )
    return {row["event_id"]: _stats_from_aggregate_row(row) for row in rows}


def serialize_managed_event(event: Event) -> dict:
    stats = _guest_stats_for_event(event.id)
    return {
        "id": event.id,
        "title": event.title,
        "status": event.status,
        "status_label": event.get_status_display(),
        "date": event.date.isoformat(),
        "time": event.time.strftime("%H:%M") if event.time else "",
        "venue": event.venue or "",
        **stats,
    }


def list_managed_events(
    user_id: int,
    platform_id: int,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int | None = None,
) -> tuple[list[dict], int]:
    qs = managed_events_queryset(user_id, platform_id).order_by("-date", "-time")
    if status:
        qs = qs.filter(status=status)
    start = _parse_date(date_from)
    end = _parse_date(date_to)
    if start:
        qs = qs.filter(date__gte=start.date())
    if end:
        qs = qs.filter(date__lte=end.date())
    total = qs.count()
    if limit:
        qs = qs[:limit]
    return [serialize_managed_event(e) for e in qs], total


def build_member_profile(user_id: int, platform_id: int, role_key: str) -> dict:
    pm = PlatformMember.objects.filter(platform_id=platform_id, user_id=user_id).first()
    if pm and pm.member_role:
        role_key = pm.member_role

    sections = member_role_sections(role_key)
    event_stats = member_event_stats(user_id, platform_id)
    event_options = platform_events_for_filter(platform_id)

    messages_preview: list[dict] = []
    messages_total = 0
    qr_preview: list[dict] = []
    qr_total = 0
    managed_preview: list[dict] = []
    managed_total = 0

    if sections["show_messages"]:
        messages_preview, messages_total = list_member_messages(user_id, platform_id, limit=10)
    if sections["show_qr_scans"]:
        qr_preview, qr_total = list_member_qr_scans(user_id, platform_id, limit=10)
    if sections["show_managed_events"]:
        managed_preview, managed_total = list_managed_events(user_id, platform_id, limit=10)

    return {
        "event_stats": event_stats,
        "sections": sections,
        "messages_total": messages_total,
        "messages_preview": messages_preview,
        "qr_scans_total": qr_total,
        "qr_scans_preview": qr_preview,
        "managed_events_total": managed_total,
        "managed_events_preview": managed_preview,
        "event_options": event_options,
        "status_options": [
            {"value": s.value, "label": s.label}
            for s in Event.Status
        ],
    }

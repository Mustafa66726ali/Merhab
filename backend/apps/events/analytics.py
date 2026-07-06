from django.db.models import Count, Q
from django.utils import timezone

from apps.events.cover_media import event_cover_url
from apps.events.models import Event
from apps.guests.models import Guest
from apps.guests.status_utils import (
    CONFIRMED_ATTENDANCE_STATUSES,
    PHYSICAL_PRESENCE_STATUSES,
    rate_percent,
)

AR_WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
AR_MONTHS = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]


def _event_queryset(platform_id: int | None = None):
    qs = Event.objects.select_related("platform", "created_by").annotate(
        guests_count=Count("guests", distinct=True),
        attended_count=Count(
            "guests",
            filter=Q(guests__status__in=PHYSICAL_PRESENCE_STATUSES),
            distinct=True,
        ),
        confirmed_count=Count(
            "guests",
            filter=Q(guests__status__in=CONFIRMED_ATTENDANCE_STATUSES),
            distinct=True,
        ),
    )
    if platform_id is not None:
        qs = qs.filter(platform_id=platform_id)
    return qs


def _serialize_event_brief(ev: Event, request=None, stats=None) -> dict:
    from apps.platforms.member_profile import _guest_stats_for_event

    if stats is None:
        stats = _guest_stats_for_event(ev.id)
    manager = ev.created_by.get_full_name().strip() or ev.created_by.email
    cover_path = event_cover_url(ev)
    if cover_path and request is not None:
        cover_path = request.build_absolute_uri(cover_path)
    return {
        "id": ev.id,
        "title": ev.title,
        "platform_id": ev.platform_id,
        "platform_name": ev.platform.name if ev.platform else "—",
        "manager_name": manager,
        "status": ev.status,
        "status_label": ev.get_status_display(),
        "guests_count": stats["guests_total"],
        "invited_count": stats["invited"],
        "attended_count": stats["attended"],
        "confirmed_count": stats["confirmed"],
        "declined_count": stats["declined"],
        "date": ev.date.isoformat() if ev.date else "",
        "venue": ev.venue or "",
        "cover_image": cover_path,
        "created_at": ev.created_at.isoformat(),
    }


def compute_event_stats(platform_id: int | None = None) -> dict:
    qs = _event_queryset(platform_id)
    total = qs.count()
    completed = qs.filter(status=Event.Status.COMPLETED).count()
    cancelled = qs.filter(status=Event.Status.CANCELLED).count()
    active = qs.filter(status=Event.Status.ACTIVE).count()
    archived = qs.filter(status=Event.Status.ARCHIVED).count()
    draft = qs.filter(status=Event.Status.DRAFT).count()

    guest_qs = Guest.objects.all()
    if platform_id is not None:
        guest_qs = guest_qs.filter(event__platform_id=platform_id)
    total_guests = guest_qs.count()
    if total_guests:
        confirmed = guest_qs.filter(
            status__in=CONFIRMED_ATTENDANCE_STATUSES
        ).count()
        confirmation_rate = rate_percent(confirmed, total_guests)
        non_confirmation_rate = round(min(100.0, 100 - confirmation_rate), 1)
    else:
        confirmation_rate = 0.0
        non_confirmation_rate = 0.0

    return {
        "total": total,
        "completed": completed,
        "cancelled": cancelled,
        "active": active,
        "archived": archived,
        "draft": draft,
        "confirmation_rate": confirmation_rate,
        "non_confirmation_rate": non_confirmation_rate,
    }


def latest_events(platform_id: int | None = None, limit: int = 5, request=None) -> list[dict]:
    from apps.platforms.member_profile import _guest_stats_bulk

    qs = _event_queryset(platform_id).order_by("-created_at")[:limit]
    events = list(qs)
    stats_map = _guest_stats_bulk([ev.id for ev in events])
    return [_serialize_event_brief(ev, request, stats_map.get(ev.id)) for ev in events]


def top_attendance_events(platform_id: int | None = None, limit: int = 5, request=None) -> list[dict]:
    from apps.platforms.member_profile import _guest_stats_bulk

    qs = _event_queryset(platform_id).order_by("-created_at")
    events = list(qs)
    stats_map = _guest_stats_bulk([ev.id for ev in events])

    def sort_key(ev: Event) -> tuple:
        stats = stats_map.get(ev.id) or {}
        return (
            stats.get("attended", 0),
            stats.get("confirmed", 0),
            stats.get("guests_total", 0),
        )

    ranked = sorted(events, key=sort_key, reverse=True)[:limit]
    return [_serialize_event_brief(ev, request, stats_map.get(ev.id)) for ev in ranked]


def _bar_heights(values: list[int]) -> list[str]:
    max_val = max(values, default=0) or 1
    return [f"{max(round(v / max_val * 100), 5 if v > 0 else 0)}%" for v in values]


def event_charts(platform_id: int | None = None) -> dict:
    qs = Event.objects.all()
    if platform_id is not None:
        qs = qs.filter(platform_id=platform_id)

    weekday_counts = [0] * 7
    for ev in qs.only("created_at"):
        if ev.created_at:
            weekday_counts[ev.created_at.weekday()] += 1
    weekday_mapped = [
        weekday_counts[6],
        weekday_counts[0],
        weekday_counts[1],
        weekday_counts[2],
        weekday_counts[3],
        weekday_counts[4],
        weekday_counts[5],
    ]

    year = timezone.now().year
    monthly_counts = [0] * 12
    for ev in qs.filter(created_at__year=year).only("created_at"):
        monthly_counts[ev.created_at.month - 1] += 1

    growth_labels: list[str] = []
    growth_values: list[int] = []
    now = timezone.now()
    for i in range(5, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        growth_labels.append(AR_MONTHS[m - 1])
        growth_values.append(qs.filter(created_at__year=y, created_at__month=m).count())

    # خريطة حرارية: أيام الأسبوع × فترات الساعات (ذروة النشاط)
    day_labels = list(AR_WEEKDAYS)
    hour_labels = ["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"]
    heatmap_matrix = [[0] * 6 for _ in range(7)]
    for ev in qs.only("created_at"):
        if not ev.created_at:
            continue
        day_idx = (ev.created_at.weekday() + 1) % 7
        hour_block = min(ev.created_at.hour // 4, 5)
        heatmap_matrix[day_idx][hour_block] += 1
    heatmap_max = max(max(row) for row in heatmap_matrix) if heatmap_matrix else 1
    if heatmap_max == 0:
        heatmap_max = 1

    return {
        "weekday": {
            "labels": AR_WEEKDAYS,
            "values": weekday_mapped,
            "heights": _bar_heights(weekday_mapped),
        },
        "monthly": {
            "labels": AR_MONTHS,
            "values": monthly_counts,
            "heights": _bar_heights(monthly_counts),
        },
        "growth": {
            "labels": growth_labels,
            "values": growth_values,
            "heights": _bar_heights(growth_values),
        },
        "peak": {
            "day_labels": day_labels,
            "hour_labels": hour_labels,
            "matrix": heatmap_matrix,
            "max": heatmap_max,
        },
    }


def events_overview(platform_id: int | None = None, request=None) -> dict:
    return {
        "stats": compute_event_stats(platform_id),
        "latest": latest_events(platform_id, 5, request),
        "top_attendance": top_attendance_events(platform_id, 5, request),
        "charts": event_charts(platform_id),
    }

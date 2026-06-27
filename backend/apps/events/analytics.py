from django.db.models import Count, Q
from django.utils import timezone

from apps.events.cover_media import event_cover_url
from apps.events.models import Event
from apps.guests.models import Guest

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
            filter=Q(guests__status=Guest.Status.ATTENDED),
            distinct=True,
        ),
        confirmed_count=Count(
            "guests",
            filter=Q(guests__status__in=[Guest.Status.CONFIRMED, Guest.Status.ATTENDED]),
            distinct=True,
        ),
    )
    if platform_id is not None:
        qs = qs.filter(platform_id=platform_id)
    return qs


def _serialize_event_brief(ev: Event) -> dict:
    manager = ev.created_by.get_full_name().strip() or ev.created_by.email
    return {
        "id": ev.id,
        "title": ev.title,
        "platform_id": ev.platform_id,
        "platform_name": ev.platform.name if ev.platform else "—",
        "manager_name": manager,
        "status": ev.status,
        "status_label": ev.get_status_display(),
        "guests_count": ev.guests_count,
        "attended_count": ev.attended_count,
        "confirmed_count": ev.confirmed_count,
        "date": ev.date.isoformat() if ev.date else "",
        "venue": ev.venue or "",
        "cover_image": event_cover_url(ev),
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
            status__in=[Guest.Status.CONFIRMED, Guest.Status.ATTENDED]
        ).count()
        confirmation_rate = round(confirmed / total_guests * 100, 1)
        non_confirmation_rate = round(100 - confirmation_rate, 1)
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


def latest_events(platform_id: int | None = None, limit: int = 5) -> list[dict]:
    qs = _event_queryset(platform_id).order_by("-created_at")[:limit]
    return [_serialize_event_brief(ev) for ev in qs]


def top_attendance_events(platform_id: int | None = None, limit: int = 5) -> list[dict]:
    qs = _event_queryset(platform_id).order_by("-attended_count", "-guests_count")[:limit]
    return [_serialize_event_brief(ev) for ev in qs]


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


def events_overview(platform_id: int | None = None) -> dict:
    return {
        "stats": compute_event_stats(platform_id),
        "latest": latest_events(platform_id, 5),
        "top_attendance": top_attendance_events(platform_id, 5),
        "charts": event_charts(platform_id),
    }

from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import ExtractMonth
from django.utils import timezone

from apps.events.cover_media import event_cover_url
from apps.events.models import Event, Schedule
from apps.guests.models import Guest
from apps.platforms.member_profile import (
    _empty_guest_stats,
    _guest_stats_bulk,
)
from apps.platforms.platform_events import _completion_meta
from apps.platforms.models import PlatformMember
from apps.staff.models import StaffMember
from config.cache_utils import cache_get_or_set

AR_MONTHS = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]


def _event_ids_for_platform(platform_id: int | None) -> list[int]:
    qs = Event.objects.all()
    if platform_id is not None:
        qs = qs.filter(platform_id=platform_id)
    return list(qs.values_list("id", flat=True))


def compute_kpis(platform_id: int | None = None) -> dict:
    event_ids = _event_ids_for_platform(platform_id)
    activities_count = len(event_ids)
    schedules_count = (
        Schedule.objects.filter(event_id__in=event_ids).count() if event_ids else 0
    )

    if platform_id is not None:
        members_count = PlatformMember.objects.filter(platform_id=platform_id).count()
    else:
        members_count = PlatformMember.objects.count()

    staff_count = (
        StaffMember.objects.filter(event_id__in=event_ids).values("user").distinct().count()
        if event_ids
        else 0
    )

    guests_count = 0
    attendance_rate = 0.0
    confirmation_rate = 0.0

    if event_ids:
        guest_agg = Guest.objects.filter(event_id__in=event_ids).aggregate(
            guests_count=Count("id"),
            attended=Count("id", filter=Q(status=Guest.Status.ATTENDED)),
            confirmed=Count(
                "id",
                filter=Q(status__in=[Guest.Status.CONFIRMED, Guest.Status.ATTENDED]),
            ),
        )
        guests_count = guest_agg["guests_count"] or 0
        if guests_count:
            attended = guest_agg["attended"] or 0
            confirmed = guest_agg["confirmed"] or 0
            attendance_rate = round(attended / guests_count * 100, 1)
            confirmation_rate = round(confirmed / guests_count * 100, 1)

    return {
        "activities_count": activities_count,
        "schedules_count": schedules_count,
        "staff_count": members_count + staff_count,
        "guests_count": guests_count,
        "attendance_rate": attendance_rate,
        "confirmation_rate": confirmation_rate,
    }


def monthly_rsvp_chart(event_ids: list[int]) -> dict:
    now = timezone.now()
    year = now.year
    labels = AR_MONTHS.copy()
    confirmed = [0] * 12
    declined = [0] * 12
    invited = [0] * 12

    if event_ids:
        rows = (
            Guest.objects.filter(event_id__in=event_ids, created_at__year=year)
            .annotate(month=ExtractMonth("created_at"))
            .values("month")
            .annotate(
                confirmed=Count(
                    "id",
                    filter=Q(status__in=[Guest.Status.CONFIRMED, Guest.Status.ATTENDED]),
                ),
                declined=Count("id", filter=Q(status=Guest.Status.DECLINED)),
                invited=Count("id", filter=Q(status=Guest.Status.INVITED)),
            )
        )
        for row in rows:
            month_idx = (row["month"] or 1) - 1
            if 0 <= month_idx < 12:
                confirmed[month_idx] = row["confirmed"] or 0
                declined[month_idx] = row["declined"] or 0
                invited[month_idx] = row["invited"] or 0

    max_val = max(max(confirmed + declined, default=0), 1)
    confirmed_heights = [f"{max(round(v / max_val * 100), 5)}%" for v in confirmed]
    declined_heights = [f"{max(round(v / max_val * 100), 5)}%" for v in declined]

    return {
        "labels": labels,
        "confirmed": confirmed,
        "declined": declined,
        "invited": invited,
        "confirmed_heights": confirmed_heights,
        "declined_heights": declined_heights,
    }


def rsvp_charts(platform_id: int | None = None) -> dict:
    event_ids = _event_ids_for_platform(platform_id)
    monthly = monthly_rsvp_chart(event_ids)
    return {"monthly": monthly}


def recent_activities(platform_id: int | None = None, limit: int = 6) -> list[dict]:
    qs = Event.objects.select_related("created_by").order_by("-created_at")
    if platform_id is not None:
        qs = qs.filter(platform_id=platform_id)
    events = list(qs[:limit])
    stats_map = _guest_stats_bulk([ev.id for ev in events])

    results = []
    for ev in events:
        organizer = ev.created_by.get_full_name().strip() or ev.created_by.email
        stats = stats_map.get(ev.id, _empty_guest_stats())
        completion = _completion_meta(ev)
        no_response = max(stats["guests_total"] - stats["responded"], 0)
        results.append({
            "id": ev.id,
            "title": ev.title,
            "organizer": organizer,
            "guests": stats["guests_total"],
            "guests_total": stats["guests_total"],
            "confirmed_count": stats["confirmed"],
            "attended_count": stats["attended"],
            "declined_count": stats["declined"],
            "no_response_count": no_response,
            "confirmation_rate": stats["confirmation_rate"],
            "attendance_rate": stats["attendance_rate"],
            "absence_rate": stats["absence_rate"],
            "completion_percent": completion["completion_percent"],
            "phase_label": completion["phase_label"],
            "status": ev.status,
            "status_label": ev.get_status_display(),
            "date": ev.date.isoformat() if ev.date else "",
            "venue": ev.venue or "",
            "cover_image": event_cover_url(ev),
            "created_at": ev.created_at.isoformat(),
        })
    return results


def _pct_change(current: float, previous: float) -> float:
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round((current - previous) / previous * 100, 1)


def _confirmation_rate(qs) -> float:
    total = qs.count()
    if not total:
        return 0.0
    confirmed = qs.filter(
        status__in=[Guest.Status.CONFIRMED, Guest.Status.ATTENDED]
    ).count()
    return round(confirmed / total * 100, 1)


def compute_kpi_cards(platform_id: int) -> list[dict]:
    kpis = compute_kpis(platform_id)
    now = timezone.now()
    start_30 = now - timedelta(days=30)
    start_60 = now - timedelta(days=60)

    events_cur = Event.objects.filter(
        platform_id=platform_id, created_at__gte=start_30
    ).count()
    events_prev = Event.objects.filter(
        platform_id=platform_id, created_at__gte=start_60, created_at__lt=start_30
    ).count()

    members_cur = PlatformMember.objects.filter(
        platform_id=platform_id, joined_at__gte=start_30
    ).count()
    members_prev = PlatformMember.objects.filter(
        platform_id=platform_id, joined_at__gte=start_60, joined_at__lt=start_30
    ).count()

    event_ids = _event_ids_for_platform(platform_id)
    guests_qs = (
        Guest.objects.filter(event_id__in=event_ids) if event_ids else Guest.objects.none()
    )
    guests_cur = guests_qs.filter(created_at__gte=start_30).count()
    guests_prev = guests_qs.filter(
        created_at__gte=start_60, created_at__lt=start_30
    ).count()

    eng_cur = _confirmation_rate(guests_qs.filter(created_at__gte=start_30))
    eng_prev = _confirmation_rate(
        guests_qs.filter(created_at__gte=start_60, created_at__lt=start_30)
    )
    eng_change = round(eng_cur - eng_prev, 1)

    return [
        {
            "key": "events",
            "label": "عدد الفعاليات",
            "value": kpis["activities_count"],
            "change_pct": _pct_change(events_cur, events_prev),
            "icon": "calendar_today",
            "color": "primary",
        },
        {
            "key": "users",
            "label": "عدد المستخدمين",
            "value": kpis["staff_count"],
            "change_pct": _pct_change(members_cur, members_prev),
            "icon": "group",
            "color": "tertiary",
        },
        {
            "key": "guests",
            "label": "إجمالي المدعوين",
            "value": kpis["guests_count"],
            "change_pct": _pct_change(guests_cur, guests_prev),
            "icon": "person_add",
            "color": "primary",
        },
        {
            "key": "engagement",
            "label": "نسبة التفاعل",
            "value": kpis["confirmation_rate"],
            "change_pct": eng_change,
            "icon": "analytics",
            "color": "primary",
            "is_percent": True,
        },
    ]


def event_growth_summary(platform_id: int) -> dict:
    now = timezone.now()
    year = now.year
    qs = Event.objects.filter(platform_id=platform_id)
    this_year = qs.filter(created_at__year=year).count()
    last_year = qs.filter(created_at__year=year - 1).count()

    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if month_start.month == 1:
        prev_month_start = month_start.replace(year=month_start.year - 1, month=12)
    else:
        prev_month_start = month_start.replace(month=month_start.month - 1)

    this_month = qs.filter(created_at__gte=month_start).count()
    prev_month = qs.filter(
        created_at__gte=prev_month_start, created_at__lt=month_start
    ).count()

    target = max(this_year, 1)
    progress = min(round(this_year / target * 100), 100)

    return {
        "yearly_growth_pct": _pct_change(this_year, last_year),
        "monthly_growth_pct": _pct_change(this_month, prev_month),
        "year_events": this_year,
        "progress_pct": progress,
    }


def cached_platform_overview_payload(platform_id: int) -> dict:
    """لوحة المنصة — مخزنة مؤقتاً لتقليل الضغط على قاعدة البيانات."""
    return cache_get_or_set(
        f"platform:overview:{platform_id}",
        lambda: {
            "kpis": compute_kpis(platform_id),
            "kpi_cards": compute_kpi_cards(platform_id),
            "event_growth": event_growth_summary(platform_id),
            "recent_activities": recent_activities(platform_id, limit=8),
            "rsvp_charts": rsvp_charts(platform_id),
        },
        timeout=120,
    )

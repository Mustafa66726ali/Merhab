"""لوحة تحكم مدير الفعالية — بيانات الفعاليات المُعيَّن عليها فقط."""

from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.events.cover_media import event_cover_url
from apps.events.models import Event, Schedule
from apps.guests.models import Guest
from apps.platforms.analytics import _pct_change, monthly_rsvp_chart
from apps.platforms.member_profile import (
    _empty_guest_stats,
    _guest_stats_bulk,
    managed_events_queryset,
    member_event_stats,
)
from apps.platforms.platform_events import _completion_meta
from apps.staff.models import StaffMember


def _managed_event_ids(user_id: int, platform_id: int) -> list[int]:
    return list(
        managed_events_queryset(user_id, platform_id).values_list("id", flat=True)
    )


def _compute_managed_kpis(event_ids: list[int]) -> dict:
    guests_count = 0
    attendance_rate = 0.0
    confirmation_rate = 0.0
    if event_ids:
        agg = Guest.objects.filter(event_id__in=event_ids).aggregate(
            guests_count=Count("id"),
            attended=Count("id", filter=Q(status=Guest.Status.ATTENDED)),
            confirmed=Count(
                "id",
                filter=Q(status__in=[Guest.Status.CONFIRMED, Guest.Status.ATTENDED]),
            ),
        )
        guests_count = agg["guests_count"] or 0
        if guests_count:
            attended = agg["attended"] or 0
            confirmed = agg["confirmed"] or 0
            attendance_rate = round(attended / guests_count * 100, 1)
            confirmation_rate = round(confirmed / guests_count * 100, 1)
    return {
        "activities_count": len(event_ids),
        "guests_count": guests_count,
        "attendance_rate": attendance_rate,
        "confirmation_rate": confirmation_rate,
        "staff_count": 0,
        "schedules_count": 0,
    }


def _recent_managed_activities(user_id: int, platform_id: int, limit: int = 8) -> list[dict]:
    events = list(
        managed_events_queryset(user_id, platform_id)
        .select_related("created_by")
        .order_by("-created_at")[:limit]
    )
    stats_map = _guest_stats_bulk([e.id for e in events])
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


def _managed_event_growth(user_id: int, platform_id: int) -> dict:
    qs = managed_events_queryset(user_id, platform_id)
    now = timezone.now()
    year = now.year
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


def _managed_kpi_cards(user_id: int, platform_id: int, kpis: dict, stats: dict) -> list[dict]:
    now = timezone.now()
    start_30 = now - timedelta(days=30)
    start_60 = now - timedelta(days=60)
    event_ids = _managed_event_ids(user_id, platform_id)
    qs = managed_events_queryset(user_id, platform_id)

    events_cur = qs.filter(created_at__gte=start_30).count()
    events_prev = qs.filter(created_at__gte=start_60, created_at__lt=start_30).count()

    guests_qs = Guest.objects.filter(event_id__in=event_ids) if event_ids else Guest.objects.none()
    guests_cur = guests_qs.filter(created_at__gte=start_30).count()
    guests_prev = guests_qs.filter(created_at__gte=start_60, created_at__lt=start_30).count()

    return [
        {
            "key": "events",
            "label": "مناسباتي",
            "value": stats["total"],
            "change_pct": _pct_change(events_cur, events_prev),
            "icon": "calendar_today",
            "color": "primary",
        },
        {
            "key": "active",
            "label": "نشطة الآن",
            "value": stats["active"],
            "change_pct": 0,
            "icon": "event_available",
            "color": "tertiary",
        },
        {
            "key": "guests",
            "label": "إجمالي الضيوف",
            "value": kpis["guests_count"],
            "change_pct": _pct_change(guests_cur, guests_prev),
            "icon": "group",
            "color": "primary",
        },
        {
            "key": "engagement",
            "label": "نسبة التأكيد",
            "value": kpis["confirmation_rate"],
            "change_pct": 0,
            "icon": "analytics",
            "color": "primary",
            "is_percent": True,
        },
    ]


def _team_preview_for_managed_events(user_id: int, platform_id: int, limit: int = 8) -> list[dict]:
    event_ids = _managed_event_ids(user_id, platform_id)
    if not event_ids:
        return []
    rows = (
        StaffMember.objects.filter(event_id__in=event_ids, is_active=True)
        .select_related("user", "event")
        .order_by("-assigned_at")[:limit]
    )
    preview = []
    for sm in rows:
        user = sm.user
        name = user.get_full_name().strip() or user.email
        preview.append({
            "id": user.id,
            "name": name,
            "email": user.email,
            "role_label": sm.get_role_display(),
            "event_title": sm.event.title,
            "avatar_initial": (name[0] if name else "?").upper(),
            "joined_at": sm.assigned_at.isoformat() if sm.assigned_at else "",
        })
    return preview


def build_event_manager_overview(user_id: int, platform_id: int) -> dict:
    stats = member_event_stats(user_id, platform_id)
    event_ids = _managed_event_ids(user_id, platform_id)
    kpis = _compute_managed_kpis(event_ids)
    kpis["staff_count"] = (
        StaffMember.objects.filter(event_id__in=event_ids, is_active=True)
        .values("user")
        .distinct()
        .count()
        if event_ids
        else 0
    )
    kpis["schedules_count"] = (
        Schedule.objects.filter(event_id__in=event_ids).count() if event_ids else 0
    )

    return {
        "kpis": kpis,
        "kpi_cards": _managed_kpi_cards(user_id, platform_id, kpis, stats),
        "event_growth": _managed_event_growth(user_id, platform_id),
        "recent_activities": _recent_managed_activities(user_id, platform_id, limit=8),
        "rsvp_charts": {"monthly": monthly_rsvp_chart(event_ids)},
        "team_preview": _team_preview_for_managed_events(user_id, platform_id, limit=8),
        "event_stats": stats,
    }

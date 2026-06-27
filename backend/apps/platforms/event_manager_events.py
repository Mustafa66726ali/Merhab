"""لوحة قائمة مناسبات مدير الفعالية — نفس بنية منصة المنصة لكن للفعاليات المُدارة فقط."""

from __future__ import annotations

from django.db.models import Count, Q
from django.utils import timezone

from apps.events.models import Event
from apps.platforms.member_profile import managed_events_queryset
from apps.platforms.platform_events import (
    PHASE_OPTIONS,
    STATUS_OPTIONS,
    _event_queryset,
    _serialize_event_card,
    _serialize_event_row,
    _serialize_events_batch,
)


def _managed_events_queryset(user_id: int, platform_id: int):
    ids = list(managed_events_queryset(user_id, platform_id).values_list("id", flat=True))
    if not ids:
        return _event_queryset(platform_id).none()
    return _event_queryset(platform_id).filter(id__in=ids)


def _stats_for_queryset(qs) -> dict:
    today = timezone.localdate()
    agg = qs.aggregate(
        total=Count("id"),
        completed=Count("id", filter=Q(status=Event.Status.COMPLETED)),
        active_now=Count("id", filter=Q(status=Event.Status.ACTIVE)),
        scheduled=Count(
            "id",
            filter=Q(
                status__in=[Event.Status.ACTIVE, Event.Status.DRAFT],
                date__gt=today,
            ),
        ),
        draft=Count("id", filter=Q(status=Event.Status.DRAFT)),
    )
    return {
        "total": agg["total"] or 0,
        "completed": agg["completed"] or 0,
        "active_now": agg["active_now"] or 0,
        "scheduled": agg["scheduled"] or 0,
        "draft": agg["draft"] or 0,
    }


def build_event_manager_events_dashboard(
    user_id: int,
    platform_id: int,
    platform_name: str,
) -> dict:
    qs = _managed_events_queryset(user_id, platform_id)
    active_events = list(
        qs.filter(status=Event.Status.ACTIVE).order_by("-date", "-time")
    )
    recent_events = list(qs.order_by("-created_at")[:5])
    all_events = list(qs.order_by("-created_at"))

    return {
        "platform": {"id": platform_id, "name": platform_name},
        "stats": _stats_for_queryset(qs),
        "active_now": _serialize_events_batch(
            active_events, platform_id, _serialize_event_card
        ),
        "recent_events": _serialize_events_batch(
            recent_events, platform_id, _serialize_event_card
        ),
        "top_attendance": [],
        "bottom_attendance": [],
        "events": _serialize_events_batch(all_events, platform_id, _serialize_event_row),
        "status_options": STATUS_OPTIONS,
        "phase_options": PHASE_OPTIONS,
    }

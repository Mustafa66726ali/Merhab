"""تجميع إحصائيات الضيوف من الاستعلام — نفس منطق لوحة المنصة."""

from django.db.models import Count, Q, QuerySet

from apps.guests.models import Guest
from apps.guests.status_utils import (
    CONFIRMED_ATTENDANCE_STATUSES,
    PHYSICAL_PRESENCE_STATUSES,
    RESPONDED_STATUSES,
    rate_percent,
)


def aggregate_guest_stats(queryset: QuerySet) -> dict:
    agg = queryset.aggregate(
        total=Count("id"),
        invited=Count("id", filter=Q(status=Guest.Status.INVITED)),
        pending=Count("id", filter=Q(status=Guest.Status.PENDING)),
        confirmed=Count("id", filter=Q(status__in=CONFIRMED_ATTENDANCE_STATUSES)),
        attended=Count("id", filter=Q(status__in=PHYSICAL_PRESENCE_STATUSES)),
        seated=Count("id", filter=Q(status=Guest.Status.SEATED)),
        declined=Count("id", filter=Q(status=Guest.Status.DECLINED)),
        cancelled=Count("id", filter=Q(status=Guest.Status.CANCELLED)),
        responded=Count("id", filter=Q(status__in=RESPONDED_STATUSES)),
    )
    total = agg["total"] or 0
    confirmed = agg["confirmed"] or 0
    attended = agg["attended"] or 0
    declined = agg["declined"] or 0
    return {
        "total": total,
        "invited": agg["invited"] or 0,
        "pending": agg["pending"] or 0,
        "confirmed": confirmed,
        "attended": attended,
        "seated": agg["seated"] or 0,
        "declined": declined,
        "cancelled": agg["cancelled"] or 0,
        "responded": agg["responded"] or 0,
        "confirmation_rate": rate_percent(confirmed, total),
        "attendance_rate": rate_percent(attended, total),
    }

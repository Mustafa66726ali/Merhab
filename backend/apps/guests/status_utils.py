"""مجموعات حالات الضيف المستخدمة في الإحصائيات والتقارير."""

from apps.guests.models import Guest

# أكّد الحضور (RSVP أو حضر فعلياً أو جلس)
CONFIRMED_ATTENDANCE_STATUSES = (
    Guest.Status.CONFIRMED,
    Guest.Status.ATTENDED,
    Guest.Status.SEATED,
)

# حضور فعلي في القاعة (مسح QR أو جلس)
PHYSICAL_PRESENCE_STATUSES = (
    Guest.Status.ATTENDED,
    Guest.Status.SEATED,
)

RESPONDED_STATUSES = (
    Guest.Status.CONFIRMED,
    Guest.Status.ATTENDED,
    Guest.Status.SEATED,
    Guest.Status.DECLINED,
)


def is_confirmed_attendance(status: str) -> bool:
    return status in CONFIRMED_ATTENDANCE_STATUSES


def is_physical_presence(status: str) -> bool:
    return status in PHYSICAL_PRESENCE_STATUSES


def rate_percent(part: int, whole: int, *, cap: float = 100.0) -> float:
    """نسبة مئوية منطقية — لا تتجاوز 100% افتراضياً."""
    if not whole or part <= 0:
        return 0.0
    return round(min(cap, part / whole * 100), 1)

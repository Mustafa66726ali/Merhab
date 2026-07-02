"""بدء/إنهاء الفعالية واشتراط أن تكون «تعمل الآن» للعمليات الحية."""

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.events.models import Event


def require_event_live(event: Event, message: str | None = None) -> None:
    """يُسمح بإدخال الضيوف والإجلاس والحضور فقط أثناء تشغيل الفعالية."""
    if event.status == Event.Status.ACTIVE:
        return
    default = "لا يمكن تنفيذ هذه العملية — الفعالية ليست قيد التشغيل حالياً"
    raise ValidationError({"detail": message or default})


def can_start_event(event: Event) -> bool:
    return event.status in (Event.Status.DRAFT, Event.Status.COMPLETED)


def can_end_event(event: Event) -> bool:
    return event.status == Event.Status.ACTIVE


def start_event(event: Event) -> Event:
    if not can_start_event(event):
        raise ValidationError({"detail": "لا يمكن بدء هذه الفعالية في حالتها الحالية"})
    event.status = Event.Status.ACTIVE
    event.started_at = timezone.now()
    event.ended_at = None
    event.save(update_fields=["status", "started_at", "ended_at", "updated_at"])
    return event


def end_event(event: Event) -> Event:
    if not can_end_event(event):
        raise ValidationError({"detail": "الفعالية غير قيد التشغيل — لا يمكن إنهاؤها"})
    event.status = Event.Status.COMPLETED
    event.ended_at = timezone.now()
    event.save(update_fields=["status", "ended_at", "updated_at"])
    return event

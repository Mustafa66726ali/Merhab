"""مسارات صور الفعاليات."""

from apps.events.models import Event


def event_cover_url(event: Event) -> str:
    if not event.cover_image:
        return ""
    try:
        return event.cover_image.url or ""
    except (ValueError, OSError):
        return ""

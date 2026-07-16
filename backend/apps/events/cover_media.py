"""مسارات صور الفعاليات."""

from apps.events.models import Event


def event_cover_url(event: Event) -> str:
    if not event.cover_image:
        return ""
    version = int(event.updated_at.timestamp()) if event.updated_at else 0
    return f"/api/v1/events/events/{event.pk}/cover/?v={version}"

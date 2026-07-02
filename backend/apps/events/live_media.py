"""إعدادات البث المباشر/الصوتي للفعالية — للضيوف عبر رابط الدعوة."""

from __future__ import annotations

import re
import uuid

from django.conf import settings
from django.db import models

YOUTUBE_RE = re.compile(
    r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/live/)([a-zA-Z0-9_-]{11})"
)

LIVE_MEDIA_MODES = (
    ("off", "متوقف"),
    ("audio_file", "ملف صوتي"),
    ("youtube", "يوتيوب"),
    ("microphone", "ميكروفون مباشر"),
    ("camera", "كamera مباشر"),
)

STREAM_MODES = frozenset({"microphone", "camera"})


def youtube_embed_url(url: str) -> str:
    if not url:
        return ""
    match = YOUTUBE_RE.search(url.strip())
    if match:
        return f"https://www.youtube.com/embed/{match.group(1)}?autoplay=0&rel=0"
    return ""


def _media_url(request, file_field) -> str | None:
    if not file_field:
        return None
    try:
        path = file_field.url
    except ValueError:
        return None
    if request and path.startswith("/"):
        return request.build_absolute_uri(path)
    return path


def ensure_broadcast_token(event) -> None:
    if event.live_broadcast_token:
        return
    event.live_broadcast_token = uuid.uuid4()
    event.save(update_fields=["live_broadcast_token"])


def broadcast_public_url(event) -> str:
    ensure_broadcast_token(event)
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}/live/{event.live_broadcast_token}"


def build_live_media_payload(event, request=None, *, include_broadcast_url: bool = False) -> dict:
    """حمولة البث للواجهات العامة والإدارية."""
    mode = event.live_media_mode or "off"
    enabled = bool(event.live_media_enabled and mode != "off")
    stream_active = bool(enabled and mode in STREAM_MODES and event.live_stream_active)

    audio_url = None
    if enabled and mode == "audio_file" and event.live_audio_file:
        audio_url = _media_url(request, event.live_audio_file)

    youtube_embed = None
    if enabled and mode == "youtube":
        youtube_embed = youtube_embed_url(event.live_youtube_url or "")

    stream_url = None
    if enabled and mode in STREAM_MODES and event.live_stream_file:
        stream_url = _media_url(request, event.live_stream_file)
        if stream_url and event.live_stream_rev:
            sep = "&" if "?" in stream_url else "?"
            stream_url = f"{stream_url}{sep}v={event.live_stream_rev}"

    payload = {
        "enabled": enabled,
        "mode": mode,
        "mode_label": dict(LIVE_MEDIA_MODES).get(mode, mode),
        "audio_url": audio_url,
        "youtube_embed_url": youtube_embed or None,
        "youtube_url": (event.live_youtube_url or "").strip() or None,
        "stream_active": stream_active,
        "stream_url": stream_url if stream_active else None,
        "stream_kind": "video" if mode == "camera" else "audio" if mode == "microphone" else None,
        "stream_rev": event.live_stream_rev or 0,
    }
    if include_broadcast_url and event.live_broadcast_token:
        payload["broadcast_url"] = broadcast_public_url(event)
    elif include_broadcast_url:
        payload["broadcast_url"] = None
    return payload


class LiveMediaMode(models.TextChoices):
    OFF = "off", "متوقف"
    AUDIO_FILE = "audio_file", "ملف صوتي"
    YOUTUBE = "youtube", "يوتيوب"
    MICROPHONE = "microphone", "ميكروفون مباشر"
    CAMERA = "camera", "كamera مباشر"

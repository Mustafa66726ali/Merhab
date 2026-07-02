"""نقاط النهاية العامة لصفحة البث المباشر."""

from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.events.live_media import build_live_media_payload
from apps.events.models import Event


def _abs_url(file_field) -> str | None:
    if not file_field:
        return None
    try:
        return file_field.url
    except ValueError:
        return None


def broadcast_payload(event) -> dict:
    return {
        "event": {
            "title": event.title,
            "cover_image": _abs_url(event.cover_image),
            "platform_name": event.platform.name if event.platform_id else "",
        },
        "live_media": build_live_media_payload(event),
    }


def _get_event(token):
    return get_object_or_404(
        Event.objects.select_related("platform"),
        live_broadcast_token=token,
    )


class PublicBroadcastView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        event = _get_event(token)
        return Response(broadcast_payload(event))


class PublicBroadcastLiveMediaView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        event = _get_event(token)
        return Response(build_live_media_payload(event))

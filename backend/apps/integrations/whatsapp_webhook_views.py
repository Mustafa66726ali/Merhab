"""Webhooks لردود واتساب — Twilio / Meta / البوت المحلي."""

from __future__ import annotations

import json

import logging

from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .whatsapp_inbound import handle_rsvp_inbound


def _check_bot_secret(request) -> bool:
    expected = getattr(settings, "WHATSAPP_BOT_TOKEN", "")
    header = (
        getattr(request, "headers", {}).get("Authorization", "")
        or request.META.get("HTTP_AUTHORIZATION", "")
    )
    token = header[7:] if header.startswith("Bearer ") else ""
    return bool(expected) and token == expected


@csrf_exempt
@require_http_methods(["GET", "POST"])
def meta_whatsapp_webhook(request):
    """تحقق Meta + استقبال ردود الأزرار."""
    if request.method == "GET":
        mode = request.GET.get("hub.mode")
        token = request.GET.get("hub.verify_token")
        challenge = request.GET.get("hub.challenge")
        verify = getattr(settings, "WHATSAPP_WEBHOOK_VERIFY_TOKEN", "merhab-verify")
        if mode == "subscribe" and token == verify:
            return HttpResponse(challenge)
        return HttpResponse(status=403)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return HttpResponse(status=400)

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for msg in value.get("messages", []):
                phone = msg.get("from", "")
                msg_type = msg.get("type")
                button_id = ""
                text = ""
                if msg_type == "interactive":
                    interactive = msg.get("interactive", {})
                    if interactive.get("type") == "button_reply":
                        button_id = interactive.get("button_reply", {}).get("id", "")
                elif msg_type == "text":
                    text = msg.get("text", {}).get("body", "")
                if button_id or text:
                    handle_rsvp_inbound(phone=phone, button_id=button_id, text=text)

    return HttpResponse(status=200)


@csrf_exempt
@require_http_methods(["POST"])
def twilio_whatsapp_webhook(request):
    """Twilio — زر Quick Reply أو نص الرد."""
    button_id = request.POST.get("ButtonPayload", "") or request.POST.get("ButtonText", "")
    text = request.POST.get("Body", "")
    phone = request.POST.get("From", "").replace("whatsapp:", "").replace("+", "")
    handle_rsvp_inbound(phone=phone, button_id=button_id, text=text)
    return HttpResponse(status=200)


@csrf_exempt
@require_http_methods(["POST"])
def twilio_whatsapp_status_callback(request):
    """Twilio — تحديث حالة التسليم (failed/delivered/...)."""
    sid = request.POST.get("MessageSid", "")
    status = request.POST.get("MessageStatus", "")
    error_code = request.POST.get("ErrorCode", "")
    error_message = request.POST.get("ErrorMessage", "")
    to = request.POST.get("To", "")
    if error_code or status in ("failed", "undelivered"):
        logger.warning(
            "Twilio delivery failed sid=%s to=%s status=%s code=%s msg=%s",
            sid,
            to,
            status,
            error_code,
            error_message,
        )
    else:
        logger.info("Twilio delivery sid=%s to=%s status=%s", sid, to, status)
    return HttpResponse(status=200)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def bot_whatsapp_inbound(request):
    """البوت المحلي يُبلّغ الباك-إند برد الضيف."""
    if not _check_bot_secret(request):
        return Response({"detail": "غير مصرّح"}, status=401)

    data = request.data
    result = handle_rsvp_inbound(
        phone=str(data.get("from") or data.get("phone") or ""),
        button_id=str(data.get("button_id") or ""),
        text=str(data.get("text") or data.get("body") or ""),
        public_token=str(data.get("guest_token") or ""),
    )
    status_code = 200 if result.get("ok") else 400
    return Response(result, status=status_code)

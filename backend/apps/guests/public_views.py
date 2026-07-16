"""نقاط النهاية العامة (بدون مصادقة) لدعوة الضيف والرد عليها عبر رمز فريد.

يفتح الضيف رابط الدعوة الذي يحمل ``public_token`` ثم يختار:
- تأكيد الحضور  → الحالة ``confirmed`` ويُنشأ له رمز QR فريد فوراً.
- الاعتذار       → الحالة ``declined``.

كما توفّر حمولة غنية لبطاقة الدعوة (البرنامج الزمني، حضور المجموعة، المنسّق).
"""

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.events.cover_media import event_cover_url
from apps.integrations.whatsapp_send import build_whatsapp_url
from apps.platforms.platform_events import _location_label

from apps.events.live_media import build_live_media_payload

from .inbound_messages import (
    record_guest_greeting,
    record_guest_inquiry,
    resolve_event_coordinator,
)
from .models import Guest
from .qr_utils import build_guest_qr_png, ensure_guest_qr
from .rsvp_actions import apply_guest_rsvp

GOING_STATUSES = (
    Guest.Status.CONFIRMED,
    Guest.Status.ATTENDED,
    Guest.Status.SEATED,
)


def _abs_url(request, file_field) -> str | None:
    """يُرجع مسار الوسائط نسبياً (مثل ``/media/...``) ليُحمَّل عبر نفس أصل
    الواجهة (المنفذ 3000) ويُمرَّر داخلياً للباك-إند — فيعمل من أي جهاز دون
    الحاجة للوصول المباشر إلى المنفذ 8000."""
    if not file_field:
        return None
    try:
        return file_field.url
    except ValueError:
        return None


def _initials(name: str) -> str:
    parts = (name or "").strip().split()
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2]
    return (parts[0][:1] + parts[-1][:1]).upper()


def _coordinator(event) -> dict | None:
    user = resolve_event_coordinator(event)
    if not user:
        return None
    name = (user.get_full_name() or "").strip() or "منسّق الحفل"
    phone = getattr(user, "phone", "") or ""
    return {
        "name": name,
        "phone": phone,
        "whatsapp_url": build_whatsapp_url(phone) if phone else None,
    }


def invitation_payload(request, guest: Guest) -> dict:
    """يبني حمولة الدعوة العامة الآمنة (بدون بيانات حساسة)."""
    event = guest.event
    show_qr = guest.status in GOING_STATUSES
    qr_url = _abs_url(request, guest.qr_code) if (show_qr and guest.qr_code) else None

    schedules = [
        {
            "title": s.title,
            "description": s.description,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "location": s.location,
        }
        for s in event.schedules.all().order_by("order", "start_time")
    ]

    group_members = []
    if guest.group_id:
        members = (
            Guest.objects.filter(event_id=event.id, group_id=guest.group_id)
            .order_by("full_name")[:40]
        )
        group_members = [
            {
                "full_name": m.full_name,
                "initials": _initials(m.full_name),
                "going": m.status in GOING_STATUSES,
                "declined": m.status == Guest.Status.DECLINED,
                "is_self": m.id == guest.id,
                "status": m.status,
            }
            for m in members
        ]

    return {
        "guest": {
            "full_name": guest.full_name,
            "status": guest.status,
            "status_label": guest.get_status_display(),
            "section_name": guest.section.name if guest.section else "",
            "group_name": guest.group.name if guest.group else "",
            "greeting": guest.greeting,
            "responded_at": guest.responded_at,
        },
        "event": {
            "title": event.title,
            "description": event.description,
            "date": event.date,
            "time": event.time,
            "end_date": event.end_date,
            "end_time": event.end_time,
            "venue": event.venue,
            "geo_address": event.geo_address,
            "latitude": event.latitude,
            "longitude": event.longitude,
            "location": _location_label(event),
            "cover_image": event_cover_url(event) or None,
            "platform_name": event.platform.name if event.platform_id else "",
            "invitation_title": event.invitation_title,
            "invitation_message": event.invitation_message,
        },
        "live_media": build_live_media_payload(event),
        "schedules": schedules,
        "group_members": group_members,
        "coordinator": _coordinator(event),
        "qr_url": qr_url,
        "can_respond": guest.status
        in (Guest.Status.PENDING, Guest.Status.INVITED, Guest.Status.CONFIRMED, Guest.Status.DECLINED),
    }


def _get_guest(token):
    return get_object_or_404(
        Guest.objects.select_related(
            "event", "event__platform", "event__created_by", "section", "group"
        ),
        public_token=token,
    )


class PublicInvitationLiveMediaView(APIView):
    """استطلاع خفيف لحالة البث — للضيوف أثناء البث المباشر."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        guest = _get_guest(token)
        return Response(build_live_media_payload(guest.event))


class PublicInvitationQrView(APIView):
    """صورة QR عامة لـ Twilio/Meta MediaUrl — فقط بعد تأكيد الحضور."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        guest = _get_guest(token)
        if guest.status not in GOING_STATUSES:
            return HttpResponse(status=404)
        ensure_guest_qr(guest)
        guest.refresh_from_db()
        png = build_guest_qr_png(guest.public_token)
        response = HttpResponse(png, content_type="image/png")
        response["Cache-Control"] = "public, max-age=300"
        response["Content-Disposition"] = f'inline; filename="guest-{token}.png"'
        return response


class PublicInvitationView(APIView):
    """عرض بيانات الدعوة عبر الرمز الفريد."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        guest = _get_guest(token)
        return Response(invitation_payload(request, guest))


class PublicInvitationRespondView(APIView):
    """تسجيل رد الضيف: تأكيد الحضور أو الاعتذار."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, token):
        guest = _get_guest(token)
        action = (request.data.get("action") or "").strip().lower()
        if action not in ("confirm", "decline"):
            return Response(
                {"detail": "الإجراء غير صالح — اختر تأكيد الحضور أو الاعتذار"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if guest.status in (Guest.Status.ATTENDED, Guest.Status.SEATED):
            return Response(
                {"detail": "تم تسجيل حضورك بالفعل", **invitation_payload(request, guest)},
                status=status.HTTP_409_CONFLICT,
            )

        apply_guest_rsvp(
            guest,
            confirm=(action == "confirm"),
            # إعادة التأكيد من الصفحة تعيد الإرسال إن حان موعد التذكير
            force_reminder_delivery=(action == "confirm"),
        )
        guest.refresh_from_db()
        return Response(invitation_payload(request, guest))


class PublicInvitationGreetingView(APIView):
    """حفظ كلمة التهنئة المرسَلة من الضيف."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, token):
        guest = _get_guest(token)
        message = (request.data.get("message") or "").strip()[:2000]
        if not message:
            return Response(
                {"detail": "نص التهنئة مطلوب"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        record_guest_greeting(guest, message)
        return Response({"ok": True, "greeting": guest.greeting})


class PublicInvitationInquiryView(APIView):
    """إرسال استفسار مباشر من الضيف إلى منسّق الحفل."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, token):
        guest = _get_guest(token)
        message = (request.data.get("message") or "").strip()[:2000]
        if not message:
            return Response(
                {"detail": "نص الاستفسار مطلوب"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        _, coordinator = record_guest_inquiry(guest, message)
        if not coordinator:
            return Response(
                {"detail": "لا يوجد منسّق معيّن لهذه المناسبة حالياً"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"ok": True})

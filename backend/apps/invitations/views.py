"""إدارة الدعوات: قالب الدعوة الافتراضي للفعالية + إرسال دفعات عبر واتساب.

الإرسال يبني رابط دعوة فريداً لكل ضيف (يحمل ``public_token``) ورسالة واتساب
جاهزة. يدعم تخصيص الرسالة حسب القسم/المجموعة/الضيف قبل الإرسال.
"""

from django.conf import settings
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.accounts.models import User
from apps.events.models import Event
from apps.guests.models import Guest
from apps.integrations.whatsapp_send import build_whatsapp_url, dispatch_whatsapp
from apps.platforms.platform_permissions import (
    PERM_SEND_MESSAGES,
    get_platform_for_user,
    require_event_access,
    require_platform_permission,
)

from .models import Invitation
from .serializers import InvitationSerializer

DEFAULT_TEMPLATE = (
    "مرحباً {name}،\n"
    "يسعدنا دعوتك لحضور: {event}\n"
    "📅 التاريخ: {date} - {time}\n"
    "📍 المكان: {venue}\n\n"
    "يرجى تأكيد حضورك عبر الرابط التالي:\n{link}"
)

# تذكير لمن لم يؤكّد الحضور بعد — يحثّه على التأكيد عبر الرابط
DEFAULT_REMINDER_UNCONFIRMED = (
    "تذكير ودّي {name} 🌿\n"
    "لم نستلم تأكيد حضورك بعد لمناسبة: {event}\n"
    "📅 التاريخ: {date} - {time}\n"
    "📍 المكان: {venue}\n\n"
    "نرجو تأكيد حضورك أو الاعتذار عبر الرابط:\n{link}"
)

# تذكير لمن أكّد الحضور — تذكير بموعد المناسبة وبطاقة الدخول
DEFAULT_REMINDER_CONFIRMED = (
    "تذكير بموعد المناسبة {name} 🎉\n"
    "يسعدنا لقاؤك في: {event}\n"
    "📅 التاريخ: {date} - {time}\n"
    "📍 المكان: {venue}\n\n"
    "احتفظ ببطاقة دخولك (QR) عبر الرابط:\n{link}"
)


def _filter_audience(guests, data):
    """تصفية الضيوف حسب الجمهور المستهدف (محددون/قسم/مجموعة)."""
    guest_ids = data.get("guest_ids")
    section_id = data.get("section")
    group_id = data.get("group")
    if guest_ids:
        guests = guests.filter(id__in=guest_ids)
    if section_id:
        guests = guests.filter(section_id=section_id)
    if group_id:
        guests = guests.filter(group_id=group_id)
    return guests


def _scope_events(user):
    qs = Event.objects.select_related("platform")
    if user.role == User.Role.SYSTEM_MANAGER:
        return qs
    if user.role == User.Role.PLATFORM_ADMIN:
        platform = get_platform_for_user(user)
        return qs.filter(platform_id=platform.id) if platform else qs.none()
    from django.db.models import Q

    return qs.filter(Q(created_by=user) | Q(managers=user)).distinct()


def _render_message(
    template: str, guest: Guest, invite_url: str, include_link: bool = True
) -> str:
    """يبني نص الرسالة من القالب.

    عند ``include_link=False`` يُحذف عنصر الرابط النائب (والسطر الحاوي له)
    لإرسال الرابط لاحقاً في رسالة منفصلة قابلة للنقر.
    """
    event = guest.event
    mapping = {
        "name": guest.full_name,
        "event": event.title,
        "date": event.date.strftime("%Y-%m-%d") if event.date else "",
        "time": event.time.strftime("%H:%M") if event.time else "",
        "venue": event.venue or "",
        "section": guest.section.name if guest.section else "",
        "group": guest.group.name if guest.group else "",
        "link": invite_url,
    }
    out = template or DEFAULT_TEMPLATE
    has_link = "{link}" in out
    for key, value in mapping.items():
        if key == "link" and not include_link:
            continue
        out = out.replace("{" + key + "}", str(value))

    if not include_link:
        # احذف السطر الذي يحمل عنصر الرابط النائب فقط، وأبقِ بقية النص
        lines = [ln for ln in out.splitlines() if "{link}" not in ln]
        return "\n".join(lines).rstrip()

    # ضمان تضمين رابط الدعوة القابل للنقر دائماً، حتى لو حُذف الحقل من القالب
    if not has_link and invite_url not in out:
        out = out.rstrip() + "\n\n" + invite_url
    return out


def _dispatch_split(phone: str, text_body: str, invite_url: str) -> dict:
    """يُرسل رسالتين منفصلتين: النص أولاً ثم الرابط وحده (قابل للنقر).

    يُرجع نتيجة مجمّعة: ``sent`` يكون True فقط إذا نجح إرسال الرسالتين.
    """
    out_text = dispatch_whatsapp(phone, text_body)
    out_link = dispatch_whatsapp(phone, invite_url)
    sent = bool(out_text.get("sent")) and bool(out_link.get("sent"))
    detail = out_link.get("detail") or out_text.get("detail") or ""
    return {"sent": sent, "detail": detail}


class InvitationViewSet(viewsets.ModelViewSet):
    serializer_class = InvitationSerializer
    filterset_fields = ["event", "guest", "method", "status"]

    def get_queryset(self):
        return Invitation.objects.select_related("guest", "event").filter(
            event__in=_scope_events(self.request.user)
        )

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        invitation = self.get_object()
        require_event_access(request.user, invitation.event)
        invitation.status = Invitation.Status.SENT
        invitation.sent_at = timezone.now()
        invitation.save(update_fields=["status", "sent_at"])
        return Response(InvitationSerializer(invitation).data)

    @action(detail=False, methods=["get", "put"], url_path="template")
    def template(self, request):
        """جلب/تحديث قالب الدعوة الافتراضي للفعالية (?event=ID)."""
        event_id = request.query_params.get("event") or request.data.get("event")
        if not event_id:
            raise ValidationError({"event": "معرّف الفعالية مطلوب"})
        event = _scope_events(request.user).filter(pk=event_id).first()
        if not event:
            return Response(
                {"detail": "الفعالية غير موجودة أو خارج نطاق صلاحياتك"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.method == "PUT":
            require_platform_permission(
                request.user,
                PERM_SEND_MESSAGES,
                "غير مصرح — لا تملك صلاحية إرسال الرسائل",
            )
            require_event_access(request.user, event)
            event.invitation_title = request.data.get(
                "invitation_title", event.invitation_title
            )
            event.invitation_message = request.data.get(
                "invitation_message", event.invitation_message
            )
            event.save(update_fields=["invitation_title", "invitation_message"])

        return Response(
            {
                "event": event.id,
                "invitation_title": event.invitation_title,
                "invitation_message": event.invitation_message or DEFAULT_TEMPLATE,
                "default_template": DEFAULT_TEMPLATE,
                "placeholders": [
                    "name", "event", "date", "time", "venue", "section", "group", "link",
                ],
            }
        )

    @action(detail=False, methods=["post"], url_path="send-one")
    def send_one(self, request):
        """إرسال رسالة واحدة لضيف محدّد مباشرة عبر المزوّد (بوت/Twilio).

        يُستخدم عند الضغط على زر الإرسال لكل ضيف بحيث يتولّى البوت الإرسال
        فوراً بدل فتح واتساب يدوياً.
        """
        guest_id = request.data.get("guest_id") or request.data.get("guest")
        message = (request.data.get("message") or "").strip()
        if not guest_id or not message:
            raise ValidationError({"detail": "معرّف الضيف ونص الرسالة مطلوبان"})

        guest = (
            Guest.objects.select_related("event", "section", "group")
            .filter(id=guest_id)
            .first()
        )
        if not guest:
            return Response(
                {"detail": "الضيف غير موجود"}, status=status.HTTP_404_NOT_FOUND
            )
        event = guest.event
        if not _scope_events(request.user).filter(pk=event.id).exists():
            return Response(
                {"detail": "خارج نطاق صلاحياتك"}, status=status.HTTP_404_NOT_FOUND
            )
        require_platform_permission(
            request.user,
            PERM_SEND_MESSAGES,
            "غير مصرح — لا تملك صلاحية إرسال الرسائل",
        )
        require_event_access(request.user, event)

        # افصل الرابط في رسالة مستقلة قابلة للنقر إن وُجد ضمن النص
        invite_url = f"{settings.FRONTEND_URL}/i/{guest.public_token}"
        if invite_url in message:
            text_body = message.replace(invite_url, "").rstrip()
            outcome = _dispatch_split(guest.phone, text_body, invite_url)
        else:
            outcome = dispatch_whatsapp(guest.phone, message)
        sent = bool(outcome.get("sent"))
        Invitation.objects.create(
            event=event,
            guest=guest,
            method=Invitation.Method.WHATSAPP,
            status=Invitation.Status.SENT if sent else Invitation.Status.FAILED,
            subject=event.invitation_title or event.title,
            message=message,
            sent_at=timezone.now(),
        )
        return Response(
            {
                "guest_id": guest.id,
                "sent": sent,
                "detail": outcome.get("detail", ""),
                "whatsapp_url": build_whatsapp_url(guest.phone, message)
                if guest.phone
                else None,
            }
        )

    @action(detail=False, methods=["get"], url_path="bot-status")
    def bot_status(self, request):
        """حالة مزوّد الإرسال — يفيد الواجهة لمعرفة هل الأتمتة جاهزة."""
        provider = (
            getattr(settings, "WHATSAPP_PROVIDER", "manual") or "manual"
        ).lower()
        info = {"provider": provider, "ready": provider != "manual"}
        if provider == "bot":
            import urllib.request

            info["ready"] = False
            try:
                req = urllib.request.Request(
                    f"{settings.WHATSAPP_BOT_URL}/status",
                    headers={
                        "Authorization": f"Bearer {settings.WHATSAPP_BOT_TOKEN}"
                    },
                )
                with urllib.request.urlopen(req, timeout=5) as resp:
                    import json as _json

                    payload = _json.loads(resp.read().decode("utf-8", "replace"))
                    info["ready"] = bool(payload.get("ready"))
                    info["state"] = payload.get("state")
                    info["queue"] = payload.get("queue")
            except Exception as exc:  # noqa: BLE001
                info["error"] = f"تعذّر الاتصال بالبوت: {exc}"[:160]
        return Response(info)

    @action(detail=False, methods=["post"], url_path="send-batch")
    def send_batch(self, request):
        """إنشاء دعوات وروابط واتساب لمجموعة ضيوف (الكل/قسم/مجموعة/محددين)."""
        event_id = request.data.get("event")
        if not event_id:
            raise ValidationError({"event": "معرّف الفعالية مطلوب"})
        event = _scope_events(request.user).filter(pk=event_id).first()
        if not event:
            return Response(
                {"detail": "الفعالية غير موجودة أو خارج نطاق صلاحياتك"},
                status=status.HTTP_404_NOT_FOUND,
            )
        require_platform_permission(
            request.user,
            PERM_SEND_MESSAGES,
            "غير مصرح — لا تملك صلاحية إرسال الرسائل",
        )
        require_event_access(request.user, event)

        guests = Guest.objects.filter(event=event).select_related(
            "event", "section", "group"
        )
        guests = _filter_audience(guests, request.data)

        title = request.data.get("title") or event.invitation_title or event.title
        template = request.data.get("message") or event.invitation_message
        auto = bool(request.data.get("auto"))

        results = []
        for guest in guests:
            invite_url = f"{settings.FRONTEND_URL}/i/{guest.public_token}"
            body = _render_message(template, guest, invite_url)

            sent = False
            detail = ""
            if auto:
                # رسالتان منفصلتان: النص ثم الرابط القابل للنقر
                text_body = _render_message(
                    template, guest, invite_url, include_link=False
                )
                outcome = _dispatch_split(guest.phone, text_body, invite_url)
                sent = bool(outcome.get("sent"))
                detail = outcome.get("detail", "")

            Invitation.objects.create(
                event=event,
                guest=guest,
                method=Invitation.Method.WHATSAPP,
                status=(
                    Invitation.Status.SENT
                    if (not auto or sent)
                    else Invitation.Status.FAILED
                ),
                subject=title,
                message=body,
                sent_at=timezone.now(),
            )
            results.append(
                {
                    "guest_id": guest.id,
                    "full_name": guest.full_name,
                    "phone": guest.phone,
                    "invite_url": invite_url,
                    "message": body,
                    "auto": auto,
                    "sent": sent,
                    "detail": detail,
                    "whatsapp_url": build_whatsapp_url(guest.phone, body)
                    if guest.phone
                    else None,
                }
            )

        return Response({"count": len(results), "auto": auto, "invitations": results})

    @action(detail=False, methods=["post"], url_path="remind-batch")
    def remind_batch(self, request):
        """إرسال تذكيرات مخصّصة حسب حالة الضيف:
        - من لم يؤكّد الحضور  → تذكير بالتأكيد عبر الرابط.
        - من أكّد الحضور      → تذكير بموعد المناسبة وبطاقة الدخول.
        - من اعتذر            → يُتجاوز (حالة نهائية).
        """
        event_id = request.data.get("event")
        if not event_id:
            raise ValidationError({"event": "معرّف الفعالية مطلوب"})
        event = _scope_events(request.user).filter(pk=event_id).first()
        if not event:
            return Response(
                {"detail": "الفعالية غير موجودة أو خارج نطاق صلاحياتك"},
                status=status.HTTP_404_NOT_FOUND,
            )
        require_platform_permission(
            request.user,
            PERM_SEND_MESSAGES,
            "غير مصرح — لا تملك صلاحية إرسال الرسائل",
        )
        require_event_access(request.user, event)

        guests = Guest.objects.filter(event=event).select_related(
            "event", "section", "group"
        )
        guests = _filter_audience(guests, request.data)

        tpl_unconfirmed = (
            request.data.get("message_unconfirmed") or DEFAULT_REMINDER_UNCONFIRMED
        )
        tpl_confirmed = (
            request.data.get("message_confirmed") or DEFAULT_REMINDER_CONFIRMED
        )
        confirmed_states = (
            Guest.Status.CONFIRMED,
            Guest.Status.ATTENDED,
            Guest.Status.SEATED,
        )
        auto = bool(request.data.get("auto"))

        results = []
        skipped = 0
        for guest in guests:
            if guest.status == Guest.Status.DECLINED:
                skipped += 1
                continue
            is_confirmed = guest.status in confirmed_states
            template = tpl_confirmed if is_confirmed else tpl_unconfirmed
            invite_url = f"{settings.FRONTEND_URL}/i/{guest.public_token}"
            body = _render_message(template, guest, invite_url)
            prefix = "تذكير بموعد: " if is_confirmed else "تذكير بتأكيد الحضور: "
            subject = prefix + (event.invitation_title or event.title)

            sent = False
            detail = ""
            if auto:
                # رسالتان منفصلتان: النص ثم الرابط القابل للنقر
                text_body = _render_message(
                    template, guest, invite_url, include_link=False
                )
                outcome = _dispatch_split(guest.phone, text_body, invite_url)
                sent = bool(outcome.get("sent"))
                detail = outcome.get("detail", "")

            Invitation.objects.create(
                event=event,
                guest=guest,
                method=Invitation.Method.WHATSAPP,
                status=(
                    Invitation.Status.SENT
                    if (not auto or sent)
                    else Invitation.Status.FAILED
                ),
                subject=subject,
                message=body,
                sent_at=timezone.now(),
            )
            results.append(
                {
                    "guest_id": guest.id,
                    "full_name": guest.full_name,
                    "phone": guest.phone,
                    "status": guest.status,
                    "kind": "confirmed" if is_confirmed else "unconfirmed",
                    "invite_url": invite_url,
                    "message": body,
                    "auto": auto,
                    "sent": sent,
                    "detail": detail,
                    "whatsapp_url": build_whatsapp_url(guest.phone, body)
                    if guest.phone
                    else None,
                }
            )

        return Response(
            {
                "count": len(results),
                "skipped": skipped,
                "auto": auto,
                "reminders": results,
            }
        )

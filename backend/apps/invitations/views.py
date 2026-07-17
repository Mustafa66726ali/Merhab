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
from apps.guests.invitation_status import mark_guest_invitation_sent
from apps.integrations.whatsapp_send import (
    build_whatsapp_url,
    has_active_whatsapp_credential,
    _active_cloud_credential,
)
from apps.integrations.whatsapp_messages import send_guest_invitation, send_guest_reminder
from apps.integrations.whatsapp_interactive import send_interactive_invitation
from apps.platforms.platform_permissions import (
    PERM_SEND_MESSAGES,
    get_platform_for_user,
    require_event_access,
    require_platform_permission,
)

from .models import Invitation
from .remind_batch_service import process_manual_remind_batch
from .serializers import InvitationSerializer

DEFAULT_TEMPLATE = (
    "مرحباً {name}،\n"
    "يسعدنا دعوتك لحضور: {event}\n"
    "📅 التاريخ: {date} - {time}\n"
    "📍 المكان: {venue}\n\n"
    "يرجى تأكيد حضورك عبر الرابط التالي:\n{link}"
)

# تذكير لمن لم يؤكّد — نفس الدعوة التفاعلية مع عنوان «تذكير» (يُرسَل عبر send_interactive_invitation)
DEFAULT_REMINDER_UNCONFIRMED = (
    "تذكير\n\n"
    "مرحباً {name}،\n"
    "يسعدنا دعوتك لحضور: {event}\n"
    "📅 التاريخ: {date} - {time}\n"
    "📍 المكان: {venue}\n\n"
    "يرجى تأكيد حضورك عبر الرابط التالي:\n{link}"
)

# تذكير لمن أكّد الحضور — رسالة نصية بسيطة (بدون قالب Meta/Twilio)
DEFAULT_REMINDER_CONFIRMED = (
    "تذكير بموعد المناسبة {name}،\n"
    "يسعدنا لقاؤك في: {event}\n"
    "📅 التاريخ: {date} - {time}\n"
    "📍 المكان: {venue}\n\n"
    "احتفظ ببطاقة دخولك (QR) :\n{link}"
)

REMINDER_UNCONFIRMED_HEADLINE = "تذكير"

CONFIRMED_REMINDER_STATUSES = (
    Guest.Status.CONFIRMED,
    Guest.Status.ATTENDED,
    Guest.Status.SEATED,
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


def _dispatch_guest_reminder(guest: Guest, custom_body: str | None = None) -> dict:
    """يُوجّه التذكير حسب حالة الضيف:
    - مؤكّد الحضور → رسالة نصية بسيطة (بدون قالب Meta).
    - غير مؤكّد → نفس الدعوة التفاعلية الأولى مع عنوان «تذكير».
    """
    if guest.status in CONFIRMED_REMINDER_STATUSES:
        return send_guest_reminder(guest, custom_body=custom_body)
    return send_interactive_invitation(
        guest,
        headline=REMINDER_UNCONFIRMED_HEADLINE,
    )


def process_event_reminders(
    event,
    guests,
    tpl_unconfirmed: str | None = None,
    tpl_confirmed: str | None = None,
    auto: bool = False,
):
    """يُرسل تذكيرات لمجموعة ضيوف حسب حالتهم — يُستخدم من التذكير التلقائي
    المجدوَل (أمر ``send_due_reminders``) فقط. التذكير اليدوي من ``remind_batch``
    يمر عبر ``process_manual_remind_batch``.

    - من لم يؤكّد الحضور → تذكير بالتأكيد عبر الرابط.
    - من أكّد/حضر/جلس   → تذكير بموعد المناسبة وبطاقة الدخول.
    - من اعتذر          → يُتجاوز.

    يُرجع: ``(results, skipped, sent_count)``.
    """
    tpl_unconfirmed = tpl_unconfirmed or DEFAULT_REMINDER_UNCONFIRMED
    tpl_confirmed = tpl_confirmed or DEFAULT_REMINDER_CONFIRMED
    confirmed_states = CONFIRMED_REMINDER_STATUSES

    results = []
    skipped = 0
    sent_count = 0
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
            if is_confirmed:
                custom = _render_message(
                    template, guest, invite_url, include_link=False
                )
                outcome = send_guest_reminder(guest, custom_body=custom)
            else:
                outcome = send_interactive_invitation(
                    guest,
                    headline=REMINDER_UNCONFIRMED_HEADLINE,
                )
            sent = bool(outcome.get("sent"))
            detail = outcome.get("detail", "")
        if sent:
            sent_count += 1

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

    return results, skipped, sent_count


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
            update_fields = ["invitation_title", "invitation_message"]

            if "auto_reminder_enabled" in request.data:
                event.auto_reminder_enabled = bool(
                    request.data.get("auto_reminder_enabled")
                )
                update_fields.append("auto_reminder_enabled")
            if "auto_reminder_hours_before" in request.data:
                try:
                    hours = int(request.data.get("auto_reminder_hours_before"))
                except (TypeError, ValueError):
                    hours = event.auto_reminder_hours_before
                event.auto_reminder_hours_before = max(1, min(hours, 168))
                update_fields.append("auto_reminder_hours_before")
                # تغيير الإعداد يعيد فتح إمكانية الإرسال التلقائي مجدداً
                event.auto_reminder_sent_at = None
                update_fields.append("auto_reminder_sent_at")

            event.save(update_fields=update_fields)

        return Response(
            {
                "event": event.id,
                "invitation_title": event.invitation_title,
                "invitation_message": event.invitation_message or DEFAULT_TEMPLATE,
                "default_template": DEFAULT_TEMPLATE,
                "auto_reminder_enabled": event.auto_reminder_enabled,
                "auto_reminder_hours_before": event.auto_reminder_hours_before,
                "auto_reminder_sent_at": event.auto_reminder_sent_at,
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

        invite_url = f"{settings.FRONTEND_URL}/i/{guest.public_token}"
        text_body = message.replace(invite_url, "").rstrip() if invite_url in message else message
        kind = (request.data.get("kind") or request.data.get("message_kind") or "invite").lower()
        if kind == "remind":
            outcome = _dispatch_guest_reminder(guest, custom_body=text_body)
        else:
            outcome = send_guest_invitation(guest, custom_body=text_body)
        sent = bool(outcome.get("sent"))
        if sent and kind != "remind":
            mark_guest_invitation_sent(guest)
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
        """حالة مزوّد الإرسال الفعّال — يفيد الواجهة لمعرفة هل الأتمتة جاهزة.

        يحسب المزوّد *الفعّال* بنفس منطق ``dispatch_whatsapp``: أي اعتماد رسمي
        نشط (Cloud/Twilio) يتقدّم تلقائياً على البوت ما لم يكن الوضع ``manual``.
        """
        configured = (
            getattr(settings, "WHATSAPP_PROVIDER", "manual") or "manual"
        ).lower()

        labels = {
            "cloud": "WhatsApp Cloud API",
            "twilio": "Twilio WhatsApp",
            "bot": "بوت محلي (اختبار)",
            "manual": "روابط يدوية",
        }

        # المزوّد الرسمي يتقدّم تلقائياً متى وُجد اعتماد نشط
        if configured != "manual" and has_active_whatsapp_credential():
            effective = "cloud" if _active_cloud_credential() else "twilio"
            from apps.integrations.whatsapp_twilio_setup import (
                check_twilio_invitation_setup,
            )

            payload = {
                "provider": effective,
                "configured": configured,
                "label": labels[effective],
                "ready": True,
                "automated": True,
            }
            if effective == "twilio":
                setup = check_twilio_invitation_setup()
                payload["ready"] = setup["ready"]
                payload["issues"] = setup["issues"]
                payload["warnings"] = setup.get("warnings") or []
                if setup["issues"]:
                    payload["error"] = " | ".join(setup["issues"])
            return Response(payload)

        if configured == "bot":
            info = {
                "provider": "bot",
                "configured": configured,
                "label": labels["bot"],
                "ready": False,
                "automated": True,
            }
            import urllib.request

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

        if configured in ("api", "cloud", "twilio"):
            # وضع api لكن لا يوجد اعتماد نشط بعد
            return Response(
                {
                    "provider": "api",
                    "configured": configured,
                    "label": "WhatsApp API (لم يُكوَّن بعد)",
                    "ready": False,
                    "automated": True,
                    "error": "لا يوجد اعتماد تكامل نشط — أضِفه من صفحة التكاملات",
                }
            )

        return Response(
            {
                "provider": "manual",
                "configured": configured,
                "label": labels["manual"],
                "ready": False,
                "automated": False,
            }
        )

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

        if auto:
            from apps.integrations.whatsapp_send import (
                _active_cloud_credential,
                _active_twilio_credential,
            )
            from apps.integrations.whatsapp_twilio_setup import (
                check_twilio_invitation_setup,
            )

            if _active_twilio_credential() and not _active_cloud_credential():
                setup = check_twilio_invitation_setup()
                if not setup["ready"]:
                    return Response(
                        {
                            "detail": "لا يمكن الإرسال — إعداد Twilio غير مكتمل",
                            "issues": setup["issues"],
                            "auto": True,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        results = []
        for guest in guests:
            invite_url = f"{settings.FRONTEND_URL}/i/{guest.public_token}"
            body = _render_message(template, guest, invite_url)

            sent = False
            detail = ""
            if auto:
                custom = _render_message(
                    template, guest, invite_url, include_link=False
                )
                outcome = send_guest_invitation(guest, custom_body=custom)
                sent = bool(outcome.get("sent"))
                detail = outcome.get("detail", "")
                if sent:
                    mark_guest_invitation_sent(guest)
            else:
                detail = "وضع يدوي — لم يُرسل عبر Twilio. فعّل «إرسال تلقائي»."

            if auto and sent:
                inv_status = Invitation.Status.SENT
            elif auto:
                inv_status = Invitation.Status.FAILED
            else:
                inv_status = Invitation.Status.PENDING

            Invitation.objects.create(
                event=event,
                guest=guest,
                method=Invitation.Method.WHATSAPP,
                status=inv_status,
                subject=title,
                message=body,
                sent_at=timezone.now() if auto and sent else None,
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

        sent_count = sum(1 for r in results if r["sent"])
        return Response(
            {
                "count": len(results),
                "auto": auto,
                "sent_count": sent_count,
                "failed_count": len(results) - sent_count,
                "invitations": results,
            }
        )

    @action(detail=False, methods=["post"], url_path="remind-batch")
    def remind_batch(self, request):
        """تذكير يدوي من شاشة الدعوات:
        - المعتذرون (لا اعتذر) → يُتجاوزون.
        - من لم يختر نعم/لا → إعادة الدعوة + قالب التذكير المسبق.
        - من اختار نعم ذكرني → العدّ التنازلي + QR مباشرة بدون قالب.
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

        auto = bool(request.data.get("auto"))

        if auto:
            from apps.integrations.whatsapp_send import _active_twilio_credential
            from apps.integrations.whatsapp_twilio_setup import (
                check_twilio_invitation_setup,
            )

            if _active_twilio_credential() and not _active_cloud_credential():
                setup = check_twilio_invitation_setup()
                if not setup["ready"]:
                    return Response(
                        {
                            "detail": "لا يمكن الإرسال — إعداد Twilio غير مكتمل",
                            "issues": setup["issues"],
                            "auto": True,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        results, skipped, sent_count = process_manual_remind_batch(
            event, guests, auto=auto
        )

        return Response(
            {
                "count": len(results),
                "skipped": skipped,
                "sent": sent_count,
                "auto": auto,
                "reminders": results,
            }
        )

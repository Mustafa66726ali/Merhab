"""أمر إرسال التذكيرات التلقائية المجدوَلة قبل الحفل.

يُشغَّل دورياً (مثلاً كل بضع دقائق عبر cron / Task Scheduler، أو مجدوِل المشروع
المدمج في ``manage.py`` الجذري). لكل فعالية فُعِّل لها التذكير التلقائي، يُرسل
التذكيرات عندما يحين موعد الإرسال (قبل الحفل بعدد الساعات المحدّد في الإعدادات)
— وذلك *فقط* عند وجود مزوّد رسمي نشط (Twilio/Cloud)، ولا يعمل عبر بوت الاختبار.
يضبط ``auto_reminder_sent_at`` بعد الإرسال لمنع التكرار.
"""

from datetime import datetime, timedelta

from django.conf import settings as dj_settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.events.models import Event
from apps.guests.models import Guest
from apps.integrations.whatsapp_send import has_active_whatsapp_credential
from apps.invitations.views import process_event_reminders


class Command(BaseCommand):
    help = "إرسال التذكيرات التلقائية المجدوَلة قبل الحفل عبر المزوّد الرسمي (Twilio/Cloud)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="عرض الفعاليات المستحقّة دون إرسال فعلي.",
        )

    def _event_datetime(self, event):
        naive_dt = datetime.combine(event.date, event.time)
        if dj_settings.USE_TZ:
            return timezone.make_aware(naive_dt, timezone.get_current_timezone())
        return naive_dt

    def handle(self, *args, **options):
        dry = bool(options.get("dry_run"))
        now = timezone.now()

        # التذكير التلقائي يعتمد على مزوّد رسمي فقط (Twilio/Cloud) وليس البوت
        if not dry and not has_active_whatsapp_credential():
            self.stdout.write(
                "تخطّي: لا يوجد مزوّد رسمي نشط (Twilio/Cloud) — "
                "التذكير التلقائي يعمل مع Twilio فقط."
            )
            return

        candidates = Event.objects.filter(
            auto_reminder_enabled=True,
            auto_reminder_sent_at__isnull=True,
            date__gte=now.date(),
        )

        total_sent = 0
        for event in candidates:
            if not event.date or not event.time:
                continue
            event_dt = self._event_datetime(event)
            send_at = event_dt - timedelta(
                hours=event.auto_reminder_hours_before or 0
            )

            # مستحقّ فقط إذا حان وقت الإرسال ولم يبدأ الحفل بعد
            if not (send_at <= now <= event_dt):
                continue

            guests = Guest.objects.filter(event=event).select_related(
                "event", "section", "group"
            )
            label = f"#{event.id} {event.title}"

            if dry:
                self.stdout.write(
                    f"مستحقّ: {label} — موعد الإرسال {send_at:%Y-%m-%d %H:%M} "
                    f"— ضيوف: {guests.count()}"
                )
                continue

            results, skipped, sent = process_event_reminders(
                event, guests, auto=True
            )
            event.auto_reminder_sent_at = timezone.now()
            event.save(update_fields=["auto_reminder_sent_at"])
            total_sent += sent
            self.stdout.write(
                f"أُرسل: {label} — تم {sent}/{len(results)} (تجاوز {skipped})"
            )

        if not dry:
            self.stdout.write(f"اكتمل. إجمالي المُرسَل: {total_sent}")

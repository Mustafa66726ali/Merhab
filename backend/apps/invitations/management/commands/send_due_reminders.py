"""أمر إرسال التذكيرات المجدوَلة قبل الحفل.

1) تذكيرات الضيوف الذين اختاروا «نعم ذكرني» (قبل الموعد بـ 24 ساعة أو أقرب وقت).
2) التذكير التلقائي على مستوى الفعالية (إن فُعّل) مع تجنّب التكرار.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.events.models import Event
from apps.guests.models import Guest
from apps.guests.reminder_schedule import event_aware_datetime
from apps.integrations.whatsapp_messages import send_guest_day_before_reminder
from apps.integrations.whatsapp_send import has_active_whatsapp_credential
from apps.invitations.views import process_event_reminders


class Command(BaseCommand):
    help = "إرسال التذكيرات المجدوَلة (تذكير مسبق للضيف + تذكير الفعالية)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="عرض المستحقّ دون إرسال فعلي.",
        )

    def _event_datetime(self, event):
        return event_aware_datetime(event)

    def _process_guest_day_before(self, *, dry: bool) -> int:
        now = timezone.now()
        qs = (
            Guest.objects.filter(
                reminder_opted_in=True,
                reminder_sent_at__isnull=True,
                reminder_scheduled_for__isnull=False,
                reminder_scheduled_for__lte=now,
                status=Guest.Status.CONFIRMED,
            )
            .exclude(Q(phone="") | Q(phone__isnull=True))
            .select_related("event")
        )

        sent_count = 0
        for guest in qs:
            event_dt = self._event_datetime(guest.event)
            if event_dt is None or now > event_dt:
                continue
            label = f"guest#{guest.id} {guest.full_name}"
            if dry:
                self.stdout.write(
                    f"مستحقّ (ضيف): {label} — {guest.reminder_scheduled_for:%Y-%m-%d %H:%M}"
                )
                continue
            outcome = send_guest_day_before_reminder(guest)
            if outcome.get("sent"):
                guest.reminder_sent_at = timezone.now()
                guest.save(update_fields=["reminder_sent_at"])
                sent_count += 1
                self.stdout.write(f"أُرسل تذكير+QR: {label}")
            else:
                self.stdout.write(
                    f"فشل تذكير: {label} — {outcome.get('detail', '')}"
                )
        return sent_count

    def handle(self, *args, **options):
        dry = bool(options.get("dry_run"))
        now = timezone.now()

        if not dry and not has_active_whatsapp_credential():
            self.stdout.write(
                "تخطّي: لا يوجد مزوّد رسمي نشط (Twilio/Cloud) — "
                "التذكير التلقائي يعمل مع Twilio فقط."
            )
            return

        guest_sent = self._process_guest_day_before(dry=dry)

        candidates = Event.objects.filter(
            auto_reminder_enabled=True,
            auto_reminder_sent_at__isnull=True,
            date__gte=now.date(),
        )

        total_sent = guest_sent
        for event in candidates:
            if not event.date or not event.time:
                continue
            event_dt = self._event_datetime(event)
            if event_dt is None:
                continue
            send_at = event_dt - timedelta(
                hours=event.auto_reminder_hours_before or 0
            )

            if not (send_at <= now <= event_dt):
                continue

            # تجنّب إعادة إرسال لمن استلم التذكير المسبق المجدول
            guests = (
                Guest.objects.filter(event=event)
                .filter(reminder_sent_at__isnull=True)
                .select_related("event", "section", "group")
            )
            label = f"#{event.id} {event.title}"

            if dry:
                self.stdout.write(
                    f"مستحقّ (فعالية): {label} — موعد الإرسال {send_at:%Y-%m-%d %H:%M} "
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

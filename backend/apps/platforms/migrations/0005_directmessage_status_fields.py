from django.db import migrations, models
from django.utils import timezone


def backfill_message_status(apps, schema_editor):
    DirectMessage = apps.get_model("platforms", "DirectMessage")
    for msg in DirectMessage.objects.all().iterator():
        updates = []
        if not msg.delivered_at:
            msg.delivered_at = msg.created_at
            updates.append("delivered_at")
        if msg.is_read and not msg.read_at:
            msg.read_at = msg.created_at
            updates.append("read_at")
        if not msg.delivery_status:
            msg.delivery_status = "delivered"
            updates.append("delivery_status")
        if updates:
            msg.save(update_fields=updates)


class Migration(migrations.Migration):

    dependencies = [
        ("platforms", "0004_platformmember_profile"),
    ]

    operations = [
        migrations.AddField(
            model_name="directmessage",
            name="delivery_status",
            field=models.CharField(
                choices=[
                    ("pending", "قيد الإرسال"),
                    ("delivered", "تم التسليم"),
                    ("failed", "فشل التسليم"),
                ],
                default="delivered",
                max_length=20,
                verbose_name="حالة التسليم",
            ),
        ),
        migrations.AddField(
            model_name="directmessage",
            name="delivered_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="وقت التسليم"),
        ),
        migrations.AddField(
            model_name="directmessage",
            name="read_at",
            field=models.DateTimeField(blank=True, null=True, verbose_name="وقت القراءة / الفتح"),
        ),
        migrations.RunPython(backfill_message_status, migrations.RunPython.noop),
    ]

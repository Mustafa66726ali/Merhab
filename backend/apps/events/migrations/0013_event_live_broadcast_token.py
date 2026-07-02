import uuid

from django.db import migrations, models


def assign_broadcast_tokens(apps, schema_editor):
    Event = apps.get_model("events", "Event")
    for event in Event.objects.filter(live_broadcast_token__isnull=True).iterator():
        event.live_broadcast_token = uuid.uuid4()
        event.save(update_fields=["live_broadcast_token"])


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0012_event_live_media"),
    ]

    operations = [
        migrations.AddField(
            model_name="event",
            name="live_broadcast_token",
            field=models.UUIDField(
                blank=True,
                editable=False,
                null=True,
                unique=True,
                verbose_name="رمز رابط البث العام",
            ),
        ),
        migrations.RunPython(assign_broadcast_tokens, migrations.RunPython.noop),
    ]

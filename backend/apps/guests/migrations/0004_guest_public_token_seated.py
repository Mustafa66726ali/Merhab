import uuid

from django.db import migrations, models


def assign_tokens(apps, schema_editor):
    Guest = apps.get_model("guests", "Guest")
    for guest in Guest.objects.filter(public_token__isnull=True).iterator():
        guest.public_token = uuid.uuid4()
        guest.save(update_fields=["public_token"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("guests", "0003_add_performance_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="guest",
            name="responded_at",
            field=models.DateTimeField(
                blank=True, null=True, verbose_name="تاريخ الرد على الدعوة"
            ),
        ),
        migrations.AddField(
            model_name="guest",
            name="public_token",
            field=models.UUIDField(
                null=True, editable=False, verbose_name="رمز الدعوة الفريد"
            ),
        ),
        migrations.RunPython(assign_tokens, noop),
        migrations.AlterField(
            model_name="guest",
            name="public_token",
            field=models.UUIDField(
                default=uuid.uuid4,
                editable=False,
                unique=True,
                db_index=True,
                verbose_name="رمز الدعوة الفريد",
                help_text="معرّف فريد لكل ضيف يُستخدم في رابط الدعوة العام وفي رمز QR",
            ),
        ),
    ]

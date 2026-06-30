from django.db import migrations


def enable_recovery_for_all(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(recovery_email_enabled=False).update(recovery_email_enabled=True)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_alter_user_recovery_email_enabled_passwordresetcode"),
    ]

    operations = [
        migrations.RunPython(enable_recovery_for_all, migrations.RunPython.noop),
    ]

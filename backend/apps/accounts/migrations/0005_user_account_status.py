from django.db import migrations, models


def sync_account_status(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(is_active=False).update(account_status="inactive")


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_user_two_factor_enabled"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="account_status",
            field=models.CharField(
                choices=[
                    ("active", "نشط"),
                    ("inactive", "غير نشط"),
                    ("blocked", "محظور"),
                ],
                default="active",
                max_length=10,
                verbose_name="حالة الحساب",
            ),
        ),
        migrations.RunPython(sync_account_status, migrations.RunPython.noop),
    ]

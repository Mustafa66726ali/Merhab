from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="recovery_email_enabled",
            field=models.BooleanField(
                default=False,
                verbose_name="تفعيل بريد استرداد كلمة المرور",
            ),
        ),
    ]

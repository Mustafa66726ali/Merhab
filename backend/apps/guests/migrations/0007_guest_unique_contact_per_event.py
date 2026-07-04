from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("guests", "0006_guest_greeting"),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name="guest",
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name="guest",
            constraint=models.UniqueConstraint(
                condition=models.Q(("email__gt", "")),
                fields=("event", "email"),
                name="unique_guest_email_per_event",
            ),
        ),
        migrations.AddConstraint(
            model_name="guest",
            constraint=models.UniqueConstraint(
                condition=models.Q(("phone__gt", "")),
                fields=("event", "phone"),
                name="unique_guest_phone_per_event",
            ),
        ),
    ]

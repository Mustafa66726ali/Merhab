from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platforms", "0003_directmessage_parent"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformmember",
            name="member_role",
            field=models.CharField(
                choices=[
                    ("event_manager", "مدير فعالية"),
                    ("event_organizer", "منظم فعالية"),
                    ("coordinator", "منسق"),
                    ("entry_manager", "مدير دخول"),
                ],
                default="event_manager",
                max_length=20,
                verbose_name="دور المنصة",
            ),
        ),
        migrations.AddField(
            model_name="platformmember",
            name="coordinator_label",
            field=models.CharField(
                blank=True,
                max_length=120,
                verbose_name="نوع المنسق",
            ),
        ),
        migrations.AddField(
            model_name="platformmember",
            name="perm_scan_qr",
            field=models.BooleanField(default=False, verbose_name="مسح QR"),
        ),
        migrations.AddField(
            model_name="platformmember",
            name="perm_edit_guests",
            field=models.BooleanField(default=False, verbose_name="تعديل الضيوف"),
        ),
        migrations.AddField(
            model_name="platformmember",
            name="perm_send_messages",
            field=models.BooleanField(default=False, verbose_name="إرسال رسائل"),
        ),
    ]

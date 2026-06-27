import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("platforms", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DirectMessage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("subject", models.CharField(blank=True, max_length=255, verbose_name="الموضوع")),
                ("body", models.TextField(verbose_name="المحتوى")),
                ("is_read", models.BooleanField(default=False, verbose_name="مقروءة")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإرسال")),
                (
                    "platform",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="direct_messages",
                        to="platforms.platform",
                        verbose_name="المنصة",
                    ),
                ),
                (
                    "recipient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="received_direct_messages",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="المستلم",
                    ),
                ),
                (
                    "sender",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sent_direct_messages",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="المرسل",
                    ),
                ),
            ],
            options={
                "verbose_name": "رسالة مباشرة",
                "verbose_name_plural": "الرسائل المباشرة",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="UserNotification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255, verbose_name="العنوان")),
                ("body", models.TextField(verbose_name="المحتوى")),
                ("is_read", models.BooleanField(default=False, verbose_name="مقروء")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")),
                (
                    "platform",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="notifications",
                        to="platforms.platform",
                        verbose_name="المنصة",
                    ),
                ),
                (
                    "sender",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="sent_user_notifications",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="المرسل",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_notifications",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="المستخدم",
                    ),
                ),
            ],
            options={
                "verbose_name": "إشعار مستخدم",
                "verbose_name_plural": "إشعارات المستخدمين",
                "ordering": ["-created_at"],
            },
        ),
    ]

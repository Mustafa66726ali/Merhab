import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Platform",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255, verbose_name="اسم المنصة")),
                (
                    "status",
                    models.CharField(
                        choices=[("active", "نشطة"), ("blocked", "محظورة")],
                        default="active",
                        max_length=10,
                        verbose_name="الحالة",
                    ),
                ),
                ("description", models.TextField(blank=True, verbose_name="الوصف")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="تاريخ التحديث")),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="owned_platforms",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="المالك",
                    ),
                ),
            ],
            options={
                "verbose_name": "منصة",
                "verbose_name_plural": "المنصات",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="PlatformMember",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("joined_at", models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الانضمام")),
                (
                    "platform",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="members",
                        to="platforms.platform",
                        verbose_name="المنصة",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="platform_memberships",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="المستخدم",
                    ),
                ),
            ],
            options={
                "verbose_name": "عضو منصة",
                "verbose_name_plural": "أعضاء المنصات",
                "unique_together": {("platform", "user")},
            },
        ),
    ]

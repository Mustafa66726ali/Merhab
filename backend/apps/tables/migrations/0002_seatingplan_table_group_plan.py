# Generated manually for seating plans

import django.db.models.deletion
from django.db import migrations, models


def create_default_plans(apps, schema_editor):
    Event = apps.get_model("events", "Event")
    SeatingPlan = apps.get_model("tables", "SeatingPlan")
    Table = apps.get_model("tables", "Table")

    for event in Event.objects.all():
        tables = Table.objects.filter(event_id=event.id)
        if not tables.exists():
            continue
        plan, _ = SeatingPlan.objects.get_or_create(
            event_id=event.id,
            name="المخطط الرئيسي",
            defaults={"order": 0},
        )
        Table.objects.filter(event_id=event.id, plan__isnull=True).update(plan_id=plan.id)


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0004_event_geo_fields"),
        ("tables", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SeatingPlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120, verbose_name="اسم المخطط")),
                ("description", models.TextField(blank=True, verbose_name="الوصف")),
                ("order", models.PositiveIntegerField(default=0, verbose_name="الترتيب")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الإنشاء")),
                (
                    "event",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="seating_plans",
                        to="events.event",
                        verbose_name="الفعالية",
                    ),
                ),
            ],
            options={
                "verbose_name": "مخطط جلوس",
                "verbose_name_plural": "مخططات الجلوس",
                "ordering": ["order", "id"],
            },
        ),
        migrations.AddField(
            model_name="table",
            name="group",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="tables",
                to="events.group",
                verbose_name="المجموعة",
            ),
        ),
        migrations.AddField(
            model_name="table",
            name="plan",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="tables",
                to="tables.seatingplan",
                verbose_name="المخطط",
            ),
        ),
        migrations.RunPython(create_default_plans, migrations.RunPython.noop),
    ]

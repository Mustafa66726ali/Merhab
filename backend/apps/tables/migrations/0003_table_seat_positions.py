from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tables", "0002_seatingplan_table_group_plan"),
    ]

    operations = [
        migrations.AddField(
            model_name="table",
            name="seat_positions",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="خريطة رقم المقعد إلى إزاحة {x, y} حول مركز الطاولة (إحداثيات منطقية)",
                verbose_name="مواقع الكراسي المخصصة",
            ),
        ),
    ]

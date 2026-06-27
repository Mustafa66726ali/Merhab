from django.contrib import admin
from .models import Table, TableSeat


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ["name", "event", "section", "capacity", "shape"]


@admin.register(TableSeat)
class TableSeatAdmin(admin.ModelAdmin):
    list_display = ["table", "seat_number", "guest"]

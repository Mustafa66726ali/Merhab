from django.contrib import admin
from .models import Event, Section, Schedule, Group


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["title", "date", "time", "venue", "status", "created_by", "created_at"]
    list_filter = ["status", "date"]
    search_fields = ["title", "venue"]


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ["name", "event", "order"]


@admin.register(Schedule)
class ScheduleAdmin(admin.ModelAdmin):
    list_display = ["title", "event", "start_time", "end_time"]


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ["name", "event"]

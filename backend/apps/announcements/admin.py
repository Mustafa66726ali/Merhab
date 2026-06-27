from django.contrib import admin

from apps.announcements.models import Announcement


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "section", "media_type", "is_active", "show_on_landing", "display_duration", "sort_order")
    list_filter = ("section", "is_active", "show_on_landing")
    search_fields = ("title", "description")

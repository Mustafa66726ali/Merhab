from django.contrib import admin

from apps.activity_logs.models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user_email", "action", "category", "status", "object_repr")
    list_filter = ("action", "category", "status", "created_at")
    search_fields = ("description", "user_email", "object_repr", "ip_address")
    readonly_fields = [f.name for f in ActivityLog._meta.fields]

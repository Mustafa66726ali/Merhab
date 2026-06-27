from django.contrib import admin

from apps.system_settings.models import SystemSettings


@admin.register(SystemSettings)
class SystemSettingsAdmin(admin.ModelAdmin):
    list_display = ("platform_name", "default_language", "timezone", "updated_at")

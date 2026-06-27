from django.contrib import admin

from apps.integrations.models import IntegrationCredential


@admin.register(IntegrationCredential)
class IntegrationCredentialAdmin(admin.ModelAdmin):
    list_display = ("name", "provider", "category", "is_active", "is_primary", "last_test_status", "updated_at")
    list_filter = ("category", "provider", "is_active", "environment", "last_test_status")
    search_fields = ("name", "from_email", "notes")
    readonly_fields = ("created_at", "updated_at", "last_tested_at")

from django.contrib import admin

from apps.external_links.models import ExternalLink


@admin.register(ExternalLink)
class ExternalLinkAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "link_type",
        "category",
        "placement",
        "is_active",
        "is_featured",
        "sort_order",
        "click_count",
        "updated_at",
    )
    list_filter = ("category", "link_type", "placement", "is_active", "is_featured")
    search_fields = ("title", "url", "description")
    ordering = ("sort_order", "-created_at")

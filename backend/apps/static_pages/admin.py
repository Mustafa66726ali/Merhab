from django.contrib import admin

from apps.static_pages.models import StaticPage


@admin.register(StaticPage)
class StaticPageAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "slug",
        "page_type",
        "is_published",
        "show_in_footer",
        "show_on_landing",
        "sort_order",
        "updated_at",
    )
    list_filter = ("page_type", "is_published", "show_in_footer", "show_on_landing")
    search_fields = ("title", "slug", "content")
    prepopulated_fields = {"slug": ("title",)}
    ordering = ("sort_order", "-updated_at")

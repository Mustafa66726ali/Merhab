from django.contrib import admin

from apps.faq.models import FAQItem


@admin.register(FAQItem)
class FAQItemAdmin(admin.ModelAdmin):
    list_display = ("question", "status", "is_published", "asker_name", "created_at")
    list_filter = ("status", "is_published")
    search_fields = ("question", "answer", "asker_email")

from django.contrib import admin

from apps.public_media.models import LandingSiteConfig, PublicMediaItem, TestimonialSubmission


@admin.register(TestimonialSubmission)
class TestimonialSubmissionAdmin(admin.ModelAdmin):
    list_display = ("name", "status", "show_on_landing", "source", "created_at")
    list_filter = ("status", "show_on_landing", "source")
    search_fields = ("name", "text", "email")


@admin.register(LandingSiteConfig)
class LandingSiteConfigAdmin(admin.ModelAdmin):
    list_display = ("hero_title", "is_published", "updated_at")


@admin.register(PublicMediaItem)
class PublicMediaItemAdmin(admin.ModelAdmin):
    list_display = ("title", "media_type", "section", "is_active", "is_featured", "sort_order")
    list_filter = ("media_type", "section", "is_active")
    search_fields = ("title", "description")

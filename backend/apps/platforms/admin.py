from django.contrib import admin
from .models import Platform, PlatformMember


@admin.register(Platform)
class PlatformAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "status", "created_at"]
    list_filter = ["status"]
    search_fields = ["name", "owner__email"]


@admin.register(PlatformMember)
class PlatformMemberAdmin(admin.ModelAdmin):
    list_display = ["platform", "user", "joined_at"]

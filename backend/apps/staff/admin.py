from django.contrib import admin
from .models import StaffMember


@admin.register(StaffMember)
class StaffMemberAdmin(admin.ModelAdmin):
    list_display = ["user", "event", "role", "is_active", "assigned_at"]
    list_filter = ["role", "is_active"]

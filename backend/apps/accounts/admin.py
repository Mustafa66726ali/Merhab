from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class UserAdmin(UserAdmin):
    list_display = ["username", "email", "role", "phone", "is_active", "date_joined"]
    list_filter = ["role", "is_active", "is_staff"]
    search_fields = ["username", "email", "first_name", "last_name", "phone"]
    fieldsets = UserAdmin.fieldsets + (
        ("معلومات إضافية", {"fields": ("role", "phone", "avatar")}),
    )

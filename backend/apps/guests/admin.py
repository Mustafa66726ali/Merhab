from django.contrib import admin
from .models import Guest


@admin.register(Guest)
class GuestAdmin(admin.ModelAdmin):
    list_display = ["full_name", "email", "event", "status", "section", "created_at"]
    list_filter = ["status", "event", "section"]
    search_fields = ["full_name", "email", "phone"]

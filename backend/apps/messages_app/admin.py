from django.contrib import admin
from .models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["event", "guest", "direction", "is_read", "created_at"]
    list_filter = ["direction", "is_read"]

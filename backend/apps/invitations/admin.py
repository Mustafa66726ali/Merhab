from django.contrib import admin
from .models import Invitation


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ["guest", "event", "method", "status", "sent_at"]
    list_filter = ["method", "status"]

from rest_framework import serializers
from .models import Invitation


class InvitationSerializer(serializers.ModelSerializer):
    guest_name = serializers.CharField(source="guest.full_name", read_only=True)
    event_title = serializers.CharField(source="event.title", read_only=True)

    class Meta:
        model = Invitation
        fields = [
            "id", "event", "event_title", "guest", "guest_name",
            "method", "status", "subject", "message", "sent_at", "created_at",
        ]
        read_only_fields = ["sent_at", "created_at"]

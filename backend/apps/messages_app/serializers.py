from rest_framework import serializers
from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    guest_name = serializers.CharField(source="guest.full_name", read_only=True)
    sender_name = serializers.CharField(source="sender.get_full_name", read_only=True)

    class Meta:
        model = Message
        fields = [
            "id", "event", "guest", "guest_name", "sender", "sender_name",
            "direction", "content", "is_read", "created_at",
        ]
        read_only_fields = ["sender", "created_at"]

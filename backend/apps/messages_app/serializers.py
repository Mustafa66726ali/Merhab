from rest_framework import serializers
from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    guest_name = serializers.CharField(source="guest.full_name", read_only=True)
    sender_name = serializers.CharField(source="sender.get_full_name", read_only=True)
    recipient_name = serializers.CharField(source="recipient.get_full_name", read_only=True)
    kind_label = serializers.CharField(source="get_kind_display", read_only=True)
    direction_label = serializers.CharField(source="get_direction_display", read_only=True)

    class Meta:
        model = Message
        fields = [
            "id", "event", "guest", "guest_name", "sender", "sender_name",
            "recipient", "recipient_name", "direction", "direction_label",
            "kind", "kind_label", "content", "is_read", "created_at",
        ]
        read_only_fields = ["sender", "created_at"]

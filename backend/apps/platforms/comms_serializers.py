from rest_framework import serializers

from .models import DirectMessage, UserNotification


class DirectMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    recipient_name = serializers.SerializerMethodField()
    platform_name = serializers.CharField(source="platform.name", read_only=True, default="")
    is_outgoing = serializers.SerializerMethodField()
    direction = serializers.SerializerMethodField()
    direction_label = serializers.SerializerMethodField()
    delivery_status_label = serializers.SerializerMethodField()
    is_opened = serializers.SerializerMethodField()
    is_delivered = serializers.SerializerMethodField()

    class Meta:
        model = DirectMessage
        fields = [
            "id",
            "sender",
            "sender_name",
            "recipient",
            "recipient_name",
            "platform",
            "platform_name",
            "subject",
            "body",
            "parent_id",
            "is_read",
            "is_outgoing",
            "direction",
            "direction_label",
            "delivery_status",
            "delivery_status_label",
            "delivered_at",
            "read_at",
            "is_delivered",
            "is_opened",
            "created_at",
        ]
        read_only_fields = [
            "sender",
            "recipient",
            "platform",
            "parent_id",
            "created_at",
            "delivery_status",
            "delivered_at",
            "read_at",
        ]

    def get_sender_name(self, obj):
        return obj.sender.get_full_name().strip() or obj.sender.email

    def get_recipient_name(self, obj):
        return obj.recipient.get_full_name().strip() or obj.recipient.email

    def get_is_outgoing(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.sender_id == request.user.id
        return False

    def get_direction(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return "outgoing" if obj.sender_id == request.user.id else "incoming"
        return "incoming"

    def get_direction_label(self, obj):
        return "صادر" if self.get_direction(obj) == "outgoing" else "وارد"

    def get_delivery_status_label(self, obj):
        return obj.get_delivery_status_display()

    def get_is_delivered(self, obj):
        return obj.delivery_status == DirectMessage.DeliveryStatus.DELIVERED

    def get_is_opened(self, obj):
        return bool(obj.is_read)


class DirectMessageWriteSerializer(serializers.Serializer):
    recipient_id = serializers.IntegerField()
    subject = serializers.CharField(max_length=255, required=False, allow_blank=True)
    body = serializers.CharField()
    parent_id = serializers.IntegerField(required=False, allow_null=True)


class UserNotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    platform_name = serializers.CharField(source="platform.name", read_only=True, default="")

    class Meta:
        model = UserNotification
        fields = [
            "id",
            "user",
            "sender",
            "sender_name",
            "platform",
            "platform_name",
            "title",
            "body",
            "is_read",
            "created_at",
        ]
        read_only_fields = ["user", "sender", "platform", "created_at"]

    def get_sender_name(self, obj):
        if not obj.sender:
            return "النظام"
        return obj.sender.get_full_name().strip() or obj.sender.email


class UserNotificationAdminSerializer(UserNotificationSerializer):
    recipient_name = serializers.SerializerMethodField()
    recipient_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta(UserNotificationSerializer.Meta):
        fields = UserNotificationSerializer.Meta.fields + ["recipient_name", "recipient_email"]

    def get_recipient_name(self, obj):
        return obj.user.get_full_name().strip() or obj.user.email

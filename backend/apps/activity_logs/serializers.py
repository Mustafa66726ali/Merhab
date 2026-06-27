from rest_framework import serializers

from apps.activity_logs.models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    action_label = serializers.CharField(source="get_action_display", read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ActivityLog
        fields = [
            "id",
            "user",
            "user_email",
            "user_name",
            "user_role",
            "action",
            "action_label",
            "category",
            "category_label",
            "status",
            "status_label",
            "object_type",
            "object_id",
            "object_repr",
            "description",
            "metadata",
            "ip_address",
            "user_agent",
            "request_path",
            "request_method",
            "platform_id",
            "created_at",
        ]
        read_only_fields = fields

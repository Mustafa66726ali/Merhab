from rest_framework import serializers
from .models import StaffMember


class StaffMemberSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_phone = serializers.CharField(source="user.phone", read_only=True)

    class Meta:
        model = StaffMember
        fields = [
            "id", "event", "user", "user_name", "user_email", "user_phone",
            "role", "is_active", "notes", "assigned_at",
        ]
        read_only_fields = ["assigned_at"]

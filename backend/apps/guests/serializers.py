from django.conf import settings
from rest_framework import serializers

from .models import Guest


class GuestSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source="section.name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    event_title = serializers.CharField(source="event.title", read_only=True)
    qr_code_url = serializers.SerializerMethodField()
    invite_url = serializers.SerializerMethodField()

    class Meta:
        model = Guest
        fields = [
            "id", "event", "event_title", "user", "full_name", "email", "phone",
            "status", "status_label", "section", "section_name", "group", "group_name",
            "qr_code", "qr_code_url", "public_token", "invite_url", "responded_at",
            "greeting", "notes", "dietary_requirements", "created_at",
        ]
        read_only_fields = [
            "qr_code", "qr_code_url", "public_token", "invite_url",
            "responded_at", "created_at",
        ]

    def get_qr_code_url(self, obj) -> str | None:
        if not obj.qr_code:
            return None
        request = self.context.get("request")
        url = obj.qr_code.url
        return request.build_absolute_uri(url) if request else url

    def get_invite_url(self, obj) -> str:
        return f"{settings.FRONTEND_URL}/i/{obj.public_token}"


class GuestImportSerializer(serializers.Serializer):
    guests = serializers.ListField(
        child=serializers.DictField(),
        help_text="قائمة الضيوف بصيغة JSON",
    )

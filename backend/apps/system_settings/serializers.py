from rest_framework import serializers

from apps.system_settings.models import SystemSettings


def _absolute_url(request, path: str) -> str:
    if not path:
        return ""
    if path.startswith("http"):
        return path
    if request:
        return request.build_absolute_uri(path)
    return path


class SystemSettingsSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    default_language_label = serializers.CharField(
        source="get_default_language_display", read_only=True
    )
    timezone_label = serializers.CharField(source="get_timezone_display", read_only=True)
    qr_validity_label = serializers.CharField(source="get_qr_validity_display", read_only=True)
    ticket_format_label = serializers.CharField(source="get_ticket_format_display", read_only=True)

    class Meta:
        model = SystemSettings
        fields = [
            "platform_name",
            "logo",
            "logo_url",
            "default_language",
            "default_language_label",
            "timezone",
            "timezone_label",
            "theme_primary",
            "notify_email",
            "notify_sms",
            "notify_whatsapp",
            "notify_push",
            "notify_system_alerts",
            "qr_validity",
            "qr_validity_label",
            "rsvp_auto_enabled",
            "high_res_headers_only",
            "ticket_format",
            "ticket_format_label",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
        extra_kwargs = {"logo": {"write_only": True}}

    def to_internal_value(self, data):
        if hasattr(data, "getlist"):
            mutable = data.copy()
            for field in (
                "notify_email",
                "notify_sms",
                "notify_whatsapp",
                "notify_push",
                "notify_system_alerts",
                "rsvp_auto_enabled",
                "high_res_headers_only",
            ):
                if field in mutable:
                    val = mutable.get(field)
                    if val in ("true", "True", "1", "on"):
                        mutable[field] = True
                    elif val in ("false", "False", "0", "", None):
                        mutable[field] = False
            data = mutable
        return super().to_internal_value(data)

    def get_logo_url(self, obj):
        if not obj.logo:
            return ""
        request = self.context.get("request")
        return _absolute_url(request, obj.logo.url)

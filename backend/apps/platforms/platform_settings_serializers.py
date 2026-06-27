import re

from rest_framework import serializers

from .branding import platform_logo_url
from .models import Platform

_E164_MIN = 8
_E164_MAX = 15


def normalize_whatsapp_number(value: str) -> str:
    """تطبيع رقم واتساب إلى صيغة E.164 دولية (+XXXXXXXX)."""
    raw = (value or "").strip()
    if not raw:
        return ""

    if raw.startswith("+") or raw.startswith("00"):
        digits = re.sub(r"\D", "", raw)
        if raw.startswith("00") and digits.startswith("00"):
            digits = digits[2:]
    else:
        digits = re.sub(r"\D", "", raw)

    if not digits:
        return ""

    if len(digits) < _E164_MIN or len(digits) > _E164_MAX:
        raise serializers.ValidationError(
            "رقم واتساب غير صالح — يجب أن يكون بين 8 و 15 رقماً مع رمز الدولة"
        )

    return f"+{digits}"


def whatsapp_wa_link(number: str) -> str:
    if not number:
        return ""
    digits = re.sub(r"\D", "", number)
    return f"https://wa.me/{digits}" if digits else ""


class PlatformMySettingsSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    owner_name = serializers.SerializerMethodField()
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    whatsapp_link = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Platform
        fields = [
            "id",
            "name",
            "description",
            "status",
            "status_label",
            "owner_name",
            "owner_email",
            "logo",
            "logo_url",
            "whatsapp_number",
            "whatsapp_invites_enabled",
            "whatsapp_link",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "status_label",
            "owner_name",
            "owner_email",
            "logo_url",
            "whatsapp_link",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "logo": {"write_only": True, "required": False, "allow_null": True},
        }

    def get_logo_url(self, obj):
        request = self.context.get("request")
        return platform_logo_url(obj, request)

    def validate_logo(self, value):
        if not value:
            return value
        if value.size > 2 * 1024 * 1024:
            raise serializers.ValidationError("حجم الشعار يجب ألا يتجاوز 2 ميغابايت")
        return value

    def get_owner_name(self, obj):
        return obj.owner.get_full_name().strip() or obj.owner.email

    def get_whatsapp_link(self, obj):
        return whatsapp_wa_link(obj.whatsapp_number)

    def update(self, instance, validated_data):
        clear_logo = str(self.initial_data.get("clear_logo", "")).lower() in ("true", "1")
        logo = validated_data.pop("logo", serializers.empty)
        instance = super().update(instance, validated_data)
        if clear_logo:
            if instance.logo:
                instance.logo.delete(save=False)
            instance.logo = ""
            instance.save(update_fields=["logo", "updated_at"])
        elif logo is not serializers.empty and logo is not None:
            if instance.logo:
                instance.logo.delete(save=False)
            instance.logo = logo
            instance.save(update_fields=["logo", "updated_at"])
        return instance

    def validate_whatsapp_number(self, value):
        if not value or not str(value).strip():
            return ""
        return normalize_whatsapp_number(str(value))

    def validate(self, attrs):
        enabled = attrs.get(
            "whatsapp_invites_enabled",
            self.instance.whatsapp_invites_enabled if self.instance else False,
        )
        number = attrs.get(
            "whatsapp_number",
            self.instance.whatsapp_number if self.instance else "",
        )
        if enabled and not number:
            raise serializers.ValidationError({
                "whatsapp_number": "أدخل رقم واتساب قبل تفعيل إرسال الدعوات",
            })
        return attrs

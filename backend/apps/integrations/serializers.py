from rest_framework import serializers

from apps.integrations.models import IntegrationCredential
from apps.integrations.services import mask_secret, PROVIDER_META


SENSITIVE_FIELDS = ("api_key", "api_secret", "access_token", "refresh_token", "webhook_secret")


class IntegrationCredentialSerializer(serializers.ModelSerializer):
    provider_label = serializers.CharField(source="get_provider_display", read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    environment_label = serializers.CharField(source="get_environment_display", read_only=True)
    last_test_status_label = serializers.CharField(source="get_last_test_status_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    api_key_masked = serializers.SerializerMethodField()
    api_secret_masked = serializers.SerializerMethodField()
    access_token_masked = serializers.SerializerMethodField()
    refresh_token_masked = serializers.SerializerMethodField()
    webhook_secret_masked = serializers.SerializerMethodField()
    has_api_key = serializers.SerializerMethodField()
    has_api_secret = serializers.SerializerMethodField()
    icon = serializers.SerializerMethodField()
    color = serializers.SerializerMethodField()

    class Meta:
        model = IntegrationCredential
        fields = [
            "id",
            "provider",
            "provider_label",
            "category",
            "category_label",
            "name",
            "description",
            "environment",
            "environment_label",
            "is_active",
            "is_primary",
            "phone_number_id",
            "business_account_id",
            "from_email",
            "from_name",
            "smtp_host",
            "smtp_port",
            "smtp_use_tls",
            "webhook_url",
            "config",
            "notes",
            "last_tested_at",
            "last_test_status",
            "last_test_status_label",
            "last_test_error",
            "created_by_name",
            "created_at",
            "updated_at",
            "api_key_masked",
            "api_secret_masked",
            "access_token_masked",
            "refresh_token_masked",
            "webhook_secret_masked",
            "has_api_key",
            "has_api_secret",
            "icon",
            "color",
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ""
        return obj.created_by.get_full_name() or obj.created_by.email

    def get_api_key_masked(self, obj):
        return mask_secret(obj.api_key)

    def get_api_secret_masked(self, obj):
        return mask_secret(obj.api_secret)

    def get_access_token_masked(self, obj):
        return mask_secret(obj.access_token)

    def get_refresh_token_masked(self, obj):
        return mask_secret(obj.refresh_token)

    def get_webhook_secret_masked(self, obj):
        return mask_secret(obj.webhook_secret)

    def get_has_api_key(self, obj):
        return bool(obj.api_key)

    def get_has_api_secret(self, obj):
        return bool(obj.api_secret)

    def get_icon(self, obj):
        meta = PROVIDER_META.get(obj.provider, {})
        return meta.get("icon", "extension")

    def get_color(self, obj):
        meta = PROVIDER_META.get(obj.provider, {})
        return meta.get("color", "#928ea3")


class IntegrationCredentialWriteSerializer(serializers.ModelSerializer):
    api_key = serializers.CharField(required=False, allow_blank=True, write_only=True)
    api_secret = serializers.CharField(required=False, allow_blank=True, write_only=True)
    access_token = serializers.CharField(required=False, allow_blank=True, write_only=True)
    refresh_token = serializers.CharField(required=False, allow_blank=True, write_only=True)
    webhook_secret = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = IntegrationCredential
        fields = [
            "provider",
            "category",
            "name",
            "description",
            "environment",
            "is_active",
            "is_primary",
            "api_key",
            "api_secret",
            "access_token",
            "refresh_token",
            "phone_number_id",
            "business_account_id",
            "from_email",
            "from_name",
            "smtp_host",
            "smtp_port",
            "smtp_use_tls",
            "webhook_url",
            "webhook_secret",
            "config",
            "notes",
        ]

    def validate(self, attrs):
        provider = attrs.get("provider") or (self.instance and self.instance.provider)
        if provider and provider in PROVIDER_META:
            if not attrs.get("category"):
                attrs["category"] = PROVIDER_META[provider]["category"]
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        for field in SENSITIVE_FIELDS:
            value = validated_data.get(field)
            if value is None:
                continue
            if value == "" and instance.pk:
                validated_data.pop(field, None)
        return super().update(instance, validated_data)

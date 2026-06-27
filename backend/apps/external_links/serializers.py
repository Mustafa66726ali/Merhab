from rest_framework import serializers

from apps.external_links.models import ExternalLink
from apps.external_links.services import LINK_TYPE_META, validate_url


class ExternalLinkSerializer(serializers.ModelSerializer):
    link_type_label = serializers.CharField(source="get_link_type_display", read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    placement_label = serializers.CharField(source="get_placement_display", read_only=True)
    platform_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    display_icon = serializers.SerializerMethodField()
    display_color = serializers.SerializerMethodField()
    domain = serializers.SerializerMethodField()

    class Meta:
        model = ExternalLink
        fields = [
            "id",
            "title",
            "url",
            "link_type",
            "link_type_label",
            "category",
            "category_label",
            "placement",
            "placement_label",
            "description",
            "icon",
            "display_icon",
            "display_color",
            "domain",
            "platform",
            "platform_name",
            "is_active",
            "is_featured",
            "open_in_new_tab",
            "sort_order",
            "click_count",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_platform_name(self, obj):
        return obj.platform.name if obj.platform else ""

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ""
        return obj.created_by.get_full_name() or obj.created_by.email

    def get_display_icon(self, obj):
        if obj.icon:
            return obj.icon
        meta = LINK_TYPE_META.get(obj.link_type, {})
        return meta.get("icon", "link")

    def get_display_color(self, obj):
        meta = LINK_TYPE_META.get(obj.link_type, {})
        return meta.get("color", "#928ea3")

    def get_domain(self, obj):
        try:
            from urllib.parse import urlparse

            return urlparse(obj.url).netloc
        except Exception:
            return ""


class ExternalLinkWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalLink
        fields = [
            "title",
            "url",
            "link_type",
            "category",
            "placement",
            "description",
            "icon",
            "platform",
            "is_active",
            "is_featured",
            "open_in_new_tab",
            "sort_order",
        ]

    def validate_url(self, value):
        ok, message = validate_url(value)
        if not ok:
            raise serializers.ValidationError(message)
        return value.strip()

    def validate(self, attrs):
        link_type = attrs.get("link_type") or (self.instance and self.instance.link_type)
        if link_type and link_type in LINK_TYPE_META and not attrs.get("category"):
            attrs["category"] = LINK_TYPE_META[link_type]["category"]
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)


class ReorderItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    sort_order = serializers.IntegerField()


class ReorderSerializer(serializers.Serializer):
    items = ReorderItemSerializer(many=True, allow_empty=False)

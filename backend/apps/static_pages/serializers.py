import re

from rest_framework import serializers

from apps.static_pages.models import StaticPage
from apps.static_pages.services import PAGE_TYPE_META, PAGE_TYPE_SLUGS, DEFAULT_TEMPLATES


def slugify_simple(value: str) -> str:
    value = (value or "").strip().lower()
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    value = re.sub(r"[\s_-]+", "-", value).strip("-")
    return value or "page"


class StaticPageSerializer(serializers.ModelSerializer):
    page_type_label = serializers.CharField(source="get_page_type_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    display_icon = serializers.SerializerMethodField()
    display_color = serializers.SerializerMethodField()
    public_url = serializers.SerializerMethodField()
    word_count = serializers.SerializerMethodField()

    class Meta:
        model = StaticPage
        fields = [
            "id",
            "slug",
            "page_type",
            "page_type_label",
            "title",
            "subtitle",
            "content",
            "meta_title",
            "meta_description",
            "icon",
            "display_icon",
            "display_color",
            "is_published",
            "show_in_footer",
            "show_in_header",
            "show_on_landing",
            "sort_order",
            "published_at",
            "created_by_name",
            "created_at",
            "updated_at",
            "public_url",
            "word_count",
        ]
        read_only_fields = fields

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return ""
        return obj.created_by.get_full_name() or obj.created_by.email

    def get_display_icon(self, obj):
        if obj.icon:
            return obj.icon
        meta = PAGE_TYPE_META.get(obj.page_type, {})
        return meta.get("icon", "article")

    def get_display_color(self, obj):
        meta = PAGE_TYPE_META.get(obj.page_type, {})
        return meta.get("color", "#928ea3")

    def get_public_url(self, obj):
        return f"/pages/{obj.slug}"

    def get_word_count(self, obj):
        text = re.sub(r"<[^>]+>", " ", obj.content or "")
        words = [w for w in text.split() if w.strip()]
        return len(words)


class StaticPageWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaticPage
        fields = [
            "slug",
            "page_type",
            "title",
            "subtitle",
            "content",
            "meta_title",
            "meta_description",
            "icon",
            "is_published",
            "show_in_footer",
            "show_in_header",
            "show_on_landing",
            "sort_order",
        ]

    def validate_slug(self, value):
        slug = slugify_simple(value)
        if not slug:
            raise serializers.ValidationError("المعرّف غير صالح")
        return slug

    def validate(self, attrs):
        page_type = attrs.get("page_type") or (self.instance and self.instance.page_type)
        if page_type and page_type != StaticPage.PageType.CUSTOM:
            attrs["slug"] = PAGE_TYPE_SLUGS.get(page_type, attrs.get("slug", ""))
        if not attrs.get("slug") and attrs.get("title"):
            attrs["slug"] = slugify_simple(attrs["title"])
        meta = PAGE_TYPE_META.get(page_type, {})
        if not attrs.get("icon") and meta.get("icon"):
            attrs["icon"] = meta.get("icon")
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            validated_data["created_by"] = request.user
        return super().create(validated_data)


class StaticPagePublicSerializer(serializers.ModelSerializer):
    page_type_label = serializers.CharField(source="get_page_type_display", read_only=True)
    display_icon = serializers.SerializerMethodField()

    class Meta:
        model = StaticPage
        fields = [
            "slug",
            "page_type",
            "page_type_label",
            "title",
            "subtitle",
            "content",
            "meta_title",
            "meta_description",
            "icon",
            "display_icon",
            "show_in_footer",
            "show_in_header",
            "show_on_landing",
            "sort_order",
            "published_at",
            "updated_at",
        ]

    def get_display_icon(self, obj):
        if obj.icon:
            return obj.icon
        meta = PAGE_TYPE_META.get(obj.page_type, {})
        return meta.get("icon", "article")


class StaticPagePublicListSerializer(serializers.ModelSerializer):
    display_icon = serializers.SerializerMethodField()

    class Meta:
        model = StaticPage
        fields = [
            "slug",
            "title",
            "subtitle",
            "page_type",
            "display_icon",
            "show_in_footer",
            "show_in_header",
            "show_on_landing",
            "sort_order",
        ]

    def get_display_icon(self, obj):
        if obj.icon:
            return obj.icon
        meta = PAGE_TYPE_META.get(obj.page_type, {})
        return meta.get("icon", "article")


class ReorderItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    sort_order = serializers.IntegerField()


class ReorderSerializer(serializers.Serializer):
    items = ReorderItemSerializer(many=True, allow_empty=False)


class SeedTemplateSerializer(serializers.Serializer):
    page_type = serializers.ChoiceField(choices=StaticPage.PageType.choices)

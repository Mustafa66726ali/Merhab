import re

from rest_framework import serializers

from apps.public_media.models import LandingSiteConfig, PublicMediaItem, TestimonialSubmission


def _absolute_url(request, path: str) -> str:
    if not path:
        return ""
    if path.startswith("http"):
        return path
    if request:
        return request.build_absolute_uri(path)
    return path


def _video_embed_url(url: str) -> str:
    if not url:
        return ""
    youtube = re.search(
        r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})",
        url,
    )
    if youtube:
        return f"https://www.youtube.com/embed/{youtube.group(1)}"
    vimeo = re.search(r"vimeo\.com/(\d+)", url)
    if vimeo:
        return f"https://player.vimeo.com/video/{vimeo.group(1)}"
    return url


class PublicMediaItemSerializer(serializers.ModelSerializer):
    media_type_label = serializers.CharField(source="get_media_type_display", read_only=True)
    section_label = serializers.CharField(source="get_section_display", read_only=True)
    file_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    embed_url = serializers.SerializerMethodField()

    class Meta:
        model = PublicMediaItem
        fields = [
            "id",
            "title",
            "description",
            "alt_text",
            "media_type",
            "media_type_label",
            "section",
            "section_label",
            "file_url",
            "video_url",
            "thumbnail_url",
            "embed_url",
            "sort_order",
            "is_active",
            "is_featured",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_file_url(self, obj):
        if obj.file:
            return _absolute_url(self.context.get("request"), obj.file.url)
        return ""

    def get_thumbnail_url(self, obj):
        if obj.thumbnail:
            return _absolute_url(self.context.get("request"), obj.thumbnail.url)
        return ""

    def get_embed_url(self, obj):
        if obj.media_type == PublicMediaItem.MediaType.VIDEO_URL:
            return _video_embed_url(obj.video_url)
        return ""


class PublicMediaItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicMediaItem
        fields = [
            "title",
            "description",
            "alt_text",
            "media_type",
            "section",
            "file",
            "video_url",
            "thumbnail",
            "sort_order",
            "is_active",
            "is_featured",
        ]


class LandingSiteConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandingSiteConfig
        fields = [
            "hero_title",
            "hero_subtitle",
            "hero_description",
            "hero_cta_primary",
            "hero_cta_primary_url",
            "hero_cta_secondary",
            "hero_cta_secondary_url",
            "stats",
            "features",
            "testimonials",
            "partners_title",
            "gallery_title",
            "video_section_title",
            "contact_email",
            "contact_phone",
            "meta_title",
            "meta_description",
            "is_published",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class TestimonialSubmissionSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    source_label = serializers.CharField(source="get_source_display", read_only=True)

    class Meta:
        model = TestimonialSubmission
        fields = [
            "id",
            "name",
            "role",
            "text",
            "email",
            "status",
            "status_label",
            "show_on_landing",
            "source",
            "source_label",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class TestimonialSubmissionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestimonialSubmission
        fields = ["name", "role", "text", "email", "status", "show_on_landing", "source"]


class TestimonialPublicSubmitSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestimonialSubmission
        fields = ["name", "role", "text", "email"]

    def create(self, validated_data):
        return TestimonialSubmission.objects.create(
            **validated_data,
            status=TestimonialSubmission.Status.PENDING,
            source=TestimonialSubmission.Source.VISITOR,
            show_on_landing=False,
        )

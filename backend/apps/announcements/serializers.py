import re

from rest_framework import serializers

from apps.announcements.models import Announcement


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


class AnnouncementSerializer(serializers.ModelSerializer):
    section_label = serializers.CharField(source="get_section_display", read_only=True)
    media_type_label = serializers.CharField(source="get_media_type_display", read_only=True)
    image_url = serializers.SerializerMethodField()
    video_file_url = serializers.SerializerMethodField()
    embed_url = serializers.SerializerMethodField()
    is_visible = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = [
            "id",
            "title",
            "description",
            "section",
            "section_label",
            "media_type",
            "media_type_label",
            "image_url",
            "video_url",
            "video_file_url",
            "embed_url",
            "link_url",
            "display_duration",
            "sort_order",
            "is_active",
            "show_on_landing",
            "starts_at",
            "ends_at",
            "is_visible",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_image_url(self, obj):
        if obj.image:
            return _absolute_url(self.context.get("request"), obj.image.url)
        return ""

    def get_video_file_url(self, obj):
        if obj.video_file:
            return _absolute_url(self.context.get("request"), obj.video_file.url)
        return ""

    def get_embed_url(self, obj):
        if obj.media_type == Announcement.MediaType.VIDEO_URL:
            return _video_embed_url(obj.video_url)
        return ""

    def get_is_visible(self, obj):
        return obj.is_visible_now()


class AnnouncementWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = [
            "title",
            "description",
            "section",
            "media_type",
            "image",
            "video_file",
            "video_url",
            "link_url",
            "display_duration",
            "sort_order",
            "is_active",
            "show_on_landing",
            "starts_at",
            "ends_at",
        ]

    def validate(self, attrs):
        section = attrs.get("section", getattr(self.instance, "section", None))
        media_type = attrs.get("media_type", getattr(self.instance, "media_type", None))

        if section == Announcement.Section.BANNER:
            attrs["media_type"] = Announcement.MediaType.IMAGE
        elif section == Announcement.Section.VIDEO:
            if media_type == Announcement.MediaType.IMAGE:
                attrs["media_type"] = Announcement.MediaType.VIDEO_FILE

        duration = attrs.get("display_duration", 5)
        if duration < 2:
            attrs["display_duration"] = 2
        if duration > 120:
            attrs["display_duration"] = 120
        return attrs


class AnnouncementPublicSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    video_file_url = serializers.SerializerMethodField()
    embed_url = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = [
            "id",
            "title",
            "description",
            "section",
            "media_type",
            "image_url",
            "video_url",
            "video_file_url",
            "embed_url",
            "link_url",
            "display_duration",
            "sort_order",
        ]

    def get_image_url(self, obj):
        if obj.image:
            return _absolute_url(self.context.get("request"), obj.image.url)
        return ""

    def get_video_file_url(self, obj):
        if obj.video_file:
            return _absolute_url(self.context.get("request"), obj.video_file.url)
        return ""

    def get_embed_url(self, obj):
        if obj.media_type == Announcement.MediaType.VIDEO_URL:
            return _video_embed_url(obj.video_url)
        return ""

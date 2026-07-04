from __future__ import annotations

import re

from django.conf import settings
from rest_framework import serializers

from .models import Guest


def _normalize_phone(phone: str) -> str:
    return re.sub(r"\D", "", (phone or "").strip())


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

    def validate(self, attrs):
        event = attrs.get("event") or (self.instance.event if self.instance else None)
        if not event:
            return attrs

        email = (attrs.get("email", getattr(self.instance, "email", "")) or "").strip()
        phone = _normalize_phone(attrs.get("phone", getattr(self.instance, "phone", "")))

        qs = Guest.objects.filter(event=event)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if email and qs.filter(email__iexact=email).exists():
            raise serializers.ValidationError(
                {"detail": "هذا البريد مُسجّل مسبقاً في هذه المناسبة"}
            )

        if phone:
            for other in qs.exclude(phone="").only("id", "phone"):
                if _normalize_phone(other.phone) == phone:
                    raise serializers.ValidationError(
                        {"detail": "رقم الجوال مُسجّل مسبقاً في هذه المناسبة"}
                    )

        section = attrs.get("section")
        if section is not None and section.event_id != event.id:
            raise serializers.ValidationError({"section": "القسم لا ينتمي لهذه المناسبة"})

        group = attrs.get("group")
        if group is not None and group.event_id != event.id:
            raise serializers.ValidationError({"group": "المجموعة لا تنتمي لهذه المناسبة"})

        return attrs


class GuestImportSerializer(serializers.Serializer):
    guests = serializers.ListField(
        child=serializers.DictField(),
        help_text="قائمة الضيوف بصيغة JSON",
    )

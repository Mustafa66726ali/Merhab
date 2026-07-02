from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from rest_framework import serializers

from apps.guests.models import Guest
from apps.guests.status_utils import CONFIRMED_ATTENDANCE_STATUSES, PHYSICAL_PRESENCE_STATUSES
from apps.platforms.member_profile import _guest_stats_for_event
from apps.platforms.platform_events import (
    _completion_meta,
    _event_managers_by_role,
    _location_label,
)

from apps.platforms.models import PlatformMember

from .cover_media import event_cover_url
from .models import Event, Section, Schedule, Group


def _absolute_cover_url(serializer, event: Event) -> str:
    path = event_cover_url(event)
    if not path:
        return ""
    request = serializer.context.get("request")
    if request:
        return request.build_absolute_uri(path)
    return path


def _validate_coordinates(attrs):
    lat = attrs.get("latitude")
    lng = attrs.get("longitude")
    if lat is not None and (lat < -90 or lat > 90):
        raise serializers.ValidationError({"latitude": "خط العرض غير صالح"})
    if lng is not None and (lng < -180 or lng > 180):
        raise serializers.ValidationError({"longitude": "خط الطول غير صالح"})
    return attrs


class SectionSerializer(serializers.ModelSerializer):
    event_title = serializers.CharField(source="event.title", read_only=True)

    class Meta:
        model = Section
        fields = [
            "id",
            "event",
            "event_title",
            "name",
            "description",
            "location",
            "color",
            "order",
            "created_at",
        ]
        read_only_fields = ["created_at"]
        extra_kwargs = {
            "event": {"required": True},
            "description": {"required": False, "allow_blank": True},
            "location": {"required": False, "allow_blank": True},
        }


class ScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Schedule
        fields = [
            "id",
            "event",
            "title",
            "description",
            "start_time",
            "end_time",
            "location",
            "order",
        ]
        extra_kwargs = {
            "event": {"required": True},
            "description": {"required": False, "allow_blank": True},
            "location": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        start = attrs.get("start_time") or (self.instance.start_time if self.instance else None)
        end = attrs.get("end_time") or (self.instance.end_time if self.instance else None)
        if start and end and end <= start:
            raise serializers.ValidationError({"end_time": "وقت الانتهاء يجب أن يكون بعد وقت البداية"})
        return attrs


class GroupSerializer(serializers.ModelSerializer):
    event_title = serializers.CharField(source="event.title", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)

    class Meta:
        model = Group
        fields = [
            "id",
            "event",
            "event_title",
            "section",
            "section_name",
            "name",
            "description",
            "location",
            "color",
        ]
        extra_kwargs = {
            "event": {"required": True},
            "section": {"required": False, "allow_null": True},
            "description": {"required": False, "allow_blank": True},
            "location": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        event = attrs.get("event") or (self.instance.event if self.instance else None)
        section = attrs.get("section")
        if section is None and self.instance:
            section = self.instance.section
        if section and event and section.event_id != event.id:
            raise serializers.ValidationError({"section": "القسم لا يتبع هذه المناسبة"})
        return attrs


class EventListSerializer(serializers.ModelSerializer):
    sections_count = serializers.SerializerMethodField()
    guests_count = serializers.SerializerMethodField()
    attended_count = serializers.SerializerMethodField()
    confirmed_count = serializers.SerializerMethodField()
    platform_name = serializers.SerializerMethodField()
    platform_id = serializers.SerializerMethodField()
    manager_name = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id", "title", "date", "time", "venue", "geo_address", "latitude", "longitude",
            "status", "status_label",
            "max_guests", "cover_image", "sections_count", "guests_count",
            "attended_count", "confirmed_count", "platform_id", "platform_name",
            "manager_name", "created_at",
        ]

    def get_sections_count(self, obj):
        if hasattr(obj, "sections_count") and not callable(getattr(obj, "sections_count", None)):
            return obj.sections_count
        return obj.sections.count()

    def get_guests_count(self, obj):
        if hasattr(obj, "guests_count") and not callable(getattr(obj, "guests_count", None)):
            return obj.guests_count
        return obj.guests.count()

    def get_attended_count(self, obj):
        if hasattr(obj, "attended_count"):
            return obj.attended_count
        return obj.guests.filter(status="attended").count()

    def get_confirmed_count(self, obj):
        if hasattr(obj, "confirmed_count"):
            return obj.confirmed_count
        return obj.guests.filter(status__in=CONFIRMED_ATTENDANCE_STATUSES).count()

    def get_platform_name(self, obj):
        return obj.platform.name if obj.platform else "—"

    def get_platform_id(self, obj):
        return obj.platform_id

    def get_manager_name(self, obj):
        return obj.created_by.get_full_name().strip() or obj.created_by.email

    def get_cover_image(self, obj):
        return _absolute_cover_url(self, obj)


class EventDetailSerializer(serializers.ModelSerializer):
    sections = serializers.SerializerMethodField()
    schedules = ScheduleSerializer(many=True, read_only=True)
    groups = GroupSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    location = serializers.SerializerMethodField()
    owner_name = serializers.SerializerMethodField()
    event_manager = serializers.SerializerMethodField()
    event_organizer = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()
    completion_percent = serializers.SerializerMethodField()
    phase = serializers.SerializerMethodField()
    phase_label = serializers.SerializerMethodField()
    recent_activity = serializers.SerializerMethodField()
    guest_greetings = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()
    started_at = serializers.DateTimeField(read_only=True)
    ended_at = serializers.DateTimeField(read_only=True)
    can_start = serializers.SerializerMethodField()
    can_end = serializers.SerializerMethodField()
    live_elapsed_seconds = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id", "title", "description", "date", "time", "end_date", "end_time",
            "venue", "geo_address", "latitude", "longitude", "location",
            "status", "status_label", "max_guests", "cover_image", "created_by",
            "created_by_name", "owner_name", "event_manager", "event_organizer",
            "managers", "sections", "schedules", "groups", "stats",
            "completion_percent", "phase", "phase_label", "recent_activity",
            "guest_greetings",
            "invitation_title", "invitation_message",
            "started_at", "ended_at", "can_start", "can_end", "live_elapsed_seconds",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]

    def get_location(self, obj):
        return _location_label(obj)

    def get_owner_name(self, obj):
        return obj.created_by.get_full_name().strip() or obj.created_by.email

    def get_cover_image(self, obj):
        return _absolute_cover_url(self, obj)

    def get_event_manager(self, obj):
        manager, _ = _event_managers_by_role(obj, obj.platform_id)
        return manager

    def get_event_organizer(self, obj):
        _, organizer = _event_managers_by_role(obj, obj.platform_id)
        return organizer

    def get_stats(self, obj):
        stats = _guest_stats_for_event(obj.id)
        no_response = max(stats["guests_total"] - stats["responded"], 0)
        return {
            **stats,
            "no_response": no_response,
        }

    def get_can_start(self, obj):
        from apps.events.event_lifecycle import can_start_event

        return can_start_event(obj)

    def get_can_end(self, obj):
        from apps.events.event_lifecycle import can_end_event

        return can_end_event(obj)

    def get_live_elapsed_seconds(self, obj):
        if not obj.started_at:
            return 0
        from django.utils import timezone

        end = obj.ended_at if obj.status == Event.Status.COMPLETED and obj.ended_at else timezone.now()
        return max(int((end - obj.started_at).total_seconds()), 0)

    def get_completion_percent(self, obj):
        return _completion_meta(obj)["completion_percent"]

    def get_phase(self, obj):
        return _completion_meta(obj)["phase"]

    def get_phase_label(self, obj):
        return _completion_meta(obj)["phase_label"]

    def _guests_for_event(self, obj):
        if hasattr(obj, "_detail_guests"):
            return obj._detail_guests
        if (
            hasattr(obj, "_prefetched_objects_cache")
            and "guests" in obj._prefetched_objects_cache
        ):
            guests = list(obj.guests.all())
        else:
            guests = list(
                Guest.objects.filter(event_id=obj.id).select_related("group", "section")
            )
        obj._detail_guests = guests
        return guests

    def get_sections(self, obj):
        guests = self._guests_for_event(obj)
        event_groups = {g.id: g for g in obj.groups.all()}
        result = []

        for section in obj.sections.all():
            section_guests = [g for g in guests if g.section_id == section.id]
            guests_count = len(section_guests)
            guests_confirmed = sum(
                1
                for g in section_guests
                if g.status in CONFIRMED_ATTENDANCE_STATUSES
            )

            group_stats: dict[int, dict] = {}
            for guest in section_guests:
                if not guest.group_id:
                    continue
                if guest.group_id not in group_stats:
                    group_stats[guest.group_id] = {"count": 0, "confirmed": 0}
                group_stats[guest.group_id]["count"] += 1
                if guest.status in CONFIRMED_ATTENDANCE_STATUSES:
                    group_stats[guest.group_id]["confirmed"] += 1

            groups_data = []
            section_linked = [g for g in obj.groups.all() if g.section_id == section.id]
            seen_group_ids: set[int] = set()

            for group in section_linked:
                stats = group_stats.get(group.id, {"count": 0, "confirmed": 0})
                groups_data.append(
                    {
                        "id": group.id,
                        "name": group.name,
                        "description": group.description,
                        "location": group.location or "",
                        "color": group.color,
                        "guests_count": stats["count"],
                        "guests_confirmed": stats["confirmed"],
                    }
                )
                seen_group_ids.add(group.id)

            for group_id, stats in group_stats.items():
                if group_id in seen_group_ids:
                    continue
                group = event_groups.get(group_id)
                if not group:
                    continue
                groups_data.append(
                    {
                        "id": group.id,
                        "name": group.name,
                        "description": group.description,
                        "location": group.location or "",
                        "color": group.color,
                        "guests_count": stats["count"],
                        "guests_confirmed": stats["confirmed"],
                    }
                )
                seen_group_ids.add(group.id)

            groups_data.sort(key=lambda x: x["name"])

            result.append(
                {
                    "id": section.id,
                    "name": section.name,
                    "description": section.description,
                    "location": section.location or "",
                    "color": section.color,
                    "order": section.order,
                    "guests_count": guests_count,
                    "guests_confirmed": guests_confirmed,
                    "groups": groups_data,
                }
            )

        return result

    def get_recent_activity(self, obj):
        items = []
        for guest in Guest.objects.filter(event_id=obj.id).order_by("-created_at")[:4]:
            status_label = guest.get_status_display()
            items.append(
                {
                    "id": f"guest-{guest.id}",
                    "message": f"ضيف «{guest.full_name}» — {status_label}",
                    "at": guest.created_at.isoformat(),
                    "tone": "primary",
                }
            )
        if not items and obj.updated_at:
            items.append(
                {
                    "id": "event-updated",
                    "message": "تم تحديث بيانات المناسبة",
                    "at": obj.updated_at.isoformat(),
                    "tone": "tertiary",
                }
            )
        return items

    def get_guest_greetings(self, obj):
        from apps.messages_app.models import Message

        greetings = (
            Message.objects.filter(
                event_id=obj.id,
                direction=Message.Direction.INCOMING,
                kind=Message.Kind.GREETING,
            )
            .select_related("guest")
            .order_by("-created_at")
        )
        return [
            {
                "id": msg.id,
                "guest_name": (msg.guest.full_name if msg.guest else "—"),
                "content": msg.content,
                "created_at": msg.created_at.isoformat(),
            }
            for msg in greetings
        ]


class EventCreateSerializer(serializers.ModelSerializer):
    event_manager_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        write_only=True,
    )
    event_organizer_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = Event
        fields = [
            "title",
            "description",
            "date",
            "time",
            "end_date",
            "end_time",
            "venue",
            "geo_address",
            "latitude",
            "longitude",
            "cover_image",
            "platform",
            "status",
            "invitation_title",
            "invitation_message",
            "event_manager_id",
            "event_organizer_id",
        ]
        extra_kwargs = {
            "description": {"required": False, "allow_blank": True},
            "venue": {"required": False, "allow_blank": True},
            "geo_address": {"required": False, "allow_blank": True},
            "end_date": {"required": False, "allow_null": True},
            "end_time": {"required": False, "allow_null": True},
            "latitude": {"required": False, "allow_null": True},
            "longitude": {"required": False, "allow_null": True},
            "cover_image": {"required": False, "allow_null": True},
            "platform": {"required": False, "allow_null": True},
            "status": {"required": False},
            "invitation_title": {"required": False, "allow_blank": True},
            "invitation_message": {"required": False, "allow_blank": True},
        }

    def to_internal_value(self, data):
        # تقريب إحداثيات الموقع إلى 6 منازل عشرية قبل التحقق، لأن منتقي
        # الخريطة قد يرسل دقّة أعلى مما يقبله الحقل (decimal_places=6).
        if hasattr(data, "copy"):
            data = data.copy()
        for key in ("latitude", "longitude"):
            raw = data.get(key)
            if raw not in (None, ""):
                try:
                    data[key] = str(
                        Decimal(str(raw)).quantize(
                            Decimal("0.000001"), rounding=ROUND_HALF_UP
                        )
                    )
                except (InvalidOperation, ValueError, TypeError):
                    pass
        return super().to_internal_value(data)

    def validate_title(self, value):
        if not value or not str(value).strip():
            raise serializers.ValidationError("اسم المناسبة مطلوب")
        return str(value).strip()

    def _validate_platform_member_user(self, user_id: int) -> int:
        platform = self.context.get("platform")
        if not platform:
            raise serializers.ValidationError("لا يمكن تعيين المدراء دون منصة نشطة")
        if platform.owner_id == user_id:
            return user_id
        if PlatformMember.objects.filter(platform_id=platform.id, user_id=user_id).exists():
            return user_id
        raise serializers.ValidationError("المستخدم المختار ليس ضمن منصتك")

    def validate_event_manager_id(self, value):
        raw = self.initial_data.get("event_manager_id")
        if raw is None or str(raw).strip() == "":
            return None
        if value is None:
            return None
        return self._validate_platform_member_user(int(value))

    def validate_event_organizer_id(self, value):
        raw = self.initial_data.get("event_organizer_id")
        if raw is None or str(raw).strip() == "":
            return None
        if value is None:
            return None
        return self._validate_platform_member_user(int(value))

    def validate_cover_image(self, value):
        if not value:
            return value
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("حجم صورة الغلاف يجب ألا يتجاوز 5 ميغابايت")
        return value

    def validate(self, attrs):
        attrs = _validate_coordinates(attrs)
        end_time = attrs.get("end_time")
        end_date = attrs.get("end_date")
        date = attrs.get("date") or (self.instance.date if self.instance else None)
        if end_time and not end_date and date:
            attrs["end_date"] = date
        return attrs

    def create(self, validated_data):
        manager_id = validated_data.pop("event_manager_id", None)
        organizer_id = validated_data.pop("event_organizer_id", None)
        event = super().create(validated_data)
        self._apply_managers(event, manager_id, organizer_id)
        return event

    def update(self, instance, validated_data):
        manager_id = validated_data.pop("event_manager_id", serializers.empty)
        organizer_id = validated_data.pop("event_organizer_id", serializers.empty)
        event = super().update(instance, validated_data)
        if "event_manager_id" in self.initial_data or "event_organizer_id" in self.initial_data:
            m_id = None if manager_id is serializers.empty else manager_id
            o_id = None if organizer_id is serializers.empty else organizer_id
            self._apply_managers(event, m_id, o_id)
        return event

    def _apply_managers(self, event, manager_id, organizer_id):
        manager_ids: list[int] = []
        if manager_id:
            manager_ids.append(manager_id)
        if organizer_id and organizer_id not in manager_ids:
            manager_ids.append(organizer_id)
        event.managers.set(manager_ids)

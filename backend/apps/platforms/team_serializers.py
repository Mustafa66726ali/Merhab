from rest_framework import serializers

from apps.accounts.models import User

MEMBER_ROLE_KEYS = (
    "event_manager",
    "event_organizer",
    "coordinator",
    "entry_manager",
)

USER_ROLE_MAP = {
    "event_manager": User.Role.EVENT_MANAGER,
    "event_organizer": User.Role.EVENT_ORGANIZER,
    "coordinator": User.Role.STAFF,
    "entry_manager": User.Role.STAFF,
}

MEMBER_ROLE_LABELS = {
    "event_manager": "مدير فعالية",
    "event_organizer": "منظم فعالية",
    "coordinator": "منسق",
    "entry_manager": "مدير دخول",
    "platform_member": "عضو منصة",
    "staff": "طاقم عمل",
}

ADD_ROLE_OPTIONS = [
    {"value": "event_manager", "label": "مدير فعالية"},
    {"value": "event_organizer", "label": "منظم فعالية"},
    {"value": "coordinator", "label": "منسق"},
    {"value": "entry_manager", "label": "مدير دخول"},
]

FILTER_ROLE_OPTIONS = ADD_ROLE_OPTIONS + [
    {"value": "platform_member", "label": "عضو منصة"},
    {"value": "staff", "label": "طاقم عمل"},
]

STATUS_FILTER_OPTIONS = [
    {"value": "active", "label": "نشط"},
    {"value": "inactive", "label": "غير نشط"},
    {"value": "blocked", "label": "محظور"},
]

PERMISSION_OPTIONS = [
    {"key": "perm_scan_qr", "label": "مسح QR code"},
    {"key": "perm_edit_guests", "label": "تعديل الضيوف"},
    {"key": "perm_send_messages", "label": "إرسال رسائل"},
]

ACCOUNT_STATUS_LABELS = {
    User.AccountStatus.ACTIVE: "نشط",
    User.AccountStatus.INACTIVE: "غير نشط",
    User.AccountStatus.BLOCKED: "محظور",
}

PERMISSION_FIELD_MAP = {
    "scan_qr": "perm_scan_qr",
    "edit_guests": "perm_edit_guests",
    "send_messages": "perm_send_messages",
}


def parse_bool(value) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("true", "1", "on", "yes")


class PlatformTeamMemberCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    role_key = serializers.ChoiceField(choices=MEMBER_ROLE_KEYS)
    coordinator_label = serializers.CharField(required=False, allow_blank=True, max_length=120)
    password = serializers.CharField(min_length=6, write_only=True)
    perm_scan_qr = serializers.BooleanField(required=False, default=False)
    perm_edit_guests = serializers.BooleanField(required=False, default=False)
    perm_send_messages = serializers.BooleanField(required=False, default=False)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value.strip()).exists():
            raise serializers.ValidationError("البريد الإلكتروني مستخدم مسبقاً")
        return value.strip().lower()

    def validate(self, attrs):
        if attrs.get("role_key") == "coordinator":
            label = (attrs.get("coordinator_label") or "").strip()
            if not label:
                raise serializers.ValidationError(
                    {"coordinator_label": "يرجى تحديد نوع المنسق (مثال: منسق رجال)"}
                )
            attrs["coordinator_label"] = label
        return attrs


class PlatformTeamMemberUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField(required=False)
    role_key = serializers.ChoiceField(choices=MEMBER_ROLE_KEYS, required=False)
    coordinator_label = serializers.CharField(required=False, allow_blank=True, max_length=120)
    account_status = serializers.ChoiceField(
        choices=[
            User.AccountStatus.ACTIVE,
            User.AccountStatus.INACTIVE,
            User.AccountStatus.BLOCKED,
        ],
        required=False,
    )
    password = serializers.CharField(
        min_length=6, required=False, allow_blank=True, write_only=True
    )
    perm_scan_qr = serializers.BooleanField(required=False)
    perm_edit_guests = serializers.BooleanField(required=False)
    perm_send_messages = serializers.BooleanField(required=False)

    def validate_email(self, value):
        value = value.strip().lower()
        user = self.context.get("user")
        if user and User.objects.filter(email__iexact=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("البريد الإلكتروني مستخدم مسبقاً")
        return value

    def validate(self, attrs):
        role_key = attrs.get("role_key")
        if role_key == "coordinator":
            label = (attrs.get("coordinator_label") or "").strip()
            if not label:
                raise serializers.ValidationError(
                    {"coordinator_label": "يرجى تحديد نوع المنسق"}
                )
            attrs["coordinator_label"] = label
        return attrs


class PlatformTeamPermissionToggleSerializer(serializers.Serializer):
    permission = serializers.ChoiceField(choices=list(PERMISSION_FIELD_MAP.keys()))
    enabled = serializers.BooleanField()

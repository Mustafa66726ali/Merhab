from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Platform, PlatformMember

User = get_user_model()


class PlatformSerializer(serializers.ModelSerializer):
    owner_name = serializers.SerializerMethodField()
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    events_count = serializers.IntegerField(read_only=True)
    members_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Platform
        fields = [
            "id",
            "name",
            "owner",
            "owner_name",
            "owner_email",
            "status",
            "description",
            "events_count",
            "members_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def get_owner_name(self, obj):
        full = obj.owner.get_full_name()
        return full.strip() or obj.owner.email


class PlatformCreateSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(write_only=True)
    owner_name = serializers.CharField(write_only=True, required=False, allow_blank=True, default="")
    owner_password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=6)

    class Meta:
        model = Platform
        fields = ["name", "owner_email", "owner_name", "owner_password", "status", "description"]

    def validate_owner_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("البريد الإلكتروني مستخدم مسبقاً")
        return email

    def validate(self, attrs):
        if not attrs.get("owner_password"):
            raise serializers.ValidationError({
                "owner_password": "كلمة المرور مطلوبة لإنشاء حساب مدير المنصة",
            })
        return attrs

    def create(self, validated_data):
        email = validated_data.pop("owner_email").strip().lower()
        owner_name = validated_data.pop("owner_name", "").strip()
        owner_password = validated_data.pop("owner_password")

        parts = owner_name.split(maxsplit=1) if owner_name else []
        first_name = parts[0] if parts else "مدير"
        last_name = parts[1] if len(parts) > 1 else "المنصة"
        owner = User(
            username=email,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=User.Role.PLATFORM_ADMIN,
            is_active=True,
        )
        owner.set_password(owner_password)
        owner.save()

        platform = Platform.objects.create(owner=owner, **validated_data)
        PlatformMember.objects.get_or_create(
            platform=platform,
            user=owner,
            defaults={"member_role": PlatformMember.MemberRole.EVENT_MANAGER},
        )
        return platform


class PlatformUpdateSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(write_only=True, required=False)
    owner_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    owner_password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=6)

    class Meta:
        model = Platform
        fields = ["name", "owner_email", "owner_name", "owner_password", "status", "description"]

    def update(self, instance, validated_data):
        owner_email = validated_data.pop("owner_email", None)
        owner_name = validated_data.pop("owner_name", None)
        owner_password = validated_data.pop("owner_password", None)

        if owner_email:
            email = owner_email.strip().lower()
            owner = User.objects.filter(email__iexact=email).first()
            if not owner:
                parts = (owner_name or "").strip().split(maxsplit=1)
                first_name = parts[0] if parts else "مدير"
                last_name = parts[1] if len(parts) > 1 else "المنصة"
                owner = User(
                    username=email,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    role=User.Role.PLATFORM_ADMIN,
                    is_active=True,
                )
                owner.set_password(owner_password or "Merhab@2024")
                owner.save()
            instance.owner = owner
            PlatformMember.objects.get_or_create(platform=instance, user=owner)

        if owner_password and instance.owner:
            instance.owner.set_password(owner_password)
            instance.owner.save()

        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        return instance

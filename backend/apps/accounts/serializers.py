from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "phone", "avatar", "is_active", "date_joined",
            "recovery_email_enabled",
            "two_factor_enabled",
        ]
        read_only_fields = ["date_joined"]


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["email", "first_name", "last_name", "phone"]


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(min_length=6)


class RecoveryEmailSerializer(serializers.Serializer):
    recovery_email_enabled = serializers.BooleanField()


class TwoFactorSerializer(serializers.Serializer):
    two_factor_enabled = serializers.BooleanField()


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = [
            "username", "email", "password", "first_name", "last_name",
            "role", "phone",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=4, max_length=12)
    new_password = serializers.CharField(min_length=6)

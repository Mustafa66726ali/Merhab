from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from apps.platforms.models import Platform
from apps.platforms.branding import platform_branding_payload

from .auth_service import authenticate_login
from .models import User
from .password_utils import verify_password
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    LoginSerializer,
    ProfileUpdateSerializer,
    ChangePasswordSerializer,
    RecoveryEmailSerializer,
    TwoFactorSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
)
from .password_recovery import request_password_reset, reset_password_with_code
from apps.integrations.email_send import is_password_recovery_configured


class AuthViewSet(viewsets.GenericViewSet):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        if self.action == "register":
            return UserCreateSerializer
        if self.action == "login":
            return LoginSerializer
        return UserSerializer

    @action(
        detail=False,
        methods=["post"],
        authentication_classes=[],
        permission_classes=[permissions.AllowAny],
    )
    def register(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            "user": UserSerializer(user).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }, status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=["post"],
        authentication_classes=[],
        permission_classes=[permissions.AllowAny],
    )
    def login(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        user = authenticate_login(email, password)
        if not user:
            try:
                from apps.activity_logs.models import ActivityLog
                from apps.activity_logs.services import record_activity

                record_activity(
                    action=ActivityLog.Action.LOGIN,
                    category=ActivityLog.Category.AUTH,
                    status=ActivityLog.Status.FAILURE,
                    object_repr="محاولة تسجيل دخول فاشلة",
                    description=f"فشل تسجيل الدخول للبريد: {email}",
                    metadata={"email": email},
                    request=request,
                )
            except Exception:
                pass
            return Response(
                {"detail": "البريد الإلكتروني أو كلمة المرور غير صحيحة"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        allowed_roles = {
            User.Role.SYSTEM_MANAGER,
            User.Role.PLATFORM_ADMIN,
            User.Role.EVENT_MANAGER,
            User.Role.EVENT_ORGANIZER,
            User.Role.STAFF,
        }
        if user.role not in allowed_roles:
            return Response(
                {"detail": "هذا الحساب غير مصرح له بدخول لوحة التحكم"},
                status=status.HTTP_403_FORBIDDEN,
            )
        if user.role == User.Role.PLATFORM_ADMIN:
            platform = Platform.objects.filter(owner=user).first()
            if not platform or platform.status != Platform.Status.ACTIVE:
                return Response(
                    {"detail": "منصتك محظورة أو غير موجودة. تواصل مع مدير النظام"},
                    status=status.HTTP_403_FORBIDDEN,
                )
        if user.role == User.Role.EVENT_MANAGER:
            from apps.platforms.member_context import (
                get_event_manager_context,
                membership_payload,
            )

            ctx = get_event_manager_context(user)
            if not ctx:
                return Response(
                    {"detail": "لا توجد منصة نشطة مرتبطة بحساب مدير الفعالية"},
                    status=status.HTTP_403_FORBIDDEN,
                )
        if user.role == User.Role.EVENT_ORGANIZER:
            from apps.platforms.member_context import (
                get_event_organizer_context,
                membership_payload,
            )

            ctx = get_event_organizer_context(user)
            if not ctx:
                return Response(
                    {"detail": "لا توجد منصة نشطة مرتبطة بحساب منظم الفعالية"},
                    status=status.HTTP_403_FORBIDDEN,
                )
        if user.role == User.Role.STAFF:
            from apps.platforms.member_context import get_platform_member_for_user

            ctx = get_platform_member_for_user(user)
            if not ctx:
                return Response(
                    {"detail": "لا توجد منصة نشطة مرتبطة بحسابك"},
                    status=status.HTTP_403_FORBIDDEN,
                )
        refresh = RefreshToken.for_user(user)
        payload = {
            "user": UserSerializer(user).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
        if user.role == User.Role.PLATFORM_ADMIN:
            platform = Platform.objects.filter(owner=user).first()
            if platform:
                payload["platform"] = platform_branding_payload(platform, request)
        if user.role == User.Role.EVENT_MANAGER:
            from apps.platforms.member_context import (
                get_event_manager_context,
                membership_payload,
            )

            ctx = get_event_manager_context(user)
            if ctx:
                platform, pm = ctx
                payload["platform"] = platform_branding_payload(platform, request)
                payload["membership"] = membership_payload(pm)
        if user.role == User.Role.EVENT_ORGANIZER:
            from apps.platforms.member_context import (
                get_event_organizer_context,
                membership_payload,
            )

            ctx = get_event_organizer_context(user)
            if ctx:
                platform, pm = ctx
                payload["platform"] = platform_branding_payload(platform, request)
                payload["membership"] = membership_payload(pm)
        if user.role == User.Role.STAFF:
            from apps.platforms.member_context import (
                get_platform_member_for_user,
                membership_payload,
            )

            ctx = get_platform_member_for_user(user)
            if ctx:
                platform, pm = ctx
                payload["platform"] = platform_branding_payload(platform, request)
                payload["membership"] = membership_payload(pm)
        try:
            from apps.activity_logs.models import ActivityLog
            from apps.activity_logs.services import record_activity

            record_activity(
                user=user,
                action=ActivityLog.Action.LOGIN,
                category=ActivityLog.Category.AUTH,
                status=ActivityLog.Status.SUCCESS,
                object_repr=user.email,
                description=f"تسجيل دخول ناجح — {user.get_role_display()}",
                request=request,
            )
        except Exception:
            pass
        return Response(payload)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        from apps.platforms.platform_permissions import get_platform_permissions
        from apps.platforms.member_context import (
            get_event_manager_context,
            get_event_organizer_context,
            get_platform_member_for_user,
            membership_payload,
        )

        data = UserSerializer(request.user).data
        if request.user.role == User.Role.PLATFORM_ADMIN:
            platform = Platform.objects.filter(owner=request.user).first()
            if platform:
                data["platform"] = platform_branding_payload(platform, request)
        if request.user.role == User.Role.EVENT_MANAGER:
            ctx = get_event_manager_context(request.user)
            if ctx:
                platform, pm = ctx
                data["platform"] = platform_branding_payload(platform, request)
                data["membership"] = membership_payload(pm)
        if request.user.role == User.Role.EVENT_ORGANIZER:
            ctx = get_event_organizer_context(request.user)
            if ctx:
                platform, pm = ctx
                data["platform"] = platform_branding_payload(platform, request)
                data["membership"] = membership_payload(pm)
        if request.user.role == User.Role.STAFF:
            ctx = get_platform_member_for_user(request.user)
            if ctx:
                platform, pm = ctx
                data["platform"] = platform_branding_payload(platform, request)
                data["membership"] = membership_payload(pm)
        perms = get_platform_permissions(request.user)
        data["platform_permissions"] = perms
        return Response(data)

    @action(detail=False, methods=["patch"], permission_classes=[permissions.IsAuthenticated])
    def update_me(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        if "email" in serializer.validated_data:
            user.username = user.email
            user.save(update_fields=["username"])
        return Response(UserSerializer(user).data)

    @action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not verify_password(user, serializer.validated_data["current_password"]):
            return Response(
                {"detail": "كلمة المرور الحالية غير صحيحة"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"detail": "تم تغيير كلمة المرور بنجاح"})

    @action(
        detail=False,
        methods=["patch"],
        permission_classes=[permissions.IsAuthenticated],
        url_path="recovery-email",
    )
    def recovery_email(self, request):
        serializer = RecoveryEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.recovery_email_enabled = serializer.validated_data["recovery_email_enabled"]
        user.save(update_fields=["recovery_email_enabled"])
        return Response(UserSerializer(user).data)

    @action(
        detail=False,
        methods=["patch"],
        permission_classes=[permissions.IsAuthenticated],
        url_path="two-factor",
    )
    def two_factor(self, request):
        serializer = TwoFactorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.two_factor_enabled = serializer.validated_data["two_factor_enabled"]
        user.save(update_fields=["two_factor_enabled"])
        return Response(UserSerializer(user).data)

    @action(
        detail=False,
        methods=["get"],
        authentication_classes=[],
        permission_classes=[permissions.AllowAny],
        url_path="recovery-status",
    )
    def recovery_status(self, request):
        """هل استعادة كلمة المرور عبر البريد مفعّلة (SMTP مُكوَّن)؟"""
        return Response({"configured": is_password_recovery_configured()})

    @action(
        detail=False,
        methods=["post"],
        authentication_classes=[],
        permission_classes=[permissions.AllowAny],
        url_path="forgot-password",
    )
    def forgot_password(self, request):
        """إرسال رمز تحقق إلى بريد المستخدم لاستعادة كلمة المرور."""
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = request_password_reset(serializer.validated_data["email"])
        status_code = (
            status.HTTP_200_OK if result.get("ok") else status.HTTP_400_BAD_REQUEST
        )
        return Response({"detail": result.get("detail", "")}, status=status_code)

    @action(
        detail=False,
        methods=["post"],
        authentication_classes=[],
        permission_classes=[permissions.AllowAny],
        url_path="reset-password",
    )
    def reset_password(self, request):
        """التحقق من الرمز وتعيين كلمة مرور جديدة."""
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = reset_password_with_code(
            data["email"], data["code"], data["new_password"]
        )
        status_code = (
            status.HTTP_200_OK if result.get("ok") else status.HTTP_400_BAD_REQUEST
        )
        return Response({"detail": result.get("detail", "")}, status=status_code)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    filterset_fields = ["role", "is_active"]
    search_fields = ["username", "email", "first_name", "last_name", "phone"]

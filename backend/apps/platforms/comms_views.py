from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import User

from .comms_serializers import (
    DirectMessageSerializer,
    DirectMessageWriteSerializer,
    UserNotificationSerializer,
    UserNotificationAdminSerializer,
)
from .models import DirectMessage, UserNotification, Platform, PlatformMember
from apps.platforms.platform_permissions import (
    PERM_SEND_MESSAGES,
    get_platform_for_user,
    has_platform_permission,
)
from apps.messages_app.guest_messages import (
    guest_contacts_for_user,
    guest_messages_queryset,
    guest_inbound_queryset,
    send_guest_message,
)
from apps.messages_app.serializers import MessageSerializer


ROLE_LABELS = {
    User.Role.SYSTEM_MANAGER: "مدير النظام",
    User.Role.PLATFORM_ADMIN: "مدير المنصة",
    User.Role.EVENT_MANAGER: "مدير الفعالية",
    User.Role.EVENT_ORGANIZER: "منظم الفعالية",
}


def _contact_from_user(user: User, platform_name: str = "") -> dict:
    role_label = ROLE_LABELS.get(user.role, user.get_role_display())
    return {
        "id": user.id,
        "name": user.get_full_name().strip() or user.email,
        "email": user.email,
        "role_label": role_label,
        "platform_name": platform_name,
    }


def _user_on_platform(user: User, platform: Platform | None) -> bool:
    if not platform:
        return False
    if platform.owner_id == user.id:
        return True
    return PlatformMember.objects.filter(platform=platform, user=user).exists()


def _platform_member_users(platform: Platform, roles: tuple) -> list[User]:
    return list(
        User.objects.filter(
            is_active=True,
            platform_memberships__platform=platform,
            role__in=roles,
        )
        .distinct()
        .order_by("first_name", "email")
    )


def _message_queryset_for_user(user):
    return DirectMessage.objects.filter(
        Q(sender=user) | Q(recipient=user)
    ).select_related("sender", "recipient", "platform", "parent")


def _message_stats(user) -> dict:
    base = _message_queryset_for_user(user)
    inbox_qs = base.filter(recipient=user)
    outbox_qs = base.filter(sender=user)
    return {
        "total": base.count(),
        "inbox": inbox_qs.count(),
        "outbox": outbox_qs.count(),
        "inbox_unread": inbox_qs.filter(is_read=False).count(),
        "inbox_read": inbox_qs.filter(is_read=True).count(),
        "outbox_opened": outbox_qs.filter(is_read=True).count(),
        "outbox_not_opened": outbox_qs.filter(is_read=False).count(),
        "delivered": base.filter(delivery_status=DirectMessage.DeliveryStatus.DELIVERED).count(),
        "pending": base.filter(delivery_status=DirectMessage.DeliveryStatus.PENDING).count(),
        "failed": base.filter(delivery_status=DirectMessage.DeliveryStatus.FAILED).count(),
    }


def _apply_message_filters(qs, request):
    read_filter = request.query_params.get("is_read")
    if read_filter in ("true", "1"):
        qs = qs.filter(is_read=True)
    elif read_filter in ("false", "0"):
        qs = qs.filter(is_read=False)

    opened = request.query_params.get("opened")
    if opened in ("true", "1"):
        qs = qs.filter(is_read=True)
    elif opened in ("false", "0"):
        qs = qs.filter(is_read=False)

    delivery = request.query_params.get("delivery_status")
    if delivery in (
        DirectMessage.DeliveryStatus.PENDING,
        DirectMessage.DeliveryStatus.DELIVERED,
        DirectMessage.DeliveryStatus.FAILED,
    ):
        qs = qs.filter(delivery_status=delivery)

    direction = request.query_params.get("direction")
    user = request.user
    if direction == "incoming":
        qs = qs.filter(recipient=user)
    elif direction == "outgoing":
        qs = qs.filter(sender=user)

    return qs


def _can_message(user: User, recipient: User) -> bool:
    if user.id == recipient.id or not recipient.is_active:
        return False
    if user.role == User.Role.SYSTEM_MANAGER:
        return recipient.role == User.Role.PLATFORM_ADMIN
    if user.role == User.Role.PLATFORM_ADMIN:
        platform = get_platform_for_user(user)
        if recipient.role == User.Role.SYSTEM_MANAGER:
            return True
        if recipient.role in (User.Role.EVENT_MANAGER, User.Role.EVENT_ORGANIZER):
            return _user_on_platform(recipient, platform)
        return False
    if user.role == User.Role.EVENT_MANAGER:
        platform = get_platform_for_user(user)
        if not platform:
            return False
        if recipient.role == User.Role.PLATFORM_ADMIN and platform.owner_id == recipient.id:
            return True
        if recipient.role in (User.Role.EVENT_MANAGER, User.Role.EVENT_ORGANIZER):
            return _user_on_platform(recipient, platform)
        return False
    if user.role == User.Role.EVENT_ORGANIZER:
        platform = get_platform_for_user(user)
        if not platform:
            return False
        if recipient.role == User.Role.PLATFORM_ADMIN and platform.owner_id == recipient.id:
            return True
        if recipient.role in (User.Role.EVENT_MANAGER, User.Role.EVENT_ORGANIZER):
            return _user_on_platform(recipient, platform)
        return False
    return False


def _platform_for_message(sender: User, recipient: User):
    if sender.role == User.Role.PLATFORM_ADMIN:
        return Platform.objects.filter(owner=sender).first()
    if recipient.role == User.Role.PLATFORM_ADMIN:
        return Platform.objects.filter(owner=recipient).first()
    platform = get_platform_for_user(sender) or get_platform_for_user(recipient)
    return platform


class CommsViewSet(viewsets.ViewSet):
    @action(detail=False, methods=["get"], url_path="messages/inbox")
    def messages_inbox(self, request):
        user = request.user
        unread_qs = DirectMessage.objects.filter(recipient=user, is_read=False)
        qs = unread_qs.select_related(
            "sender", "recipient", "platform", "parent"
        ).order_by("-created_at")[:50]
        direct_unread = unread_qs.count()

        guest_qs = guest_inbound_queryset(user).filter(is_read=False)
        guest_unread = guest_qs.count()
        guest_preview = MessageSerializer(
            guest_qs.order_by("-created_at")[:8],
            many=True,
        ).data

        return Response({
            "unread_count": direct_unread + guest_unread,
            "direct_unread": direct_unread,
            "guest_inbound_unread": guest_unread,
            "messages": DirectMessageSerializer(
                qs, many=True, context={"request": request}
            ).data,
            "guest_messages": guest_preview,
        })

    @action(detail=False, methods=["get"], url_path="messages/list")
    def messages_list(self, request):
        box = request.query_params.get("box", "all")
        user = request.user
        qs = _message_queryset_for_user(user)
        if box == "inbox":
            qs = qs.filter(recipient=user)
        elif box == "outbox":
            qs = qs.filter(sender=user)
        qs = _apply_message_filters(qs, request)
        qs = qs.order_by("-created_at")[:300]
        stats = _message_stats(user)
        return Response({
            "inbox_unread": stats["inbox_unread"],
            "stats": stats,
            "messages": DirectMessageSerializer(
                qs, many=True, context={"request": request}
            ).data,
        })

    @action(detail=False, methods=["get"], url_path="messages/contacts")
    def message_contacts(self, request):
        user = request.user
        contacts: list[dict] = []
        seen_ids: set[int] = set()

        def add_contact(entry: dict):
            if entry["id"] == user.id or entry["id"] in seen_ids:
                return
            seen_ids.add(entry["id"])
            contacts.append(entry)

        if user.role == User.Role.SYSTEM_MANAGER:
            platform_map = {
                p.owner_id: p
                for p in Platform.objects.select_related("owner").order_by("name")
            }
            for admin in User.objects.filter(
                role=User.Role.PLATFORM_ADMIN, is_active=True
            ).order_by("email"):
                platform = platform_map.get(admin.id)
                add_contact(
                    _contact_from_user(
                        admin,
                        platform.name if platform else "",
                    )
                )
        elif user.role == User.Role.PLATFORM_ADMIN:
            platform = get_platform_for_user(user)
            for manager in User.objects.filter(
                role=User.Role.SYSTEM_MANAGER, is_active=True
            ):
                add_contact(_contact_from_user(manager))
            if platform:
                for member in _platform_member_users(
                    platform,
                    (User.Role.EVENT_MANAGER, User.Role.EVENT_ORGANIZER),
                ):
                    add_contact(_contact_from_user(member, platform.name))
        elif user.role in (User.Role.EVENT_MANAGER, User.Role.EVENT_ORGANIZER):
            platform = get_platform_for_user(user)
            if platform and platform.owner.is_active:
                add_contact(_contact_from_user(platform.owner, platform.name))
            if platform:
                for member in _platform_member_users(
                    platform,
                    (User.Role.EVENT_MANAGER, User.Role.EVENT_ORGANIZER),
                ):
                    add_contact(_contact_from_user(member, platform.name))

        return Response({"contacts": contacts})

    @action(detail=False, methods=["post"], url_path="messages/send")
    def messages_send(self, request):
        user = request.user
        if user.role not in (User.Role.SYSTEM_MANAGER, User.Role.PLATFORM_ADMIN):
            if not has_platform_permission(user, PERM_SEND_MESSAGES):
                return Response(
                    {"detail": "غير مصرح — لا تملك صلاحية إرسال الرسائل"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        serializer = DirectMessageWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        recipient = get_object_or_404(User, pk=data["recipient_id"])
        if not _can_message(request.user, recipient):
            return Response(
                {"detail": "غير مصرح بإرسال رسالة لهذا المستخدم"},
                status=status.HTTP_403_FORBIDDEN,
            )

        parent = None
        parent_id = data.get("parent_id")
        if parent_id:
            parent = get_object_or_404(DirectMessage, pk=parent_id)
            if request.user.id not in (parent.sender_id, parent.recipient_id):
                return Response(
                    {"detail": "غير مصرح"},
                    status=status.HTTP_403_FORBIDDEN,
                )

        subject = (data.get("subject") or "").strip()
        if not subject and parent:
            subject = parent.subject
            if not subject.lower().startswith("re:"):
                subject = f"Re: {subject}"

        body = data["body"].strip()
        platform = _platform_for_message(request.user, recipient)

        delivery_status = DirectMessage.DeliveryStatus.DELIVERED
        if not recipient.is_active:
            delivery_status = DirectMessage.DeliveryStatus.FAILED

        now = timezone.now()
        msg = DirectMessage.objects.create(
            sender=request.user,
            recipient=recipient,
            platform=platform,
            subject=subject or "رسالة",
            body=body,
            parent=parent,
            delivery_status=delivery_status,
            delivered_at=now if delivery_status == DirectMessage.DeliveryStatus.DELIVERED else None,
        )
        from apps.platforms.notification_service import notify_direct_message

        notify_direct_message(recipient, request.user, subject or "رسالة جديدة", body, platform)
        return Response(
            DirectMessageSerializer(msg, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path=r"messages/(?P<message_id>[0-9]+)/read",
    )
    def message_mark_read(self, request, message_id=None):
        msg = get_object_or_404(DirectMessage, pk=message_id)
        if msg.recipient_id != request.user.id:
            return Response({"detail": "غير مصرح"}, status=status.HTTP_403_FORBIDDEN)
        if not msg.is_read:
            msg.is_read = True
            msg.read_at = timezone.now()
            msg.save(update_fields=["is_read", "read_at"])
        return Response(
            DirectMessageSerializer(msg, context={"request": request}).data
        )

    @action(
        detail=False,
        methods=["delete"],
        url_path=r"messages/(?P<message_id>[0-9]+)/delete",
    )
    def message_delete(self, request, message_id=None):
        msg = get_object_or_404(DirectMessage, pk=message_id)
        if msg.sender_id != request.user.id and msg.recipient_id != request.user.id:
            return Response({"detail": "غير مصرح"}, status=status.HTTP_403_FORBIDDEN)
        msg.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="notifications/inbox")
    def notifications_inbox(self, request):
        qs = UserNotification.objects.filter(user=request.user).select_related(
            "sender", "platform", "event"
        ).order_by("-created_at")[:50]
        unread = UserNotification.objects.filter(
            user=request.user, is_read=False
        ).count()
        return Response({
            "unread_count": unread,
            "notifications": UserNotificationSerializer(qs, many=True).data,
        })

    def _notifications_queryset(self, request):
        user = request.user
        if user.role == User.Role.SYSTEM_MANAGER:
            qs = UserNotification.objects.select_related("sender", "platform", "user")
        else:
            qs = UserNotification.objects.filter(user=user).select_related(
                "sender", "platform", "user"
            )

        read_filter = request.query_params.get("is_read")
        if read_filter in ("true", "1"):
            qs = qs.filter(is_read=True)
        elif read_filter in ("false", "0"):
            qs = qs.filter(is_read=False)

        platform_id = request.query_params.get("platform")
        if platform_id:
            qs = qs.filter(platform_id=platform_id)

        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(body__icontains=search)
                | Q(user__email__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(platform__name__icontains=search)
            )

        return qs.order_by("-created_at")

    @action(detail=False, methods=["get"], url_path="notifications/list")
    def notifications_list(self, request):
        qs = self._notifications_queryset(request)
        notifications = UserNotificationAdminSerializer(qs[:500], many=True).data
        all_qs = (
            UserNotification.objects.all()
            if request.user.role == User.Role.SYSTEM_MANAGER
            else UserNotification.objects.filter(user=request.user)
        )
        today = timezone.now().date()
        stats = {
            "total": all_qs.count(),
            "unread": all_qs.filter(is_read=False).count(),
            "read": all_qs.filter(is_read=True).count(),
            "today": all_qs.filter(created_at__date=today).count(),
        }
        platform_options = [
            {"value": str(p.id), "label": p.name}
            for p in Platform.objects.all().order_by("name")
        ]
        return Response({
            "notifications": notifications,
            "stats": stats,
            "platform_options": platform_options,
        })

    @action(
        detail=False,
        methods=["delete"],
        url_path=r"notifications/(?P<notification_id>[0-9]+)/delete",
    )
    def notification_delete(self, request, notification_id=None):
        try:
            notif = UserNotification.objects.get(pk=notification_id)
        except UserNotification.DoesNotExist:
            return Response(
                {"detail": "الإشعار غير موجود"},
                status=status.HTTP_404_NOT_FOUND,
            )

        user = request.user
        if user.role != User.Role.SYSTEM_MANAGER and notif.user_id != user.id:
            return Response({"detail": "غير مصرح"}, status=status.HTTP_403_FORBIDDEN)

        notif.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="notifications/mark-read")
    def notifications_mark_read(self, request):
        ids = request.data.get("ids", [])
        if not ids:
            return Response(
                {"detail": "لا توجد إشعارات محددة"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = UserNotification.objects.filter(id__in=ids)
        if request.user.role != User.Role.SYSTEM_MANAGER:
            qs = qs.filter(user=request.user)
        updated = qs.update(is_read=True)
        return Response({"updated": updated})

    @action(detail=False, methods=["post"], url_path="notifications/mark-all-read")
    def notifications_mark_all_read(self, request):
        qs = UserNotification.objects.filter(is_read=False)
        if request.user.role != User.Role.SYSTEM_MANAGER:
            qs = qs.filter(user=request.user)
        updated = qs.update(is_read=True)
        return Response({"updated": updated})

    @action(detail=False, methods=["post"], url_path="notifications/delete-read")
    def notifications_delete_read(self, request):
        qs = UserNotification.objects.filter(is_read=True)
        if request.user.role != User.Role.SYSTEM_MANAGER:
            qs = qs.filter(user=request.user)
        deleted, _ = qs.delete()
        return Response({"deleted": deleted})

    @action(detail=False, methods=["get"], url_path="guest-messages/list")
    def guest_messages_list(self, request):
        event_id = request.query_params.get("event")
        guest_id = request.query_params.get("guest")
        qs = guest_messages_queryset(
            request.user,
            event_id=int(event_id) if event_id else None,
            guest_id=int(guest_id) if guest_id else None,
        )[:500]
        return Response({
            "messages": MessageSerializer(qs, many=True).data,
        })

    @action(detail=False, methods=["get"], url_path="guest-messages/contacts")
    def guest_messages_contacts(self, request):
        event_id = request.query_params.get("event")
        contacts = guest_contacts_for_user(
            request.user,
            event_id=int(event_id) if event_id else None,
        )
        return Response({"contacts": contacts})

    @action(detail=False, methods=["post"], url_path="guest-messages/send")
    def guest_messages_send(self, request):
        guest_id = request.data.get("guest_id")
        content = request.data.get("content") or request.data.get("body") or ""
        via_whatsapp = bool(request.data.get("via_whatsapp"))
        if not guest_id:
            return Response(
                {"detail": "guest_id مطلوب"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            data = send_guest_message(
                request.user,
                int(guest_id),
                str(content),
                via_whatsapp=via_whatsapp,
            )
        except Exception as exc:
            from rest_framework.exceptions import APIException

            if isinstance(exc, APIException):
                raise exc
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="guest-messages/inbound")
    def guest_messages_inbound(self, request):
        """تهنئات واستفسارات واردة من صفحة الدعوة."""
        event_id = request.query_params.get("event")
        kind = (request.query_params.get("kind") or "").strip().lower()
        qs = guest_inbound_queryset(
            request.user,
            kind=kind if kind in ("greeting", "inquiry") else None,
            event_id=int(event_id) if event_id else None,
        )[:500]
        return Response({
            "messages": MessageSerializer(qs, many=True).data,
        })

    @action(detail=False, methods=["post"], url_path="guest-messages/mark-read")
    def guest_messages_mark_read(self, request):
        ids = request.data.get("ids") or []
        if not ids:
            return Response({"detail": "لا توجد رسائل محددة"}, status=status.HTTP_400_BAD_REQUEST)
        qs = guest_inbound_queryset(request.user).filter(id__in=ids)
        updated = qs.update(is_read=True)
        return Response({"updated": updated})

    @action(detail=False, methods=["post"], url_path="guest-messages/mark-all-read")
    def guest_messages_mark_all_read(self, request):
        qs = guest_inbound_queryset(request.user).filter(is_read=False)
        updated = qs.update(is_read=True)
        return Response({"updated": updated})

from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import User


class IsSystemManager(IsAuthenticated):
    def has_permission(self, request, view):
        return (
            super().has_permission(request, view)
            and request.user.role == User.Role.SYSTEM_MANAGER
        )

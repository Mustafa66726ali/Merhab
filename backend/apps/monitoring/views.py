from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from .services import collect_metrics


class IsSystemManager(IsAuthenticated):
    def has_permission(self, request, view):
        return (
            super().has_permission(request, view)
            and request.user.role == User.Role.SYSTEM_MANAGER
        )


class SystemOverviewView(APIView):
    permission_classes = [IsSystemManager]

    def get(self, request):
        return Response(collect_metrics())

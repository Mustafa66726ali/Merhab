from rest_framework import viewsets
from .models import StaffMember
from .serializers import StaffMemberSerializer


class StaffMemberViewSet(viewsets.ModelViewSet):
    serializer_class = StaffMemberSerializer
    filterset_fields = ["event", "role", "is_active"]

    def get_queryset(self):
        return StaffMember.objects.select_related("user").all()

from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.announcements.models import Announcement
from apps.announcements.permissions import IsSystemManager
from apps.announcements.serializers import (
    AnnouncementSerializer,
    AnnouncementWriteSerializer,
    AnnouncementPublicSerializer,
)


def get_visible_announcements():
    now = timezone.now()
    return Announcement.objects.filter(
        is_active=True,
        show_on_landing=True,
    ).filter(
        Q(starts_at__isnull=True) | Q(starts_at__lte=now),
        Q(ends_at__isnull=True) | Q(ends_at__gte=now),
    )


class AnnouncementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSystemManager]
    pagination_class = None
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ["section", "media_type", "is_active", "show_on_landing"]
    search_fields = ["title", "description"]

    def get_queryset(self):
        return Announcement.objects.all()

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return AnnouncementWriteSerializer
        return AnnouncementSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(
            AnnouncementSerializer(instance, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(AnnouncementSerializer(instance, context={"request": request}).data)


class AnnouncementOverviewView(APIView):
    permission_classes = [IsSystemManager]

    def get(self, request):
        qs = Announcement.objects.all()
        return Response({
            "stats": {
                "total": qs.count(),
                "active": qs.filter(is_active=True).count(),
                "banners": qs.filter(section=Announcement.Section.BANNER).count(),
                "videos": qs.filter(section=Announcement.Section.VIDEO).count(),
                "on_landing": qs.filter(show_on_landing=True, is_active=True).count(),
            },
            "sections": [
                {"value": v, "label": l}
                for v, l in Announcement.Section.choices
            ],
            "media_types": [
                {"value": v, "label": l}
                for v, l in Announcement.MediaType.choices
            ],
        })


class PublicAnnouncementListView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        qs = get_visible_announcements().order_by("section", "sort_order", "-created_at")
        data = AnnouncementPublicSerializer(qs, many=True, context={"request": request}).data
        banners = [d for d in data if d["section"] == Announcement.Section.BANNER]
        videos = [d for d in data if d["section"] == Announcement.Section.VIDEO]
        return Response({"banners": banners, "videos": videos})

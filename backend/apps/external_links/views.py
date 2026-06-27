from django.db import transaction
from django.db.models import F
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.external_links.models import ExternalLink
from apps.external_links.permissions import IsSystemManager
from apps.external_links.serializers import (
    ExternalLinkSerializer,
    ExternalLinkWriteSerializer,
    ReorderSerializer,
)
from apps.external_links.services import compute_stats, get_link_types_catalog, validate_url
from apps.platforms.models import Platform


class ExternalLinkViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSystemManager]
    pagination_class = None
    filterset_fields = ["category", "link_type", "placement", "is_active", "is_featured"]
    search_fields = ["title", "url", "description"]
    ordering_fields = ["sort_order", "created_at", "title", "click_count"]

    def get_queryset(self):
        qs = ExternalLink.objects.select_related("platform", "created_by").all()
        platform_param = self.request.query_params.get("platform")
        if platform_param == "system":
            qs = qs.filter(platform__isnull=True)
        elif platform_param:
            try:
                qs = qs.filter(platform_id=int(platform_param))
            except (TypeError, ValueError):
                pass
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ExternalLinkWriteSerializer
        if self.action == "reorder":
            return ReorderSerializer
        return ExternalLinkSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(
            ExternalLinkSerializer(instance).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(ExternalLinkSerializer(instance).data)

    @action(detail=False, methods=["get"])
    def overview(self, request):
        platforms = Platform.objects.order_by("name").values("id", "name")
        return Response({
            "stats": compute_stats(),
            "link_types": get_link_types_catalog(),
            "categories": [
                {"value": v, "label": l}
                for v, l in ExternalLink.Category.choices
            ],
            "placements": [
                {"value": v, "label": l}
                for v, l in ExternalLink.Placement.choices
            ],
            "platform_options": [{"id": p["id"], "name": p["name"]} for p in platforms],
        })

    @action(detail=True, methods=["post"])
    def toggle(self, request, pk=None):
        link = self.get_object()
        link.is_active = not link.is_active
        link.save(update_fields=["is_active", "updated_at"])
        return Response(ExternalLinkSerializer(link).data)

    @action(detail=True, methods=["post"])
    def toggle_featured(self, request, pk=None):
        link = self.get_object()
        link.is_featured = not link.is_featured
        link.save(update_fields=["is_featured", "updated_at"])
        return Response(ExternalLinkSerializer(link).data)

    @action(detail=True, methods=["post"])
    def track_click(self, request, pk=None):
        link = self.get_object()
        ExternalLink.objects.filter(pk=link.pk).update(click_count=F("click_count") + 1)
        link.refresh_from_db()
        return Response({"click_count": link.click_count})

    @action(detail=False, methods=["post"])
    def validate_url(self, request):
        url = request.data.get("url", "")
        ok, message = validate_url(url)
        return Response({"valid": ok, "message": message})

    @action(detail=False, methods=["post"])
    def reorder(self, request):
        serializer = ReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        items = serializer.validated_data["items"]
        with transaction.atomic():
            for item in items:
                link_id = item.get("id")
                sort_order = item.get("sort_order")
                if link_id is not None and sort_order is not None:
                    ExternalLink.objects.filter(pk=link_id).update(sort_order=sort_order)
        qs = self.get_queryset()
        return Response(ExternalLinkSerializer(qs, many=True).data)

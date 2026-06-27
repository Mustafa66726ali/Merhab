from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.static_pages.models import StaticPage
from apps.static_pages.permissions import IsSystemManager
from apps.static_pages.serializers import (
    StaticPageSerializer,
    StaticPageWriteSerializer,
    StaticPagePublicSerializer,
    StaticPagePublicListSerializer,
    ReorderSerializer,
    SeedTemplateSerializer,
)
from apps.static_pages.services import (
    compute_stats,
    get_page_types_catalog,
    seed_default_pages,
    publish_page,
    unpublish_page,
    DEFAULT_TEMPLATES,
    PAGE_TYPE_SLUGS,
    PAGE_TYPE_META,
)


class StaticPageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSystemManager]
    pagination_class = None
    filterset_fields = ["page_type", "is_published", "show_in_footer", "show_on_landing"]
    search_fields = ["title", "subtitle", "content", "slug"]
    ordering_fields = ["sort_order", "created_at", "updated_at", "title"]

    def get_queryset(self):
        return StaticPage.objects.select_related("created_by").all()

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return StaticPageWriteSerializer
        if self.action == "reorder":
            return ReorderSerializer
        if self.action == "seed_template":
            return SeedTemplateSerializer
        return StaticPageSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(StaticPageSerializer(instance).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(StaticPageSerializer(instance).data)

    @action(detail=False, methods=["get"])
    def overview(self, request):
        return Response({
            "stats": compute_stats(),
            "page_types": get_page_types_catalog(),
        })

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        page = publish_page(self.get_object())
        return Response(StaticPageSerializer(page).data)

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        page = unpublish_page(self.get_object())
        return Response(StaticPageSerializer(page).data)

    @action(detail=False, methods=["post"])
    def seed_defaults(self, request):
        created, updated = seed_default_pages()
        return Response({"created": created, "updated": updated})

    @action(detail=False, methods=["post"])
    def seed_template(self, request):
        serializer = SeedTemplateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        page_type = serializer.validated_data["page_type"]
        if page_type not in DEFAULT_TEMPLATES:
            return Response(
                {"detail": "لا يوجد قالب لهذا النوع"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        slug = PAGE_TYPE_SLUGS[page_type]
        meta = PAGE_TYPE_META.get(page_type, {})
        template = DEFAULT_TEMPLATES[page_type]
        page, was_created = StaticPage.objects.update_or_create(
            slug=slug,
            defaults={
                **template,
                "page_type": page_type,
                "slug": slug,
                "icon": meta.get("icon", "article"),
            },
        )
        return Response(
            StaticPageSerializer(page).data,
            status=status.HTTP_201_CREATED if was_created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"])
    def reorder(self, request):
        serializer = ReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            for item in serializer.validated_data["items"]:
                StaticPage.objects.filter(pk=item["id"]).update(sort_order=item["sort_order"])
        qs = self.get_queryset()
        return Response(StaticPageSerializer(qs, many=True).data)


class PublicStaticPageListView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        qs = StaticPage.objects.filter(is_published=True).order_by("sort_order", "title")
        placement = request.query_params.get("placement")
        if placement == "footer":
            qs = qs.filter(show_in_footer=True)
        elif placement == "header":
            qs = qs.filter(show_in_header=True)
        elif placement == "landing":
            qs = qs.filter(show_on_landing=True)
        return Response(StaticPagePublicListSerializer(qs, many=True).data)


class PublicStaticPageDetailView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        page = get_object_or_404(StaticPage, slug=slug, is_published=True)
        return Response(StaticPagePublicSerializer(page).data)


class PublicLandingOverviewView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        landing_pages = StaticPage.objects.filter(
            is_published=True,
            show_on_landing=True,
        ).order_by("sort_order")
        footer_pages = StaticPage.objects.filter(
            is_published=True,
            show_in_footer=True,
        ).order_by("sort_order")
        return Response({
            "landing_pages": StaticPagePublicListSerializer(landing_pages, many=True).data,
            "footer_pages": StaticPagePublicListSerializer(footer_pages, many=True).data,
        })

from rest_framework import viewsets, status, permissions
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.external_links.models import ExternalLink
from apps.public_media.models import LandingSiteConfig, PublicMediaItem, TestimonialSubmission
from apps.public_media.permissions import IsSystemManager
from apps.public_media.serializers import (
    LandingSiteConfigSerializer,
    PublicMediaItemSerializer,
    PublicMediaItemWriteSerializer,
    TestimonialSubmissionSerializer,
    TestimonialSubmissionWriteSerializer,
    TestimonialPublicSubmitSerializer,
)
from apps.public_media.services import build_public_site_payload, seed_landing_config
from apps.static_pages.models import StaticPage
from apps.static_pages.serializers import StaticPagePublicListSerializer
from apps.faq.models import FAQItem
from apps.faq.serializers import FAQPublicListSerializer
from apps.announcements.views import get_visible_announcements
from apps.announcements.serializers import AnnouncementPublicSerializer


def _visitor_testimonials_for_landing():
    qs = TestimonialSubmission.objects.filter(
        status=TestimonialSubmission.Status.APPROVED,
        show_on_landing=True,
    ).order_by("-created_at")
    return [{"name": t.name, "role": t.role, "text": t.text} for t in qs]


def _published_faq_for_landing():
    qs = FAQItem.objects.filter(
        is_published=True,
        status=FAQItem.Status.ANSWERED,
    ).exclude(answer="").order_by("sort_order", "-created_at")
    return FAQPublicListSerializer(qs, many=True).data


class PublicMediaItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSystemManager]
    pagination_class = None
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ["section", "media_type", "is_active", "is_featured"]
    search_fields = ["title", "description", "alt_text"]

    def get_queryset(self):
        return PublicMediaItem.objects.all()

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PublicMediaItemWriteSerializer
        return PublicMediaItemSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(
            PublicMediaItemSerializer(instance, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(PublicMediaItemSerializer(instance, context={"request": request}).data)


class LandingConfigView(APIView):
    permission_classes = [IsSystemManager]

    def get(self, request):
        config = LandingSiteConfig.get_solo()
        return Response(LandingSiteConfigSerializer(config).data)

    def patch(self, request):
        config = LandingSiteConfig.get_solo()
        serializer = LandingSiteConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class LandingAdminOverviewView(APIView):
    permission_classes = [IsSystemManager]

    def get(self, request):
        config = LandingSiteConfig.get_solo()
        media = PublicMediaItem.objects.all()
        return Response({
            "config": LandingSiteConfigSerializer(config).data,
            "media": PublicMediaItemSerializer(media, many=True, context={"request": request}).data,
            "stats": {
                "total_media": media.count(),
                "active_media": media.filter(is_active=True).count(),
                "images": media.filter(media_type=PublicMediaItem.MediaType.IMAGE).count(),
                "videos": media.filter(
                    media_type__in=[
                        PublicMediaItem.MediaType.VIDEO_URL,
                        PublicMediaItem.MediaType.VIDEO_FILE,
                    ]
                ).count(),
            },
            "sections": [
                {"value": v, "label": l}
                for v, l in PublicMediaItem.Section.choices
            ],
            "media_types": [
                {"value": v, "label": l}
                for v, l in PublicMediaItem.MediaType.choices
            ],
        })


class SeedLandingView(APIView):
    permission_classes = [IsSystemManager]

    def post(self, request):
        config = seed_landing_config()
        return Response(LandingSiteConfigSerializer(config).data)


class TestimonialSubmissionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSystemManager]
    pagination_class = None
    filterset_fields = ["status", "show_on_landing", "source"]
    search_fields = ["name", "role", "text", "email"]

    def get_queryset(self):
        return TestimonialSubmission.objects.all()

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return TestimonialSubmissionWriteSerializer
        return TestimonialSubmissionSerializer

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status == TestimonialSubmission.Status.APPROVED and not instance.reviewed_by:
            instance.reviewed_by = self.request.user
            instance.save(update_fields=["reviewed_by"])


class PublicTestimonialSubmitView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = TestimonialPublicSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(
            {
                "id": item.id,
                "message": "شكراً لك! سيتم مراجعة رأيك قبل نشره.",
            },
            status=status.HTTP_201_CREATED,
        )


class PublicSiteView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        config = LandingSiteConfig.get_solo()
        if not config.is_published:
            return Response({"published": False, "message": "صفحة الهبوط غير منشورة حالياً"})

        media_qs = PublicMediaItem.objects.filter(is_active=True).order_by("section", "sort_order")
        media_data = PublicMediaItemSerializer(
            media_qs, many=True, context={"request": request}
        ).data

        static_landing = StaticPage.objects.filter(is_published=True, show_on_landing=True).order_by("sort_order")
        static_footer = StaticPage.objects.filter(is_published=True, show_in_footer=True).order_by("sort_order")
        static_header = StaticPage.objects.filter(is_published=True, show_in_header=True).order_by("sort_order")

        from django.db.models import Q

        links_qs = ExternalLink.objects.filter(is_active=True).filter(
            Q(placement=ExternalLink.Placement.LANDING) | Q(placement=ExternalLink.Placement.ALL)
        ).order_by("sort_order")

        payload = build_public_site_payload(
            config,
            media_data,
            StaticPagePublicListSerializer(static_landing, many=True).data,
            [
                {
                    "title": l.title,
                    "url": l.url,
                    "icon": l.icon or "link",
                    "link_type": l.link_type,
                }
                for l in links_qs
            ],
            StaticPagePublicListSerializer(static_footer, many=True).data,
            visitor_testimonials=_visitor_testimonials_for_landing(),
            faq_items=_published_faq_for_landing(),
        )
        payload["published"] = True
        payload["header_pages"] = StaticPagePublicListSerializer(static_header, many=True).data
        ann_data = AnnouncementPublicSerializer(
            get_visible_announcements().order_by("section", "sort_order", "-created_at"),
            many=True,
            context={"request": request},
        ).data
        payload["announcement_banners"] = [
            d for d in ann_data if d["section"] == "banner"
        ]
        payload["announcement_videos"] = [
            d for d in ann_data if d["section"] == "video"
        ]
        wa_link = links_qs.filter(link_type=ExternalLink.LinkType.WHATSAPP).first()
        payload["admin_whatsapp_url"] = wa_link.url if wa_link else ""
        return Response(payload)

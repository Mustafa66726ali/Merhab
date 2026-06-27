from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.faq.models import FAQItem
from apps.faq.serializers import (
    FAQItemSerializer,
    FAQItemWriteSerializer,
    FAQPublicSubmitSerializer,
    FAQPublicListSerializer,
)
from apps.public_media.permissions import IsSystemManager


class FAQItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSystemManager]
    pagination_class = None
    filterset_fields = ["status", "is_published"]
    search_fields = ["question", "answer", "asker_name", "asker_email"]

    def get_queryset(self):
        return FAQItem.objects.all()

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return FAQItemWriteSerializer
        return FAQItemSerializer

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.answer and instance.status == FAQItem.Status.PENDING:
            instance.status = FAQItem.Status.ANSWERED
            instance.answered_at = timezone.now()
            instance.answered_by = self.request.user
            instance.save(update_fields=["status", "answered_at", "answered_by"])

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = FAQItemWriteSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        answer = serializer.validated_data.get("answer", instance.answer)
        status_val = serializer.validated_data.get("status", instance.status)
        is_published = serializer.validated_data.get("is_published", instance.is_published)

        instance.question = serializer.validated_data.get("question", instance.question)
        instance.asker_name = serializer.validated_data.get("asker_name", instance.asker_name)
        instance.asker_email = serializer.validated_data.get("asker_email", instance.asker_email)
        instance.answer = answer
        instance.status = status_val
        instance.sort_order = serializer.validated_data.get("sort_order", instance.sort_order)
        instance.is_published = is_published

        if answer and not instance.answered_at:
            instance.answered_at = timezone.now()
            instance.answered_by = request.user
            if instance.status == FAQItem.Status.PENDING:
                instance.status = FAQItem.Status.ANSWERED

        instance.save()
        return Response(FAQItemSerializer(instance).data)


class FAQOverviewView(APIView):
    permission_classes = [IsSystemManager]

    def get(self, request):
        qs = FAQItem.objects.all()
        return Response({
            "stats": {
                "total": qs.count(),
                "pending": qs.filter(status=FAQItem.Status.PENDING).count(),
                "answered": qs.filter(status=FAQItem.Status.ANSWERED).count(),
                "published": qs.filter(is_published=True).count(),
            },
        })


class PublicFAQSubmitView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = FAQPublicSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(
            {
                "id": item.id,
                "message": "تم إرسال سؤالك بنجاح. سنرد عليك قريباً.",
            },
            status=status.HTTP_201_CREATED,
        )


class PublicFAQListView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        qs = FAQItem.objects.filter(
            is_published=True,
            status=FAQItem.Status.ANSWERED,
        ).exclude(answer="").order_by("sort_order", "-created_at")
        return Response(FAQPublicListSerializer(qs, many=True).data)

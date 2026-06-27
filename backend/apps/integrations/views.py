from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.integrations.models import IntegrationCredential
from apps.integrations.permissions import IsSystemManager
from apps.integrations.serializers import (
    IntegrationCredentialSerializer,
    IntegrationCredentialWriteSerializer,
)
from apps.integrations.services import compute_stats, get_providers_catalog, run_test_and_save


class IntegrationCredentialViewSet(viewsets.ModelViewSet):
    permission_classes = [IsSystemManager]
    pagination_class = None
    filterset_fields = ["category", "provider", "is_active", "environment"]
    search_fields = ["name", "description", "from_email", "notes"]
    ordering_fields = ["created_at", "updated_at", "name", "provider"]

    def get_queryset(self):
        return IntegrationCredential.objects.select_related("created_by").all()

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return IntegrationCredentialWriteSerializer
        return IntegrationCredentialSerializer

    def perform_create(self, serializer):
        with transaction.atomic():
            instance = serializer.save()
            if instance.is_primary:
                IntegrationCredential.objects.filter(
                    category=instance.category,
                ).exclude(pk=instance.pk).update(is_primary=False)

    def perform_update(self, serializer):
        with transaction.atomic():
            instance = serializer.save()
            if instance.is_primary:
                IntegrationCredential.objects.filter(
                    category=instance.category,
                ).exclude(pk=instance.pk).update(is_primary=False)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        read = IntegrationCredentialSerializer(serializer.instance)
        return Response(read.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        read = IntegrationCredentialSerializer(serializer.instance)
        return Response(read.data)

    @action(detail=False, methods=["get"])
    def overview(self, request):
        return Response({
            "stats": compute_stats(),
            "providers": get_providers_catalog(),
            "categories": [
                {"value": v, "label": l}
                for v, l in IntegrationCredential.Category.choices
            ],
        })

    @action(detail=True, methods=["post"])
    def test(self, request, pk=None):
        credential = self.get_object()
        result = run_test_and_save(credential)
        return Response({
            **result,
            "credential": IntegrationCredentialSerializer(credential).data,
        })

    @action(detail=True, methods=["post"])
    def toggle(self, request, pk=None):
        credential = self.get_object()
        credential.is_active = not credential.is_active
        credential.save(update_fields=["is_active", "updated_at"])
        return Response(IntegrationCredentialSerializer(credential).data)

    @action(detail=True, methods=["post"])
    def set_primary(self, request, pk=None):
        credential = self.get_object()
        with transaction.atomic():
            IntegrationCredential.objects.filter(category=credential.category).update(is_primary=False)
            credential.is_primary = True
            credential.save(update_fields=["is_primary", "updated_at"])
        return Response(IntegrationCredentialSerializer(credential).data)

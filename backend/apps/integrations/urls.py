from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.integrations.views import IntegrationCredentialViewSet

router = DefaultRouter()
router.register("credentials", IntegrationCredentialViewSet, basename="integration-credential")

urlpatterns = [
    path("", include(router.urls)),
]

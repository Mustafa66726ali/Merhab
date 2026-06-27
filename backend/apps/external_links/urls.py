from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.external_links.views import ExternalLinkViewSet

router = DefaultRouter()
router.register("links", ExternalLinkViewSet, basename="external-link")

urlpatterns = [
    path("", include(router.urls)),
]

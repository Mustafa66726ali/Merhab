from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.faq.views import (
    FAQItemViewSet,
    FAQOverviewView,
    PublicFAQSubmitView,
    PublicFAQListView,
)

router = DefaultRouter()
router.register("items", FAQItemViewSet, basename="faq-item")

urlpatterns = [
    path("", include(router.urls)),
    path("overview/", FAQOverviewView.as_view(), name="faq-overview"),
    path("public/submit/", PublicFAQSubmitView.as_view(), name="faq-public-submit"),
    path("public/list/", PublicFAQListView.as_view(), name="faq-public-list"),
]

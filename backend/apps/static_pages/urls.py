from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.static_pages.views import (
    StaticPageViewSet,
    PublicStaticPageListView,
    PublicStaticPageDetailView,
    PublicLandingOverviewView,
)

router = DefaultRouter()
router.register("pages", StaticPageViewSet, basename="static-page")

urlpatterns = [
    path("", include(router.urls)),
    path("public/pages/", PublicStaticPageListView.as_view(), name="public-static-pages-list"),
    path("public/pages/<slug:slug>/", PublicStaticPageDetailView.as_view(), name="public-static-page-detail"),
    path("public/landing/", PublicLandingOverviewView.as_view(), name="public-landing-overview"),
]

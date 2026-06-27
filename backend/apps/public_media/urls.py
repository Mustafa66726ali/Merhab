from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.public_media.views import (
    PublicMediaItemViewSet,
    LandingConfigView,
    LandingAdminOverviewView,
    SeedLandingView,
    PublicSiteView,
    TestimonialSubmissionViewSet,
    PublicTestimonialSubmitView,
)

router = DefaultRouter()
router.register("items", PublicMediaItemViewSet, basename="public-media-item")
router.register("testimonials", TestimonialSubmissionViewSet, basename="testimonial-submission")

urlpatterns = [
    path("", include(router.urls)),
    path("config/", LandingConfigView.as_view(), name="landing-config"),
    path("overview/", LandingAdminOverviewView.as_view(), name="landing-admin-overview"),
    path("seed/", SeedLandingView.as_view(), name="landing-seed"),
    path("public/site/", PublicSiteView.as_view(), name="public-site"),
    path("public/testimonials/submit/", PublicTestimonialSubmitView.as_view(), name="public-testimonial-submit"),
]

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.announcements.views import (
    AnnouncementViewSet,
    AnnouncementOverviewView,
    PublicAnnouncementListView,
)

router = DefaultRouter()
router.register("items", AnnouncementViewSet, basename="announcement")

urlpatterns = [
    path("", include(router.urls)),
    path("overview/", AnnouncementOverviewView.as_view(), name="announcements-overview"),
    path("public/list/", PublicAnnouncementListView.as_view(), name="announcements-public-list"),
]

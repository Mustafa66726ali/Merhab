from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.activity_logs.views import ActivityLogViewSet, ActivityLogOverviewView

router = DefaultRouter()
router.register("logs", ActivityLogViewSet, basename="activity-log")

urlpatterns = [
    path("", include(router.urls)),
    path("overview/", ActivityLogOverviewView.as_view(), name="activity-logs-overview"),
]

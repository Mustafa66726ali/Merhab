from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .dashboard_views import ReportsDashboardView
from .views import ReportViewSet

router = DefaultRouter()
router.register("", ReportViewSet, basename="report")

urlpatterns = [
    path("dashboard/", ReportsDashboardView.as_view(), name="reports-dashboard"),
    path("", include(router.urls)),
]

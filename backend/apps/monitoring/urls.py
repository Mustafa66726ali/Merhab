from django.urls import path

from .views import SystemOverviewView

urlpatterns = [
    path("overview/", SystemOverviewView.as_view(), name="monitoring-overview"),
]

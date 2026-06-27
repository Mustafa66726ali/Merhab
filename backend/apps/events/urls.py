from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EventViewSet, SectionViewSet, ScheduleViewSet, GroupViewSet

router = DefaultRouter()
router.register("events", EventViewSet, basename="event")
router.register("sections", SectionViewSet, basename="section")
router.register("schedules", ScheduleViewSet, basename="schedule")
router.register("groups", GroupViewSet, basename="group")

urlpatterns = [
    path("", include(router.urls)),
]

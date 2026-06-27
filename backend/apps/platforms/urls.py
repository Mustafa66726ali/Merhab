from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .comms_views import CommsViewSet
from .views import PlatformViewSet

router = DefaultRouter()
router.register("platforms", PlatformViewSet, basename="platform")
router.register("comms", CommsViewSet, basename="comms")

urlpatterns = [
    path("", include(router.urls)),
]

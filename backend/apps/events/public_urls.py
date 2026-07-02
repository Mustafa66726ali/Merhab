from django.urls import path

from .public_views import PublicBroadcastLiveMediaView, PublicBroadcastView

urlpatterns = [
    path(
        "broadcast/<uuid:token>/",
        PublicBroadcastView.as_view(),
        name="public-broadcast",
    ),
    path(
        "broadcast/<uuid:token>/live-media/",
        PublicBroadcastLiveMediaView.as_view(),
        name="public-broadcast-live-media",
    ),
]

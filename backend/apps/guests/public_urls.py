from django.urls import path

from .public_views import (
    PublicInvitationGreetingView,
    PublicInvitationInquiryView,
    PublicInvitationLiveMediaView,
    PublicInvitationQrView,
    PublicInvitationRespondView,
    PublicInvitationView,
)

urlpatterns = [
    path(
        "invitation/<uuid:token>/",
        PublicInvitationView.as_view(),
        name="public-invitation",
    ),
    path(
        "invitation/<uuid:token>/respond/",
        PublicInvitationRespondView.as_view(),
        name="public-invitation-respond",
    ),
    path(
        "invitation/<uuid:token>/greeting/",
        PublicInvitationGreetingView.as_view(),
        name="public-invitation-greeting",
    ),
    path(
        "invitation/<uuid:token>/inquiry/",
        PublicInvitationInquiryView.as_view(),
        name="public-invitation-inquiry",
    ),
    path(
        "invitation/<uuid:token>/live-media/",
        PublicInvitationLiveMediaView.as_view(),
        name="public-invitation-live-media",
    ),
    path(
        "invitation/<uuid:token>/qr.png",
        PublicInvitationQrView.as_view(),
        name="public-invitation-qr",
    ),
]

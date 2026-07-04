from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.integrations.views import IntegrationCredentialViewSet
from apps.integrations.whatsapp_webhook_views import (
    bot_whatsapp_inbound,
    meta_whatsapp_webhook,
    twilio_whatsapp_webhook,
)

router = DefaultRouter()
router.register("credentials", IntegrationCredentialViewSet, basename="integration-credential")

urlpatterns = [
    path("", include(router.urls)),
    path("whatsapp/webhook/meta/", meta_whatsapp_webhook, name="whatsapp-webhook-meta"),
    path("whatsapp/webhook/twilio/", twilio_whatsapp_webhook, name="whatsapp-webhook-twilio"),
    path("whatsapp/bot-inbound/", bot_whatsapp_inbound, name="whatsapp-bot-inbound"),
]

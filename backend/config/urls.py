from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/events/", include("apps.events.urls")),
    path("api/v1/guests/", include("apps.guests.urls")),
    path("api/v1/public/", include("apps.guests.public_urls")),
    path("api/v1/tables/", include("apps.tables.urls")),
    path("api/v1/invitations/", include("apps.invitations.urls")),
    path("api/v1/messages/", include("apps.messages_app.urls")),
    path("api/v1/reports/", include("apps.reports.urls")),
    path("api/v1/staff/", include("apps.staff.urls")),
    path("api/v1/platforms/", include("apps.platforms.urls")),
    path("api/v1/monitoring/", include("apps.monitoring.urls")),
    path("api/v1/integrations/", include("apps.integrations.urls")),
    path("api/v1/external-links/", include("apps.external_links.urls")),
    path("api/v1/static-pages/", include("apps.static_pages.urls")),
    path("api/v1/public-media/", include("apps.public_media.urls")),
    path("api/v1/faq/", include("apps.faq.urls")),
    path("api/v1/announcements/", include("apps.announcements.urls")),
    path("api/v1/activity-logs/", include("apps.activity_logs.urls")),
    path("api/v1/system-settings/", include("apps.system_settings.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

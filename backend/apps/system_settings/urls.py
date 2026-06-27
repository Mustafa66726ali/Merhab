from django.urls import path

from apps.system_settings.views import SystemSettingsView

urlpatterns = [
    path("", SystemSettingsView.as_view(), name="system-settings"),
]

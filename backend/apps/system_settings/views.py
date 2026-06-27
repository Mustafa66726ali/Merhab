from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.system_settings.models import SystemSettings
from apps.system_settings.permissions import IsSystemManager
from apps.system_settings.serializers import SystemSettingsSerializer


class SystemSettingsView(APIView):
    permission_classes = [IsSystemManager]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        settings = SystemSettings.get_solo()
        data = SystemSettingsSerializer(settings, context={"request": request}).data
        data["choices"] = {
            "languages": [
                {"value": v, "label": l} for v, l in SystemSettings.Language.choices
            ],
            "timezones": [
                {"value": v, "label": l} for v, l in SystemSettings.Timezone.choices
            ],
            "qr_validity": [
                {"value": v, "label": l} for v, l in SystemSettings.QrValidity.choices
            ],
            "ticket_formats": [
                {"value": v, "label": l} for v, l in SystemSettings.TicketFormat.choices
            ],
        }
        return Response(data)

    def patch(self, request):
        settings = SystemSettings.get_solo()
        serializer = SystemSettingsSerializer(
            settings,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return Response(
            SystemSettingsSerializer(instance, context={"request": request}).data
        )

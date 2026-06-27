from rest_framework.response import Response
from rest_framework.views import APIView

from apps.reports.analytics import build_reports_dashboard
from apps.reports.permissions import IsSystemManager


class ReportsDashboardView(APIView):
    permission_classes = [IsSystemManager]

    def get(self, request):
        return Response(build_reports_dashboard())

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Q
from .models import Report
from .serializers import ReportSerializer
from apps.guests.models import Guest
from apps.invitations.models import Invitation


class ReportViewSet(viewsets.ModelViewSet):
    serializer_class = ReportSerializer
    filterset_fields = ["event", "report_type"]

    def get_queryset(self):
        return Report.objects.select_related("event").all()

    @action(detail=False, methods=["post"])
    def generate(self, request):
        event_id = request.data.get("event")
        report_type = request.data.get("report_type")

        data = {}
        if report_type == "guest_list":
            guests = Guest.objects.filter(event_id=event_id)
            data = {
                "total": guests.count(),
                "confirmed": guests.filter(status="confirmed").count(),
                "attended": guests.filter(status="attended").count(),
                "declined": guests.filter(status="declined").count(),
            }
        elif report_type == "invitations":
            invitations = Invitation.objects.filter(event_id=event_id)
            data = {
                "total": invitations.count(),
                "sent": invitations.filter(status="sent").count(),
                "opened": invitations.filter(status="opened").count(),
            }

        report = Report.objects.create(
            event_id=event_id,
            report_type=report_type,
            title=f"تقرير {report_type}",
            data=data,
        )
        return Response(ReportSerializer(report).data, status=status.HTTP_201_CREATED)

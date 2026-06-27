from rest_framework import serializers
from .models import Report


class ReportSerializer(serializers.ModelSerializer):
    event_title = serializers.CharField(source="event.title", read_only=True)

    class Meta:
        model = Report
        fields = [
            "id", "event", "event_title", "report_type",
            "title", "data", "generated_at",
        ]
        read_only_fields = ["generated_at"]

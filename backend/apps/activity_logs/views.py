from datetime import timedelta

from django.db.models import Count
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, permissions
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activity_logs.models import ActivityLog
from apps.activity_logs.permissions import IsSystemManager
from apps.activity_logs.serializers import ActivityLogSerializer


class ActivityLogPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsSystemManager]
    serializer_class = ActivityLogSerializer
    pagination_class = ActivityLogPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["action", "category", "status", "user_role"]
    search_fields = [
        "description",
        "object_repr",
        "user_email",
        "user_name",
        "request_path",
        "ip_address",
    ]
    ordering_fields = ["created_at", "action", "category"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = ActivityLog.objects.all()
        category = self.request.query_params.get("category")
        action = self.request.query_params.get("action")
        status = self.request.query_params.get("status")
        user_id = self.request.query_params.get("user")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if category:
            qs = qs.filter(category=category)
        if action:
            qs = qs.filter(action=action)
        if status:
            qs = qs.filter(status=status)
        if user_id:
            qs = qs.filter(user_id=user_id)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs


class ActivityLogOverviewView(APIView):
    permission_classes = [IsSystemManager]

    def get(self, request):
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=7)

        qs = ActivityLog.objects.all()
        today_qs = qs.filter(created_at__gte=today_start)
        week_qs = qs.filter(created_at__gte=week_start)

        by_category = list(
            week_qs.values("category")
            .annotate(count=Count("id"))
            .order_by("-count")[:12]
        )
        for row in by_category:
            row["label"] = dict(ActivityLog.Category.choices).get(row["category"], row["category"])

        by_action = list(
            week_qs.values("action")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        for row in by_action:
            row["label"] = dict(ActivityLog.Action.choices).get(row["action"], row["action"])

        by_status = list(
            week_qs.values("status")
            .annotate(count=Count("id"))
        )
        for row in by_status:
            row["label"] = dict(ActivityLog.Status.choices).get(row["status"], row["status"])

        recent = ActivityLogSerializer(
            qs.order_by("-created_at")[:8],
            many=True,
        ).data

        return Response({
            "stats": {
                "total": qs.count(),
                "today": today_qs.count(),
                "last_7_days": week_qs.count(),
                "failures_today": today_qs.filter(status=ActivityLog.Status.FAILURE).count(),
                "success_rate": _success_rate(week_qs),
            },
            "by_category": by_category,
            "by_action": by_action,
            "by_status": by_status,
            "recent": recent,
            "filters": {
                "actions": [{"value": v, "label": l} for v, l in ActivityLog.Action.choices],
                "categories": [{"value": v, "label": l} for v, l in ActivityLog.Category.choices],
                "statuses": [{"value": v, "label": l} for v, l in ActivityLog.Status.choices],
            },
        })


def _success_rate(qs) -> float:
    total = qs.count()
    if total == 0:
        return 100.0
    success = qs.filter(status=ActivityLog.Status.SUCCESS).count()
    return round(success / total * 100, 1)

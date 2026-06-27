from apps.activity_logs.services import record_from_request


class ActivityLogMiddleware:
    """يسجّل عمليات مدير النظام على واجهة API."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            record_from_request(request, response.status_code)
        except Exception:
            pass
        return response

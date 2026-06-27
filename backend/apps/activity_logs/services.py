"""تسجيل وتصنيف سجلات النشاط."""

from __future__ import annotations

from typing import Any, Optional

from django.http import HttpRequest

from apps.activity_logs.models import ActivityLog

PATH_CATEGORY_MAP = {
    "auth": ActivityLog.Category.AUTH,
    "events": ActivityLog.Category.EVENTS,
    "guests": ActivityLog.Category.GUESTS,
    "platforms": ActivityLog.Category.PLATFORMS,
    "integrations": ActivityLog.Category.INTEGRATIONS,
    "static-pages": ActivityLog.Category.STATIC_PAGES,
    "external-links": ActivityLog.Category.EXTERNAL_LINKS,
    "public-media": ActivityLog.Category.PUBLIC_MEDIA,
    "announcements": ActivityLog.Category.ANNOUNCEMENTS,
    "faq": ActivityLog.Category.FAQ,
    "reports": ActivityLog.Category.REPORTS,
    "staff": ActivityLog.Category.STAFF,
    "messages": ActivityLog.Category.MESSAGES,
    "monitoring": ActivityLog.Category.MONITORING,
    "tables": ActivityLog.Category.EVENTS,
    "invitations": ActivityLog.Category.EVENTS,
    "users": ActivityLog.Category.SYSTEM,
}

METHOD_ACTION_MAP = {
    "POST": ActivityLog.Action.CREATE,
    "PUT": ActivityLog.Action.UPDATE,
    "PATCH": ActivityLog.Action.UPDATE,
    "DELETE": ActivityLog.Action.DELETE,
    "GET": ActivityLog.Action.VIEW,
}


def get_client_ip(request: HttpRequest) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def infer_category_from_path(path: str) -> str:
    parts = path.strip("/").split("/")
    if len(parts) >= 3 and parts[0] == "api" and parts[1] == "v1":
        segment = parts[2]
        return PATH_CATEGORY_MAP.get(segment, ActivityLog.Category.OTHER)
    return ActivityLog.Category.OTHER


def infer_action_from_request(method: str, path: str) -> str:
    lower = path.lower()
    if "login" in lower:
        return ActivityLog.Action.LOGIN
    if "export" in lower:
        return ActivityLog.Action.EXPORT
    if "publish" in lower or "seed" in lower:
        return ActivityLog.Action.PUBLISH
    if "test" in lower:
        return ActivityLog.Action.TEST
    if "approve" in lower:
        return ActivityLog.Action.APPROVE
    return METHOD_ACTION_MAP.get(method.upper(), ActivityLog.Action.OTHER)


def build_description(
    action: str,
    category: str,
    object_repr: str,
    path: str,
    method: str,
) -> str:
    action_label = dict(ActivityLog.Action.choices).get(action, action)
    category_label = dict(ActivityLog.Category.choices).get(category, category)
    target = object_repr or path
    return f"{action_label} في {category_label}: {target} ({method})"


def record_activity(
    *,
    user=None,
    action: str = ActivityLog.Action.OTHER,
    category: str = ActivityLog.Category.OTHER,
    status: str = ActivityLog.Status.SUCCESS,
    object_type: str = "",
    object_id: str = "",
    object_repr: str = "",
    description: str = "",
    metadata: Optional[dict] = None,
    request: Optional[HttpRequest] = None,
    platform_id: Optional[int] = None,
) -> ActivityLog | None:
    try:
        user_email = ""
        user_name = ""
        user_role = ""
        if user and getattr(user, "is_authenticated", False):
            user_email = user.email or ""
            user_name = user.get_full_name() or user.email or ""
            user_role = getattr(user, "role", "") or ""

        ip_address = None
        user_agent = ""
        request_path = ""
        request_method = ""
        if request is not None:
            ip_address = get_client_ip(request)
            user_agent = (request.META.get("HTTP_USER_AGENT") or "")[:500]
            request_path = request.path[:500]
            request_method = request.method

        if not description and request_path:
            description = build_description(
                action, category, object_repr, request_path, request_method
            )

        return ActivityLog.objects.create(
            user=user if user and getattr(user, "is_authenticated", False) else None,
            user_email=user_email,
            user_name=user_name,
            user_role=user_role,
            action=action,
            category=category,
            status=status,
            object_type=object_type[:120],
            object_id=str(object_id)[:64] if object_id else "",
            object_repr=object_repr[:500],
            description=description[:2000],
            metadata=metadata or {},
            ip_address=ip_address,
            user_agent=user_agent,
            request_path=request_path,
            request_method=request_method,
            platform_id=platform_id,
        )
    except Exception:
        return None


def record_from_request(
    request: HttpRequest,
    response_status: int,
    extra_metadata: Optional[dict] = None,
) -> ActivityLog | None:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return None

    from apps.accounts.models import User

    if user.role != User.Role.SYSTEM_MANAGER:
        return None

    path = request.path
    if "/activity-logs/" in path:
        return None

    method = request.method.upper()
    if method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return None

    category = infer_category_from_path(path)
    action = infer_action_from_request(method, path)
    status = ActivityLog.Status.SUCCESS if response_status < 400 else ActivityLog.Status.FAILURE

    metadata: dict[str, Any] = {"status_code": response_status}
    if extra_metadata:
        metadata.update(extra_metadata)

    return record_activity(
        user=user,
        action=action,
        category=category,
        status=status,
        object_repr=path,
        request=request,
        metadata=metadata,
    )

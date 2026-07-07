"""اختبار API فعلي لكل دور — يُشغَّل: python scripts/run_platform_qa.py"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, field

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

User = get_user_model()


@dataclass
class Case:
    name: str
    method: str
    path: str
    expect: int | tuple[int, ...] = 200
    data: dict | None = None
    json_body: dict | None = None


@dataclass
class RoleReport:
    role: str
    email: str
    passed: list[str] = field(default_factory=list)
    failed: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def _ok(status: int, expect: int | tuple[int, ...]) -> bool:
    if isinstance(expect, tuple):
        return status in expect
    return status == expect


def run_case(client: APIClient, case: Case) -> tuple[bool, str]:
    method = case.method.upper()
    kwargs: dict = {}
    if case.json_body is not None:
        kwargs["data"] = json.dumps(case.json_body)
        kwargs["content_type"] = "application/json"
    elif case.data is not None:
        kwargs["data"] = case.data
    resp = getattr(client, method.lower())(case.path, **kwargs)
    if _ok(resp.status_code, case.expect):
        return True, str(resp.status_code)
    detail = ""
    try:
        detail = str(resp.data)[:180]
    except Exception:
        detail = (resp.content or b"")[:180].decode("utf-8", errors="replace")
    return False, f"{resp.status_code} {detail}"


def pick_user(role: str) -> User | None:
    qs = User.objects.filter(role=role, account_status=User.AccountStatus.ACTIVE).order_by("id")
    if role == User.Role.EVENT_MANAGER:
        from apps.platforms.models import PlatformMember

        with_perm = qs.filter(
            platform_memberships__perm_edit_guests=True,
        ).distinct()
        if with_perm.exists():
            return with_perm.first()
    return qs.first()


def system_manager_cases() -> list[Case]:
    return [
        Case("auth/me", "GET", "/api/v1/auth/me/"),
        Case("platforms list", "GET", "/api/v1/platforms/platforms/"),
        Case("system overview", "GET", "/api/v1/platforms/platforms/system-overview/"),
        Case("all staff", "GET", "/api/v1/platforms/platforms/all-staff/"),
        Case("integrations", "GET", "/api/v1/integrations/credentials/"),
        Case("activity logs", "GET", "/api/v1/activity-logs/"),
        Case("system settings", "GET", "/api/v1/system-settings/"),
        Case("faq admin", "GET", "/api/v1/faq/items/"),
        Case("static pages", "GET", "/api/v1/static-pages/pages/"),
        Case("announcements", "GET", "/api/v1/announcements/"),
        Case("external links", "GET", "/api/v1/external-links/links/"),
        Case("public media", "GET", "/api/v1/public-media/items/"),
        Case("monitoring", "GET", "/api/v1/monitoring/overview/"),
        Case("reports", "GET", "/api/v1/reports/dashboard/"),
        Case("events list", "GET", "/api/v1/events/events/"),
        Case("guests list", "GET", "/api/v1/guests/"),
        Case("comms inbox", "GET", "/api/v1/platforms/comms/messages/inbox/"),
    ]


def platform_admin_cases() -> list[Case]:
    return [
        Case("auth/me", "GET", "/api/v1/auth/me/"),
        Case("my overview", "GET", "/api/v1/platforms/platforms/my-overview/"),
        Case("my events dashboard", "GET", "/api/v1/platforms/platforms/my-events/"),
        Case("my reports", "GET", "/api/v1/platforms/platforms/my-reports/"),
        Case("my staff", "GET", "/api/v1/platforms/platforms/my-staff/"),
        Case("my permissions", "GET", "/api/v1/platforms/platforms/my-permissions/"),
        Case("events list", "GET", "/api/v1/events/events/"),
        Case("guests list", "GET", "/api/v1/guests/"),
        Case("guests stats", "GET", "/api/v1/guests/stats/"),
        Case("invitations list", "GET", "/api/v1/invitations/"),
        Case("comms inbox", "GET", "/api/v1/platforms/comms/messages/inbox/"),
        Case("deny integrations", "GET", "/api/v1/integrations/credentials/", expect=403),
        Case("deny all platforms", "GET", "/api/v1/platforms/platforms/all-staff/", expect=403),
    ]


def event_manager_cases() -> list[Case]:
    return [
        Case("auth/me", "GET", "/api/v1/auth/me/"),
        Case("member overview", "GET", "/api/v1/platforms/platforms/my-member-overview/"),
        Case("member events", "GET", "/api/v1/platforms/platforms/my-member-events/"),
        Case("member sections", "GET", "/api/v1/platforms/platforms/my-member-sections/"),
        Case("member team", "GET", "/api/v1/platforms/platforms/my-member-team/"),
        Case("events list", "GET", "/api/v1/events/events/"),
        Case("guests list", "GET", "/api/v1/guests/"),
        Case("guests stats", "GET", "/api/v1/guests/stats/"),
        Case("invitations list", "GET", "/api/v1/invitations/"),
        Case("deny system overview", "GET", "/api/v1/platforms/platforms/system-overview/", expect=403),
    ]


def event_organizer_cases() -> list[Case]:
    return [
        Case("auth/me", "GET", "/api/v1/auth/me/"),
        Case("organizer overview", "GET", "/api/v1/platforms/platforms/my-organizer-overview/"),
        Case("organizer events", "GET", "/api/v1/platforms/platforms/my-organizer-events/"),
        Case("events list", "GET", "/api/v1/events/events/"),
        Case("guests list", "GET", "/api/v1/guests/"),
        Case("guests stats", "GET", "/api/v1/guests/stats/"),
        Case("deny member team", "GET", "/api/v1/platforms/platforms/my-member-team/", expect=403),
    ]


def staff_cases() -> list[Case]:
    return [
        Case("auth/me", "GET", "/api/v1/auth/me/"),
        Case("my permissions", "GET", "/api/v1/platforms/platforms/my-permissions/"),
        Case("deny events list", "GET", "/api/v1/events/events/", expect=(403, 200)),
        Case("deny guests list", "GET", "/api/v1/guests/", expect=(403, 200)),
        Case("deny integrations", "GET", "/api/v1/integrations/credentials/", expect=403),
    ]


ROLE_CASES = {
    User.Role.SYSTEM_MANAGER: system_manager_cases,
    User.Role.PLATFORM_ADMIN: platform_admin_cases,
    User.Role.EVENT_MANAGER: event_manager_cases,
    User.Role.EVENT_ORGANIZER: event_organizer_cases,
    User.Role.STAFF: staff_cases,
}


def crud_guest_flow(client: APIClient, user: User, report: RoleReport) -> None:
    if user.role not in (
        User.Role.PLATFORM_ADMIN,
        User.Role.EVENT_MANAGER,
        User.Role.EVENT_ORGANIZER,
    ):
        report.skipped.append("guest CRUD (role not applicable)")
        return

    from apps.events.models import Event

    event = Event.objects.filter(models_q_for_user(user)).first()
    if not event:
        report.skipped.append("guest CRUD (no accessible event)")
        return

    create = Case(
        "guest create",
        "POST",
        "/api/v1/guests/",
        expect=201,
        json_body={
            "event": event.id,
            "full_name": "QA Test Guest",
            "email": "qa.test.guest@merhab.test",
            "phone": "966500000001",
            "status": "pending",
        },
    )
    ok, info = run_case(client, create)
    if not ok:
        report.failed.append(f"{create.name}: {info}")
        return
    report.passed.append(create.name)

    resp = client.get("/api/v1/guests/", {"event": event.id, "search": "QA Test Guest"})
    guests = resp.data.get("results", resp.data) if hasattr(resp, "data") else []
    if isinstance(guests, dict):
        guests = guests.get("results", [])
    guest = next((g for g in guests if g.get("full_name") == "QA Test Guest"), None)
    if not guest:
        report.failed.append("guest list after create: not found")
        return
    report.passed.append("guest list filter")

    gid = guest["id"]
    patch = Case(
        "guest patch",
        "PATCH",
        f"/api/v1/guests/{gid}/",
        expect=200,
        json_body={"notes": "qa note"},
    )
    ok, info = run_case(client, patch)
    (report.passed if ok else report.failed).append(f"{patch.name}: {info}" if not ok else patch.name)

    delete = Case("guest delete", "DELETE", f"/api/v1/guests/{gid}/", expect=204)
    ok, info = run_case(client, delete)
    (report.passed if ok else report.failed).append(f"{delete.name}: {info}" if not ok else delete.name)


def models_q_for_user(user: User):
    from django.db.models import Q
    from apps.platforms.platform_permissions import get_platform_for_user, staff_assigned_event_ids

    if user.role == User.Role.SYSTEM_MANAGER:
        from apps.events.models import Event

        return Q()
    if user.role == User.Role.PLATFORM_ADMIN:
        platform = get_platform_for_user(user)
        from apps.events.models import Event

        return Q(platform=platform) if platform else Q(pk__in=[])
    if user.role in (User.Role.EVENT_MANAGER, User.Role.EVENT_ORGANIZER):
        from apps.events.models import Event

        return Q(created_by=user) | Q(managers=user)
    if user.role == User.Role.STAFF:
        ids = staff_assigned_event_ids(user)
        from apps.events.models import Event

        return Q(pk__in=ids)
    from apps.events.models import Event

    return Q(pk__in=[])


def run_role(role: str) -> RoleReport:
    user = pick_user(role)
    if not user:
        return RoleReport(role=role, email="—", skipped=[f"no active user for role {role}"])
    client = APIClient()
    client.force_authenticate(user=user)
    report = RoleReport(role=role, email=user.email or user.username)

    for case in ROLE_CASES.get(role, lambda: [])():
        ok, info = run_case(client, case)
        label = f"{case.name} ({case.method} {case.path})"
        if ok:
            report.passed.append(label)
        else:
            report.failed.append(f"{label} -> {info}")

    crud_guest_flow(client, user, report)
    client.logout()
    return report


def main() -> int:
    roles = [
        User.Role.SYSTEM_MANAGER,
        User.Role.PLATFORM_ADMIN,
        User.Role.EVENT_MANAGER,
        User.Role.EVENT_ORGANIZER,
        User.Role.STAFF,
    ]
    with override_settings(ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"]):
        reports: list[RoleReport] = [run_role(role) for role in roles]

    print("=" * 72)
    print("Merhab Platform QA — API smoke + permissions")
    print("=" * 72)
    total_pass = total_fail = total_skip = 0
    for rep in reports:
        print(f"\n## {rep.role} ({rep.email})")
        print(f"   PASS: {len(rep.passed)} | FAIL: {len(rep.failed)} | SKIP: {len(rep.skipped)}")
        for item in rep.passed[:8]:
            print(f"   ✓ {item}")
        if len(rep.passed) > 8:
            print(f"   ... +{len(rep.passed) - 8} more passed")
        for item in rep.failed:
            print(f"   ✗ {item}")
        for item in rep.skipped:
            print(f"   - {item}")
        total_pass += len(rep.passed)
        total_fail += len(rep.failed)
        total_skip += len(rep.skipped)

    print("\n" + "=" * 72)
    print(f"TOTAL PASS={total_pass} FAIL={total_fail} SKIP={total_skip}")
    print("=" * 72)
    return 1 if total_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())

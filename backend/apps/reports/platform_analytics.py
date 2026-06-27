"""لوحة التقارير والإحصائيات — بيانات منصة واحدة فقط."""

from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from apps.events.analytics import events_overview
from apps.events.models import Event, Schedule
from apps.guests.models import Guest
from apps.invitations.models import Invitation
from apps.messages_app.models import Message
from apps.platforms.analytics import compute_kpis, rsvp_charts, recent_activities
from apps.platforms.models import DirectMessage, PlatformMember, UserNotification
from apps.platforms.staff_preview import platform_team_list
from apps.reports.analytics import (
    AR_MONTHS,
    _growth_rate,
    _last_six_months_series,
    _month_count,
    _suggestions,
)
from apps.staff.models import StaffMember
from apps.tables.models import Table

PLATFORM_SECTION_IDS = frozenset({
    "events",
    "guests",
    "team",
    "messages",
    "operations",
    "activity_logs",
})


def _month_count_joined(qs, year: int, month: int) -> int:
    return qs.filter(joined_at__year=year, joined_at__month=month).count()


def _last_six_months_joined_series(qs) -> dict:
    now = timezone.now()
    labels: list[str] = []
    values: list[int] = []
    for i in range(5, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        labels.append(AR_MONTHS[m - 1])
        values.append(_month_count_joined(qs, y, m))
    max_val = max(values, default=0) or 1
    heights = [f"{max(round(v / max_val * 100), 5 if v > 0 else 0)}%" for v in values]
    return {"labels": labels, "values": values, "heights": heights}


def _event_ids(platform_id: int) -> list[int]:
    return list(Event.objects.filter(platform_id=platform_id).values_list("id", flat=True))


def _guests_qs(platform_id: int):
    event_ids = _event_ids(platform_id)
    if not event_ids:
        return Guest.objects.none()
    return Guest.objects.filter(event_id__in=event_ids)


def _guest_status_chart_platform(platform_id: int) -> dict:
    guests = _guests_qs(platform_id)
    labels: list[str] = []
    values: list[int] = []
    for value, label in Guest.Status.choices:
        labels.append(label)
        values.append(guests.filter(status=value).count())
    total = max(sum(values), 1) or 1
    heights = [f"{max(round(v / total * 100), 5 if v > 0 else 0)}%" for v in values]
    return {"labels": labels, "values": values, "heights": heights}


def _platform_team_roles_chart(platform_id: int) -> dict:
    from apps.platforms.team_serializers import MEMBER_ROLE_LABELS

    labels: list[str] = []
    values: list[int] = []
    for role_value, _ in PlatformMember.MemberRole.choices:
        labels.append(MEMBER_ROLE_LABELS.get(role_value, role_value))
        values.append(
            PlatformMember.objects.filter(platform_id=platform_id, member_role=role_value).count()
        )
    total = max(sum(values), 1) or 1
    heights = [f"{max(round(v / total * 100), 5 if v > 0 else 0)}%" for v in values]
    return {"labels": labels, "values": values, "heights": heights}


def _platform_suggestions(stats: dict) -> list[dict]:
    tips = _suggestions(stats)
    filtered = [
        t for t in tips
        if t["title"] not in ("منصات محظورة", "نشر الصفحات الثابتة", "تفعيل التكاملات")
    ]
    if stats.get("draft_events", 0) > stats.get("active_events", 0):
        for t in filtered:
            if t["title"] == "فعاليات قيد الإعداد":
                t["body"] = "عدد الفعاليات المسودة يتجاوز النشطة — راجع الفعاليات وفعّل ما هو جاهز."
                break
    return filtered


def _activity_logs_kpis_platform(platform_id: int) -> list:
    try:
        from apps.activity_logs.models import ActivityLog

        qs = ActivityLog.objects.filter(platform_id=platform_id)
        today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_qs = qs.filter(created_at__gte=today)
        return [
            {"label": "اليوم", "value": today_qs.count()},
            {"label": "فشل اليوم", "value": today_qs.filter(status=ActivityLog.Status.FAILURE).count()},
            {"label": "إجمالي المنصة", "value": qs.count()},
        ]
    except Exception:
        return [{"label": "السجلات", "value": "—"}]


def _activity_logs_table_platform(platform_id: int) -> dict | None:
    try:
        from apps.activity_logs.models import ActivityLog

        rows = []
        for log in ActivityLog.objects.filter(platform_id=platform_id).order_by("-created_at")[:8]:
            rows.append([
                log.user_email or log.user_name or "—",
                log.get_action_display(),
                log.get_category_display(),
                log.get_status_display(),
            ])
        if not rows:
            return None
        return {
            "headers": ["المستخدم", "الإجراء", "القسم", "الحالة"],
            "rows": rows,
        }
    except Exception:
        return None


def _team_table_platform(platform_id: int) -> dict | None:
    staff = platform_team_list(platform_id)["staff"][:8]
    if not staff:
        return None
    return {
        "headers": ["الاسم", "الدور", "الحالة", "الفعاليات"],
        "rows": [
            [m["name"], m["role_label"], m.get("status_label", "—"), m.get("events_count", 0)]
            for m in staff
        ],
    }


def build_platform_reports_dashboard(platform_id: int, platform_name: str) -> dict:
    now = timezone.now()
    cur_month = now.month
    cur_year = now.year
    prev_month = cur_month - 1
    prev_year = cur_year
    if prev_month <= 0:
        prev_month = 12
        prev_year -= 1

    platform_kpis = compute_kpis(platform_id)
    events_data = events_overview(platform_id)
    event_stats = events_data["stats"]
    event_ids = _event_ids(platform_id)

    guests_qs = _guests_qs(platform_id)
    guests_total = guests_qs.count()
    members_count = PlatformMember.objects.filter(platform_id=platform_id).count()
    staff_on_events = (
        StaffMember.objects.filter(event_id__in=event_ids).values("user").distinct().count()
        if event_ids
        else 0
    )
    team_total = members_count + staff_on_events

    events_qs = Event.objects.filter(platform_id=platform_id)
    events_cur = _month_count(events_qs, cur_year, cur_month)
    events_prev = _month_count(events_qs, prev_year, prev_month)
    guests_cur = _month_count(guests_qs, cur_year, cur_month)
    guests_prev = _month_count(guests_qs, prev_year, prev_month)
    members_qs = PlatformMember.objects.filter(platform_id=platform_id)
    members_cur = _month_count_joined(members_qs, cur_year, cur_month)
    members_prev = _month_count_joined(members_qs, prev_year, prev_month)

    invitations_qs = (
        Invitation.objects.filter(event_id__in=event_ids) if event_ids else Invitation.objects.none()
    )
    invitations_total = invitations_qs.count()
    messages_platform = DirectMessage.objects.filter(platform_id=platform_id).count()
    notifications_platform = UserNotification.objects.filter(platform_id=platform_id).count()
    guest_messages = (
        Message.objects.filter(event_id__in=event_ids).count() if event_ids else 0
    )
    tables_total = (
        Table.objects.filter(event_id__in=event_ids).count() if event_ids else 0
    )
    schedules_count = (
        Schedule.objects.filter(event_id__in=event_ids).count() if event_ids else 0
    )

    aggregate_stats = {
        "confirmation_rate": platform_kpis["confirmation_rate"],
        "attendance_rate": platform_kpis["attendance_rate"],
        "blocked_platforms": 0,
        "draft_events": event_stats["draft"],
        "active_events": event_stats["active"],
        "integrations_active": 1,
        "published_pages": 1,
    }

    overview_kpis = [
        {
            "key": "events",
            "label": "الفعاليات",
            "value": event_stats["total"],
            "icon": "celebration",
            "color": "#5b2eff",
        },
        {
            "key": "guests",
            "label": "الضيوف",
            "value": guests_total,
            "icon": "groups",
            "color": "#ffb59b",
        },
        {
            "key": "team",
            "label": "الأعضاء والطاقم",
            "value": team_total,
            "icon": "badge",
            "color": "#c8bfff",
        },
        {
            "key": "active_events",
            "label": "فعاليات نشطة",
            "value": event_stats["active"],
            "icon": "event_available",
            "color": "#5b2eff",
        },
        {
            "key": "confirmation",
            "label": "نسبة التأكيد",
            "value": f"{platform_kpis['confirmation_rate']}%",
            "icon": "mark_email_read",
            "color": "#00C48C",
        },
        {
            "key": "attendance",
            "label": "نسبة الحضور",
            "value": f"{platform_kpis['attendance_rate']}%",
            "icon": "how_to_reg",
            "color": "#00C48C",
        },
    ]

    growth_summary = [
        {
            "label": "الفعاليات",
            "current": events_cur,
            "previous": events_prev,
            "growth": _growth_rate(events_cur, events_prev),
        },
        {
            "label": "الضيوف",
            "current": guests_cur,
            "previous": guests_prev,
            "growth": _growth_rate(guests_cur, guests_prev),
        },
        {
            "label": "الأعضاء",
            "current": members_cur,
            "previous": members_prev,
            "growth": _growth_rate(members_cur, members_prev),
        },
        {
            "label": "الدعوات",
            "current": _month_count(invitations_qs, cur_year, cur_month),
            "previous": _month_count(invitations_qs, prev_year, prev_month),
            "growth": _growth_rate(
                _month_count(invitations_qs, cur_year, cur_month),
                _month_count(invitations_qs, prev_year, prev_month),
            ),
        },
    ]

    event_table_rows = [
        [e["title"], e["guests_count"], e["attended_count"], e["status_label"]]
        for e in events_data["top_attendance"][:5]
    ]

    sections = [
        {
            "id": "events",
            "title": "الفعاليات والمناسبات",
            "description": "توزيع فعاليات منصتك وأداء الحضور",
            "icon": "celebration",
            "implemented": True,
            "kpis": [
                {"label": "إجمالي", "value": event_stats["total"]},
                {"label": "نشطة", "value": event_stats["active"]},
                {"label": "مكتملة", "value": event_stats["completed"]},
                {"label": "ملغية", "value": event_stats["cancelled"]},
                {"label": "مؤرشفة", "value": event_stats["archived"]},
                {"label": "مسودة", "value": event_stats["draft"]},
            ],
            "charts": [
                {
                    "id": "events_monthly",
                    "title": "الفعاليات شهرياً",
                    "type": "bar",
                    "data": events_data["charts"]["monthly"],
                },
                {
                    "id": "events_growth",
                    "title": "نمو الفعاليات",
                    "type": "bar",
                    "data": events_data["charts"]["growth"],
                },
                {
                    "id": "events_weekday",
                    "title": "حسب اليوم",
                    "type": "bar",
                    "data": events_data["charts"]["weekday"],
                },
                {
                    "id": "events_peak",
                    "title": "خريطة ذروة النشاط",
                    "type": "heatmap",
                    "data": events_data["charts"]["peak"],
                },
            ],
            "table": {
                "headers": ["الفعالية", "ضيوف", "حضور", "الحالة"],
                "rows": event_table_rows,
            } if event_table_rows else None,
        },
        {
            "id": "guests",
            "title": "الضيوف و RSVP",
            "description": "تأكيدات الحضور والمدعوين في منصتك",
            "icon": "groups",
            "implemented": True,
            "kpis": [
                {"label": "إجمالي الضيوف", "value": guests_total},
                {"label": "نسبة التأكيد", "value": f"{platform_kpis['confirmation_rate']}%"},
                {"label": "نسبة الحضور", "value": f"{platform_kpis['attendance_rate']}%"},
                {"label": "نمو الشهر", "value": f"{_growth_rate(guests_cur, guests_prev)}%"},
            ],
            "charts": [
                {
                    "id": "rsvp_monthly",
                    "title": "تأكيدات RSVP شهرياً",
                    "type": "rsvp",
                    "data": rsvp_charts(platform_id)["monthly"],
                },
                {
                    "id": "guest_status",
                    "title": "حالة الضيوف",
                    "type": "bar",
                    "data": _guest_status_chart_platform(platform_id),
                    "color": "tertiary",
                },
                {
                    "id": "guest_growth",
                    "title": "نمو الضيوف",
                    "type": "bar",
                    "data": _last_six_months_series(guests_qs),
                },
            ],
            "table": None,
        },
        {
            "id": "team",
            "title": "الأعضاء والطاقم",
            "description": "فريق منصتك وأدوارهم",
            "icon": "badge",
            "implemented": True,
            "kpis": [
                {"label": "أعضاء المنصة", "value": members_count},
                {"label": "طاقم الفعاليات", "value": staff_on_events},
                {"label": "إجمالي الفريق", "value": team_total},
                {"label": "نمو الشهر", "value": f"{_growth_rate(members_cur, members_prev)}%"},
            ],
            "charts": [
                {
                    "id": "team_roles",
                    "title": "توزيع الأدوار",
                    "type": "bar",
                    "data": _platform_team_roles_chart(platform_id),
                },
                {
                    "id": "members_growth",
                    "title": "نمو الأعضاء",
                    "type": "bar",
                    "data": _last_six_months_joined_series(members_qs),
                },
            ],
            "table": _team_table_platform(platform_id),
        },
        {
            "id": "messages",
            "title": "الدعوات والرسائل",
            "description": "دعوات ورسائل منصتك",
            "icon": "mail",
            "implemented": True,
            "kpis": [
                {"label": "الدعوات", "value": invitations_total},
                {"label": "رسائل المنصة", "value": messages_platform},
                {"label": "الإشعارات", "value": notifications_platform},
                {"label": "رسائل الضيوف", "value": guest_messages},
            ],
            "charts": [
                {
                    "id": "invitations_growth",
                    "title": "الدعوات (6 أشهر)",
                    "type": "bar",
                    "data": _last_six_months_series(invitations_qs),
                },
            ],
            "table": None,
        },
        {
            "id": "operations",
            "title": "العمليات والتخطيط",
            "description": "الطاولات والجداول الزمنية",
            "icon": "table_restaurant",
            "implemented": True,
            "kpis": [
                {"label": "الطاولات", "value": tables_total},
                {"label": "الجداول الزمنية", "value": schedules_count},
                {"label": "الفعاليات", "value": event_stats["total"]},
            ],
            "charts": [],
            "table": None,
        },
        {
            "id": "activity_logs",
            "title": "سجلات النشاط",
            "description": "عمليات منصتك المسجّلة",
            "icon": "history",
            "implemented": True,
            "kpis": _activity_logs_kpis_platform(platform_id),
            "charts": [],
            "table": _activity_logs_table_platform(platform_id),
        },
    ]

    return {
        "generated_at": now.isoformat(),
        "platform_name": platform_name,
        "scope": "platform",
        "overview_kpis": overview_kpis,
        "growth_summary": growth_summary,
        "sections": sections,
        "suggestions": _platform_suggestions(aggregate_stats),
        "recent_activities": recent_activities(platform_id, limit=6),
        "rsvp_charts": rsvp_charts(platform_id),
    }

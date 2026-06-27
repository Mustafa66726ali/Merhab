"""تجميع بيانات لوحة التقارير والإحصائيات على مستوى النظام."""

from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.accounts.models import User
from apps.events.analytics import events_overview
from apps.events.models import Event
from apps.external_links.models import ExternalLink
from apps.guests.models import Guest
from apps.integrations.models import IntegrationCredential
from apps.invitations.models import Invitation
from apps.messages_app.models import Message
from apps.platforms.analytics import compute_kpis, rsvp_charts, recent_activities
from apps.platforms.models import DirectMessage, Platform, UserNotification
from apps.static_pages.models import StaticPage
from apps.tables.models import Table
from apps.reports.models import Report
from apps.staff.models import StaffMember

AR_MONTHS = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]


def _growth_rate(current: int, previous: int) -> float:
    if previous == 0:
        return 100.0 if current > 0 else 0.0
    return round((current - previous) / previous * 100, 1)


def _month_count(qs, year: int, month: int) -> int:
    return qs.filter(created_at__year=year, created_at__month=month).count()


def _last_six_months_series(qs) -> dict:
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
        values.append(_month_count(qs, y, m))
    max_val = max(values, default=0) or 1
    heights = [f"{max(round(v / max_val * 100), 5 if v > 0 else 0)}%" for v in values]
    return {"labels": labels, "values": values, "heights": heights}


def _platform_status_chart() -> dict:
    active = Platform.objects.filter(status=Platform.Status.ACTIVE).count()
    blocked = Platform.objects.filter(status=Platform.Status.BLOCKED).count()
    labels = ["نشطة", "محظورة"]
    values = [active, blocked]
    total = max(sum(values), 1)
    heights = [f"{max(round(v / total * 100), 5 if v > 0 else 0)}%" for v in values]
    return {"labels": labels, "values": values, "heights": heights}


def _user_roles_chart() -> dict:
    roles = []
    values = []
    for value, label in User.Role.choices:
        count = User.objects.filter(role=value).count()
        roles.append(label)
        values.append(count)
    total = max(sum(values), 1) or 1
    heights = [f"{max(round(v / total * 100), 5 if v > 0 else 0)}%" for v in values]
    return {"labels": roles, "values": values, "heights": heights}


def _guest_status_chart() -> dict:
    labels = []
    values = []
    for value, label in Guest.Status.choices:
        labels.append(label)
        values.append(Guest.objects.filter(status=value).count())
    total = max(sum(values), 1) or 1
    heights = [f"{max(round(v / total * 100), 5 if v > 0 else 0)}%" for v in values]
    return {"labels": labels, "values": values, "heights": heights}


def _suggestions(stats: dict) -> list[dict]:
    tips: list[dict] = []
    if stats.get("confirmation_rate", 0) < 60:
        tips.append({
            "icon": "mark_email_read",
            "title": "تحسين معدل التأكيد",
            "body": "معدل تأكيد الضيوف منخفض — فعّل تذكيرات RSVP وتكامل WhatsApp.",
            "priority": "high",
        })
    if stats.get("blocked_platforms", 0) > 0:
        tips.append({
            "icon": "block",
            "title": "منصات محظورة",
            "body": f"يوجد {stats['blocked_platforms']} منصة محظورة — راجع حالة المنصات.",
            "priority": "medium",
        })
    if stats.get("draft_events", 0) > stats.get("active_events", 0):
        tips.append({
            "icon": "edit_note",
            "title": "فعاليات قيد الإعداد",
            "body": "عدد الفعاليات المسودة يتجاوز النشطة — شجّع المنصات على الإطلاق.",
            "priority": "low",
        })
    if stats.get("integrations_active", 0) == 0:
        tips.append({
            "icon": "extension",
            "title": "تفعيل التكاملات",
            "body": "لا توجد تكاملات نشطة — أضف SMTP أو WhatsApp من صفحة التكاملات.",
            "priority": "medium",
        })
    if stats.get("published_pages", 0) < 3:
        tips.append({
            "icon": "article",
            "title": "نشر الصفحات الثابتة",
            "body": "انشر سياسة الخصوصية وشروط الاستخدام لصفحة الهبوط.",
            "priority": "low",
        })
    tips.append({
        "icon": "insights",
        "title": "تصدير دوري",
        "body": "صدّر تقارير الأقسام شهرياً لمتابعة النمو ومشاركة الإدارة.",
        "priority": "low",
    })
    return tips


def _faq_kpis() -> list:
    try:
        from apps.faq.models import FAQItem

        qs = FAQItem.objects.all()
        return [
            {"label": "إجمالي الأسئلة", "value": qs.count()},
            {"label": "بانتظار الرد", "value": qs.filter(status=FAQItem.Status.PENDING).count()},
            {"label": "منشور", "value": qs.filter(is_published=True).count()},
        ]
    except Exception:
        return [{"label": "الأسئلة", "value": "—"}]


def _faq_table() -> dict | None:
    try:
        from apps.faq.models import FAQItem

        rows = []
        for item in FAQItem.objects.order_by("-created_at")[:8]:
            rows.append([
                item.question[:60],
                item.get_status_display(),
                "نعم" if item.is_published else "لا",
            ])
        if not rows:
            return None
        return {
            "headers": ["السؤال", "الحالة", "منشور"],
            "rows": rows,
        }
    except Exception:
        return None


def _announcements_kpis() -> list:
    try:
        from apps.announcements.models import Announcement

        qs = Announcement.objects.all()
        return [
            {"label": "إجمالي الإعلانات", "value": qs.count()},
            {"label": "بانرات", "value": qs.filter(section=Announcement.Section.BANNER).count()},
            {"label": "فيديوهات", "value": qs.filter(section=Announcement.Section.VIDEO).count()},
        ]
    except Exception:
        return [{"label": "الإعلانات", "value": "—"}]


def _announcements_table() -> dict | None:
    try:
        from apps.announcements.models import Announcement

        rows = []
        for item in Announcement.objects.order_by("section", "sort_order")[:8]:
            rows.append([
                item.title[:40],
                item.get_section_display(),
                f"{item.display_duration}ث",
                "نعم" if item.show_on_landing and item.is_active else "لا",
            ])
        if not rows:
            return None
        return {
            "headers": ["العنوان", "القسم", "المدة", "على الهبوط"],
            "rows": rows,
        }
    except Exception:
        return None


def _activity_logs_kpis() -> list:
    try:
        from apps.activity_logs.models import ActivityLog
        from django.utils import timezone
        from datetime import timedelta

        now = timezone.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        qs = ActivityLog.objects.filter(created_at__gte=today)
        return [
            {"label": "اليوم", "value": qs.count()},
            {"label": "فشل اليوم", "value": qs.filter(status=ActivityLog.Status.FAILURE).count()},
            {"label": "إجمالي", "value": ActivityLog.objects.count()},
        ]
    except Exception:
        return [{"label": "السجلات", "value": "—"}]


def _activity_logs_table() -> dict | None:
    try:
        from apps.activity_logs.models import ActivityLog

        rows = []
        for log in ActivityLog.objects.order_by("-created_at")[:8]:
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


def build_reports_dashboard() -> dict:
    now = timezone.now()
    cur_month = now.month
    cur_year = now.year
    prev_month = cur_month - 1
    prev_year = cur_year
    if prev_month <= 0:
        prev_month = 12
        prev_year -= 1

    system_kpis = compute_kpis(None)
    events_data = events_overview(None)
    event_stats = events_data["stats"]

    platforms_qs = Platform.objects.all()
    platform_total = platforms_qs.count()
    platform_blocked = platforms_qs.filter(status=Platform.Status.BLOCKED).count()
    platform_active = platform_total - platform_blocked

    users_total = User.objects.count()
    guests_total = Guest.objects.count()
    invitations_total = Invitation.objects.count()
    tables_total = Table.objects.count()
    staff_total = StaffMember.objects.count()
    messages_total = DirectMessage.objects.count()
    notifications_total = UserNotification.objects.count()
    legacy_messages = Message.objects.count()
    integrations_total = IntegrationCredential.objects.count()
    integrations_active = IntegrationCredential.objects.filter(is_active=True).count()
    links_total = ExternalLink.objects.count()
    links_active = ExternalLink.objects.filter(is_active=True).count()
    pages_total = StaticPage.objects.count()
    pages_published = StaticPage.objects.filter(is_published=True).count()

    events_cur = _month_count(Event.objects.all(), cur_year, cur_month)
    events_prev = _month_count(Event.objects.all(), prev_year, prev_month)
    guests_cur = _month_count(Guest.objects.all(), cur_year, cur_month)
    guests_prev = _month_count(Guest.objects.all(), prev_year, prev_month)
    platforms_cur = _month_count(Platform.objects.all(), cur_year, cur_month)
    platforms_prev = _month_count(Platform.objects.all(), prev_year, prev_month)
    users_cur = _month_count(User.objects.all(), cur_year, cur_month)
    users_prev = _month_count(User.objects.all(), prev_year, prev_month)

    aggregate_stats = {
        "confirmation_rate": system_kpis["confirmation_rate"],
        "attendance_rate": system_kpis["attendance_rate"],
        "blocked_platforms": platform_blocked,
        "draft_events": event_stats["draft"],
        "active_events": event_stats["active"],
        "integrations_active": integrations_active,
        "published_pages": pages_published,
    }

    overview_kpis = [
        {"key": "platforms", "label": "المنصات", "value": platform_total, "icon": "dns", "color": "#5b2eff"},
        {"key": "events", "label": "الفعاليات", "value": event_stats["total"], "icon": "celebration", "color": "#c8bfff"},
        {"key": "guests", "label": "الضيوف", "value": guests_total, "icon": "groups", "color": "#ffb59b"},
        {"key": "users", "label": "المستخدمين", "value": users_total, "icon": "badge", "color": "#5b2eff"},
        {"key": "confirmation", "label": "نسبة التأكيد", "value": f"{system_kpis['confirmation_rate']}%", "icon": "mark_email_read", "color": "#00C48C"},
        {"key": "attendance", "label": "نسبة الحضور", "value": f"{system_kpis['attendance_rate']}%", "icon": "event_available", "color": "#00C48C"},
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
            "label": "المنصات",
            "current": platforms_cur,
            "previous": platforms_prev,
            "growth": _growth_rate(platforms_cur, platforms_prev),
        },
        {
            "label": "المستخدمين",
            "current": users_cur,
            "previous": users_prev,
            "growth": _growth_rate(users_cur, users_prev),
        },
    ]

    top_platforms = list(
        Platform.objects.annotate(
            events_count=Count("events", distinct=True),
            members_count=Count("members", distinct=True),
        ).order_by("-events_count")[:5].values("id", "name", "events_count", "members_count", "status")
    )

    sections = [
        {
            "id": "platforms",
            "title": "المنصات",
            "description": "إحصائيات المنصات المسجلة وحالتها",
            "icon": "dns",
            "implemented": True,
            "kpis": [
                {"label": "إجمالي المنصات", "value": platform_total},
                {"label": "نشطة", "value": platform_active},
                {"label": "محظورة", "value": platform_blocked},
                {"label": "نمو الشهر", "value": f"{_growth_rate(platforms_cur, platforms_prev)}%"},
            ],
            "charts": [
                {"id": "platform_growth", "title": "نمو المنصات (6 أشهر)", "type": "bar", "data": _last_six_months_series(Platform.objects.all())},
                {"id": "platform_status", "title": "حالة المنصات", "type": "bar", "data": _platform_status_chart()},
            ],
            "table": {
                "headers": ["المنصة", "فعاليات", "أعضاء", "الحالة"],
                "rows": [
                    [p["name"], p["events_count"], p["members_count"], "نشطة" if p["status"] == "active" else "محظورة"]
                    for p in top_platforms
                ],
            },
        },
        {
            "id": "events",
            "title": "الفعاليات والمناسبات",
            "description": "توزيع الفعاليات والأداء",
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
                {"id": "events_monthly", "title": "الفعاليات شهرياً", "type": "bar", "data": events_data["charts"]["monthly"]},
                {"id": "events_growth", "title": "نمو الفعاليات", "type": "bar", "data": events_data["charts"]["growth"]},
                {"id": "events_weekday", "title": "حسب اليوم", "type": "bar", "data": events_data["charts"]["weekday"]},
                {"id": "events_peak", "title": "خريطة ذروة النشاط", "type": "heatmap", "data": events_data["charts"]["peak"]},
            ],
            "table": {
                "headers": ["الفعالية", "المنصة", "ضيوف", "حضور", "الحالة"],
                "rows": [
                    [e["title"], e["platform_name"], e["guests_count"], e["attended_count"], e["status_label"]]
                    for e in events_data["top_attendance"][:5]
                ],
            },
        },
        {
            "id": "guests",
            "title": "الضيوف و RSVP",
            "description": "تأكيدات الحضور والمدعوين",
            "icon": "groups",
            "implemented": True,
            "kpis": [
                {"label": "إجمالي الضيوف", "value": guests_total},
                {"label": "نسبة التأكيد", "value": f"{system_kpis['confirmation_rate']}%"},
                {"label": "نسبة الحضور", "value": f"{system_kpis['attendance_rate']}%"},
                {"label": "نمو الشهر", "value": f"{_growth_rate(guests_cur, guests_prev)}%"},
            ],
            "charts": [
                {"id": "rsvp_monthly", "title": "تأكيدات RSVP شهرياً", "type": "rsvp", "data": rsvp_charts(None)["monthly"]},
                {"id": "guest_status", "title": "حالة الضيوف", "type": "bar", "data": _guest_status_chart(), "color": "tertiary"},
                {"id": "guest_growth", "title": "نمو الضيوف", "type": "bar", "data": _last_six_months_series(Guest.objects.all())},
            ],
            "table": None,
        },
        {
            "id": "users",
            "title": "المستخدمين والطاقم",
            "description": "حسابات النظام والأدوار",
            "icon": "badge",
            "implemented": True,
            "kpis": [
                {"label": "المستخدمين", "value": users_total},
                {"label": "طاقم الفعاليات", "value": staff_total},
                {"label": "أعضاء المنصات", "value": system_kpis["staff_count"]},
                {"label": "نمو الشهر", "value": f"{_growth_rate(users_cur, users_prev)}%"},
            ],
            "charts": [
                {"id": "user_roles", "title": "توزيع الأدوار", "type": "bar", "data": _user_roles_chart()},
                {"id": "user_growth", "title": "نمو المستخدمين", "type": "bar", "data": _last_six_months_series(User.objects.all())},
            ],
            "table": None,
        },
        {
            "id": "invitations",
            "title": "الدعوات والرسائل",
            "description": "دعوات الفعاليات والتواصل",
            "icon": "mail",
            "implemented": True,
            "kpis": [
                {"label": "الدعوات", "value": invitations_total},
                {"label": "رسائل المنصات", "value": messages_total},
                {"label": "الإشعارات", "value": notifications_total},
                {"label": "رسائل النظام", "value": legacy_messages},
            ],
            "charts": [
                {"id": "invitations_growth", "title": "الدعوات (6 أشهر)", "type": "bar", "data": _last_six_months_series(Invitation.objects.all())},
            ],
            "table": None,
        },
        {
            "id": "operations",
            "title": "العمليات والتخطيط",
            "description": "الطاولات والجداول والتقارير المحفوظة",
            "icon": "table_restaurant",
            "implemented": True,
            "kpis": [
                {"label": "الطاولات", "value": tables_total},
                {"label": "الجداول الزمنية", "value": system_kpis["schedules_count"]},
                {"label": "تقارير محفوظة", "value": Report.objects.count()},
            ],
            "charts": [],
            "table": None,
        },
        {
            "id": "integrations",
            "title": "التكاملات والروابط",
            "description": "API والروابط الخارجية",
            "icon": "extension",
            "implemented": True,
            "kpis": [
                {"label": "التكاملات", "value": integrations_total},
                {"label": "تكاملات نشطة", "value": integrations_active},
                {"label": "روابط خارجية", "value": links_total},
                {"label": "روابط نشطة", "value": links_active},
            ],
            "charts": [],
            "table": None,
        },
        {
            "id": "content",
            "title": "المحتوى والصفحات",
            "description": "الصفحات الثابتة والوسائط",
            "icon": "article",
            "implemented": True,
            "kpis": [
                {"label": "صفحات ثابتة", "value": pages_total},
                {"label": "منشورة", "value": pages_published},
                {"label": "مسودة", "value": pages_total - pages_published},
            ],
            "charts": [],
            "table": None,
        },
        {
            "id": "announcements",
            "title": "الإعلانات والبانرات",
            "description": "إعلانات صفحة الهبوط والفيديوهات",
            "icon": "campaign",
            "implemented": True,
            "kpis": _announcements_kpis(),
            "charts": [],
            "table": _announcements_table(),
        },
        {
            "id": "media",
            "title": "الوسائط العامة",
            "description": "مكتبة الوسائط والصور",
            "icon": "perm_media",
            "implemented": False,
            "kpis": [{"label": "قريباً", "value": "—"}],
            "charts": [],
            "table": None,
        },
        {
            "id": "backup",
            "title": "النسخ الاحتياطي",
            "description": "نسخ احتياطي واستعادة",
            "icon": "backup",
            "implemented": False,
            "kpis": [{"label": "قريباً", "value": "—"}],
            "charts": [],
            "table": None,
        },
        {
            "id": "activity_logs",
            "title": "سجلات النشاط",
            "description": "تدقيق وتتبع العمليات",
            "icon": "history",
            "implemented": True,
            "kpis": _activity_logs_kpis(),
            "charts": [],
            "table": _activity_logs_table(),
        },
        {
            "id": "faq",
            "title": "الأسئلة والاستفسارات",
            "description": "FAQ ودعم الزوار",
            "icon": "quiz",
            "implemented": True,
            "kpis": _faq_kpis(),
            "charts": [],
            "table": _faq_table(),
        },
    ]

    return {
        "generated_at": now.isoformat(),
        "overview_kpis": overview_kpis,
        "growth_summary": growth_summary,
        "sections": sections,
        "suggestions": _suggestions(aggregate_stats),
        "recent_activities": recent_activities(None, limit=6),
        "rsvp_charts": rsvp_charts(None),
    }

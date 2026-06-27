"""لوحة إدارة فعاليات المنصة — إحصائيات، بطاقات حضور، قائمة تفصيلية."""

from __future__ import annotations

from django.db.models import Count, Prefetch, Q
from django.utils import timezone

from apps.accounts.models import User
from apps.events.models import Event
from apps.guests.models import Guest
from apps.invitations.models import Invitation
from apps.events.cover_media import event_cover_url
from apps.platforms.member_profile import _guest_stats_bulk, _empty_guest_stats
from apps.platforms.models import PlatformMember
from apps.staff.models import StaffMember

PHASE_WEIGHT = 20

EVENT_PHASES = [
    {"value": "setup", "label": "إعداد المناسبة"},
    {"value": "sections", "label": "الأقسام والمجموعات"},
    {"value": "guests", "label": "إضافة الضيوف"},
    {"value": "invites", "label": "إرسال الدعوات"},
    {"value": "attendance", "label": "تأكيد الحضور"},
]

PHASE_OPTIONS = [
    *EVENT_PHASES,
    {"value": "completed", "label": "مكتمل"},
]

STATUS_OPTIONS = [
    {"value": "draft", "label": "مسودة"},
    {"value": "active", "label": "نشط"},
    {"value": "completed", "label": "مكتمل"},
    {"value": "cancelled", "label": "ملغي"},
    {"value": "archived", "label": "مؤرشف"},
]


def _user_display(user: User) -> str:
    return user.get_full_name().strip() or user.email


def _location_label(event: Event) -> str:
    """نص الموقع للعرض — المكان + الموقع الجغرافي."""
    venue = (event.venue or "").strip()
    geo = (event.geo_address or "").strip()
    if venue and geo:
        return f"{venue} — {geo}"
    if venue:
        return venue
    if geo:
        return geo
    if event.latitude is not None and event.longitude is not None:
        return f"{event.latitude}, {event.longitude}"
    return "—"


def _event_managers_by_role(
    event: Event,
    platform_id: int | None,
    role_map: dict[int, str] | None = None,
) -> tuple[str, str]:
    mgrs = list(event.managers.all())
    if not mgrs:
        return "—", "—"

    if role_map is None and platform_id:
        role_map = {
            pm.user_id: pm.member_role
            for pm in PlatformMember.objects.filter(
                platform_id=platform_id,
                user_id__in=[u.id for u in mgrs],
            )
        }
    role_map = role_map or {}

    manager_name = "—"
    organizer_name = "—"
    for user in mgrs:
        display = _user_display(user)
        role = role_map.get(user.id)
        if role == PlatformMember.MemberRole.EVENT_MANAGER and manager_name == "—":
            manager_name = display
        elif role == PlatformMember.MemberRole.EVENT_ORGANIZER and organizer_name == "—":
            organizer_name = display

    if manager_name == "—" and mgrs:
        manager_name = _user_display(mgrs[0])
    if organizer_name == "—" and len(mgrs) > 1:
        organizer_name = _user_display(mgrs[1])

    return manager_name, organizer_name


def _event_queryset(platform_id: int):
    return (
        Event.objects.filter(platform_id=platform_id)
        .select_related("platform", "created_by")
        .prefetch_related(
            Prefetch("managers", queryset=User.objects.only("id", "email", "first_name", "last_name")),
            Prefetch(
                "staff_members",
                queryset=StaffMember.objects.filter(
                    role=StaffMember.Role.COORDINATOR,
                    is_active=True,
                ).select_related("user"),
            ),
        )
        .annotate(
            guests_count=Count("guests", distinct=True),
            attended_count=Count(
                "guests",
                filter=Q(guests__status=Guest.Status.ATTENDED),
                distinct=True,
            ),
            confirmed_count=Count(
                "guests",
                filter=Q(guests__status__in=[Guest.Status.CONFIRMED, Guest.Status.ATTENDED]),
                distinct=True,
            ),
            sections_count=Count("sections", distinct=True),
            groups_count=Count("groups", distinct=True),
            schedules_count=Count("schedules", distinct=True),
            managers_count=Count("managers", distinct=True),
            invitations_sent_count=Count(
                "invitations",
                filter=Q(
                    invitations__status__in=[
                        Invitation.Status.SENT,
                        Invitation.Status.DELIVERED,
                        Invitation.Status.OPENED,
                    ]
                ),
                distinct=True,
            ),
            responded_count=Count(
                "guests",
                filter=Q(
                    guests__status__in=[
                        Guest.Status.CONFIRMED,
                        Guest.Status.ATTENDED,
                        Guest.Status.DECLINED,
                    ]
                ),
                distinct=True,
            ),
        )
    )


def _is_setup_complete(event: Event) -> bool:
    """إضافة المناسبة بواسطة مدير المنصة."""
    return bool(event.title and event.date and event.time)


def _is_sections_groups_complete(event: Event) -> bool:
    sections = getattr(event, "sections_count", None)
    groups = getattr(event, "groups_count", None)
    if sections is not None and groups is not None and not callable(sections):
        return sections > 0 and groups > 0
    return event.sections.exists() and event.groups.exists()


def _is_guests_complete(event: Event) -> bool:
    count = getattr(event, "guests_count", None)
    if count is not None and not callable(count):
        return count > 0
    return event.guests.exists()


def _is_invites_complete(event: Event) -> bool:
    count = getattr(event, "invitations_sent_count", None)
    if count is not None and not callable(count):
        return count > 0
    return Invitation.objects.filter(
        event_id=event.id,
        status__in=[
            Invitation.Status.SENT,
            Invitation.Status.DELIVERED,
            Invitation.Status.OPENED,
        ],
    ).exists()


def _is_attendance_confirmation_started(event: Event) -> bool:
    """بدء تأكيد الحضور — ضيف أكّد أو حضر أو اعتذر."""
    count = getattr(event, "responded_count", None)
    if count is not None and not callable(count):
        return count > 0
    return event.guests.filter(
        status__in=[
            Guest.Status.CONFIRMED,
            Guest.Status.ATTENDED,
            Guest.Status.DECLINED,
        ]
    ).exists()


def _phase_states(event: Event) -> list[tuple[str, str, bool]]:
    return [
        ("setup", "إعداد المناسبة", _is_setup_complete(event)),
        ("sections", "الأقسام والمجموعات", _is_sections_groups_complete(event)),
        ("guests", "إضافة الضيوف", _is_guests_complete(event)),
        ("invites", "إرسال الدعوات", _is_invites_complete(event)),
        ("attendance", "تأكيد الحضور", _is_attendance_confirmation_started(event)),
    ]


def _completion_meta(event: Event) -> dict:
    """كل مرحلة = 20% — خمس مراحل بمجموع 100%."""
    phases = _phase_states(event)
    done_count = sum(1 for _, _, done in phases if done)
    percent = min(done_count * PHASE_WEIGHT, 100)

    if event.status == Event.Status.COMPLETED or done_count >= len(phases):
        phase, phase_label = "completed", "مكتمل"
    else:
        current = next(((k, lbl) for k, lbl, done in phases if not done), phases[-1][:2])
        phase, phase_label = current[0], current[1]

    return {
        "completion_percent": percent,
        "phase": phase,
        "phase_label": phase_label,
    }


def _serialize_event_card(
    event: Event,
    stats: dict | None = None,
    role_map: dict[int, str] | None = None,
) -> dict:
    if stats is None:
        stats_map = _guest_stats_bulk([event.id])
        stats = stats_map.get(event.id, _empty_guest_stats())
    completion = _completion_meta(event)
    cover = event_cover_url(event)
    location = _location_label(event)
    return {
        "id": event.id,
        "title": event.title,
        "owner_name": _user_display(event.created_by),
        "venue": event.venue or "",
        "geo_address": event.geo_address or "",
        "location": location,
        "status": event.status,
        "status_label": event.get_status_display(),
        "date": event.date.isoformat() if event.date else "",
        "time": event.time.strftime("%H:%M") if event.time else "",
        "cover_image": cover,
        "guests_count": stats["guests_total"],
        "attended_count": stats["attended"],
        "confirmed_count": stats["confirmed"],
        "confirmation_rate": stats["confirmation_rate"],
        "attendance_rate": stats["attendance_rate"],
        "absence_rate": stats["absence_rate"],
        "created_at": event.created_at.isoformat(),
        **completion,
    }


def _serialize_event_row(
    event: Event,
    stats: dict | None = None,
    role_map: dict[int, str] | None = None,
) -> dict:
    if stats is None:
        stats_map = _guest_stats_bulk([event.id])
        stats = stats_map.get(event.id, _empty_guest_stats())
    completion = _completion_meta(event)
    event_manager, event_organizer = _event_managers_by_role(
        event, event.platform_id, role_map
    )
    coordinators = ", ".join(
        _user_display(s.user) for s in event.staff_members.all()
    ) or "—"
    cover = event_cover_url(event)
    location = _location_label(event)
    guests_total = getattr(event, "guests_count", None)
    if guests_total is None:
        guests_total = stats["guests_total"]

    return {
        "id": event.id,
        "title": event.title,
        "owner_name": _user_display(event.created_by),
        "venue": event.venue or "",
        "geo_address": event.geo_address or "",
        "location": location,
        "latitude": float(event.latitude) if event.latitude is not None else None,
        "longitude": float(event.longitude) if event.longitude is not None else None,
        "status": event.status,
        "status_label": event.get_status_display(),
        "date": event.date.isoformat() if event.date else "",
        "time": event.time.strftime("%H:%M") if event.time else "",
        "cover_image": cover,
        "event_manager": event_manager,
        "event_organizer": event_organizer,
        "coordinators": coordinators,
        "guests_count": guests_total,
        "attended_count": stats["attended"],
        "confirmed_count": stats["confirmed"],
        "confirmation_rate": stats["confirmation_rate"],
        "attendance_rate": stats["attendance_rate"],
        "absence_rate": stats["absence_rate"],
        "created_at": event.created_at.isoformat(),
        **completion,
    }


def compute_platform_event_stats(platform_id: int) -> dict:
    today = timezone.localdate()
    agg = _event_queryset(platform_id).aggregate(
        total=Count("id"),
        completed=Count("id", filter=Q(status=Event.Status.COMPLETED)),
        active_now=Count("id", filter=Q(status=Event.Status.ACTIVE)),
        scheduled=Count(
            "id",
            filter=Q(
                status__in=[Event.Status.ACTIVE, Event.Status.DRAFT],
                date__gt=today,
            ),
        ),
        draft=Count("id", filter=Q(status=Event.Status.DRAFT)),
    )
    return {
        "total": agg["total"] or 0,
        "completed": agg["completed"] or 0,
        "active_now": agg["active_now"] or 0,
        "scheduled": agg["scheduled"] or 0,
        "draft": agg["draft"] or 0,
    }


def _serialize_events_batch(
    events: list[Event],
    platform_id: int,
    serializer,
) -> list[dict]:
    if not events:
        return []
    stats_map = _guest_stats_bulk([e.id for e in events])
    manager_ids: set[int] = set()
    for event in events:
        for user in event.managers.all():
            manager_ids.add(user.id)
    role_map: dict[int, str] = {}
    if platform_id and manager_ids:
        role_map = {
            pm.user_id: pm.member_role
            for pm in PlatformMember.objects.filter(
                platform_id=platform_id,
                user_id__in=manager_ids,
            )
        }
    return [
        serializer(event, stats_map.get(event.id, _empty_guest_stats()), role_map)
        for event in events
    ]


def top_attendance_events(platform_id: int, limit: int = 5) -> list[dict]:
    events = list(
        _event_queryset(platform_id)
        .filter(guests_count__gt=0)
        .order_by("-attended_count", "-guests_count")[:limit]
    )
    return _serialize_events_batch(events, platform_id, _serialize_event_card)


def bottom_attendance_events(platform_id: int, limit: int = 5) -> list[dict]:
    events = list(
        _event_queryset(platform_id)
        .filter(guests_count__gt=0)
        .order_by("attended_count", "guests_count")[:limit]
    )
    return _serialize_events_batch(events, platform_id, _serialize_event_card)


def list_platform_events(platform_id: int) -> list[dict]:
    events = list(_event_queryset(platform_id).order_by("-created_at"))
    return _serialize_events_batch(events, platform_id, _serialize_event_row)


def build_platform_events_dashboard(platform_id: int, platform_name: str) -> dict:
    from config.cache_utils import cache_get_or_set

    return cache_get_or_set(
        f"platform:events_dashboard:{platform_id}",
        lambda: {
            "platform": {"id": platform_id, "name": platform_name},
            "stats": compute_platform_event_stats(platform_id),
            "top_attendance": top_attendance_events(platform_id, 5),
            "bottom_attendance": bottom_attendance_events(platform_id, 5),
            "events": list_platform_events(platform_id),
            "status_options": STATUS_OPTIONS,
            "phase_options": PHASE_OPTIONS,
        },
        timeout=120,
    )

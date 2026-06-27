from datetime import datetime

from django.utils import timezone

from apps.accounts.models import User
from apps.events.models import Event
from apps.platforms.models import Platform, PlatformMember
from apps.platforms.team_serializers import MEMBER_ROLE_LABELS
from apps.staff.models import StaffMember

ROLE_PRIORITY = {
    "platform_owner": 5,
    "event_manager": 4,
    "event_organizer": 3,
    "coordinator": 2,
    "entry_manager": 2,
    "platform_member": 2,
    "staff": 1,
}

FILTER_ROLES = [
    ("platform_owner", "مالك المنصة"),
    ("event_manager", "مدير فعالية"),
    ("event_organizer", "منظم فعالية"),
    ("coordinator", "منسق"),
    ("entry_manager", "مدير دخول"),
    ("platform_member", "عضو منصة"),
    ("staff", "طاقم عمل"),
]

PLATFORM_TEAM_FILTER_ROLES = [
    ("event_manager", "مدير فعالية"),
    ("event_organizer", "منظم فعالية"),
    ("platform_member", "عضو منصة"),
    ("staff", "طاقم عمل"),
]


def _parse_dt(value) -> datetime:
    if value is None:
        return timezone.now()
    if isinstance(value, datetime):
        return value
    return timezone.now()


def coordinator_role_label(coordinator_label: str = "") -> str:
    """منسق + نوع المنسق (مثال: منسق — منسق رجال)."""
    base = MEMBER_ROLE_LABELS.get("coordinator", "منسق")
    label = (coordinator_label or "").strip()
    if not label:
        return base
    if label.startswith("منسق"):
        return label
    return f"{base} — {label}"


def member_role_label(member_role: str, coordinator_label: str = "") -> str:
    if member_role == PlatformMember.MemberRole.COORDINATOR:
        return coordinator_role_label(coordinator_label)
    return MEMBER_ROLE_LABELS.get(member_role, member_role)


def _minimal_row_from_pm(pm: PlatformMember, platform: Platform) -> dict:
    user = pm.user
    name = user.get_full_name().strip() or user.email
    role_key = pm.member_role or _role_from_user(user)[0]
    role_label = member_role_label(role_key, pm.coordinator_label or "")
    status_key = getattr(user, "account_status", User.AccountStatus.ACTIVE)
    status_label = {
        User.AccountStatus.ACTIVE: "نشط",
        User.AccountStatus.INACTIVE: "غير نشط",
        User.AccountStatus.BLOCKED: "محظور",
    }.get(status_key, "نشط")
    joined = _parse_dt(pm.joined_at)
    return {
        "id": user.id,
        "name": name,
        "email": user.email,
        "role": role_label,
        "role_key": role_key,
        "role_label": role_label,
        "account_status": status_key,
        "status_label": status_label,
        "joined_at": joined.isoformat(),
        "avatar_initial": name[0] if name else "?",
        "avatar_url": user.avatar.url if user.avatar else "",
        "perm_scan_qr": pm.perm_scan_qr,
        "perm_edit_guests": pm.perm_edit_guests,
        "perm_send_messages": pm.perm_send_messages,
        "coordinator_label": pm.coordinator_label or "",
        "platform_id": platform.id,
        "platform_name": platform.name,
        "platform_member_id": pm.id,
        "events_count": 0,
        "active_events_count": 0,
        "completed_events_count": 0,
    }


def _sync_row_from_platform_member(row: dict, pm: PlatformMember) -> None:
    """تفضيل بيانات PlatformMember على ما يُستمد من الفعاليات."""
    role_key = pm.member_role or row.get("role_key") or _role_from_user(pm.user)[0]
    row["role_key"] = role_key
    row["role_label"] = member_role_label(role_key, pm.coordinator_label or "")
    row["role"] = row["role_label"]
    row["coordinator_label"] = pm.coordinator_label or ""
    row["perm_scan_qr"] = pm.perm_scan_qr
    row["perm_edit_guests"] = pm.perm_edit_guests
    row["perm_send_messages"] = pm.perm_send_messages
    row["platform_member_id"] = pm.id
    user = pm.user
    row["account_status"] = getattr(user, "account_status", User.AccountStatus.ACTIVE)
    row["status_label"] = {
        User.AccountStatus.ACTIVE: "نشط",
        User.AccountStatus.INACTIVE: "غير نشط",
        User.AccountStatus.BLOCKED: "محظور",
    }.get(row["account_status"], "نشط")
    row["avatar_url"] = user.avatar.url if user.avatar else row.get("avatar_url", "")


def _role_from_user(user: User) -> tuple[str, str]:
    mapping = {
        User.Role.EVENT_MANAGER: ("event_manager", "مدير فعالية"),
        User.Role.EVENT_ORGANIZER: ("event_organizer", "منظم فعالية"),
        User.Role.STAFF: ("staff", "طاقم عمل"),
        User.Role.GUEST: ("platform_member", "عضو منصة"),
    }
    return mapping.get(user.role, ("platform_member", "عضو منصة"))


def _attach_event_participation(platform_id: int, members_map: dict[int, dict]) -> None:
    """عدّ مشاركات المستخدم في فعاليات المنصة (منشئ، مدير، منظم، أو طاقم)."""
    counts: dict[int, dict[str, int]] = {}
    event_qs = Event.objects.filter(platform_id=platform_id).prefetch_related("managers")

    for event in event_qs:
        participant_ids: set[int] = set()
        if event.created_by_id:
            participant_ids.add(event.created_by_id)
        for manager in event.managers.all():
            participant_ids.add(manager.id)

        is_completed = event.status == Event.Status.COMPLETED
        is_active = event.status in (Event.Status.ACTIVE, Event.Status.DRAFT)

        for uid in participant_ids:
            bucket = counts.setdefault(uid, {"total": 0, "active": 0, "completed": 0})
            bucket["total"] += 1
            if is_completed:
                bucket["completed"] += 1
            if is_active:
                bucket["active"] += 1

    event_ids = list(event_qs.values_list("id", flat=True))
    if event_ids:
        staff_qs = StaffMember.objects.filter(event_id__in=event_ids).select_related("event")
        for sm in staff_qs:
            uid = sm.user_id
            bucket = counts.setdefault(uid, {"total": 0, "active": 0, "completed": 0})
            bucket["total"] += 1
            if sm.event.status == Event.Status.COMPLETED:
                bucket["completed"] += 1
            if sm.event.status in (Event.Status.ACTIVE, Event.Status.DRAFT):
                bucket["active"] += 1

    for uid, entry in members_map.items():
        bucket = counts.get(uid, {"total": 0, "active": 0, "completed": 0})
        entry["events_count"] = bucket["total"]
        entry["active_events_count"] = bucket["active"]
        entry["completed_events_count"] = bucket["completed"]


def _build_staff_map(platform_id: int) -> dict[int, dict]:
    platform = Platform.objects.select_related("owner").get(pk=platform_id)
    members_map: dict[int, dict] = {}

    def upsert(user: User, role_key: str, role_label: str, joined_at) -> None:
        uid = user.id
        joined = _parse_dt(joined_at)
        name = user.get_full_name().strip() or user.email
        priority = ROLE_PRIORITY.get(role_key, 0)
        status_key = getattr(user, "account_status", User.AccountStatus.ACTIVE)
        status_label = {
            User.AccountStatus.ACTIVE: "نشط",
            User.AccountStatus.INACTIVE: "غير نشط",
            User.AccountStatus.BLOCKED: "محظور",
        }.get(status_key, "نشط")

        if uid not in members_map:
            members_map[uid] = {
                "id": uid,
                "name": name,
                "email": user.email,
                "role": role_label,
                "role_key": role_key,
                "role_label": role_label,
                "account_status": status_key,
                "status_label": status_label,
                "joined_at": joined.isoformat(),
                "avatar_initial": name[0] if name else "?",
                "avatar_url": user.avatar.url if user.avatar else "",
                "perm_scan_qr": False,
                "perm_edit_guests": False,
                "perm_send_messages": False,
                "coordinator_label": "",
            }
            return

        entry = members_map[uid]
        existing_priority = ROLE_PRIORITY.get(entry["role_key"], 0)
        if priority > existing_priority:
            entry["role"] = role_label
            entry["role_key"] = role_key
            entry["role_label"] = role_label

        entry["account_status"] = status_key
        entry["status_label"] = status_label
        entry["avatar_url"] = user.avatar.url if user.avatar else ""

        try:
            existing_dt = datetime.fromisoformat(entry["joined_at"].replace("Z", "+00:00"))
            if joined < existing_dt:
                entry["joined_at"] = joined.isoformat()
        except (ValueError, TypeError):
            entry["joined_at"] = joined.isoformat()

    upsert(
        platform.owner,
        "platform_owner",
        "مالك المنصة",
        platform.owner.date_joined or platform.created_at,
    )

    for member in PlatformMember.objects.filter(platform_id=platform_id).select_related("user"):
        role_key = member.member_role or _role_from_user(member.user)[0]
        role_label = member_role_label(role_key, member.coordinator_label or "")
        upsert(member.user, role_key, role_label, member.joined_at)

    event_qs = Event.objects.filter(platform_id=platform_id).select_related("created_by").prefetch_related("managers")
    event_ids: list[int] = []

    for event in event_qs:
        event_ids.append(event.id)
        upsert(event.created_by, "event_manager", "مدير فعالية", event.created_at)
        for manager in event.managers.all():
            label = "مدير فعالية"
            key = "event_manager"
            if manager.role == User.Role.EVENT_ORGANIZER:
                label = "منظم فعالية"
                key = "event_organizer"
            elif manager.role == User.Role.EVENT_MANAGER:
                label = "مدير فعالية"
                key = "event_manager"
            upsert(manager, key, label, event.created_at)

    if event_ids:
        staff_qs = StaffMember.objects.filter(event_id__in=event_ids).select_related("user")
        for sm in staff_qs:
            if sm.role == StaffMember.Role.COORDINATOR:
                upsert(
                    sm.user,
                    "coordinator",
                    coordinator_role_label(sm.get_role_display()),
                    sm.assigned_at,
                )
            else:
                upsert(sm.user, "staff", sm.get_role_display(), sm.assigned_at)

    _attach_event_participation(platform_id, members_map)
    _attach_platform_member_profiles(platform_id, members_map)
    return members_map


def _attach_platform_member_profiles(platform_id: int, members_map: dict[int, dict]) -> None:
    for pm in PlatformMember.objects.filter(platform_id=platform_id).select_related("user"):
        entry = members_map.get(pm.user_id)
        if not entry:
            continue
        _sync_row_from_platform_member(entry, pm)


def _compute_stats(members: list[dict]) -> dict:
    total = len(members)
    event_managers = sum(1 for m in members if m["role_key"] == "event_manager")
    event_organizers = sum(1 for m in members if m["role_key"] == "event_organizer")
    return {
        "total": total,
        "event_managers": event_managers,
        "event_organizers": event_organizers,
    }


def platform_staff_rows(platform_id: int, platform_name: str) -> list[dict]:
    members_map = _build_staff_map(platform_id)
    member_ids = {
        m.user_id: m.id
        for m in PlatformMember.objects.filter(platform_id=platform_id)
    }
    rows = []
    for member in members_map.values():
        row = dict(member)
        row["platform_id"] = platform_id
        row["platform_name"] = platform_name
        row["platform_member_id"] = member_ids.get(member["id"])
        rows.append(row)
    return rows


def platform_staff_list(platform_id: int, limit: int | None = None) -> dict:
    platform = Platform.objects.get(pk=platform_id)
    staff = sorted(
        platform_staff_rows(platform.id, platform.name),
        key=lambda x: x["joined_at"],
        reverse=True,
    )
    if limit is not None:
        staff = staff[:limit]
    all_members = platform_staff_rows(platform.id, platform.name)
    return {
        "staff": staff,
        "stats": _compute_stats(all_members),
        "role_options": [{"value": v, "label": l} for v, l in FILTER_ROLES],
    }


def all_platforms_staff_list() -> dict:
    rows: list[dict] = []
    platform_options: list[dict] = []
    for platform in Platform.objects.all().order_by("name"):
        platform_options.append({"value": str(platform.id), "label": platform.name})
        rows.extend(platform_staff_rows(platform.id, platform.name))
    rows.sort(key=lambda x: x["joined_at"], reverse=True)
    return {
        "staff": rows,
        "stats": _compute_stats(rows),
        "role_options": [{"value": v, "label": l} for v, l in FILTER_ROLES],
        "platform_options": platform_options,
    }


def platform_staff_preview(platform_id: int, limit: int = 10) -> list[dict]:
    return platform_staff_list(platform_id, limit=limit)["staff"]


def platform_team_list(platform_id: int) -> dict:
    """قائمة أعضاء المنصة لمدير المنصة — مصدرها PlatformMember ثم دمج بيانات الفعاليات."""
    platform = Platform.objects.select_related("owner").get(pk=platform_id)
    members_map = _build_staff_map(platform_id)
    staff: list[dict] = []
    seen: set[int] = set()

    pm_qs = (
        PlatformMember.objects.filter(platform_id=platform_id)
        .exclude(user_id=platform.owner_id)
        .select_related("user")
        .order_by("-joined_at")
    )
    for pm in pm_qs:
        uid = pm.user_id
        if uid in seen:
            continue
        seen.add(uid)
        row = dict(members_map.get(uid) or _minimal_row_from_pm(pm, platform))
        _sync_row_from_platform_member(row, pm)
        row["platform_id"] = platform.id
        row["platform_name"] = platform.name
        staff.append(row)

    for uid, entry in members_map.items():
        if uid == platform.owner_id or uid in seen:
            continue
        if entry.get("role_key") == "platform_owner":
            continue
        seen.add(uid)
        row = dict(entry)
        row["platform_id"] = platform.id
        row["platform_name"] = platform.name
        row["platform_member_id"] = row.get("platform_member_id")
        staff.append(row)

    staff.sort(key=lambda x: x["joined_at"], reverse=True)
    return {
        "staff": staff,
        "stats": _compute_stats(staff),
    }


def get_platform_member_row(platform_id: int, user_id: int) -> dict | None:
    """صف عضو للعرض/التعديل — يعمل حتى لو لم يكن في قائمة الفريق الافتراضية."""
    platform = Platform.objects.select_related("owner").get(pk=platform_id)
    if platform.owner_id == user_id:
        return None

    pm = (
        PlatformMember.objects.filter(platform_id=platform_id, user_id=user_id)
        .select_related("user")
        .first()
    )
    members_map = _build_staff_map(platform_id)
    if pm:
        row = dict(members_map.get(user_id) or _minimal_row_from_pm(pm, platform))
        _sync_row_from_platform_member(row, pm)
        row["platform_id"] = platform.id
        row["platform_name"] = platform.name
        return row

    entry = members_map.get(user_id)
    if not entry or entry.get("role_key") == "platform_owner":
        return None
    row = dict(entry)
    row["platform_id"] = platform.id
    row["platform_name"] = platform.name
    return row


def user_platform_event_participation(user_id: int, platform_id: int) -> list[dict]:
    rows: list[dict] = []
    event_qs = Event.objects.filter(platform_id=platform_id).prefetch_related("managers")

    for event in event_qs:
        role_on_event = None
        if event.created_by_id == user_id:
            role_on_event = "مدير فعالية (منشئ)"
        elif event.managers.filter(id=user_id).exists():
            manager = event.managers.filter(id=user_id).first()
            if manager and manager.role == User.Role.EVENT_ORGANIZER:
                role_on_event = "منظم فعالية"
            else:
                role_on_event = "مدير فعالية"

        if role_on_event:
            rows.append({
                "id": event.id,
                "title": event.title,
                "status": event.status,
                "status_label": event.get_status_display(),
                "role_on_event": role_on_event,
                "date": event.date.isoformat(),
            })

    event_ids = list(event_qs.values_list("id", flat=True))
    if event_ids:
        for sm in StaffMember.objects.filter(
            event_id__in=event_ids, user_id=user_id
        ).select_related("event"):
            rows.append({
                "id": sm.event_id,
                "title": sm.event.title,
                "status": sm.event.status,
                "status_label": sm.event.get_status_display(),
                "role_on_event": sm.get_role_display(),
                "date": sm.event.date.isoformat(),
            })

    rows.sort(key=lambda x: x["date"], reverse=True)
    return rows

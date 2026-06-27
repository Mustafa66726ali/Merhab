"""خدمات الروابط الخارجية: كتالوج الأنواع والإحصائيات."""

from django.db.models import Sum
from urllib.parse import urlparse

from apps.external_links.models import ExternalLink

LINK_TYPE_META = {
    ExternalLink.LinkType.WEBSITE: {
        "category": ExternalLink.Category.WEBSITE,
        "icon": "language",
        "color": "#5b2eff",
    },
    ExternalLink.LinkType.FACEBOOK: {
        "category": ExternalLink.Category.SOCIAL,
        "icon": "thumb_up",
        "color": "#1877F2",
    },
    ExternalLink.LinkType.INSTAGRAM: {
        "category": ExternalLink.Category.SOCIAL,
        "icon": "photo_camera",
        "color": "#E4405F",
    },
    ExternalLink.LinkType.TWITTER: {
        "category": ExternalLink.Category.SOCIAL,
        "icon": "alternate_email",
        "color": "#1DA1F2",
    },
    ExternalLink.LinkType.LINKEDIN: {
        "category": ExternalLink.Category.SOCIAL,
        "icon": "work",
        "color": "#0A66C2",
    },
    ExternalLink.LinkType.YOUTUBE: {
        "category": ExternalLink.Category.SOCIAL,
        "icon": "play_circle",
        "color": "#FF0000",
    },
    ExternalLink.LinkType.TIKTOK: {
        "category": ExternalLink.Category.SOCIAL,
        "icon": "music_note",
        "color": "#010101",
    },
    ExternalLink.LinkType.WHATSAPP: {
        "category": ExternalLink.Category.SOCIAL,
        "icon": "chat",
        "color": "#25D366",
    },
    ExternalLink.LinkType.TELEGRAM: {
        "category": ExternalLink.Category.SOCIAL,
        "icon": "send",
        "color": "#26A5E4",
    },
    ExternalLink.LinkType.SNAPCHAT: {
        "category": ExternalLink.Category.SOCIAL,
        "icon": "photo_camera",
        "color": "#FFFC00",
    },
    ExternalLink.LinkType.APP_STORE: {
        "category": ExternalLink.Category.APP,
        "icon": "phone_iphone",
        "color": "#007AFF",
    },
    ExternalLink.LinkType.PLAY_STORE: {
        "category": ExternalLink.Category.APP,
        "icon": "android",
        "color": "#34A853",
    },
    ExternalLink.LinkType.SUPPORT: {
        "category": ExternalLink.Category.SUPPORT,
        "icon": "support_agent",
        "color": "#928ea3",
    },
    ExternalLink.LinkType.DOCUMENTATION: {
        "category": ExternalLink.Category.SUPPORT,
        "icon": "menu_book",
        "color": "#5b2eff",
    },
    ExternalLink.LinkType.PAYMENT: {
        "category": ExternalLink.Category.PAYMENT,
        "icon": "payments",
        "color": "#00C48C",
    },
    ExternalLink.LinkType.CUSTOM: {
        "category": ExternalLink.Category.OTHER,
        "icon": "link",
        "color": "#928ea3",
    },
}


def get_link_types_catalog() -> list[dict]:
    catalog = []
    for value, label in ExternalLink.LinkType.choices:
        meta = LINK_TYPE_META.get(value, {})
        category = meta.get("category", ExternalLink.Category.OTHER)
        catalog.append({
            "value": value,
            "label": label,
            "category": category,
            "category_label": dict(ExternalLink.Category.choices).get(category, ""),
            "icon": meta.get("icon", "link"),
            "color": meta.get("color", "#928ea3"),
        })
    return catalog


def validate_url(url: str) -> tuple[bool, str]:
    raw = (url or "").strip()
    if not raw:
        return False, "الرابط مطلوب"
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        return False, "يجب أن يبدأ الرابط بـ http:// أو https://"
    if not parsed.netloc:
        return False, "رابط غير صالح"
    return True, "الرابط صالح"


def compute_stats() -> dict:
    qs = ExternalLink.objects.all()
    total = qs.count()
    active = qs.filter(is_active=True).count()
    featured = qs.filter(is_featured=True).count()
    system_wide = qs.filter(platform__isnull=True).count()
    by_category = {}
    for cat_value, cat_label in ExternalLink.Category.choices:
        cat_qs = qs.filter(category=cat_value)
        by_category[cat_value] = {
            "label": cat_label,
            "count": cat_qs.count(),
            "active": cat_qs.filter(is_active=True).count(),
        }
    by_placement = {}
    for place_value, place_label in ExternalLink.Placement.choices:
        by_placement[place_value] = {
            "label": place_label,
            "count": qs.filter(placement=place_value).count(),
        }
    total_clicks = qs.aggregate(total=Sum("click_count"))["total"] or 0
    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "featured": featured,
        "system_wide": system_wide,
        "platform_specific": total - system_wide,
        "total_clicks": total_clicks,
        "by_category": by_category,
        "by_placement": by_placement,
    }

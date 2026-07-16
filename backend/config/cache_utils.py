"""مساعدات التخزين المؤقت للاستجابات المكلفة."""

from django.conf import settings
from django.core.cache import cache

DEFAULT_TIMEOUT = getattr(settings, "CACHE_DEFAULT_TIMEOUT", 300)


def cache_get_or_set(key: str, builder, timeout: int | None = None):
    cached = cache.get(key)
    if cached is not None:
        return cached
    value = builder()
    cache.set(key, value, timeout or DEFAULT_TIMEOUT)
    return value


def cache_delete_prefix(prefix: str):
    """حذف مفاتيح بنفس البادئة — يعمل مع LocMemCache في التطوير."""
    if hasattr(cache, "delete_pattern"):
        cache.delete_pattern(f"{prefix}*")
    else:
        cache.clear()


def invalidate_platform_event_caches(platform_id: int | None) -> None:
    """إبطال واجهات المنصة التي تتضمن بيانات المناسبات."""
    if not platform_id:
        return
    cache.delete_many(
        [
            f"platform:events_dashboard:{platform_id}",
            f"platform:overview:{platform_id}",
        ]
    )

"""مهام خلفية — جاهزة للتوسيع (تصدير، استيراد، إشعارات)."""

from celery import shared_task


@shared_task(name="merhab.ping")
def ping() -> str:
    return "pong"

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.activity_logs.models import ActivityLog
from apps.activity_logs.services import record_activity


SAMPLES = [
    {
        "action": ActivityLog.Action.LOGIN,
        "category": ActivityLog.Category.AUTH,
        "object_repr": "تسجيل دخول مدير النظام",
        "description": "تسجيل دخول ناجح إلى لوحة التحكم",
        "user_email": "admin@merhab.sa",
        "user_name": "مدير النظام",
        "user_role": "system_manager",
        "ip_address": "127.0.0.1",
    },
    {
        "action": ActivityLog.Action.UPDATE,
        "category": ActivityLog.Category.PUBLIC_MEDIA,
        "object_repr": "إعدادات صفحة الهبوط",
        "description": "تحديث في الوسائط والهبوط: إعدادات صفحة الهبوط",
    },
    {
        "action": ActivityLog.Action.CREATE,
        "category": ActivityLog.Category.ANNOUNCEMENTS,
        "object_repr": "إعلان عرض خاص",
        "description": "إنشاء في الإعلانات: بانر إعلاني جديد",
    },
    {
        "action": ActivityLog.Action.UPDATE,
        "category": ActivityLog.Category.INTEGRATIONS,
        "object_repr": "تكامل WhatsApp",
        "description": "تحديث بيانات تكامل WhatsApp Business",
    },
    {
        "action": ActivityLog.Action.EXPORT,
        "category": ActivityLog.Category.REPORTS,
        "object_repr": "تصدير تقرير الفعاليات",
        "description": "تصدير تقرير PDF من لوحة التقارير",
    },
    {
        "action": ActivityLog.Action.LOGIN,
        "category": ActivityLog.Category.AUTH,
        "status": ActivityLog.Status.FAILURE,
        "object_repr": "محاولة دخول فاشلة",
        "description": "فشل تسجيل الدخول — بيانات غير صحيحة",
        "metadata": {"email": "unknown@test.com"},
    },
]


class Command(BaseCommand):
    help = "Seed sample activity logs for demo"

    def handle(self, *args, **options):
        if ActivityLog.objects.exists():
            self.stdout.write("Activity logs already exist — skipping seed")
            return
        for i, sample in enumerate(SAMPLES):
            record_activity(
                action=sample.get("action", ActivityLog.Action.OTHER),
                category=sample.get("category", ActivityLog.Category.OTHER),
                status=sample.get("status", ActivityLog.Status.SUCCESS),
                object_repr=sample.get("object_repr", ""),
                description=sample.get("description", ""),
                metadata=sample.get("metadata", {}),
            )
            log = ActivityLog.objects.order_by("-id").first()
            if log:
                log.user_email = sample.get("user_email", log.user_email)
                log.user_name = sample.get("user_name", log.user_name)
                log.user_role = sample.get("user_role", log.user_role)
                if sample.get("ip_address"):
                    log.ip_address = sample["ip_address"]
                log.created_at = timezone.now() - timezone.timedelta(hours=i * 3)
                log.save(update_fields=["user_email", "user_name", "user_role", "ip_address", "created_at"])
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(SAMPLES)} activity logs"))

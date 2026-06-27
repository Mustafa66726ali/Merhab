import os
import platform
import shutil
import sys
import time

import django
from django.apps import apps
from django.conf import settings
from django.db import connection
from django.utils import timezone

try:
    import psutil
except ImportError:
    psutil = None


def _bytes_to_gb(n: int) -> float:
    return round(n / (1024 ** 3), 2)


def _disk_path() -> str:
    if os.name == "nt":
        return os.environ.get("SystemDrive", "C:") + "\\"
    return "/"


def collect_metrics() -> dict:
    hostname = platform.node()
    os_name = f"{platform.system()} {platform.release()}"
    python_version = sys.version.split()[0]
    django_version = django.get_version()

    cpu_percent = 0.0
    cpu_count = os.cpu_count() or 1
    per_cpu: list[float] = []
    memory = {"used_gb": 0, "total_gb": 0, "percent": 0}
    disk = {"used_gb": 0, "total_gb": 0, "percent": 0}
    uptime_seconds = 0
    network = {"bytes_sent_mb": 0, "bytes_recv_mb": 0}
    load_avg = None

    if psutil:
        cpu_percent = psutil.cpu_percent(interval=0.15)
        per_cpu = [round(p, 1) for p in psutil.cpu_percent(interval=0.1, percpu=True)]
        vm = psutil.virtual_memory()
        memory = {
            "used_gb": _bytes_to_gb(vm.used),
            "total_gb": _bytes_to_gb(vm.total),
            "percent": round(vm.percent, 1),
            "available_gb": _bytes_to_gb(vm.available),
        }
        du = psutil.disk_usage(_disk_path())
        disk = {
            "used_gb": _bytes_to_gb(du.used),
            "total_gb": _bytes_to_gb(du.total),
            "percent": round(du.percent, 1),
            "free_gb": _bytes_to_gb(du.free),
        }
        uptime_seconds = int(time.time() - psutil.boot_time())
        try:
            net = psutil.net_io_counters()
            network = {
                "bytes_sent_mb": round(net.bytes_sent / (1024 ** 2), 2),
                "bytes_recv_mb": round(net.bytes_recv / (1024 ** 2), 2),
            }
        except OSError:
            pass
        if hasattr(os, "getloadavg"):
            try:
                load_avg = list(os.getloadavg())
            except OSError:
                load_avg = None
    else:
        du = shutil.disk_usage(_disk_path())
        disk = {
            "used_gb": _bytes_to_gb(du.used),
            "total_gb": _bytes_to_gb(du.total),
            "percent": round(du.used / du.total * 100, 1) if du.total else 0,
            "free_gb": _bytes_to_gb(du.free),
        }

    db_status = "connected"
    db_latency_ms = 0
    try:
        start = time.perf_counter()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_latency_ms = round((time.perf_counter() - start) * 1000, 2)
    except Exception:
        db_status = "error"
        db_latency_ms = -1

    Platform = apps.get_model("platforms", "Platform")
    Event = apps.get_model("events", "Event")
    User = apps.get_model("accounts", "User")
    Guest = apps.get_model("guests", "Guest")

    services = [
        {
            "id": "api",
            "name": "خادم API",
            "status": "healthy",
            "detail": "Django REST Framework",
            "latency_ms": db_latency_ms,
        },
        {
            "id": "database",
            "name": "قاعدة البيانات",
            "status": "healthy" if db_status == "connected" else "error",
            "detail": connection.vendor,
            "latency_ms": db_latency_ms,
        },
        {
            "id": "media",
            "name": "تخزين الملفات",
            "status": "healthy" if os.path.isdir(settings.MEDIA_ROOT) or settings.DEBUG else "warning",
            "detail": str(settings.MEDIA_ROOT),
            "latency_ms": 0,
        },
    ]

    return {
        "timestamp": timezone.now().isoformat(),
        "server": {
            "hostname": hostname,
            "os": os_name,
            "python_version": python_version,
            "django_version": django_version,
            "cpu_count": cpu_count,
        },
        "cpu": {
            "percent": round(cpu_percent, 1),
            "per_core": per_cpu,
        },
        "memory": memory,
        "disk": disk,
        "network": network,
        "uptime_seconds": uptime_seconds,
        "load_avg": load_avg,
        "database": {
            "status": db_status,
            "vendor": connection.vendor,
            "latency_ms": db_latency_ms,
        },
        "business": {
            "platforms": Platform.objects.count(),
            "events": Event.objects.count(),
            "users": User.objects.count(),
            "guests": Guest.objects.count(),
        },
        "services": services,
        "psutil_available": psutil is not None,
    }

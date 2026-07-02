#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""تشغيل مشروع مرحّاب كاملاً: Backend + Frontend."""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
LANDING_PATH = "/landing"
# الفاصل الزمني (ثوانٍ) لفحص التذكيرات التلقائية المستحقّة قبل الحفل
REMINDER_INTERVAL_SEC = int(os.environ.get("REMINDER_INTERVAL_SEC", "300"))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def get_lan_ip() -> str:
    """عنوان IP المحلي على الشبكة (لروابط الدعوة من الهاتف)."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
        sock.close()
        return ip
    except OSError:
        return "127.0.0.1"


def configure_network_env(env: dict[str, str], *, use_https: bool) -> str:
    """يضبط FRONTEND_URL وALLOWED_HOSTS تلقائياً ليعمل رابط الدعوة من أجهزة أخرى."""
    lan_ip = get_lan_ip()
    port = os.environ.get("FRONTEND_PORT", "3000")
    scheme = "https" if use_https else "http"
    frontend_url = f"{scheme}://{lan_ip}:{port}"
    env["FRONTEND_URL"] = frontend_url

    hosts = {
        h.strip()
        for h in env.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
        if h.strip()
    }
    hosts.update({"localhost", "127.0.0.1", lan_ip})
    env["ALLOWED_HOSTS"] = ",".join(sorted(hosts))

    cors = {
        o.strip()
        for o in env.get(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:3000",
        ).split(",")
        if o.strip()
    }
    cors.update(
        {
            f"http://localhost:{port}",
            f"http://{lan_ip}:{port}",
            f"https://localhost:{port}",
            f"https://{lan_ip}:{port}",
        }
    )
    env["CORS_ALLOWED_ORIGINS"] = ",".join(sorted(cors))
    return frontend_url


def npm_cmd() -> str:
    return "npm.cmd" if os.name == "nt" else "npm"


def backend_python() -> str:
    venv_python = BACKEND / "venv" / "Scripts" / "python.exe"
    if venv_python.exists():
        return str(venv_python)
    subprocess.run([sys.executable, "-m", "venv", str(BACKEND / "venv")], check=True)
    return str(venv_python)


def run(cmd: list[str], cwd: Path, env: dict[str, str] | None = None) -> None:
    print("  > " + " ".join(cmd))
    subprocess.run(cmd, cwd=str(cwd), env=env, check=True)


def install_backend(py: str) -> None:
    try:
        subprocess.run([py, "-c", "import django"], cwd=str(BACKEND), check=True, capture_output=True)
    except subprocess.CalledProcessError:
        print("\n[مرحّاب] تثبيت متطلبات الخادم...")
        run([py, "-m", "pip", "install", "--upgrade", "pip"], BACKEND)
        run([py, "-m", "pip", "install", "-r", "requirements.txt"], BACKEND)


def install_frontend() -> None:
    if (FRONTEND / "node_modules").exists():
        return
    print("\n[مرحّاب] تثبيت متطلبات الواجهة...")
    run([npm_cmd(), "install"], FRONTEND)


def verify_login_api(py: str) -> bool:
    """Smoke-test admin login after DB setup."""
    env = os.environ.copy()
    env.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    script = str(BACKEND / "scripts" / "verify_login_api.py")
    try:
        subprocess.run([py, script], cwd=str(BACKEND), env=env, check=True)
        return True
    except subprocess.CalledProcessError:
        return False


def setup_database(py: str) -> None:
    env = os.environ.copy()
    env.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    print("\n[مرحّاب] تجهيز قاعدة البيانات...")
    run([py, "manage.py", "migrate", "--noinput"], BACKEND, env)
    run([py, "manage.py", "repair_password_hashes"], BACKEND, env)
    run([py, "manage.py", "ensure_admin"], BACKEND, env)


def wait_for_backend_login(py: str, timeout: int = 90) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if wait_for("http://127.0.0.1:8000/api/docs/", 3):
            if verify_login_api(py):
                print("[مرحّاب] تم التحقق من تسجيل دخول الأدمن بنجاح.")
                return True
            run([py, "manage.py", "repair_password_hashes"], BACKEND, os.environ.copy())
            run([py, "manage.py", "ensure_admin"], BACKEND, os.environ.copy())
        time.sleep(2)
    return False


def wait_for(url: str, timeout: int = 90) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=2)
            return True
        except (urllib.error.URLError, OSError, TimeoutError):
            time.sleep(1)
    return False


def reminder_scheduler(py: str) -> None:
    """مجدوِل بسيط للتذكيرات التلقائية: يفحص الفعاليات المستحقّة دورياً.

    يستدعي أمر ``send_due_reminders`` كل ``REMINDER_INTERVAL_SEC`` ثانية. الأمر
    نفسه آمن للتكرار (idempotent) ويعمل فقط عند وجود مزوّد رسمي نشط (Twilio/Cloud).
    في الإنتاج يُفضَّل استخدام cron / Task Scheduler بدل هذا الخيط.
    """
    env = os.environ.copy()
    env.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    env["PYTHONIOENCODING"] = "utf-8"
    # امهل الخادم وقتاً للإقلاع قبل أول فحص
    time.sleep(20)
    while True:
        try:
            subprocess.run(
                [py, "manage.py", "send_due_reminders"],
                cwd=str(BACKEND),
                env=env,
                capture_output=True,
                timeout=120,
            )
        except Exception:  # noqa: BLE001
            pass
        time.sleep(REMINDER_INTERVAL_SEC)


def print_login_info(frontend_url: str, local_url: str) -> None:
    print("\n" + "=" * 52)
    print("  مرحّاب - بيانات دخول مدير النظام")
    print("=" * 52)
    print("  البريد:       admin@merhab.sa")
    print("  كلمة المرور:  Merhab@2024")
    print(f"  الرابط:       {local_url}{LANDING_PATH}")
    print(f"  من جهاز آخر:  {frontend_url}{LANDING_PATH}")
    print(f"  روابط الدعوة: {frontend_url}/i/<token>")
    if frontend_url.startswith("https://"):
        print("  ملاحظة:       على الجوال/الجهاز الخارجي اقبل تحذير الشهادة")
        print("                (Advanced → Proceed) ثم اسمح للكاميرا.")
    print("=" * 52 + "\n")


def main() -> int:
    py = backend_python()
    install_backend(py)
    install_frontend()
    setup_database(py)

    backend_env = os.environ.copy()
    backend_env.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    use_https = os.environ.get("MERHAB_HTTPS", "1") != "0"
    frontend_url = configure_network_env(backend_env, use_https=use_https)
    local_scheme = "https" if use_https else "http"
    local_url = f"{local_scheme}://localhost:3000"
    frontend_env = os.environ.copy()
    # نفس الأصل: المتصفح ينادي /api/v1 على منفذ الواجهة، وخادم الواجهة يُمرّرها
    # داخليًا إلى الباك-إند (rewrites). هكذا يعمل من أي جهاز دون فتح المنفذ 8000.
    frontend_env["NEXT_PUBLIC_API_URL"] = "/api/v1"

    print("\n[مرحّاب] تشغيل Backend على http://127.0.0.1:8000")
    print(f"[مرحّاب] روابط الدعوة للأجهزة الخارجية: {frontend_url}")
    backend_proc = subprocess.Popen(
        [py, "manage.py", "runserver", "8000"],
        cwd=str(BACKEND),
        env=backend_env,
    )

    # مجدوِل التذكيرات التلقائية (خيط خلفي يعمل طوال تشغيل المشروع)
    threading.Thread(
        target=reminder_scheduler, args=(py,), daemon=True
    ).start()
    print(
        f"[مرحّاب] مجدوِل التذكيرات التلقائية يعمل كل {REMINDER_INTERVAL_SEC}ث "
        "(يتطلّب مزوّداً رسمياً نشطاً)"
    )

    print(f"[مرحّاب] تشغيل Frontend على {local_url} (متاح على الشبكة)")
    frontend_dev_args = [npm_cmd(), "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]
    if use_https:
        frontend_dev_args.append("--experimental-https")
    frontend_proc = subprocess.Popen(
        frontend_dev_args,
        cwd=str(FRONTEND),
        env=frontend_env,
        shell=os.name == "nt",
    )

    print_login_info(frontend_url, local_url)
    backend_ready = wait_for("http://127.0.0.1:8000/api/docs/", 90)
    frontend_ready = wait_for(f"{local_url}{LANDING_PATH}", 120)
    if backend_ready:
        verify_login_api(py)
    if backend_ready and frontend_ready:
        webbrowser.open(f"{local_url}{LANDING_PATH}")
        print(f"[مرحّاب] تم فتح المتصفح: {local_url}{LANDING_PATH}")

    print("\n[مرحّاب] المشروع يعمل. اضغط Ctrl+C للإيقاف.\n")
    try:
        while True:
            if backend_proc.poll() is not None:
                print("[خطأ] توقف Backend.")
                return backend_proc.returncode or 1
            if frontend_proc.poll() is not None:
                print("[خطأ] توقف Frontend.")
                return frontend_proc.returncode or 1
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[مرحّاب] إيقاف الخوادم...")
    finally:
        for proc in (frontend_proc, backend_proc):
            if proc.poll() is None:
                proc.terminate()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

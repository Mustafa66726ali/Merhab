import os
from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config("SECRET_KEY", default="django-insecure-dev-key-change-in-production")

DEBUG = config("DEBUG", default=True, cast=bool)

ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="*").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # Local apps
    "apps.accounts",
    "apps.events",
    "apps.guests",
    "apps.tables",
    "apps.invitations",
    "apps.messages_app",
    "apps.reports",
    "apps.staff",
    "apps.platforms",
    "apps.monitoring",
    "apps.integrations",
    "apps.external_links",
    "apps.static_pages",
    "apps.public_media",
    "apps.faq",
    "apps.announcements",
    "apps.activity_logs",
    "apps.system_settings",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.gzip.GZipMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.activity_logs.middleware.ActivityLogMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# PostgreSQL عند ضبط DB_NAME (السيرفر / Docker) — SQLite محلياً بدون DB_NAME
_db_name = config("DB_NAME", default="").strip()

if _db_name:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": _db_name,
            "USER": config("DB_USER"),
            "PASSWORD": config("DB_PASSWORD"),
            "HOST": config("DB_HOST", default="localhost"),
            "PORT": config("DB_PORT", default="5432"),
            "CONN_MAX_AGE": config("DB_CONN_MAX_AGE", default=600, cast=int),
            "CONN_HEALTH_CHECKS": True,
            "OPTIONS": {
                "connect_timeout": 10,
            },
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# Cache — LocMem في التطوير، Redis في الإنتاج عند توفر REDIS_URL
REDIS_URL = config("REDIS_URL", default="")
CACHE_DEFAULT_TIMEOUT = config("CACHE_DEFAULT_TIMEOUT", default=300, cast=int)

if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
            "KEY_PREFIX": "merhab",
            "TIMEOUT": CACHE_DEFAULT_TIMEOUT,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "merhab-default",
            "TIMEOUT": CACHE_DEFAULT_TIMEOUT,
        }
    }

# Celery — يعمل متزامناً في التطوير (CELERY_TASK_ALWAYS_EAGER)
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default=REDIS_URL or "redis://127.0.0.1:6379/0")
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default=CELERY_BROKER_URL)
CELERY_TASK_ALWAYS_EAGER = config("CELERY_TASK_ALWAYS_EAGER", default=DEBUG, cast=bool)
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "ar"
TIME_ZONE = "Asia/Riyadh"
USE_I18N = True
USE_TZ = True

CELERY_TIMEZONE = TIME_ZONE

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# عنوان الواجهة الأمامية — يُستخدم لبناء روابط الدعوة العامة (RSVP)
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:3000").rstrip("/")

# مزوّد إرسال واتساب للدعوات والتذكيرات:
#   manual → روابط wa.me يدوية (افتراضي للتطوير)
#   bot    → بوت محلي يحاكي الإنسان لاختبار الأتمتة (whatsapp-web.js)
#   api    → WhatsApp Cloud API / Twilio حسب التكاملات المُكوَّنة (الإنتاج)
WHATSAPP_PROVIDER = config("WHATSAPP_PROVIDER", default="manual")
# عنوان خدمة بوت الواتساب المحلي (وضع الاختبار)
WHATSAPP_BOT_URL = config("WHATSAPP_BOT_URL", default="http://127.0.0.1:8088").rstrip("/")
# مفتاح حماية بسيط للتواصل مع البوت
WHATSAPP_BOT_TOKEN = config("WHATSAPP_BOT_TOKEN", default="merhab-bot-dev")

# قوالب Meta المعتمدة (الإنتاج) — يُستبدل من صفحة التكاملات أيضاً
WHATSAPP_TEMPLATE_INVITATION = config(
    "WHATSAPP_TEMPLATE_INVITATION", default="event_invitation"
)
WHATSAPP_TEMPLATE_REMINDER = config(
    "WHATSAPP_TEMPLATE_REMINDER", default="event_reminder"
)
WHATSAPP_TEMPLATE_QR = config("WHATSAPP_TEMPLATE_QR", default="rsvp_qr")
WHATSAPP_TEMPLATE_LANGUAGE = config("WHATSAPP_TEMPLATE_LANGUAGE", default="ar")
# دعوة تفاعلية (أزرار خريطة + دعوة + نعم/لا) — الافتراضي مفعّل
WHATSAPP_INVITATION_INTERACTIVE = config(
    "WHATSAPP_INVITATION_INTERACTIVE", default=True, cast=bool
)
# إن True: استخدام قالب Meta القديم event_invitation بدل التفاعلي
WHATSAPP_INVITATION_LEGACY_TEMPLATE = config(
    "WHATSAPP_INVITATION_LEGACY_TEMPLATE", default=False, cast=bool
)
WHATSAPP_WEBHOOK_VERIFY_TOKEN = config(
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN", default="merhab-verify"
)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# خلف بروكسي عكسي (nginx) في الإنتاج
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True
    CSRF_TRUSTED_ORIGINS = config(
        "CSRF_TRUSTED_ORIGINS",
        default=config("FRONTEND_URL", default="http://localhost:3000"),
    ).split(",")

# CORS
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000",
).split(",")

# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# JWT
from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=2),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Spectacular
SPECTACULAR_SETTINGS = {
    "TITLE": "مرحّاب API",
    "DESCRIPTION": "نظام إدارة الفعاليات والمناسبات",
    "VERSION": "1.0.0",
}

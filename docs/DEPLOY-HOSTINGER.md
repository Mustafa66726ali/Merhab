# نشر مرحّاب على Hostinger VPS (Docker + PostgreSQL)

دليل خطوة بخطوة لنشر المشروع على سيرفر Hostinger افتراضي (VPS) مع قاعدة بيانات PostgreSQL **جديدة وفارغة** داخل Docker — بدون نقل قاعدة التطوير المحلية.

---

## نظرة عامة

| المكوّن | الوصف |
|---------|--------|
| **GitHub** | مصدر الكود + نشر تلقائي عند الدفع إلى `main` |
| **Docker Compose** | postgres, redis, backend, frontend, nginx, celery, scheduler |
| **قاعدة البيانات** | PostgreSQL داخل حاوية `db` — volume جديد `postgres_data` |
| **سوبر أدمن** | يُنشأ تلقائياً عند أول تشغيل من `ADMIN_EMAIL` و `ADMIN_PASSWORD` |
| **واتساب** | Twilio أو Meta Cloud API + قوالب Meta الثلاثة |

---

## 1) إعداد السيرفر (مرة واحدة)

اتصل بالسيرفر عبر SSH:

```bash
ssh root@YOUR_SERVER_IP
```

### تثبيت Docker وتشغيل المشروع

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USER/Merhab/main/scripts/server-bootstrap.sh | bash -s -- /opt/merhab https://github.com/YOUR_USER/Merhab.git
```

أو يدوياً:

```bash
apt update && apt install -y git
curl -fsSL https://get.docker.com | sh
git clone https://github.com/YOUR_USER/Merhab.git /opt/merhab
cd /opt/merhab
cp .env.example .env
nano .env   # عدّل القيم (انظر القسم 2)
docker compose build
docker compose up -d
```

تحقق:

```bash
docker compose ps
curl -I http://localhost
```

---

## 2) ملف `.env` على السيرفر

انسخ من `.env.example` وعدّل:

```env
DEBUG=False
SECRET_KEY=مفتاح-سري-طويل-عشوائي-غيّره

FRONTEND_URL=https://yourdomain.com
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com

# قاعدة بيانات جديدة داخل Docker (لا تستخدم SQLite المحلي)
DB_NAME=merhab
DB_USER=merhab
DB_PASSWORD=كلمة-مرور-قوية-للقاعدة
DB_HOST=db
DB_PORT=5432

ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=كلمة-مرور-قوية-للمدير
ADMIN_USERNAME=admin

WHATSAPP_PROVIDER=api
WHATSAPP_TEMPLATE_INVITATION=event_invitation
WHATSAPP_TEMPLATE_REMINDER=event_reminder
WHATSAPP_TEMPLATE_QR=rsvp_qr
WHATSAPP_TEMPLATE_LANGUAGE=ar

HTTP_PORT=80
```

> **مهم:** `DB_HOST=db` يشير إلى حاوية PostgreSQL في `docker-compose.yml`. عند أول `docker compose up` تُنشأ قاعدة فارغة وتُطبَّق الترحيلات تلقائياً.

### إنشاء حساب السوبر أدمن

عند تشغيل حاوية `backend` لأول مرة:

1. `migrate` — إنشاء الجداول
2. `ensure_admin` — إنشاء/تحديث مدير النظام من `.env`

سجّل الدخول بالبريد `ADMIN_EMAIL` وكلمة المرور `ADMIN_PASSWORD`.

---

## 3) ربط الدومين و SSL (Hostinger)

1. في لوحة Hostinger → DNS: أضف سجل **A** يشير `@` و `www` إلى IP السيرفر.
2. للـ HTTPS استخدم **Certbot** أو **Nginx Proxy** أمام المنفذ 80.

مثال Certbot (بعد فتح المنفذ 80):

```bash
apt install -y certbot
# أو ضع reverse proxy أمام docker compose
```

حدّث `FRONTEND_URL` و `ALLOWED_HOSTS` و `CSRF_TRUSTED_ORIGINS` بالدومين مع `https://`.

---

## 4) النشر التلقائي من GitHub

### أ) دفع المشروع إلى GitHub (من جهازك)

```bash
cd d:\Merhab
git init
git add .
git commit -m "Initial production-ready Merhab deployment"
gh repo create Merhab --private --source=. --push
```

### ب) أسرار GitHub Actions

في المستودع → **Settings → Secrets and variables → Actions**:

| السر | القيمة |
|------|--------|
| `SERVER_HOST` | IP السيرفر |
| `SERVER_USER` | `root` أو مستخدم SSH |
| `SERVER_SSH_KEY` | المفتاح الخاص (PEM) |
| `SERVER_PORT` | `22` |
| `DEPLOY_PATH` | `/opt/merhab` |

عند كل `git push` إلى `main` يُنفَّذ `.github/workflows/deploy.yml`: سحب الكود، `docker compose build`, `docker compose up -d`.

### ج) نشر يدوي على السيرفر

```bash
cd /opt/merhab
git pull
docker compose build
docker compose up -d
```

---

## 5) ربط Twilio للواتساب

1. سجّل الدخول كـ **مدير النظام** → **التكاملات**.
2. أضف تكامل **WhatsApp (Twilio)**:
   - **API Key** = Account SID
   - **API Secret** = Auth Token
   - **Phone Number ID** = رقم واتساب بصيغة `+966...` (يُحوَّل تلقائياً إلى `whatsapp:+966...`)
3. في **config** أضف Content SID (انظر `docs/META-WHATSAPP-TEMPLATES.md`):
   - `content_invitation` — دعوة call-to-action (نص + زر فتح الدعوة)
   - `content_reminder_optin` — نعم ذكرني / لا اعتذر
   - `content_reminder` — تذكير قبل الموعد بيوم (ثم QR تلقائياً)
   - `content_broadcast` / `content_broadcast_watch` — اختياري للبث
4. فعّل التكامل واجعله **أساسياً (primary)**.

بديل: **WhatsApp Cloud API** (Meta مباشرة) مع نفس أسماء القوالب في حقول `template_*`.

---

## 6) قوالب Meta (الدعوة، التذكير، QR)

راجع الملف التفصيلي: **[META-WHATSAPP-TEMPLATES.md](./META-WHATSAPP-TEMPLATES.md)**

ترتيب المتغيرات في الكود (للموافقة في Meta):

| القالب | {{1}} | {{2}} | {{3}} | {{4}} | {{5}} |
|--------|-------|-------|-------|-------|-------|
| `event_invitation` | اسم الضيف | اسم المناسبة | التاريخ | الموقع | رابط التفاصيل |
| `event_reminder` | اسم الضيف | اسم المناسبة | التاريخ | الموقع | رابط التفاصيل |
| `rsvp_qr` | اسم الضيف | اسم المناسبة | — | — | — |

بعد تأكيد الحضور: يُرسل قالب `rsvp_qr` ثم **صورة PNG** لرمز QR.

---

## 7) البث المباشر

- المنظم يفعّل البث من لوحة الفعالية.
- الرابط العام: `https://yourdomain.com/live/{token}`
- يُشارك الرابط مع الضيوف (يدوياً أو ضمن رسائل مخصصة). روابط الدعوة `/i/{token}` تعرض البث عند التفعيل.

---

## 8) استكشاف الأخطاء

```bash
# سجلات الخدمات
docker compose logs -f backend
docker compose logs -f nginx

# إعادة إنشاء المدير من .env
docker compose exec backend python manage.py ensure_admin

# التحقق من قاعدة البيانات
docker compose exec db psql -U merhab -d merhab -c '\dt'
```

| المشكلة | الحل |
|---------|------|
| 502 Bad Gateway | انتظر اكتمال `backend` و `frontend`: `docker compose ps` |
| CSRF / CORS | تأكد من `CSRF_TRUSTED_ORIGINS` و `FRONTEND_URL` |
| واتساب لا يُرسل | تحقق من التكامل النشط، موافقة القوالب، Content SID في Twilio |
| قاعدة قديمة | `docker compose down -v` يحذف volumes — **يحذف كل البيانات** |

---

## 9) ملخص الأوامر السريعة

```bash
# على السيرفر
cd /opt/merhab
nano .env
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

بعد الإعداد: افتح `https://yourdomain.com` وسجّل دخول المدير من `.env`.

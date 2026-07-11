# قوالب واتساب Meta لمرحّاب

هذا المستند يوضح القوالب الثلاثة المطلوبة في **Meta Business Manager** (أو عبر **Twilio Content Templates**) وكيف يربطها المشروع.

> في Meta تُكتب المتغيرات `{{1}}`، `{{2}}`… وليس `{{guest_name}}`. الكود يرسل القيم بهذا الترتيب.

---

## 1) دعوة الضيف — `event_invitation`

**الاسم في Meta:** `event_invitation`  
**اللغة:** `ar`

**نص القالب (للموافقة):**

```
مرحبا {{1}}
دعوة لحضور مناسبة: {{2}}

نحن سعداء بدعوتك لحضور:

 التاريخ: {{3}}
 الموقع: {{4}}

اضغط هنا لعرض التفاصيل وتأكيد الحضور:
{{5}}
شكراً مرحاب
```

| المتغير | المحتوى |
|---------|---------|
| {{1}} | اسم الضيف |
| {{2}} | اسم المناسبة |
| {{3}} | التاريخ والوقت |
| {{4}} | الموقع |
| {{5}} | رابط الدعوة `https://yourdomain.com/i/{token}` |

**زر (اختياري):** URL → `{{5}}` — نص الزر: «عرض التفاصيل»

---

## 2) تذكير الضيوف — `event_reminder`

**الاسم في Meta:** `event_reminder`  
**اللغة:** `ar`

**نص القالب:**

```
تذكير
مرحبا {{1}}
مناسبة: {{2}}

ستقام بتاريخ: {{3}}
الموقع: {{4}}

رابط التفاصيل:
{{5}}
شكرا مرحاب
```

نفس ترتيب المتغيرات كالدعوة.

---

## 3) تأكيد الحضور + QR — `rsvp_qr`

**الاسم في Meta:** `rsvp_qr`  
**اللغة:** `ar`

**نص القالب:**

```
مرحبا {{1}}
تم تأكيد حضورك في: {{2}}

هذا هو كود الدخول الخاص بك

نراك في الموعد
```

| المتغير | المحتوى |
|---------|---------|
| {{1}} | اسم الضيف |
| {{2}} | اسم المناسبة |

**بعد القالب:** يرسل النظام **صورة PNG** لرمز QR (ليست جزءاً من القالب النصي).

---

## 4) البث المباشر — `content_broadcast` + `content_broadcast_watch`

يُرسَل للضيوف **الحاضرين أو الجالسين** عند الضغط على «إرسال رابط البث» من لوحة البث.

### قالب 1 — نص البث (`content_broadcast`)

**اللغة:** `ar`

```
مرحباً {{1}}

بث مباشر — {{2}}
```

| المتغير | المحتوى |
|---------|---------|
| {{1}} | اسم الضيف |
| {{2}} | اسم المناسبة |

### قالب 2 — زر المشاهدة (`content_broadcast_watch`)

**النوع:** Call to action (CTA)  
**نص الزر:** `مشاهدة`  
**رابط الزر:** `https://YOUR-DOMAIN.com/live/{{1}}`

| المتغير | المحتوى |
|---------|---------|
| {{1}} | رمز البث (UUID) — وليس الرابط كاملاً |

> استبدل `YOUR-DOMAIN.com` ب domain الإنتاج HTTPS (نفس `FRONTEND_URL`).

**مثال:** إذا كان رابط البث `https://merhab.sa/live/a1b2c3d4-...` فـ `{{1}}` = `a1b2c3d4-...` فقط.

---

## الربط في المشروع

### عبر Meta Cloud API

1. لوحة التكاملات → **WhatsApp Business API**
2. Access Token + Phone Number ID + Business Account ID
3. حقول القوالب:
   - `template_invitation` = `event_invitation`
   - `template_reminder` = `event_reminder`
   - `template_qr` = `rsvp_qr`
   - `template_language` = `ar`

### عبر Twilio

1. أنشئ قالب **Content** من نوع **`twilio/card`** في Twilio Console (رسالة واحدة)
2. انسخ **Content SID** (`HX...`)
3. في تكامل **WhatsApp (Twilio)** → الصقه في **قالب الدعوة (twilio/card)**

#### قالب الدعوة الواحد (`content_invitation`)

**النوع:** `twilio/card`  
**اللغة:** `ar`

**نص الجسم (مثال):**

```
مرحبا {{1}}
يسعدنا دعوتك لحضور: {{2}}

التاريخ: {{3}}
المكان: {{4}}
```

**الأزرار:**

| النوع | العنوان | القيمة |
|-------|---------|--------|
| URL | الخريطة | `https://www.google.com/maps?q={{5}}` |
| URL | فتح | `https://YOUR-DOMAIN.com/i/{{6}}` |
| QUICK_REPLY | نعم | id: `merhab_rsvp_yes_{{6}}` |
| QUICK_REPLY | لا | id: `merhab_rsvp_no_{{6}}` |

| المتغير | المحتوى |
|---------|---------|
| {{1}} | اسم الضيف |
| {{2}} | اسم المناسبة |
| {{3}} | التاريخ والوقت |
| {{4}} | الموقع |
| {{5}} | إحداثيات أو عنوان للخريطة |
| {{6}} | رمز الضيف (UUID) — لرابط `/i/` وأزرار RSVP |

> استبدل `YOUR-DOMAIN.com` بـ domain الإنتاج HTTPS (نفس `FRONTEND_URL`).

#### قوالب إضافية (اختيارية / بث)

| مفتاح في مرحّاب | القالب في Twilio |
|-----------------|------------------|
| `content_invitation` | **مطلوب** — بطاقة الدعوة أعلاه |
| `content_broadcast` | نص البث ({{1}}–{{2}}) |
| `content_broadcast_watch` | زر مشاهدة CTA — URL: `https://YOUR-DOMAIN.com/live/{{1}}` |
| `content_reminder` | تذكير (اختياري) |
| `content_qr` | نص قبل صورة QR |

4. Webhook وارد: `https://yourdomain.com/api/v1/integrations/whatsapp/webhook/twilio/`

### في `.env` (افتراضيات)

```env
WHATSAPP_PROVIDER=api
WHATSAPP_TEMPLATE_INVITATION=event_invitation
WHATSAPP_TEMPLATE_REMINDER=event_reminder
WHATSAPP_TEMPLATE_QR=rsvp_qr
WHATSAPP_TEMPLATE_LANGUAGE=ar
```

---

## دعوة تفاعلية (الوضع الافتراضي في مرحّاب)

عند `WHATSAPP_INVITATION_INTERACTIVE=True` (افتراضي) تُرسل الدعوة عبر Twilio كـ **رسالة واحدة** (`twilio/card`):

1. **نص الدعوة** — ترحيب + اسم المناسبة + التاريخ + المكان  
2. **زر الخريطة** — يفتح Google Maps  
3. **زر فتح الدعوة** — يفتح صفحة `/i/{token}`  
4. **هل ستحضر؟** — أزرار **نعم** / **لا**  
   - **نعم** → تأكيد حضور + إرسال QR  
   - **لا** → تسجيل اعتذار  

> عبر Cloud API أو البوت المحلي تبقى الخطوات منفصلة؛ عبر Twilio تُدمَج في بطاقة واحدة.

### Webhooks (Twilio / Meta / البوت)

| المزوّد | الرابط |
|---------|--------|
| Meta Cloud | `https://yourdomain.com/api/v1/integrations/whatsapp/webhook/meta/` |
| Twilio | `https://yourdomain.com/api/v1/integrations/whatsapp/webhook/twilio/` |
| البوت المحلي | يُبلّغ تلقائياً: `/api/v1/integrations/whatsapp/bot-inbound/` |

في `.env`:
```env
WHATSAPP_INVITATION_INTERACTIVE=True
WHATSAPP_WEBHOOK_VERIFY_TOKEN=merhab-verify
```

للعودة للقالب النصي القديم `event_invitation`:
```env
WHATSAPP_INVITATION_LEGACY_TEMPLATE=True
```

---

## ملاحظات الموافقة في Meta

- لا تضع مسافات داخل أسماء المتغيرات (`{{event_name}}` غير مدعوم — استخدم `{{1}}`…)
- انتظر حالة **Approved** قبل الإرسال الإنتاجي
- نافذة الرسائل: 24 ساعة للمحادثة الحرة؛ القوالب للدعوات والتذكيرات خارج النافذة
- صورة QR تُرسل كـ **media message** بعد قالب `rsvp_qr`

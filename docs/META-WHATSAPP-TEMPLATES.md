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

1. أنشئ **Content Templates** في Twilio Console مطابقة للنصوص أعلاه
2. انسخ **Content SID** (يبدأ بـ `HX...`) لكل قالب
3. في تكامل **WhatsApp (Twilio)** → config:
   - `content_invitation`
   - `content_reminder`
   - `content_qr`

### في `.env` (افتراضيات)

```env
WHATSAPP_PROVIDER=api
WHATSAPP_TEMPLATE_INVITATION=event_invitation
WHATSAPP_TEMPLATE_REMINDER=event_reminder
WHATSAPP_TEMPLATE_QR=rsvp_qr
WHATSAPP_TEMPLATE_LANGUAGE=ar
```

---

## ملاحظات الموافقة في Meta

- لا تضع مسافات داخل أسماء المتغيرات (`{{event_name}}` غير مدعوم — استخدم `{{1}}`…)
- انتظر حالة **Approved** قبل الإرسال الإنتاجي
- نافذة الرسائل: 24 ساعة للمحادثة الحرة؛ القوالب للدعوات والتذكيرات خارج النافذة
- صورة QR تُرسل كـ **media message** بعد قالب `rsvp_qr`

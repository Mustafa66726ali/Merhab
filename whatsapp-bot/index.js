/**
 * بوت واتساب لاختبار أتمتة مرحّاب (الدعوات والتذكيرات).
 *
 * الغرض: إرسال الرسائل تلقائياً في بيئة التطوير دون تدخّل يدوي، مع محاكاة
 * سلوك الإنسان (تأخير عشوائي، مؤشّر كتابة، فترات راحة، حدّ إرسال بالساعة)
 * لتقليل احتمال الحظر. في الإنتاج تُستبدل هذه الطبقة بـ Twilio.
 *
 * واجهة HTTP بسيطة محميّة برمز Bearer:
 *   GET  /status        → جاهزية الاتصال وحجم الطابور والإحصاءات
 *   POST /send {to,message} → إضافة رسالة لطابور الإرسال البشري
 *   GET  /queue         → حجم الطابور الحالي
 */

const fs = require("fs");
const path = require("path");
const express = require("express");
const qrcode = require("qrcode-terminal");
const QRImage = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");

const QR_PNG_PATH = path.join(__dirname, "qr.png");
let lastQr = "";

/**
 * تحديد متصفّح مثبّت على النظام (Chrome/Edge) لأننا نتخطّى تنزيل Chromium
 * المرفق مع puppeteer. يمكن تجاوزه عبر المتغيّر CHROME_PATH.
 */
function resolveBrowserPath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    `${process.env["ProgramFiles"]}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["LOCALAPPDATA"]}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env["ProgramFiles"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || undefined;
}

const BROWSER_PATH = resolveBrowserPath();

// ===== الإعدادات (قابلة للضبط عبر متغيّرات البيئة) =====
const PORT = parseInt(process.env.PORT || "8088", 10);
const BOT_TOKEN = process.env.BOT_TOKEN || "merhab-bot-dev";

// نافذة التأخير بين الرسائل (مللي ثانية) — تحاكي تنقّل الإنسان بين المحادثات
const MIN_GAP_MS = parseInt(process.env.MIN_GAP_MS || "9000", 10);
const MAX_GAP_MS = parseInt(process.env.MAX_GAP_MS || "23000", 10);
// سرعة "الكتابة" التقريبية لكل حرف، وحدّها الأقصى
const TYPE_MS_PER_CHAR = parseInt(process.env.TYPE_MS_PER_CHAR || "55", 10);
const TYPE_MAX_MS = parseInt(process.env.TYPE_MAX_MS || "9000", 10);
// فترة راحة طويلة كل عدد عشوائي من الرسائل
const BREAK_EVERY_MIN = parseInt(process.env.BREAK_EVERY_MIN || "14", 10);
const BREAK_EVERY_MAX = parseInt(process.env.BREAK_EVERY_MAX || "24", 10);
const BREAK_MS_MIN = parseInt(process.env.BREAK_MS_MIN || "60000", 10);
const BREAK_MS_MAX = parseInt(process.env.BREAK_MS_MAX || "180000", 10);
// الحدّ الأقصى للرسائل في الساعة
const MAX_PER_HOUR = parseInt(process.env.MAX_PER_HOUR || "50", 10);

// ===== الحالة الداخلية =====
const queue = [];
let processing = false;
let reviving = false;
let ready = false;
let waState = "starting"; // starting | qr | authenticated | ready | disconnected
let lastError = "";
let nextSendAt = 0; // طابع زمني تقريبي للإرسال التالي (للعرض فق)
let sentSinceBreak = 0;
let breakThreshold = randomInt(BREAK_EVERY_MIN, BREAK_EVERY_MAX);
const stats = { sent: 0, failed: 0, queued: 0 };
let hourWindowStart = Date.now();
let sentThisHour = 0;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

// نسخة واتساب-ويب معروفة الاستقرار لتفادي خطأ "تعذّر الربط" (Couldn't link device).
// يمكن تجاوزها عبر WWEB_VERSION_URL عند الحاجة لتحديثها مستقبلاً.
const WWEB_VERSION_URL =
  process.env.WWEB_VERSION_URL ||
  "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1041842691-alpha.html";

// ===== عميل واتساب =====
const client = new Client({
  authStrategy: new LocalAuth({ clientId: "merhab", dataPath: "./.wwebjs_auth" }),
  webVersionCache: { type: "remote", remotePath: WWEB_VERSION_URL },
  puppeteer: {
    headless: true,
    executablePath: BROWSER_PATH,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
    ],
  },
});

client.on("qr", (qr) => {
  waState = "qr";
  ready = false;
  lastQr = qr;
  console.log("\n[مرحّاب-بوت] امسح رمز QR التالي من واتساب على هاتفك:\n");
  qrcode.generate(qr, { small: true });
  console.log("\n(الأجهزة المرتبطة ← ربط جهاز)\n");
  // حفظ نسخة صورة PNG لعرضها/مسحها خارج الطرفية
  QRImage.toFile(QR_PNG_PATH, qr, { width: 360, margin: 2 }).catch((e) =>
    console.warn("[مرحّاب-بوت] تعذّر حفظ صورة QR:", e.message)
  );
});

client.on("authenticated", () => {
  waState = "authenticated";
  console.log("[مرحّاب-بوت] تمت المصادقة بنجاح.");
});

client.on("ready", () => {
  ready = true;
  waState = "ready";
  lastError = "";
  lastQr = "";
  fs.promises.unlink(QR_PNG_PATH).catch(() => {});
  console.log("[مرحّاب-بوت] البوت جاهز للإرسال ✅");
  processQueue();
});

client.on("auth_failure", (msg) => {
  ready = false;
  waState = "disconnected";
  lastError = `فشل المصادقة: ${msg}`;
  console.error("[مرحّاب-بوت]", lastError);
});

client.on("disconnected", (reason) => {
  ready = false;
  waState = "disconnected";
  lastError = `انقطع الاتصال: ${reason}`;
  console.warn("[مرحّاب-بوت]", lastError);
});

// ===== معالجة الطابور بمحاكاة بشرية =====
async function humanSend(item) {
  // التحقق من تسجيل الرقم في واتساب
  const numberId = await client.getNumberId(item.to);
  if (!numberId) {
    throw new Error("الرقم غير مسجّل في واتساب");
  }
  const chatId = numberId._serialized;

  // محاكاة: فتح المحادثة + مؤشّر كتابة لمدة تتناسب مع طول الرسالة
  const typingMs = Math.min(item.message.length * TYPE_MS_PER_CHAR, TYPE_MAX_MS);
  try {
    const chat = await client.getChatById(chatId);
    await chat.sendStateTyping();
    await sleep(typingMs + randomInt(400, 1500));
    await chat.clearState();
  } catch (_) {
    // لو تعذّر مؤشّر الكتابة نكمل الإرسال عادياً
    await sleep(typingMs);
  }

  await client.sendMessage(chatId, item.message);
}

/**
 * إعادة تهيئة العميل عند انقطاع الإطار (detached Frame) أو إغلاق الجلسة.
 * الجلسة محفوظة عبر LocalAuth فلا حاجة لإعادة مسح QR.
 */
async function reviveClient(reason) {
  if (reviving) return;
  reviving = true;
  ready = false;
  waState = "reconnecting";
  lastError = `إعادة تهيئة العميل: ${reason}`;
  console.warn("[مرحّاب-بوت] إعادة تهيئة العميل بسبب:", reason);
  try {
    await client.destroy();
  } catch (_) {
    /* تجاهل */
  }
  try {
    await client.initialize(); // سيُطلق حدث ready لاحقاً ويُستأنف الطابور
  } catch (e) {
    lastError = `فشل إعادة التهيئة: ${e.message}`;
    console.error("[مرحّاب-بوت]", lastError);
  } finally {
    reviving = false;
  }
}

function isFatalSessionError(message) {
  return /detached Frame|Execution context was destroyed|Session closed|Target closed|Protocol error/i.test(
    message || ""
  );
}

async function processQueue() {
  if (processing) return;
  if (!ready) return;
  processing = true;

  while (queue.length > 0) {
    if (!ready) break;

    // إعادة ضبط نافذة الساعة
    if (Date.now() - hourWindowStart >= 3600000) {
      hourWindowStart = Date.now();
      sentThisHour = 0;
    }
    // احترام الحدّ الساعي
    if (sentThisHour >= MAX_PER_HOUR) {
      const waitMs = 3600000 - (Date.now() - hourWindowStart);
      console.log(
        `[مرحّاب-بوت] بلغنا الحدّ الساعي (${MAX_PER_HOUR}) — انتظار ${Math.round(
          waitMs / 1000
        )}ث`
      );
      nextSendAt = Date.now() + waitMs;
      await sleep(waitMs);
      continue;
    }

    const item = queue.shift();
    try {
      await humanSend(item);
      stats.sent += 1;
      sentThisHour += 1;
      sentSinceBreak += 1;
      console.log(
        `[مرحّاب-بوت] أُرسلت إلى ${item.to} (المتبقي: ${queue.length})`
      );
    } catch (err) {
      // خطأ جلسة قاتل (انقطاع الإطار) → أعد الرسالة للطابور وأعد تهيئة العميل
      if (isFatalSessionError(err.message)) {
        item.attempts = (item.attempts || 0) + 1;
        if (item.attempts <= 3) {
          queue.unshift(item);
        } else {
          stats.failed += 1;
          console.warn(
            `[مرحّاب-بوت] تجاوز محاولات الإرسال إلى ${item.to}`
          );
        }
        processing = false;
        await reviveClient(err.message); // سيُستأنف الطابور بعد ready
        return;
      }
      stats.failed += 1;
      console.warn(
        `[مرحّاب-بوت] فشل الإرسال إلى ${item.to}: ${err.message}`
      );
    }

    if (queue.length === 0) break;

    // فترة راحة طويلة بعد دفعة عشوائية لمحاكاة سلوك بشري
    if (sentSinceBreak >= breakThreshold) {
      const breakMs = randomInt(BREAK_MS_MIN, BREAK_MS_MAX);
      sentSinceBreak = 0;
      breakThreshold = randomInt(BREAK_EVERY_MIN, BREAK_EVERY_MAX);
      console.log(
        `[مرحّاب-بوت] فترة راحة ${Math.round(breakMs / 1000)}ث لمحاكاة الإنسان`
      );
      nextSendAt = Date.now() + breakMs;
      await sleep(breakMs);
    } else {
      // تأخير عشوائي بين كل رسالة وأخرى
      const gap = randomInt(MIN_GAP_MS, MAX_GAP_MS);
      nextSendAt = Date.now() + gap;
      await sleep(gap);
    }
  }

  processing = false;
}

// ===== واجهة HTTP =====
const app = express();
app.use(express.json({ limit: "1mb" }));

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== BOT_TOKEN) {
    return res.status(401).json({ error: "غير مصرّح" });
  }
  next();
}

app.get("/status", auth, (req, res) => {
  res.json({
    ready,
    state: waState,
    queue: queue.length,
    stats,
    next_send_in_sec: nextSendAt > Date.now()
      ? Math.round((nextSendAt - Date.now()) / 1000)
      : 0,
    error: lastError || undefined,
  });
});

app.get("/queue", auth, (req, res) => {
  res.json({ queue: queue.length, processing });
});

// رمز QR كصورة PNG لمسحه خارج الطرفية (بدون مصادقة لتسهيل الفتح في المتصفح محليًا)
app.get("/qr", (req, res) => {
  if (ready) return res.status(409).json({ ready: true, detail: "البوت مرتبط بالفعل" });
  if (!lastQr || !fs.existsSync(QR_PNG_PATH)) {
    return res.status(404).json({ detail: "لا يوجد رمز QR حاليًا، انتظر قليلًا ثم أعد المحاولة" });
  }
  res.type("png");
  fs.createReadStream(QR_PNG_PATH).pipe(res);
});

app.post("/send", auth, (req, res) => {
  const to = onlyDigits(req.body && req.body.to);
  const message = (req.body && req.body.message) || "";
  if (!to || !message.trim()) {
    return res.status(400).json({ error: "to و message مطلوبان" });
  }
  queue.push({ to, message, queuedAt: Date.now() });
  stats.queued += 1;
  // إطلاق المعالجة إن كانت متوقفة
  processQueue();
  res.status(202).json({ queued: true, position: queue.length });
});

app.listen(PORT, () => {
  console.log(`[مرحّاب-بوت] واجهة HTTP تعمل على http://127.0.0.1:${PORT}`);
  if (BROWSER_PATH) {
    console.log(`[مرحّاب-بوت] المتصفّح: ${BROWSER_PATH}`);
  } else {
    console.warn(
      "[مرحّاب-بوت] لم يُعثر على Chrome/Edge — عيّن CHROME_PATH لمسار المتصفّح."
    );
  }
  console.log("[مرحّاب-بوت] جارِ تهيئة عميل واتساب...");
});

client.initialize();

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
 *   POST /send-broadcast {to,body,watch_url} → نص البث + زر مشاهدة
 *   GET  /queue         → حجم الطابور الحالي
 */

const fs = require("fs");
const path = require("path");
const express = require("express");
const qrcode = require("qrcode-terminal");
const QRImage = require("qrcode");
const { Client, LocalAuth, MessageMedia, Poll } = require("whatsapp-web.js");

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
const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

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
/** آخر دعوة مُرسلة لكل رقم — لربط رد نعم/لا بالضيف */
const pendingRsvp = new Map();
/** ربط محادثة / استطلاع → guest_token (واتساب يستخدم LID أحياناً بدل رقم الهاتف) */
const chatGuestTokens = new Map();
const pollGuestTokens = new Map();
/** آخر الدعوات المُرسلة — احتياط عند فشل ربط LID */
const recentInvitations = [];

function rememberGuestRsvp(keys, guestToken) {
  if (!guestToken) return;
  for (const key of keys) {
    if (!key) continue;
    const raw = String(key).trim();
    if (!raw) continue;
    pendingRsvp.set(raw, guestToken);
    const digits = onlyDigits(raw);
    if (digits) pendingRsvp.set(digits, guestToken);
  }
}

function pushRecentInvitation(phone, chatId, guestToken) {
  if (!guestToken) return;
  recentInvitations.unshift({
    phone: onlyDigits(phone),
    chatId: chatId || "",
    guestToken,
    at: Date.now(),
  });
  while (recentInvitations.length > 30) recentInvitations.pop();
}

function storePollGuestToken(sentMsg, chatId, guestToken) {
  if (!guestToken || !sentMsg) return;
  const keys = new Set();
  const id = sentMsg?.id?.id || sentMsg?.id;
  const remote =
    sentMsg?.id?.remote ||
    sentMsg?.id?._serialized?.split("_")[0] ||
    chatId ||
    "";
  if (id) {
    keys.add(String(id));
    if (remote) keys.add(`${remote}:${id}`);
    if (chatId) keys.add(`${chatId}:${id}`);
  }
  const serialized = sentMsg?.id?._serialized;
  if (serialized) keys.add(serialized);
  for (const k of keys) pollGuestTokens.set(k, guestToken);
}
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

async function notifyBackendRsvp(fromDigits, text, guestToken) {
  const url = `${BACKEND_URL}/api/v1/integrations/whatsapp/bot-inbound/`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BOT_TOKEN}`,
      },
      body: JSON.stringify({
        from: fromDigits,
        text,
        guest_token: guestToken || pendingRsvp.get(fromDigits) || "",
      }),
    });
    const data = await res.json().catch(() => ({}));
    console.log(
      "[مرحّاب-بوت] RSVP backend:",
      res.status,
      data.detail || "",
      guestToken ? `(token: ${String(guestToken).slice(0, 8)}…)` : "(no token)"
    );
    if (data.ok) {
      for (const [k, v] of [...pendingRsvp.entries()]) {
        if (v === guestToken) pendingRsvp.delete(k);
      }
    }
    return data;
  } catch (e) {
    console.warn("[مرحّاب-بوت] تعذّر إبلاغ الباك-إند:", e.message);
    return null;
  }
}

/** يحوّل خيار الاستطلاع أو النص إلى نعم/لا أو null */
function normalizeRsvpText(raw) {
  const t = String(raw || "").trim().toLowerCase();
  if (!t) return null;
  if (t === "نعم" || t === "yes" || t === "اه" || t === "أيوه" || t === "ايوه" || t === "موافق") {
    return "نعم";
  }
  if (t === "لا" || t === "no" || t === "لأ" || t === "اعتذار" || t === "معتذر") {
    return "لا";
  }
  if (t.includes("نعم")) return "نعم";
  if (t.includes("لا")) return "لا";
  return null;
}

const recentRsvpKeys = new Map();

function shouldSkipDuplicateRsvp(fromDigits, text) {
  const key = `${fromDigits}:${text}`;
  const now = Date.now();
  const prev = recentRsvpKeys.get(key);
  if (prev && now - prev < 12000) return true;
  recentRsvpKeys.set(key, now);
  return false;
}

function pollMessageKey(vote) {
  const key = vote.parentMsgKey;
  if (key && key.id) {
    const remote = key.remote || key.participant || "";
    return remote ? `${remote}:${key.id}` : String(key.id);
  }
  const msg = vote.parentMessage;
  if (msg?.id?._serialized) return msg.id._serialized;
  if (msg?.id?.id) {
    const remote = msg.id.remote || msg.id.participant || "";
    return remote ? `${remote}:${msg.id.id}` : String(msg.id.id);
  }
  return "";
}

function resolveGuestToken(vote, fromDigits) {
  const pollKey = pollMessageKey(vote);
  if (pollKey && pollGuestTokens.has(pollKey)) return pollGuestTokens.get(pollKey);
  if (pollKey) {
    const idPart = pollKey.includes(":") ? pollKey.split(":").pop() : pollKey;
    if (idPart && pollGuestTokens.has(idPart)) return pollGuestTokens.get(idPart);
    for (const [k, v] of pollGuestTokens.entries()) {
      if (k === pollKey || k.endsWith(`:${idPart}`) || k.includes(idPart)) return v;
    }
  }
  const voterRaw = vote.voter || "";
  if (voterRaw && pendingRsvp.has(voterRaw)) return pendingRsvp.get(voterRaw);
  if (fromDigits && pendingRsvp.has(fromDigits)) return pendingRsvp.get(fromDigits);
  const chatId =
    vote.parentMessage?.from ||
    vote.parentMessage?.chatId ||
    vote.parentMessage?.id?.remote ||
    vote.parentMsgKey?.remote ||
    "";
  if (chatId && chatGuestTokens.has(chatId)) return chatGuestTokens.get(chatId);
  if (chatId) {
    const chatDigits = onlyDigits(chatId);
    if (chatDigits && pendingRsvp.has(chatDigits)) return pendingRsvp.get(chatDigits);
  }
  const recent = recentInvitations.filter((x) => Date.now() - x.at < 86400000);
  if (recent.length === 1) return recent[0].guestToken;
  if (chatId) {
    const match = recent.find((x) => x.chatId === chatId || x.phone === onlyDigits(chatId));
    if (match) return match.guestToken;
  }
  if (pendingRsvp.size === 1) return [...pendingRsvp.values()][0];
  return "";
}

async function resolveGuestTokenAsync(vote, fromDigits) {
  let token = resolveGuestToken(vote, fromDigits);
  if (token) return token;
  const voterId = vote.voter || "";
  if (!voterId) return "";
  try {
    const contact = await client.getContactById(voterId);
    const phone = onlyDigits(contact?.number || contact?.id?.user || "");
    if (phone && pendingRsvp.has(phone)) return pendingRsvp.get(phone);
    const serialized = contact?.id?._serialized || contact?.id?._serialized;
    if (serialized && chatGuestTokens.has(serialized)) return chatGuestTokens.get(serialized);
  } catch (_) {
    /* ignore */
  }
  try {
    const parentFrom = vote.parentMessage?.from || vote.parentMsgKey?.remote || "";
    if (parentFrom) {
      const chat = await client.getChatById(parentFrom);
      const phone = onlyDigits(chat?.id?.user || "");
      if (phone && pendingRsvp.has(phone)) return pendingRsvp.get(phone);
    }
  } catch (_) {
    /* ignore */
  }
  return "";
}

async function handleIncomingRsvp(fromDigits, rawText, guestToken) {
  const text = normalizeRsvpText(rawText);
  if (!text) return;
  if (!guestToken) return;
  if (shouldSkipDuplicateRsvp(fromDigits || guestToken, text)) return;
  await notifyBackendRsvp(fromDigits, text, guestToken);
}

client.on("message", async (msg) => {
  try {
    if (msg.fromMe) return;
    const from = onlyDigits(msg.from || msg.author || "");
    const body = (msg.body || "").trim();
    if (!from || !body) return;
    const rsvpText = normalizeRsvpText(body);
    if (!rsvpText) return;
    let guestToken =
      pendingRsvp.get(from) ||
      pendingRsvp.get(msg.from || "") ||
      pendingRsvp.get(msg.author || "");
    if (!guestToken) {
      try {
        const contact = await client.getContactById(msg.from || msg.author || "");
        guestToken = pendingRsvp.get(onlyDigits(contact?.number || contact?.id?.user || ""));
      } catch (_) {
        /* ignore */
      }
    }
    if (!guestToken && recentInvitations.length === 1) {
      guestToken = recentInvitations[0].guestToken;
    }
    if (!guestToken) return;
    await handleIncomingRsvp(from, body, guestToken);
  } catch (e) {
    console.warn("[مرحّاب-بوت] خطأ معالجة رسالة واردة:", e.message);
  }
});

/** ردود استطلاع «هل ستحضر؟» — لا تصل كرسالة نصية عادية */
client.on("vote_update", async (vote) => {
  try {
    const selected = vote.selectedOptions || [];
    if (!selected.length) return;
    const from = onlyDigits(vote.voter || "");
    const optionName = selected[0].name || selected[0].localId || "";
    let guestToken = resolveGuestToken(vote, from);
    if (!guestToken) guestToken = await resolveGuestTokenAsync(vote, from);
    console.log(
      "[مرحّاب-بوت] vote_update من",
      from,
      "→",
      optionName,
      "token:",
      guestToken ? guestToken.slice(0, 8) + "…" : "NO"
    );
    if (!guestToken) {
      console.warn("[مرحّاب-بوت] تعذّر ربط الاستطلاع بضيف — أعد إرسال الدعوة أو اكتب: نعم");
      return;
    }
    await handleIncomingRsvp(from, optionName, guestToken);
  } catch (e) {
    console.warn("[مرحّاب-بوت] خطأ vote_update:", e.message);
  }
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
async function humanSendImage(item) {
  const numberId = await client.getNumberId(item.to);
  if (!numberId) {
    throw new Error("الرقم غير مسجّل في واتساب");
  }
  const chatId = numberId._serialized;
  await sleep(randomInt(1200, 2800));
  const media = new MessageMedia(
    item.mimetype || "image/png",
    item.image_base64,
    "guest-qr.png"
  );
  await client.sendMessage(chatId, media, { caption: item.caption || "" });
}

async function humanSend(item) {
  if (item.type === "image") {
    return humanSendImage(item);
  }
  if (item.type === "cta_link") {
    const numberId = await client.getNumberId(item.to);
    if (!numberId) throw new Error("الرقم غير مسجّل في واتساب");
    const chatId = numberId._serialized;
    await sleep(randomInt(1200, 2800));
    await client.sendMessage(chatId, item.body || "📩 اضغط لفتح تفاصيل الدعوة");
    await sleep(randomInt(600, 1200));
    await client.sendMessage(chatId, item.url, { linkPreview: true });
    return;
  }
  if (item.type === "poll") {
    const numberId = await client.getNumberId(item.to);
    if (!numberId) throw new Error("الرقم غير مسجّل في واتساب");
    const chatId = numberId._serialized;
    await sleep(randomInt(1200, 2800));
    const poll = new Poll(item.question, item.options, {
      allowMultipleAnswers: false,
    });
    const sentMsg = await client.sendMessage(chatId, poll);
    if (item.guest_token) {
      rememberGuestRsvp([item.to, chatId], item.guest_token);
      chatGuestTokens.set(chatId, item.guest_token);
      storePollGuestToken(sentMsg, chatId, item.guest_token);
      pushRecentInvitation(item.to, chatId, item.guest_token);
      try {
        const contact = await client.getContactById(chatId);
        rememberGuestRsvp(
          [contact?.id?._serialized, contact?.number, contact?.lid],
          item.guest_token
        );
      } catch (_) {
        /* ignore */
      }
    }
    // يساعد مكتبة واتساب على تتبّع أصوات الاستطلاع في المحادثات الخاصة
    try {
      if (client.interface && typeof client.interface.openChatWindow === "function") {
        await client.interface.openChatWindow(chatId);
      }
    } catch (_) {
      /* اختياري */
    }
    return;
  }
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
        `[مرحّاب-بوت] أُرسلت ${item.type === "image" ? "صورة" : "رسالة"} إلى ${item.to} (المتبقي: ${queue.length})`
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

app.post("/send-invitation", auth, (req, res) => {
  const to = onlyDigits(req.body && req.body.to);
  const body = (req.body && req.body.body) || "";
  const inviteUrl = (req.body && req.body.invite_url) || "";
  const mapUrl = (req.body && req.body.map_url) || "";
  const mapButton = (req.body && req.body.map_button) || "عرض الخريطة";
  const inviteBody = (req.body && req.body.invite_body) || "📩 اضغط لفتح تفاصيل الدعوة";
  const inviteButton = (req.body && req.body.invite_button) || "فتح";
  const pollQuestion = (req.body && req.body.poll_question) || "هل ستحضر؟";
  const pollOptions = (req.body && req.body.poll_options) || ["نعم", "لا"];
  const guestToken = (req.body && req.body.guest_token) || "";

  if (!to || !body.trim()) {
    return res.status(400).json({ error: "to و body مطلوبان" });
  }

  if (guestToken) {
    rememberGuestRsvp([to], guestToken);
    client
      .getNumberId(to)
      .then(async (numberId) => {
        if (!numberId?._serialized) return;
        const chatId = numberId._serialized;
        chatGuestTokens.set(chatId, guestToken);
        rememberGuestRsvp([chatId], guestToken);
        pushRecentInvitation(to, chatId, guestToken);
        try {
          const contact = await client.getContactById(chatId);
          rememberGuestRsvp(
            [contact?.id?._serialized, contact?.number, contact?.lid],
            guestToken
          );
        } catch (_) {
          /* ignore */
        }
      })
      .catch(() => {});
  }

  queue.push({ type: "text", to, message: body, queuedAt: Date.now() });
  if (mapUrl) {
    queue.push({
      type: "text",
      to,
      message: `📍 ${mapButton}\n${mapUrl}`,
      queuedAt: Date.now(),
    });
  }
  if (inviteUrl) {
    queue.push({
      type: "cta_link",
      to,
      body: inviteBody,
      buttonLabel: inviteButton,
      url: inviteUrl,
      queuedAt: Date.now(),
    });
  }
  queue.push({
    type: "poll",
    to,
    question: pollQuestion,
    options: pollOptions,
    guest_token: guestToken,
    queuedAt: Date.now(),
  });
  stats.queued += 1 + (mapUrl ? 1 : 0) + (inviteUrl ? 1 : 0) + 1;
  processQueue();
  res.status(202).json({ queued: true, position: queue.length, interactive: true });
});

app.post("/send-broadcast", auth, (req, res) => {
  const to = onlyDigits(req.body && req.body.to);
  const body = (req.body && req.body.body) || "";
  const watchUrl = (req.body && req.body.watch_url) || "";
  const watchButton = (req.body && req.body.watch_button) || "مشاهدة";

  if (!to || !body.trim()) {
    return res.status(400).json({ error: "to و body مطلوبان" });
  }

  queue.push({ type: "text", to, message: body, queuedAt: Date.now() });
  let extra = 0;
  if (watchUrl) {
    queue.push({
      type: "cta_link",
      to,
      body: `▶️ ${watchButton}`,
      buttonLabel: watchButton,
      url: watchUrl,
      queuedAt: Date.now(),
    });
    extra += 1;
  }
  stats.queued += 1 + extra;
  processQueue();
  res.status(202).json({ queued: true, position: queue.length, broadcast: true });
});

app.post("/send", auth, (req, res) => {
  const to = onlyDigits(req.body && req.body.to);
  const message = (req.body && req.body.message) || "";
  if (!to || !message.trim()) {
    return res.status(400).json({ error: "to و message مطلوبان" });
  }
  queue.push({ type: "text", to, message, queuedAt: Date.now() });
  stats.queued += 1;
  processQueue();
  res.status(202).json({ queued: true, position: queue.length });
});

// إرسال صورة (مثل QR الضيف) — base64 PNG
app.post("/send-image", auth, (req, res) => {
  const to = onlyDigits(req.body && req.body.to);
  const image_base64 = (req.body && req.body.image_base64) || "";
  const caption = (req.body && req.body.caption) || "";
  const mimetype = (req.body && req.body.mimetype) || "image/png";
  if (!to || !image_base64) {
    return res.status(400).json({ error: "to و image_base64 مطلوبان" });
  }
  queue.push({
    type: "image",
    to,
    image_base64,
    caption,
    mimetype,
    queuedAt: Date.now(),
  });
  stats.queued += 1;
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

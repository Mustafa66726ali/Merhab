export interface GreetingReportItem {
  guest_name: string;
  content: string;
  created_at: string;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatGreetingDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const FLOWER_SETS = [
  "🌸 🌺 🌷 🌼 🌸",
  "🌺 🌷 🌸 🌼 🌺",
  "🌷 🌼 🌺 🌸 🌷",
  "🌼 🌸 🌺 🌷 🌼",
];

export function greetingsReportStyles() {
  return `
    .greetings-hero {
      background: linear-gradient(135deg, #6d28d9 0%, #a855f7 45%, #f472b6 100%);
      color: #fff;
      border-radius: 20px;
      padding: 24px 28px;
      margin-bottom: 20px;
      box-shadow: 0 16px 40px rgba(109, 40, 217, 0.22);
    }
    .greetings-hero h2 {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 800;
      color: #fff;
      border: none;
      padding: 0;
    }
    .greetings-hero p { margin: 4px 0; opacity: 0.95; font-size: 13px; }
    .greetings-flowers {
      font-size: 22px;
      letter-spacing: 10px;
      margin-top: 10px;
      opacity: 0.95;
    }
    .greetings-kpis {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 14px;
    }
    .greetings-kpi {
      background: rgba(255, 255, 255, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 14px;
      padding: 10px 12px;
      font-size: 11px;
    }
    .greetings-kpi b {
      display: block;
      font-size: 22px;
      margin-top: 4px;
    }
    .greeting-card {
      position: relative;
      border: 2px solid #f0d9ff;
      border-radius: 22px;
      padding: 22px 24px 20px;
      margin-bottom: 16px;
      background: linear-gradient(145deg, #fffefb 0%, #fff7fd 55%, #fdf4ff 100%);
      box-shadow: 0 8px 24px rgba(124, 58, 237, 0.08);
      page-break-inside: avoid;
    }
    .greeting-card::before,
    .greeting-card::after {
      position: absolute;
      font-size: 26px;
      line-height: 1;
      opacity: 0.85;
    }
    .greeting-card::before { content: "🌸"; top: 10px; right: 14px; }
    .greeting-card::after { content: "🌺"; bottom: 10px; left: 14px; }
    .greeting-card .corner-tr { position: absolute; top: 8px; left: 14px; font-size: 22px; }
    .greeting-card .corner-bl { position: absolute; bottom: 8px; right: 14px; font-size: 22px; }
    .greeting-card .flowers-line {
      text-align: center;
      font-size: 18px;
      letter-spacing: 8px;
      color: #c084fc;
      margin-bottom: 10px;
    }
    .greeting-meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px dashed #e9d5ff;
    }
    .greeting-name {
      font-size: 16px;
      font-weight: 800;
      color: #6d28d9;
    }
    .greeting-date {
      font-size: 12px;
      color: #7c6f96;
      white-space: nowrap;
    }
    .greeting-text {
      font-size: 14px;
      line-height: 1.75;
      color: #2b2048;
      white-space: pre-wrap;
      padding: 0 8px;
    }
    .greetings-empty {
      text-align: center;
      color: #928ea3;
      padding: 28px 16px;
      border: 1px dashed #e3d5ff;
      border-radius: 16px;
      background: #faf8ff;
      font-size: 13px;
    }
    @media print {
      .greetings-hero,
      .greeting-card {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `;
}

function greetingCardHtml(item: GreetingReportItem, index: number) {
  const flowers = FLOWER_SETS[index % FLOWER_SETS.length];
  return `
    <article class="greeting-card">
      <span class="corner-tr">🌷</span>
      <span class="corner-bl">🌼</span>
      <div class="flowers-line">${flowers}</div>
      <div class="greeting-meta">
        <span class="greeting-name">${escapeHtml(item.guest_name || "—")}</span>
        <span class="greeting-date">📅 ${escapeHtml(formatGreetingDateTime(item.created_at))}</span>
      </div>
      <p class="greeting-text">${escapeHtml(item.content || "")}</p>
    </article>
  `;
}

export function buildGreetingsSectionHtml(
  greetings: GreetingReportItem[],
  options?: { eventTitle?: string; compact?: boolean }
) {
  const eventTitle = options?.eventTitle?.trim() || "كل الفعاليات";
  const count = greetings.length;

  const cards =
    count > 0
      ? greetings.map((g, i) => greetingCardHtml(g, i)).join("")
      : `<p class="greetings-empty">لا توجد تهنئات من الضيوف حتى الآن — ستظهر هنا عند إرسالها من صفحة الدعوة.</p>`;

  if (options?.compact) {
    return `
      <h2>🌸 تهنئات وتبريكات الضيوف (${count})</h2>
      ${cards}
    `;
  }

  return `
    <section class="greetings-block">
      <div class="greetings-hero">
        <h2>🌸 تهنئات وتبريكات الضيوف</h2>
        <p>كلمات الشكر والتهنئة التي أرسلها الضيوف من صفحة الدعوة</p>
        <div class="greetings-flowers">🌸 🌺 🌷 🌼 🌺 🌸</div>
        <div class="greetings-kpis">
          <div class="greetings-kpi"><span>عدد التهنئات</span><b>${count}</b></div>
          <div class="greetings-kpi"><span>المناسبة</span><b style="font-size:15px">${escapeHtml(eventTitle)}</b></div>
          <div class="greetings-kpi"><span>تاريخ التقرير</span><b style="font-size:13px">${escapeHtml(new Date().toLocaleString("ar-SA"))}</b></div>
        </div>
      </div>
      ${cards}
    </section>
  `;
}

export function buildStandaloneGreetingsDocument(
  greetings: GreetingReportItem[],
  options?: { eventTitle?: string; title?: string }
) {
  const title = options?.title || "تقرير تهنئات الضيوف";
  const body = buildGreetingsSectionHtml(greetings, {
    eventTitle: options?.eventTitle,
  });

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)} — مرحّاب</title>
  <style>
    @page { margin: 14mm; }
    body {
      font-family: 'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif;
      margin: 0;
      padding: 28px;
      color: #1b1a26;
      background: linear-gradient(135deg, #fff7fb, #fff8ef);
      line-height: 1.55;
    }
    ${greetingsReportStyles()}
    .footer {
      margin-top: 24px;
      text-align: center;
      font-size: 11px;
      color: #928ea3;
    }
    .no-print { text-align: center; margin-top: 18px; }
    @media print {
      body { background: #fff; padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  ${body}
  <p class="footer">تقرير مُولَّد من نظام مرحّاب · ${escapeHtml(new Date().toLocaleString("ar-SA"))}</p>
  <div class="no-print">
    <button onclick="window.print()" style="padding:10px 20px;border-radius:10px;border:0;background:#6d28d9;color:#fff;font-weight:700;cursor:pointer">طباعة / PDF</button>
  </div>
</body>
</html>`;
}

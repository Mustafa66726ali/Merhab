import type { ReportSection } from "@/lib/api";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * تصدير قسم التقرير كـ PDF عبر نافذة طباعة (يدعم العربية بشكل كامل).
 */
export function exportSectionToPdf(section: ReportSection, generatedAt?: string) {
  const dateStr = generatedAt
    ? new Date(generatedAt).toLocaleString("ar-SA")
    : new Date().toLocaleString("ar-SA");

  const kpiRows = section.kpis
    .map(
      (k) =>
        `<tr><td style="padding:8px;border:1px solid #474557">${escapeHtml(k.label)}</td><td style="padding:8px;border:1px solid #474557;font-weight:bold">${escapeHtml(String(k.value))}</td></tr>`
    )
    .join("");

  const chartBlocks = section.charts
    .map((c) => {
      if (c.type === "heatmap") {
        const heat = c.data as { day_labels: string[]; hour_labels: string[]; matrix: number[][] };
        const rows = heat.matrix
          .map((row, di) =>
            row
              .map(
                (val, hi) =>
                  `<tr><td style="padding:6px;border:1px solid #474557">${escapeHtml(heat.day_labels[di])} ${escapeHtml(heat.hour_labels[hi])}</td><td style="padding:6px;border:1px solid #474557">${val}</td></tr>`
              )
              .join("")
          )
          .join("");
        return `<h3 style="color:#5b2eff;margin:16px 0 8px">${escapeHtml(c.title)}</h3><table style="width:100%;border-collapse:collapse;font-size:12px">${rows}</table>`;
      }
      const bar = c.data as { labels: string[]; values: number[] };
      const rows = bar.labels
        .map(
          (label, i) =>
            `<tr><td style="padding:6px;border:1px solid #474557">${escapeHtml(label)}</td><td style="padding:6px;border:1px solid #474557">${bar.values[i] ?? 0}</td></tr>`
        )
        .join("");
      return `<h3 style="color:#5b2eff;margin:16px 0 8px">${escapeHtml(c.title)}</h3><table style="width:100%;border-collapse:collapse;font-size:12px">${rows}</table>`;
    })
    .join("");

  let tableBlock = "";
  if (section.table && section.table.rows.length > 0) {
    const head = section.table.headers
      .map((h) => `<th style="padding:8px;border:1px solid #474557;background:#5b2eff;color:#fff">${escapeHtml(h)}</th>`)
      .join("");
    const body = section.table.rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td style="padding:8px;border:1px solid #474557">${escapeHtml(String(cell))}</td>`).join("")}</tr>`
      )
      .join("");
    tableBlock = `<h3 style="color:#5b2eff;margin:16px 0 8px">جدول البيانات</h3><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(section.title)} — مرحّاب</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 32px; color: #1b1a26; background: #fff; }
    h1 { color: #5b2eff; font-size: 22px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
    h2 { font-size: 16px; color: #333; margin-top: 24px; }
  </style>
</head>
<body>
  <h1>مرحّاب — ${escapeHtml(section.title)}</h1>
  <p class="meta">تاريخ التصدير: ${escapeHtml(dateStr)}</p>
  <p>${escapeHtml(section.description)}</p>
  <h2>المؤشرات الرئيسية</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px">${kpiRows}</table>
  ${chartBlocks}
  ${tableBlock}
  <p class="meta" style="margin-top:32px">تقرير مُولَّد تلقائياً من نظام مرحّاب</p>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("تعذر فتح نافذة التصدير — تحقق من إعدادات المتصفح");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export function exportFullDashboardPdf(
  title: string,
  sections: ReportSection[],
  generatedAt?: string
) {
  sections.filter((s) => s.implemented).forEach((section, i) => {
    setTimeout(() => exportSectionToPdf(section, generatedAt), i * 800);
  });
}

import type { EventDetail, EventScheduleItem } from "@/lib/api";
import { EVENT_PHASES } from "@/lib/eventPhases";
import { buildGreetingsSectionHtml, greetingsReportStyles } from "@/lib/greetingsReportHtml";
import {
  computeScheduleCoverage,
  formatDurationMinutes,
  formatScheduleClock,
  locationLabel,
  scheduleDurationMinutes,
  type ScheduleCoverage,
} from "@/components/platform-panel/schedule/scheduleUtils";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openPrintDocument(html: string) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("تعذّر فتح نافذة التصدير — تحقق من إعدادات المتصفح (النوافذ المنبثقة).");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 450);
}

function pdfShell(title: string, body: string) {
  const now = new Date().toLocaleString("ar-SA");
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)} — مرحّاب</title>
  <style>
    @page { margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial, sans-serif;
      margin: 0;
      padding: 28px;
      color: #1b1a26;
      background: #fff;
      line-height: 1.55;
    }
    .hero {
      background: linear-gradient(135deg, #5b2eff 0%, #7b52ff 55%, #9d7bff 100%);
      color: #fff;
      border-radius: 16px;
      padding: 28px 32px;
      margin-bottom: 24px;
    }
    .hero h1 { margin: 0 0 8px; font-size: 26px; font-weight: 800; }
    .hero .meta { opacity: 0.92; font-size: 13px; margin: 4px 0; }
    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.35);
      border-radius: 999px;
      padding: 4px 14px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 20px 0;
    }
    .kpi {
      border: 1px solid #e3e0f1;
      border-radius: 12px;
      padding: 14px 16px;
      background: #faf9ff;
    }
    .kpi label { display: block; font-size: 11px; color: #6b6580; font-weight: 700; margin-bottom: 6px; }
    .kpi strong { font-size: 22px; color: #5b2eff; }
    h2 {
      color: #5b2eff;
      font-size: 17px;
      margin: 28px 0 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid #e8e4ff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 8px;
    }
    th {
      background: #5b2eff;
      color: #fff;
      padding: 10px 8px;
      text-align: right;
      font-weight: 700;
    }
    td {
      padding: 9px 8px;
      border: 1px solid #ddd9ec;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #faf9ff; }
    .bar-wrap {
      height: 8px;
      background: #eceaf5;
      border-radius: 999px;
      overflow: hidden;
      margin-top: 6px;
    }
    .bar {
      height: 100%;
      background: linear-gradient(90deg, #5b2eff, #9d7bff);
      border-radius: 999px;
    }
    .section-card {
      border: 1px solid #e3e0f1;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 10px;
      background: #fff;
    }
    .muted { color: #6b6580; font-size: 11px; }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e3e0f1;
      font-size: 11px;
      color: #928ea3;
      text-align: center;
    }
    .timeline-row td:first-child { white-space: nowrap; font-weight: 700; color: #5b2eff; }
    .empty { text-align: center; color: #928ea3; padding: 24px; font-size: 13px; }
    ${greetingsReportStyles()}
    @media print {
      body { padding: 0; }
      .hero { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${body}
  <p class="footer">تقرير مُولَّد تلقائياً من نظام مرحّاب · ${escapeHtml(now)}</p>
</body>
</html>`;
}

function formatEventDate(date: string, time: string) {
  if (!date) return "—";
  try {
    const d = new Date(date);
    const dateStr = d.toLocaleDateString("ar-SA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return time ? `${dateStr} · ${time}` : dateStr;
  } catch {
    return date;
  }
}

function locationText(event: EventDetail) {
  const loc = (event.location || "").trim();
  if (loc && loc !== "—") return loc;
  const venue = (event.venue || "").trim();
  const geo = (event.geo_address || "").trim();
  if (venue && geo) return `${venue} — ${geo}`;
  return venue || geo || "—";
}

function kpiBlock(label: string, value: string | number) {
  return `<div class="kpi"><label>${escapeHtml(label)}</label><strong>${escapeHtml(String(value))}</strong></div>`;
}

function scheduleTableRows(schedules: EventScheduleItem[]) {
  if (!schedules.length) {
    return `<tr><td colspan="5" class="empty">لا توجد أنشطة في الجدول الزمني</td></tr>`;
  }
  return [...schedules]
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .map(
      (item, i) => `<tr class="timeline-row">
        <td>${escapeHtml(formatScheduleClock(item.start_time))} – ${escapeHtml(formatScheduleClock(item.end_time))}</td>
        <td><strong>${escapeHtml(item.title)}</strong>${item.description ? `<br/><span class="muted">${escapeHtml(item.description)}</span>` : ""}</td>
        <td>${escapeHtml(locationLabel(item.location))}</td>
        <td>${escapeHtml(formatDurationMinutes(scheduleDurationMinutes(item)))}</td>
        <td>${i + 1}</td>
      </tr>`
    )
    .join("");
}

function statsKpiGrid(event: EventDetail) {
  const s = event.stats;
  return `<div class="kpi-grid">
    ${kpiBlock("إجمالي المدعوين", s?.guests_total ?? 0)}
    ${kpiBlock("مؤكد الحضور", s?.confirmed ?? 0)}
    ${kpiBlock("حضر فعلياً", s?.attended ?? 0)}
    ${kpiBlock("جلس", s?.seated ?? 0)}
    ${kpiBlock("معتذر", s?.declined ?? 0)}
    ${kpiBlock("لم يرد", s?.no_response ?? 0)}
    ${kpiBlock("نسبة التأكيد", `${s?.confirmation_rate ?? 0}%`)}
    ${kpiBlock("نسبة الحضور", `${s?.attendance_rate ?? 0}%`)}
    ${kpiBlock("اكتمال التحضيرات", `${event.completion_percent}%`)}
  </div>`;
}

function sectionsBlock(event: EventDetail) {
  if (!event.sections?.length) {
    return `<p class="empty">لا توجد أقسام مُسجّلة لهذه المناسبة.</p>`;
  }
  return event.sections
    .map((sec) => {
      const pct =
        sec.guests_count > 0
          ? Math.round((sec.guests_confirmed / sec.guests_count) * 100)
          : 0;
      const groups =
        sec.groups?.length > 0
          ? sec.groups
              .map(
                (g) =>
                  `<span class="muted">${escapeHtml(g.name)} (${g.guests_confirmed}/${g.guests_count})</span>`
              )
              .join(" · ")
          : "<span class=\"muted\">—</span>";
      return `<div class="section-card">
        <strong style="color:${escapeHtml(sec.color || "#5b2eff")}">${escapeHtml(sec.name)}</strong>
        <span class="muted"> · ${sec.guests_confirmed} / ${sec.guests_count} مؤكّد</span>
        <div class="bar-wrap"><div class="bar" style="width:${pct}%"></div></div>
        <p class="muted" style="margin-top:8px">المجموعات: ${groups}</p>
      </div>`;
    })
    .join("");
}

function phasesBlock(event: EventDetail) {
  const doneThreshold = event.completion_percent;
  return EVENT_PHASES.map((phase, i) => {
    const threshold = (i + 1) * 20;
    const done = doneThreshold >= threshold || event.phase === "completed";
    return `<tr>
      <td>${escapeHtml(phase.label)}</td>
      <td>${done ? "✓ مكتمل" : "—"}</td>
    </tr>`;
  }).join("");
}

/** تصدير الجدول الزمني للفعالية كـ PDF (طباعة). */
export function exportScheduleToPdf(
  event: EventDetail,
  schedules: EventScheduleItem[],
  coverage?: ScheduleCoverage
) {
  const cov =
    coverage ??
    computeScheduleCoverage(
      event.date,
      event.time,
      event.end_date,
      event.end_time,
      schedules
    );

  const coverageLabel =
    cov.percent === null ? "—" : `${cov.percent}%`;

  const body = `
    <div class="hero">
      <div class="badge">الجدول الزمني</div>
      <h1>${escapeHtml(event.title)}</h1>
      <p class="meta">📅 ${escapeHtml(formatEventDate(event.date, event.time))}</p>
      <p class="meta">📍 ${escapeHtml(locationText(event))}</p>
      <p class="meta">الحالة: ${escapeHtml(event.status_label)}</p>
    </div>

    <div class="kpi-grid">
      ${kpiBlock("عدد الأنشطة", schedules.length)}
      ${kpiBlock("المدة المخططة", formatDurationMinutes(cov.plannedMinutes))}
      ${kpiBlock("تغطية الوقت", coverageLabel)}
    </div>

    <h2>خط زمني الأنشطة</h2>
    <table>
      <thead>
        <tr>
          <th>الوقت</th>
          <th>النشاط</th>
          <th>الموقع</th>
          <th>المدة</th>
          <th>#</th>
        </tr>
      </thead>
      <tbody>${scheduleTableRows(schedules)}</tbody>
    </table>`;

  openPrintDocument(pdfShell(`جدول ${event.title}`, body));
}

/** تصدير تقرير شامل للفعالية — جذاب وعصري عبر PDF (طباعة). */
export function exportEventReportToPdf(event: EventDetail) {
  const loc = locationText(event);
  const s = event.stats;

  const teamRows = [
    ["مالك/منشئ المناسبة", event.owner_name || event.created_by_name || "—"],
    ["مدير الفعالية", event.event_manager !== "—" ? event.event_manager : "—"],
    ["منظم الفعالية", event.event_organizer !== "—" ? event.event_organizer : "—"],
    ["المرحلة الحالية", event.phase_label],
    ["اكتمال التحضيرات", `${event.completion_percent}%`],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="font-weight:700;width:38%">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`
    )
    .join("");

  const activityRows =
    event.recent_activity?.length > 0
      ? event.recent_activity
          .slice(0, 12)
          .map(
            (a) =>
              `<tr><td>${escapeHtml(a.message)}</td><td style="white-space:nowrap">${escapeHtml(new Date(a.at).toLocaleString("ar-SA"))}</td></tr>`
          )
          .join("")
      : `<tr><td colspan="2" class="empty">لا توجد تحديثات حديثة</td></tr>`;

  const lifecycleNote =
    event.status === "active" && event.started_at
      ? `تعمل منذ ${new Date(event.started_at).toLocaleString("ar-SA")}`
      : event.ended_at
        ? `انتهت ${new Date(event.ended_at).toLocaleString("ar-SA")}`
        : "—";

  const body = `
    <div class="hero">
      <div class="badge">تقرير شامل للفعالية</div>
      <h1>${escapeHtml(event.title)}</h1>
      <p class="meta">📅 ${escapeHtml(formatEventDate(event.date, event.time))}${event.end_date ? ` — ${escapeHtml(formatEventDate(event.end_date, event.end_time || ""))}` : ""}</p>
      <p class="meta">📍 ${escapeHtml(loc)}</p>
      <p class="meta">الحالة: ${escapeHtml(event.status_label)} · ${escapeHtml(lifecycleNote)}</p>
    </div>

    ${event.description?.trim() ? `<p style="margin:0 0 8px;color:#444">${escapeHtml(event.description.trim())}</p>` : ""}

    <h2>مؤشرات الضيوف والحضور</h2>
    ${statsKpiGrid(event)}

    <h2>فريق المناسبة والتحضير</h2>
    <table>${teamRows}</table>

    <h2>مراحل التحضير</h2>
    <table>
      <thead><tr><th>المرحلة</th><th>الحالة</th></tr></thead>
      <tbody>${phasesBlock(event)}</tbody>
    </table>

    <h2>الأقسام والمجموعات</h2>
    ${sectionsBlock(event)}

    <h2>الجدول الزمني (${event.schedules?.length ?? 0} نشاط)</h2>
    <table>
      <thead>
        <tr>
          <th>الوقت</th>
          <th>النشاط</th>
          <th>الموقع</th>
          <th>المدة</th>
          <th>#</th>
        </tr>
      </thead>
      <tbody>${scheduleTableRows(event.schedules ?? [])}</tbody>
    </table>

    <h2>ملخص إحصائي</h2>
    <table>
      <tr><td>إجمالي الردود</td><td>${s?.responded ?? 0}</td></tr>
      <tr><td>نسبة الاعتذار</td><td>${s?.absence_rate ?? 0}% (${s?.absence_count ?? 0})</td></tr>
      <tr><td>الحد الأقصى للضيوف</td><td>${event.max_guests || "غير محدد"}</td></tr>
      <tr><td>تاريخ الإنشاء</td><td>${escapeHtml(new Date(event.created_at).toLocaleString("ar-SA"))}</td></tr>
    </table>

    <h2>آخر التحديثات</h2>
    <table>
      <thead><tr><th>الحدث</th><th>الوقت</th></tr></thead>
      <tbody>${activityRows}</tbody>
    </table>

    ${buildGreetingsSectionHtml(event.guest_greetings ?? [], { eventTitle: event.title })}`;

  openPrintDocument(pdfShell(`تقرير ${event.title}`, body));
}

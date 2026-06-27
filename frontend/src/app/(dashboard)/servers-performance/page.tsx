"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MetricHistoryChart from "@/components/monitoring/MetricHistoryChart";
import ResourceGauge from "@/components/monitoring/ResourceGauge";
import { monitoringAPI, type SystemMonitoringData } from "@/lib/api";

const HISTORY_LEN = 16;

function formatUptime(seconds: number) {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d} يوم ${h} ساعة`;
  if (h > 0) return `${h} ساعة ${m} دقيقة`;
  return `${m} دقيقة`;
}

function formatTimeLabel() {
  return new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function statusBadge(status: string) {
  switch (status) {
    case "healthy":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
    case "warning":
      return "bg-amber-500/10 text-amber-400 border-amber-500/25";
    case "error":
      return "bg-red-500/10 text-red-400 border-red-500/25";
    default:
      return "bg-surface-container-highest text-on-surface-variant border-outline-variant/20";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "healthy":
      return "يعمل";
    case "warning":
      return "تحذير";
    case "error":
      return "خطأ";
    default:
      return status;
  }
}

export default function ServersPerformancePage() {
  const [data, setData] = useState<SystemMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [cpuHistory, setCpuHistory] = useState<{ labels: string[]; values: number[] }>({
    labels: [],
    values: [],
  });
  const [memHistory, setMemHistory] = useState<{ labels: string[]; values: number[] }>({
    labels: [],
    values: [],
  });
  const loadingRef = useRef(false);

  const pushHistory = useCallback((cpu: number, mem: number) => {
    const label = formatTimeLabel();
    setCpuHistory((prev) => ({
      labels: [...prev.labels, label].slice(-HISTORY_LEN),
      values: [...prev.values, cpu].slice(-HISTORY_LEN),
    }));
    setMemHistory((prev) => ({
      labels: [...prev.labels, label].slice(-HISTORY_LEN),
      values: [...prev.values, mem].slice(-HISTORY_LEN),
    }));
  }, []);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const res = await monitoringAPI.overview();
      setData(res.data);
      pushHistory(res.data.cpu.percent, res.data.memory.percent);
      setLastUpdated(
        new Date(res.data.timestamp).toLocaleTimeString("ar-SA", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [pushHistory]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-4 py-16 text-center text-on-surface-variant">
        فشل تحميل بيانات الخادم
      </div>
    );
  }

  const gaugeColor = (p: number) => {
    if (p >= 90) return "amber" as const;
    if (p >= 75) return "tertiary" as const;
    return "primary" as const;
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container/20 shadow-lg shadow-primary-container/20">
            <span className="material-symbols-outlined text-primary text-xl">dns</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
              الخوادم والأداء
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              مراقبة حالة الخادم والموارد والخدمات في الوقت الفعلي
            </p>
            {lastUpdated && (
              <p className="text-[10px] text-outline mt-1">آخر تحديث: {lastUpdated}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              autoRefresh
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-outline-variant/30 text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {autoRefresh ? "sync" : "sync_disabled"}
            </span>
            تحديث تلقائي (15ث)
          </button>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-primary-container/30 bg-primary-container/10 text-primary hover:bg-primary-container/20 transition-all"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            تحديث الآن
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <ResourceGauge
          label="المعالج CPU"
          percent={data.cpu.percent}
          detail={`${data.server.cpu_count} نوى`}
          color={gaugeColor(data.cpu.percent)}
          icon="memory"
        />
        <ResourceGauge
          label="الذاكرة RAM"
          percent={data.memory.percent}
          detail={`${data.memory.used_gb} / ${data.memory.total_gb} GB`}
          color={gaugeColor(data.memory.percent)}
          icon="sd_card"
        />
        <ResourceGauge
          label="التخزين Disk"
          percent={data.disk.percent}
          detail={`${data.disk.used_gb} / ${data.disk.total_gb} GB`}
          color={gaugeColor(data.disk.percent)}
          icon="storage"
        />
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5 flex flex-col justify-center">
          <span className="material-symbols-outlined text-emerald-400 text-lg mb-2">schedule</span>
          <p className="text-[10px] font-bold text-on-surface-variant">مدة التشغيل</p>
          <p className="text-lg sm:text-xl font-extrabold text-on-surface font-headline mt-1">
            {formatUptime(data.uptime_seconds)}
          </p>
          <p className="text-[10px] text-outline mt-1 truncate">{data.server.hostname}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <MetricHistoryChart
          title="استخدام المعالج"
          subtitle="آخر القراءات المباشرة"
          labels={cpuHistory.labels}
          values={cpuHistory.values}
          unit="%"
        />
        <MetricHistoryChart
          title="استخدام الذاكرة"
          subtitle="آخر القراءات المباشرة"
          labels={memHistory.labels}
          values={memHistory.values}
          unit="%"
          color="tertiary"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6">
          <h3 className="text-lg font-bold text-on-surface mb-4">حالة الخدمات</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.services.map((svc) => (
              <div
                key={svc.id}
                className="rounded-xl border border-outline-variant/10 bg-surface-container/40 p-4 hover:border-primary-container/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-on-surface">{svc.name}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge(svc.status)}`}
                  >
                    {statusLabel(svc.status)}
                  </span>
                </div>
                <p className="text-[10px] text-on-surface-variant truncate">{svc.detail}</p>
                {svc.latency_ms > 0 && (
                  <p className="text-xs text-primary font-bold mt-2 tabular-nums">
                    {svc.latency_ms} ms
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6">
          <h3 className="text-lg font-bold text-on-surface mb-4">معلومات الخادم</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">النظام</dt>
              <dd className="font-medium text-on-surface text-right text-xs">{data.server.os}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">Python</dt>
              <dd className="font-mono text-xs text-on-surface">{data.server.python_version}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">Django</dt>
              <dd className="font-mono text-xs text-on-surface">{data.server.django_version}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">قاعدة البيانات</dt>
              <dd className="text-xs text-on-surface">{data.database.vendor}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">زمن الاستجابة DB</dt>
              <dd className="text-xs font-bold text-emerald-400 tabular-nums">
                {data.database.latency_ms} ms
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">الشبكة ↑</dt>
              <dd className="text-xs tabular-nums">{data.network.bytes_sent_mb} MB</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">الشبكة ↓</dt>
              <dd className="text-xs tabular-nums">{data.network.bytes_recv_mb} MB</dd>
            </div>
            {!data.psutil_available && (
              <p className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5">
                تثبيت psutil لمزيد من تفاصيل الأداء
              </p>
            )}
          </dl>
        </div>
      </section>

      {data.cpu.per_core.length > 0 && (
        <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6">
          <h3 className="text-lg font-bold text-on-surface mb-4">استخدام النوى</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {data.cpu.per_core.map((p, i) => (
              <div key={i} className="rounded-xl bg-surface-container/50 p-3 border border-outline-variant/10">
                <p className="text-[10px] text-on-surface-variant mb-2">نواة {i + 1}</p>
                <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-container to-primary rounded-full transition-all duration-500"
                    style={{ width: `${p}%` }}
                  />
                </div>
                <p className="text-xs font-bold text-primary mt-1 tabular-nums">{p}%</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "المنصات", value: data.business.platforms, icon: "dns" },
          { label: "الفعاليات", value: data.business.events, icon: "celebration" },
          { label: "المستخدمين", value: data.business.users, icon: "group" },
          { label: "المدعوين", value: data.business.guests, icon: "person_add" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 text-center"
          >
            <span className="material-symbols-outlined text-primary text-lg mb-1 block">{item.icon}</span>
            <p className="text-[10px] font-bold text-on-surface-variant">{item.label}</p>
            <p className="text-xl font-extrabold text-on-surface font-headline tabular-nums">
              {item.value.toLocaleString("ar-SA")}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}

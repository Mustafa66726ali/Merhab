"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EventPageHeader from "@/components/platform-panel/EventPageHeader";
import SeatingPlanCanvas from "@/components/platform-panel/seating/SeatingPlanCanvas";
import EventSeatingCanvasEditor from "@/components/platform-panel/seating/EventSeatingCanvasEditor";
import QrScanner from "@/components/common/QrScanner";
import {
  eventsAPI,
  seatingPlansAPI,
  tablesAPI,
  type EventSeatingOverviewResponse,
  type EventSeatingPlan,
  type EventSeatingTable,
} from "@/lib/api";

interface SectionOption {
  id: number;
  name: string;
  color: string;
}
interface GroupOption {
  id: number;
  name: string;
  color: string;
  section_id: number | null;
  section_name: string;
}

interface EventSeatingManagerProps {
  eventId: number;
  eventsBasePath?: string;
  canManage?: boolean;
}

const SHAPES = [
  { value: "round", label: "دائري", icon: "circle" },
  { value: "rectangle", label: "مستطيل", icon: "rectangle" },
  { value: "square", label: "مربع", icon: "square" },
];

function errMessage(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (data) {
    const first = Object.values(data)[0];
    if (typeof first === "string") return first;
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    if (typeof data.detail === "string") return data.detail;
  }
  return fallback;
}

export default function EventSeatingManager({
  eventId,
  eventsBasePath = "/event-organizer/events",
  canManage = true,
}: EventSeatingManagerProps) {
  const [data, setData] = useState<EventSeatingOverviewResponse | null>(null);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [manageTableId, setManageTableId] = useState<number | null>(null);
  const [planModal, setPlanModal] = useState<{ open: boolean; plan?: EventSeatingPlan } | null>(
    null
  );
  const [tableModal, setTableModal] = useState<{ open: boolean; table?: EventSeatingTable } | null>(
    null
  );
  const [zoom, setZoom] = useState(1);
  const [seatMode, setSeatMode] = useState<"insert" | "scan">("insert");
  const [scanTarget, setScanTarget] = useState<{ tableId: number; seatNumber: number } | null>(
    null
  );
  const [scanHint, setScanHint] = useState("");

  const load = useCallback(async () => {
    try {
      const [seatRes, groupsRes] = await Promise.all([
        eventsAPI.seatingOverview(eventId),
        eventsAPI.groupsOverview(eventId),
      ]);
      setData(seatRes.data);
      setSections(groupsRes.data.sections ?? []);
      setGroups(
        (groupsRes.data.groups ?? []).map((g) => ({
          id: g.id,
          name: g.name,
          color: g.color,
          section_id: g.section_id,
          section_name: g.section_name,
        }))
      );
      setActivePlanId((prev) =>
        prev && seatRes.data.plans.some((p) => p.id === prev)
          ? prev
          : seatRes.data.plans[0]?.id ?? null
      );
      setError("");
    } catch {
      setError("تعذّر تحميل مخطط الجلوس.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const activePlan = useMemo(
    () => data?.plans.find((p) => p.id === activePlanId) ?? data?.plans[0] ?? null,
    [data, activePlanId]
  );

  const manageTable = useMemo(
    () => activePlan?.tables.find((t) => t.id === manageTableId) ?? null,
    [activePlan, manageTableId]
  );

  const handleSeatScan = useCallback(
    async (token: string) => {
      const target = scanTarget;
      if (!target) return;
      try {
        const res = await tablesAPI.scanSeat(target.tableId, {
          token,
          seat_number: target.seatNumber,
        });
        const name = res.data.seated_guest?.full_name;
        setScanHint(name ? `تم إجلاس ${name} ✓` : "تم الإجلاس بنجاح");
        setScanTarget(null);
        await load();
      } catch (e) {
        setScanHint(errMessage(e, "تعذّر الإجلاس — تأكد من تسجيل حضور الضيف أولاً"));
      }
    },
    [scanTarget, load]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  const stats = data?.stats;
  const realPlans = data?.plans.filter((p) => p.id > 0) ?? [];

  const kpis = [
    { label: "المخططات", value: realPlans.length, icon: "dashboard", tone: "primary" },
    { label: "الطاولات", value: stats?.total_tables ?? 0, icon: "table_restaurant", tone: "tertiary" },
    { label: "المقاعد", value: stats?.total_seats ?? 0, icon: "event_seat", tone: "primary" },
    { label: "تم التوزيع", value: `${stats?.occupancy_rate ?? 0}%`, icon: "groups", tone: "emerald" },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6">
      <div className="space-y-2">
        <EventPageHeader
          eventId={eventId}
          eventTitle={data?.event.title}
          currentLabel="توزيع المقاعد"
          eventsBasePath={eventsBasePath}
        />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight font-headline">
              توزيع مقاعد الفعالية
            </h1>
            <p className="text-sm text-on-surface-variant max-w-2xl leading-relaxed mt-1">
              أنشئ المخططات وأضف الطاولات واربطها بالأقسام والمجموعات، ثم وزّع الضيوف على المقاعد.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setPlanModal({ open: true })}
              className="inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container px-5 py-2.5 rounded-xl font-bold text-sm hover:brightness-110 transition-all shrink-0"
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              مخطط جديد
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4"
          >
            <span
              className={`material-symbols-outlined text-lg mb-2 block ${
                card.tone === "emerald"
                  ? "text-emerald-400"
                  : card.tone === "tertiary"
                    ? "text-tertiary"
                    : "text-primary"
              }`}
            >
              {card.icon}
            </span>
            <p className="text-[10px] font-bold text-on-surface-variant leading-tight">
              {card.label}
            </p>
            <p className="text-2xl font-extrabold text-on-surface font-headline mt-1 tabular-nums">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      {realPlans.length === 0 ? (
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low py-20 text-center">
          <span className="material-symbols-outlined text-5xl text-outline/30">event_seat</span>
          <p className="text-on-surface-variant mt-3">لا توجد مخططات جلوس بعد.</p>
          {canManage && (
            <button
              type="button"
              onClick={() => setPlanModal({ open: true })}
              className="mt-4 inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              أنشئ أول مخطط
            </button>
          )}
        </div>
      ) : (
        <>
          {/* تبويبات المخططات */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {realPlans.map((plan) => (
              <div
                key={plan.id}
                className={`shrink-0 flex items-center gap-1 rounded-xl transition-all ${
                  activePlan?.id === plan.id
                    ? "bg-primary-container text-on-primary-container shadow-lg shadow-primary-container/20"
                    : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActivePlanId(plan.id);
                    setManageTableId(null);
                  }}
                  className="px-4 sm:px-5 py-2.5 text-sm font-bold"
                >
                  {plan.name}
                  <span className="mr-2 text-xs opacity-70 tabular-nums">
                    ({plan.tables.length})
                  </span>
                </button>
                {canManage && activePlan?.id === plan.id && (
                  <div className="flex items-center pl-1.5 gap-0.5">
                    <button
                      type="button"
                      title="تعديل المخطط"
                      onClick={() => setPlanModal({ open: true, plan })}
                      className="p-1 rounded-lg hover:bg-black/10"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                    <button
                      type="button"
                      title="حذف المخطط"
                      onClick={async () => {
                        if (!window.confirm(`حذف مخطط «${plan.name}» وكل طاولاته؟`)) return;
                        try {
                          await seatingPlansAPI.delete(plan.id);
                          await load();
                        } catch (e) {
                          setError(errMessage(e, "تعذّر حذف المخطط."));
                        }
                      }}
                      className="p-1 rounded-lg hover:bg-black/10"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {activePlan && (
            <div className="grid grid-cols-12 gap-4 sm:gap-6">
              {/* المخطط المرئي + إدارة الطاولات */}
              <div className="col-span-12 lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-on-surface-variant">
                    {activePlan.description || `مخطط: ${activePlan.name}`}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {canManage && (
                      <div className="inline-flex items-center bg-surface-container-high rounded-xl p-1 gap-1">
                        <button
                          type="button"
                          onClick={() => setSeatMode("insert")}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            seatMode === "insert"
                              ? "bg-primary text-on-primary"
                              : "text-on-surface-variant hover:text-on-surface"
                          }`}
                          title="إدراج الضيوف يدوياً"
                        >
                          <span className="material-symbols-outlined text-base">touch_app</span>
                          إدراج
                        </button>
                        <button
                          type="button"
                          onClick={() => setSeatMode("scan")}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            seatMode === "scan"
                              ? "bg-primary text-on-primary"
                              : "text-on-surface-variant hover:text-on-surface"
                          }`}
                          title="إجلاس بمسح رمز QR"
                        >
                          <span className="material-symbols-outlined text-base">qr_code_scanner</span>
                          مسح
                        </button>
                      </div>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setTableModal({ open: true })}
                        className="inline-flex items-center gap-1.5 bg-primary-container text-on-primary-container px-4 py-2 rounded-xl font-bold text-xs hover:brightness-110"
                      >
                        <span className="material-symbols-outlined text-base">add</span>
                        طاولة
                      </button>
                    )}
                    {!canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => setZoom((z) => Math.min(z + 0.1, 1.4))}
                          className="w-9 h-9 bg-surface-container-high rounded-xl flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors"
                          title="تكبير"
                        >
                          <span className="material-symbols-outlined text-lg">add</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoom((z) => Math.max(z - 0.1, 0.6))}
                          className="w-9 h-9 bg-surface-container-high rounded-xl flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors"
                          title="تصغير"
                        >
                          <span className="material-symbols-outlined text-lg">remove</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {canManage && seatMode === "scan" && (
                  <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary-container/10 px-4 py-2.5 text-xs font-bold text-primary">
                    <span className="material-symbols-outlined text-base">info</span>
                    وضع المسح مُفعّل — انقر على أي كرسي فارغ ثم امسح رمز الضيف لإجلاسه (يجب تسجيل حضوره أولاً).
                    {scanHint && <span className="text-on-surface mr-auto">{scanHint}</span>}
                  </div>
                )}

                {canManage ? (
                  <EventSeatingCanvasEditor
                    plan={activePlan}
                    eventId={eventId}
                    selectedTableId={manageTableId}
                    onSelectTable={setManageTableId}
                    onEditTable={(t) => setTableModal({ open: true, table: t })}
                    onReload={load}
                    onError={setError}
                    seatMode={seatMode}
                    onScanSeat={(tableId, seatNumber) =>
                      setScanTarget({ tableId, seatNumber })
                    }
                  />
                ) : (
                  <SeatingPlanCanvas plan={activePlan} zoom={zoom} />
                )}

                {/* بطاقات الطاولات للإدارة */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activePlan.tables.length === 0 ? (
                    <p className="col-span-full text-center text-sm text-on-surface-variant py-8">
                      لا توجد طاولات — أضف طاولة لبدء التوزيع.
                    </p>
                  ) : (
                    activePlan.tables.map((table) => (
                      <div
                        key={table.id}
                        className={`rounded-2xl border bg-surface-container-low p-4 transition-colors ${
                          manageTableId === table.id
                            ? "border-primary/40 ring-1 ring-primary/30"
                            : "border-outline-variant/10"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-on-surface truncate">{table.name}</p>
                            <p className="text-xs text-on-surface-variant mt-0.5 tabular-nums">
                              {table.occupied_seats}/{table.capacity} مقعد ·{" "}
                              {SHAPES.find((s) => s.value === table.shape)?.label ?? table.shape}
                            </p>
                          </div>
                          {canManage && (
                            <div className="flex gap-0.5 shrink-0">
                              <button
                                type="button"
                                title="تعديل"
                                onClick={() => setTableModal({ open: true, table })}
                                className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary-container/10"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>
                              <button
                                type="button"
                                title="حذف"
                                onClick={async () => {
                                  if (!window.confirm(`حذف طاولة «${table.name}»؟`)) return;
                                  try {
                                    await tablesAPI.delete(table.id);
                                    if (manageTableId === table.id) setManageTableId(null);
                                    await load();
                                  } catch (e) {
                                    setError(errMessage(e, "تعذّر حذف الطاولة."));
                                  }
                                }}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/10"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {table.section_name && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{
                                background: `${table.section_color || "#5b2eff"}22`,
                                color: table.section_color || "#c8bfff",
                              }}
                            >
                              <span className="material-symbols-outlined text-[12px]">grid_view</span>
                              {table.section_name}
                            </span>
                          )}
                          {table.group_name ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{
                                background: `${table.group_color || "#5b2eff"}22`,
                                color: table.group_color || "#c8bfff",
                              }}
                            >
                              <span className="material-symbols-outlined text-[12px]">group</span>
                              {table.group_name}
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400">
                              بدون مجموعة
                            </span>
                          )}
                        </div>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() =>
                              setManageTableId((id) => (id === table.id ? null : table.id))
                            }
                            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 bg-surface-container-high text-on-surface px-3 py-2 rounded-xl font-bold text-xs hover:bg-primary-container/15"
                          >
                            <span className="material-symbols-outlined text-base">event_seat</span>
                            {manageTableId === table.id ? "إغلاق التوزيع" : "توزيع الضيوف"}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* لوحة جانبية: توزيع الضيوف على الطاولة المختارة */}
              <div className="col-span-12 lg:col-span-4">
                <div className="lg:sticky lg:top-4 space-y-4">
                  {manageTable ? (
                    <SeatAssignPanel
                      table={manageTable}
                      data={data!}
                      onClose={() => setManageTableId(null)}
                      onChanged={load}
                      onError={(m) => setError(m)}
                    />
                  ) : (
                    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5">
                      <h3 className="font-bold text-on-surface mb-1">إحصائيات الإشغال</h3>
                      <div className="flex items-end gap-2 mb-3">
                        <span className="text-3xl font-black text-on-surface tabular-nums">
                          {stats?.occupancy_rate ?? 0}%
                        </span>
                        <span className="text-xs text-on-surface-variant mb-1">تم توزيعهم</span>
                      </div>
                      <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${stats?.occupancy_rate ?? 0}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-3 tabular-nums">
                        {stats?.assigned_guests ?? 0} من {stats?.total_guests ?? 0} ضيف ·{" "}
                        {stats?.unassigned_guests ?? 0} بانتظار التوزيع
                      </p>
                      <p className="text-xs text-on-surface-variant mt-4">
                        اختر «توزيع الضيوف» على أي طاولة لإسناد الضيوف إلى مقاعدها.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {canManage && planModal?.open && (
        <PlanFormModal
          eventId={eventId}
          plan={planModal.plan}
          onClose={() => setPlanModal(null)}
          onSaved={async () => {
            setPlanModal(null);
            await load();
          }}
          onError={(m) => setError(m)}
        />
      )}

      {canManage && tableModal?.open && activePlan && (
        <TableFormModal
          eventId={eventId}
          planId={activePlan.id}
          table={tableModal.table}
          sections={sections}
          groups={groups}
          onClose={() => setTableModal(null)}
          onSaved={async () => {
            setTableModal(null);
            await load();
          }}
          onError={(m) => setError(m)}
        />
      )}

      <QrScanner
        open={!!scanTarget}
        onClose={() => setScanTarget(null)}
        onResult={handleSeatScan}
        title="إجلاس ضيف بمسح QR"
        subtitle="امسح رمز الضيف لإجلاسه على المقعد المحدد"
        hint={scanHint}
      />
    </div>
  );
}

/* ===================== لوحة توزيع الضيوف ===================== */

function SeatAssignPanel({
  table,
  data,
  onClose,
  onChanged,
  onError,
}: {
  table: EventSeatingTable;
  data: EventSeatingOverviewResponse;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const seated = table.seats.filter((s) => s.occupied);
  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.unassigned_guests
      .filter((g) => (table.group_id ? g.group_id === table.group_id : true))
      .filter((g) => (!q ? true : g.full_name.toLowerCase().includes(q)));
  }, [data.unassigned_guests, table.group_id, search]);

  const full = table.occupied_seats >= table.capacity;

  const assign = async (guestId: number) => {
    setBusy(true);
    try {
      await tablesAPI.assign(table.id, { guest_id: guestId });
      await onChanged();
    } catch (e) {
      onError(errMessage(e, "تعذّر إسناد الضيف."));
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (guestId: number) => {
    setBusy(true);
    try {
      await tablesAPI.unassign(table.id, { guest_id: guestId });
      await onChanged();
    } catch (e) {
      onError(errMessage(e, "تعذّر إزالة الضيف."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-surface-container-low overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-primary-container/10 border-b border-outline-variant/10">
        <div className="min-w-0">
          <h3 className="font-bold text-on-surface truncate">توزيع: {table.name}</h3>
          <p className="text-[11px] text-on-surface-variant tabular-nums">
            {table.occupied_seats}/{table.capacity} مقعد
            {table.group_name ? ` · ${table.group_name}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-black/10"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* الجالسون */}
        <div>
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
            على الطاولة ({seated.length})
          </p>
          {seated.length === 0 ? (
            <p className="text-xs text-on-surface-variant py-2">لا أحد بعد</p>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {seated.map((s) => (
                <div
                  key={s.seat_number}
                  className="flex items-center gap-2 bg-surface-container-high rounded-xl px-2.5 py-2"
                >
                  <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                    {s.seat_number}
                  </span>
                  <span className="text-sm text-on-surface truncate flex-1">{s.guest_name}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => s.guest_id && unassign(s.guest_id)}
                    className="p-1 rounded-lg text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                    title="إزالة"
                  >
                    <span className="material-symbols-outlined text-base">person_remove</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* المتاحون */}
        <div>
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
            ضيوف متاحون{table.group_name ? ` (مجموعة ${table.group_name})` : ""}
          </p>
          <div className="relative mb-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث عن ضيف..."
              className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl py-2.5 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <span className="material-symbols-outlined absolute right-2.5 top-2 text-on-surface-variant/60 text-lg">
              search
            </span>
          </div>
          {full ? (
            <p className="text-xs text-amber-400 py-2">الطاولة مكتملة</p>
          ) : available.length === 0 ? (
            <p className="text-xs text-on-surface-variant py-2">
              لا يوجد ضيوف متاحون{table.group_id ? " في هذه المجموعة" : ""}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {available.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={busy}
                  onClick={() => assign(g.id)}
                  className="w-full flex items-center gap-2 bg-surface-container-high rounded-xl px-2.5 py-2 hover:bg-primary-container/15 disabled:opacity-50 text-right"
                >
                  <span className="w-7 h-7 rounded-lg bg-surface-container-highest text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                    {g.initials}
                  </span>
                  <span className="text-sm text-on-surface truncate flex-1">{g.full_name}</span>
                  <span className="material-symbols-outlined text-base text-primary">add</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== نافذة المخطط ===================== */

function PlanFormModal({
  eventId,
  plan,
  onClose,
  onSaved,
  onError,
}: {
  eventId: number;
  plan?: EventSeatingPlan;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(plan?.name ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      onError("اسم المخطط مطلوب");
      return;
    }
    setBusy(true);
    try {
      if (plan) {
        await seatingPlansAPI.update(plan.id, { name: name.trim(), description });
      } else {
        await seatingPlansAPI.create({ event: eventId, name: name.trim(), description });
      }
      await onSaved();
    } catch (e) {
      onError(errMessage(e, "تعذّر حفظ المخطط."));
      setBusy(false);
    }
  };

  return (
    <ModalShell title={plan ? "تعديل المخطط" : "مخطط جديد"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="اسم المخطط">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: القاعة الرئيسية"
            className="input-field"
            autoFocus
          />
        </Field>
        <Field label="الوصف (اختياري)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="input-field resize-none"
          />
        </Field>
      </div>
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} />
    </ModalShell>
  );
}

/* ===================== نافذة الطاولة ===================== */

function TableFormModal({
  eventId,
  planId,
  table,
  sections,
  groups,
  onClose,
  onSaved,
  onError,
}: {
  eventId: number;
  planId: number;
  table?: EventSeatingTable;
  sections: SectionOption[];
  groups: GroupOption[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(table?.name ?? "");
  const [capacity, setCapacity] = useState(table?.capacity ?? 8);
  const [shape, setShape] = useState(table?.shape ?? "round");
  const [sectionId, setSectionId] = useState<number | "">(table?.section_id ?? "");
  const [groupId, setGroupId] = useState<number | "">(table?.group_id ?? "");
  const [busy, setBusy] = useState(false);

  const filteredGroups = useMemo(
    () => (sectionId ? groups.filter((g) => g.section_id === sectionId) : groups),
    [groups, sectionId]
  );

  const submit = async () => {
    if (!name.trim()) {
      onError("اسم الطاولة مطلوب");
      return;
    }
    setBusy(true);
    const payload: Record<string, unknown> = {
      name: name.trim(),
      capacity: Number(capacity) || 1,
      shape,
      section: sectionId === "" ? null : sectionId,
      group: groupId === "" ? null : groupId,
    };
    try {
      if (table) {
        await tablesAPI.update(table.id, payload);
      } else {
        await tablesAPI.create({ event: eventId, plan: planId, ...payload } as Parameters<
          typeof tablesAPI.create
        >[0]);
      }
      await onSaved();
    } catch (e) {
      onError(errMessage(e, "تعذّر حفظ الطاولة."));
      setBusy(false);
    }
  };

  return (
    <ModalShell title={table ? "تعديل الطاولة" : "طاولة جديدة"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="اسم الطاولة">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="طاولة 1"
              className="input-field"
              autoFocus
            />
          </Field>
          <Field label="عدد الكراسي">
            <input
              type="number"
              min={1}
              max={30}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="input-field"
            />
          </Field>
        </div>

        <Field label="شكل الطاولة">
          <div className="grid grid-cols-3 gap-2">
            {SHAPES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setShape(s.value)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-colors ${
                  shape === s.value
                    ? "border-primary bg-primary-container/15 text-primary"
                    : "border-outline-variant/15 text-on-surface-variant hover:border-primary/30"
                }`}
              >
                <span className="material-symbols-outlined">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="القسم (اختياري)">
          <select
            value={sectionId}
            onChange={(e) => {
              const v = e.target.value === "" ? "" : Number(e.target.value);
              setSectionId(v);
              setGroupId("");
            }}
            className="input-field"
          >
            <option value="">بدون قسم</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="المجموعة (طاولة واحدة لمجموعة واحدة)">
          <select
            value={groupId}
            onChange={(e) => {
              const v = e.target.value === "" ? "" : Number(e.target.value);
              setGroupId(v);
              const g = groups.find((x) => x.id === v);
              if (g && g.section_id) setSectionId(g.section_id);
            }}
            className="input-field"
          >
            <option value="">بدون مجموعة</option>
            {filteredGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.section_name ? ` — ${g.section_name}` : ""}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-on-surface-variant mt-1.5">
            يمكن ربط أكثر من طاولة بنفس المجموعة، لكن كل طاولة لمجموعة واحدة فقط.
          </p>
        </Field>
      </div>
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} />
    </ModalShell>
  );
}

/* ===================== عناصر مشتركة ===================== */

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface-container rounded-t-3xl sm:rounded-3xl border border-outline-variant/10 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10 sticky top-0 bg-surface-container z-10">
          <h2 className="font-bold text-on-surface">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-black/10"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-on-surface-variant mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function ModalActions({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex gap-2 mt-6">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-bold text-sm hover:bg-surface-container-highest"
      >
        إلغاء
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onSubmit}
        className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {busy && (
          <span className="animate-spin w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full" />
        )}
        حفظ
      </button>
    </div>
  );
}

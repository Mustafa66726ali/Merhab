"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeSeatPositions,
  tableDimensions,
  type TableShape,
} from "@/lib/seatingLayout";
import SeatingChair from "@/components/platform-panel/seating/SeatingChair";
import { guestTooltipSideWithCanvas } from "@/lib/seatingTooltipPlacement";
import { tablesAPI, type EventSeatingPlan, type EventSeatingTable } from "@/lib/api";

const MAX_CAPACITY = 30;
const CANVAS_SCALE = 0.5; // تصغير الطاولات لتناسب اللوحة
const MOVE_THRESHOLD = 6; // px قبل اعتبار الحركة سحباً

const SHAPE_TOOLS: { shape: TableShape; label: string; icon: string; capacity: number }[] = [
  { shape: "round", label: "طاولة دائرية", icon: "circle", capacity: 8 },
  { shape: "rectangle", label: "طاولة مستطيلة", icon: "rectangle", capacity: 8 },
  { shape: "square", label: "طاولة مربعة", icon: "square", capacity: 6 },
];

type DragKind =
  | { type: "create-table"; shape: TableShape; capacity: number; label: string }
  | { type: "create-chair" };

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

function effectivePosition(table: EventSeatingTable, index: number) {
  if (table.position_x || table.position_y) {
    return { x: table.position_x, y: table.position_y };
  }
  // توزيع شبكي افتراضي للطاولات غير المُحرّكة
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: 16 + col * 22, y: 18 + row * 30 };
}

interface EditorProps {
  plan: EventSeatingPlan;
  eventId: number;
  selectedTableId: number | null;
  onSelectTable: (id: number | null) => void;
  onEditTable: (table: EventSeatingTable) => void;
  onReload: () => Promise<void>;
  onError: (m: string) => void;
  /** "insert" = توزيع يدوي · "scan" = إجلاس بمسح QR عند النقر على كرسي فارغ */
  seatMode?: "insert" | "scan";
  onScanSeat?: (tableId: number, seatNumber: number) => void;
}

export default function EventSeatingCanvasEditor({
  plan,
  eventId,
  selectedTableId,
  onSelectTable,
  onEditTable,
  onReload,
  onError,
  seatMode = "insert",
  onScanSeat,
}: EditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragKind | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [movePreview, setMovePreview] = useState<{ id: number; x: number; y: number } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // مراجع للوصول إليها داخل مستمعي النافذة
  const dragRef = useRef<DragKind | null>(null);
  const moveRef = useRef<{ id: number; startX: number; startY: number; moved: boolean } | null>(null);
  dragRef.current = drag;

  const canvasPercent = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50, inside: false };
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.min(95, Math.max(5, x)),
      y: Math.min(92, Math.max(8, y)),
      inside: clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom,
    };
  }, []);

  const tableIdAtPoint = (clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const tableEl = el?.closest<HTMLElement>("[data-table-id]");
    return tableEl ? Number(tableEl.dataset.tableId) : null;
  };

  const createTable = useCallback(
    async (shape: TableShape, capacity: number, x: number, y: number) => {
      setBusy(true);
      try {
        const count = plan.tables.length + 1;
        await tablesAPI.create({
          event: eventId,
          plan: plan.id,
          name: `طاولة ${count}`,
          capacity,
          shape,
          position_x: x,
          position_y: y,
        });
        await onReload();
      } catch (e) {
        onError(errMessage(e, "تعذّر إنشاء الطاولة."));
      } finally {
        setBusy(false);
      }
    },
    [eventId, plan.id, plan.tables.length, onReload, onError]
  );

  const addChair = useCallback(
    async (table: EventSeatingTable) => {
      if (table.capacity >= MAX_CAPACITY) {
        onError(`الحد الأقصى ${MAX_CAPACITY} كرسياً للطاولة`);
        return;
      }
      setBusy(true);
      try {
        await tablesAPI.update(table.id, { capacity: table.capacity + 1 });
        await onReload();
      } catch (e) {
        onError(errMessage(e, "تعذّر إضافة الكرسي."));
      } finally {
        setBusy(false);
      }
    },
    [onReload, onError]
  );

  const removeChair = useCallback(
    async (table: EventSeatingTable) => {
      if (table.capacity <= table.occupied_seats) {
        onError("لا يمكن إزالة كرسي مشغول — أزل ضيفاً أولاً");
        return;
      }
      if (table.capacity <= 1) return;
      setBusy(true);
      try {
        await tablesAPI.update(table.id, { capacity: table.capacity - 1 });
        await onReload();
      } catch (e) {
        onError(errMessage(e, "تعذّر إزالة الكرسي."));
      } finally {
        setBusy(false);
      }
    },
    [onReload, onError]
  );

  const persistMove = useCallback(
    async (id: number, x: number, y: number) => {
      try {
        await tablesAPI.update(id, { position_x: x, position_y: y });
        await onReload();
      } catch (e) {
        onError(errMessage(e, "تعذّر تحديث موقع الطاولة."));
      }
    },
    [onReload, onError]
  );

  const moveSeat = useCallback(
    async (table: EventSeatingTable, seatNumber: number, x: number, y: number) => {
      const map: Record<string, { x: number; y: number }> = {
        ...(table.seat_positions || {}),
      };
      map[String(seatNumber)] = {
        x: Math.round(Math.max(-400, Math.min(400, x))),
        y: Math.round(Math.max(-400, Math.min(400, y))),
      };
      try {
        await tablesAPI.update(table.id, { seat_positions: map });
        await onReload();
      } catch (e) {
        onError(errMessage(e, "تعذّر تحديث موقع الكرسي."));
      }
    },
    [onReload, onError]
  );

  // ===== سحب عناصر لوحة الأدوات (إنشاء طاولة/كرسي) =====
  const startPaletteDrag = (kind: DragKind, e: React.PointerEvent) => {
    e.preventDefault();
    setDrag(kind);
    setGhost({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      setGhost({ x: e.clientX, y: e.clientY });
      if (dragRef.current?.type === "create-chair") {
        setDropTargetId(tableIdAtPoint(e.clientX, e.clientY));
      }
    };
    const onUp = (e: PointerEvent) => {
      const current = dragRef.current;
      if (current?.type === "create-table") {
        const pos = canvasPercent(e.clientX, e.clientY);
        if (pos.inside) createTable(current.shape, current.capacity, pos.x, pos.y);
      } else if (current?.type === "create-chair") {
        const id = tableIdAtPoint(e.clientX, e.clientY);
        const t = plan.tables.find((x) => x.id === id);
        if (t) addChair(t);
      }
      setDrag(null);
      setGhost(null);
      setDropTargetId(null);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, canvasPercent, createTable, addChair, plan.tables]);

  // ===== سحب طاولة موجودة لتغيير موقعها =====
  const onTablePointerDown = (table: EventSeatingTable, index: number, e: React.PointerEvent) => {
    e.stopPropagation();
    if (drag) return;
    moveRef.current = { id: table.id, startX: e.clientX, startY: e.clientY, moved: false };
    const startPos = effectivePosition(table, index);

    const onMove = (ev: PointerEvent) => {
      const m = moveRef.current;
      if (!m) return;
      const dx = Math.abs(ev.clientX - m.startX);
      const dy = Math.abs(ev.clientY - m.startY);
      if (!m.moved && dx < MOVE_THRESHOLD && dy < MOVE_THRESHOLD) return;
      m.moved = true;
      ev.preventDefault();
      const pos = canvasPercent(ev.clientX, ev.clientY);
      setMovePreview({ id: m.id, x: pos.x, y: pos.y });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const m = moveRef.current;
      moveRef.current = null;
      if (!m) return;
      if (!m.moved) {
        onSelectTable(selectedTableId === m.id ? null : m.id);
        return;
      }
      const pos = canvasPercent(ev.clientX, ev.clientY);
      setMovePreview(null);
      if (Math.abs(pos.x - startPos.x) > 0.5 || Math.abs(pos.y - startPos.y) > 0.5) {
        persistMove(m.id, pos.x, pos.y);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="space-y-3">
      {/* لوحة الأدوات */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-3">
        <span className="text-[11px] font-bold text-on-surface-variant px-1">
          اسحب وأفلت:
        </span>
        {SHAPE_TOOLS.map((tool) => (
          <button
            key={tool.shape}
            type="button"
            onPointerDown={(e) =>
              startPaletteDrag(
                { type: "create-table", shape: tool.shape, capacity: tool.capacity, label: tool.label },
                e
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold cursor-grab active:cursor-grabbing hover:bg-primary-container/15 touch-none select-none"
            title={`اسحب لإضافة ${tool.label}`}
          >
            <span className="material-symbols-outlined text-base text-primary">{tool.icon}</span>
            {tool.label}
          </button>
        ))}
        <button
          type="button"
          onPointerDown={(e) => startPaletteDrag({ type: "create-chair" }, e)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold cursor-grab active:cursor-grabbing hover:bg-tertiary/15 touch-none select-none"
          title="اسحب الكرسي إلى طاولة لإضافته"
        >
          <span className="material-symbols-outlined text-base text-tertiary">chair</span>
          كرسي
        </button>
        <span className="text-[11px] text-on-surface-variant px-1 ms-auto hidden sm:inline">
          اسحب الطاولة لتحريكها · انقرها للتحديد
        </span>
      </div>

      {/* اللوحة */}
      <div
        ref={canvasRef}
        onPointerDown={() => onSelectTable(null)}
        className={`relative w-full min-h-[460px] sm:min-h-[560px] rounded-2xl border overflow-hidden transition-colors ${
          drag?.type === "create-table" ? "border-primary/50 ring-2 ring-primary/20" : "border-outline-variant/10"
        }`}
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 50% -10%, rgba(91,46,255,0.16) 0%, rgba(91,46,255,0) 55%), linear-gradient(160deg, #1b1a26 0%, #14131e 100%)",
        }}
      >
        {/* وهج علوي خفيف بلون العلامة */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[60%] h-48 rounded-full blur-[90px] opacity-30 pointer-events-none"
          style={{ background: "radial-gradient(circle, #5b2eff 0%, transparent 70%)" }}
        />

        {/* شبكة خلفية */}
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#c8bfff 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        {plan.tables.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-6">
            <span className="material-symbols-outlined text-5xl text-outline/30">table_restaurant</span>
            <p className="text-on-surface-variant mt-3 text-sm">
              اسحب طاولة من الأعلى وأفلتها هنا لبدء التصميم
            </p>
          </div>
        )}

        {plan.tables.map((table, index) => {
          const base = effectivePosition(table, index);
          const preview = movePreview?.id === table.id ? movePreview : null;
          const pos = preview ?? base;
          const selected = selectedTableId === table.id;
          const isDropTarget = dropTargetId === table.id;
          return (
            <CanvasTable
              key={table.id}
              table={table}
              x={pos.x}
              y={pos.y}
              selected={selected}
              dropHighlight={isDropTarget}
              dragging={!!preview}
              toolbarAbove={pos.y > 55}
              tooltipBelow={pos.y < 22}
              busy={busy}
              seatMode={seatMode}
              onScanSeat={(seatNumber) => onScanSeat?.(table.id, seatNumber)}
              onPointerDown={(e) => onTablePointerDown(table, index, e)}
              onMoveSeat={(seatNumber, sx, sy) => moveSeat(table, seatNumber, sx, sy)}
              onEdit={() => onEditTable(table)}
              onDelete={async () => {
                if (!window.confirm(`حذف طاولة «${table.name}»؟`)) return;
                try {
                  await tablesAPI.delete(table.id);
                  if (selectedTableId === table.id) onSelectTable(null);
                  await onReload();
                } catch (e) {
                  onError(errMessage(e, "تعذّر حذف الطاولة."));
                }
              }}
              onAddChair={() => addChair(table)}
              onRemoveChair={() => removeChair(table)}
            />
          );
        })}
      </div>

      {/* شبح السحب */}
      {drag && ghost && (
        <div
          className="fixed z-[100] pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: ghost.x, top: ghost.y }}
        >
          {drag.type === "create-chair" ? (
            <div className="w-9 h-9 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center shadow-2xl">
              <span className="material-symbols-outlined text-lg">chair</span>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-2xl flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">
                {SHAPE_TOOLS.find((t) => t.shape === drag.shape)?.icon}
              </span>
              {drag.label}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ===================== طاولة على اللوحة ===================== */

function CanvasTable({
  table,
  x,
  y,
  selected,
  dropHighlight,
  dragging,
  toolbarAbove,
  tooltipBelow,
  busy,
  seatMode,
  onScanSeat,
  onPointerDown,
  onMoveSeat,
  onEdit,
  onDelete,
  onAddChair,
  onRemoveChair,
}: {
  table: EventSeatingTable;
  x: number;
  y: number;
  selected: boolean;
  dropHighlight: boolean;
  dragging: boolean;
  toolbarAbove: boolean;
  tooltipBelow: boolean;
  busy: boolean;
  seatMode: "insert" | "scan";
  onScanSeat: (seatNumber: number) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onMoveSeat: (seatNumber: number, x: number, y: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddChair: () => void;
  onRemoveChair: () => void;
}) {
  const shape = (table.shape as TableShape) || "round";
  const dims = tableDimensions(shape);
  const w = dims.w * CANVAS_SCALE;
  const h = dims.h * CANVAS_SCALE;
  const defaults = computeSeatPositions(shape, table.capacity, w, h);
  const defaultByNumber = new Map(defaults.map((d) => [d.seatNumber, d]));
  const seatByNumber = new Map(table.seats.map((s) => [s.seat_number, s]));
  const tableRound = shape === "round";
  const tableRect = shape === "rectangle";
  const pad = 56;
  const isFull = table.capacity > 0 && table.occupied_seats >= table.capacity;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [seatPreview, setSeatPreview] = useState<{ n: number; x: number; y: number } | null>(null);
  const seatMoveRef = useRef<{ n: number; startX: number; startY: number; moved: boolean } | null>(
    null
  );

  const stop = (e: React.PointerEvent) => e.stopPropagation();

  // الموضع الفعّال للكرسي (مُعايَر بمقياس اللوحة)
  const seatPos = (seatNumber: number) => {
    if (seatPreview?.n === seatNumber) return { x: seatPreview.x, y: seatPreview.y };
    const seat = seatByNumber.get(seatNumber);
    if (seat && seat.pos_x != null && seat.pos_y != null) {
      return { x: seat.pos_x * CANVAS_SCALE, y: seat.pos_y * CANVAS_SCALE };
    }
    const d = defaultByNumber.get(seatNumber);
    return { x: d?.x ?? 0, y: d?.y ?? 0 };
  };

  const onChairPointerDown = (seatNumber: number, e: React.PointerEvent) => {
    e.stopPropagation();
    seatMoveRef.current = { n: seatNumber, startX: e.clientX, startY: e.clientY, moved: false };
    const onMove = (ev: PointerEvent) => {
      const m = seatMoveRef.current;
      if (!m) return;
      const dx = Math.abs(ev.clientX - m.startX);
      const dy = Math.abs(ev.clientY - m.startY);
      if (!m.moved && dx < MOVE_THRESHOLD && dy < MOVE_THRESHOLD) return;
      m.moved = true;
      ev.preventDefault();
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      setSeatPreview({ n: m.n, x: ev.clientX - cx, y: ev.clientY - cy });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const m = seatMoveRef.current;
      seatMoveRef.current = null;
      if (!m || !m.moved) {
        setSeatPreview(null);
        return;
      }
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const logicalX = (ev.clientX - cx) / CANVAS_SCALE;
        const logicalY = (ev.clientY - cy) / CANVAS_SCALE;
        onMoveSeat(m.n, logicalX, logicalY);
      }
      setSeatPreview(null);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      data-table-id={table.id}
      onPointerDown={onPointerDown}
      className={`absolute touch-none select-none ${dragging ? "z-50" : "z-10"}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
        cursor: dragging ? "grabbing" : "grab",
      }}
    >
      <div ref={wrapperRef} className="relative overflow-visible" style={{ width: w + pad, height: h + pad }}>
        {/* الكراسي */}
        {Array.from({ length: table.capacity }, (_, i) => i + 1).map((seatNumber) => {
          const seat = seatByNumber.get(seatNumber);
          const p = seatPos(seatNumber);
          const scanEmpty = seatMode === "scan" && !seat?.occupied;
          const draggable = selected && seatMode === "insert";
          return (
            <div
              key={seatNumber}
              onPointerDown={(e) => draggable && onChairPointerDown(seatNumber, e)}
              onClick={(e) => {
                if (scanEmpty) {
                  e.stopPropagation();
                  onScanSeat(seatNumber);
                }
              }}
              className={`absolute left-1/2 top-1/2 ${
                draggable ? "cursor-grab active:cursor-grabbing touch-none" : ""
              } ${scanEmpty ? "cursor-pointer animate-pulse" : ""}`}
              style={{ transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))` }}
              title={
                scanEmpty
                  ? "انقر لمسح رمز الضيف وإجلاسه"
                  : draggable
                    ? "اسحب لتغيير موضع الكرسي"
                    : seat?.guest_name || "مقعد"
              }
            >
              <SeatingChair
                size="sm"
                initials={seat?.initials}
                occupied={seat?.occupied}
                isVip={seat?.is_vip}
                guestName={seat?.guest_name}
                tooltipSide={guestTooltipSideWithCanvas(p.x, p.y, x, y)}
              />
            </div>
          );
        })}

        {/* جسم الطاولة */}
        <div
          className={`group/table absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center border-4 transition-all ${
            tableRound ? "rounded-full" : tableRect ? "rounded-2xl" : "rounded-xl"
          } ${
            dropHighlight
              ? "border-tertiary ring-4 ring-tertiary/30"
              : selected
                ? "border-primary ring-4 ring-primary/30"
                : isFull
                  ? "border-emerald-400/70 ring-2 ring-emerald-400/20"
                  : "border-[#7d2240]/80"
          }`}
          style={{
            width: w,
            height: h,
            backgroundImage: isFull
              ? "linear-gradient(150deg, #2b3a30 0%, #1d2a23 100%)"
              : "linear-gradient(150deg, #5e1b2e 0%, #3a0f1f 100%)",
            boxShadow: isFull
              ? "0 10px 30px rgba(16,185,129,0.18), inset 0 1px 0 rgba(255,255,255,0.06)"
              : "0 10px 28px rgba(123,34,64,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <span
            className={`text-[9px] uppercase tracking-widest tabular-nums ${
              isFull ? "text-emerald-300 font-bold" : "text-on-surface-variant opacity-70"
            }`}
          >
            {table.occupied_seats}/{table.capacity}
          </span>
          <span className="text-base font-black text-on-surface leading-none mt-0.5 px-1 text-center truncate max-w-[90%]">
            {table.name.replace(/[^\d]/g, "").slice(0, 2) || table.name.slice(0, 3)}
          </span>
          {table.group_name && (
            <span
              className="mt-1 w-3 h-3 rounded-full border border-white/25 shadow"
              style={{ background: table.group_color || "#5b2eff" }}
            />
          )}

          {/* تلميح عند التمرير: الاسم والقسم والمجموعة */}
          <div
            className={`pointer-events-none absolute left-1/2 -translate-x-1/2 opacity-0 group-hover/table:opacity-100 transition-opacity z-50 min-w-[140px] max-w-[220px] px-3 py-2 rounded-xl bg-surface-container-highest border border-outline-variant/20 shadow-2xl text-center ${
              tooltipBelow ? "top-full mt-3" : "bottom-full mb-3"
            }`}
          >
            <p className="text-xs font-bold text-on-surface truncate">{table.name}</p>
            <div className="mt-1.5 flex flex-col items-stretch gap-1">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-container text-[10px] font-bold text-on-surface">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                  style={{ background: table.section_color || "#5b2eff" }}
                />
                <span className="material-symbols-outlined text-[12px] text-on-surface-variant">
                  grid_view
                </span>
                <span className="truncate">{table.section_name || "بدون قسم"}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-container text-[10px] font-bold text-on-surface">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                  style={{ background: table.group_color || "#5b2eff" }}
                />
                <span className="material-symbols-outlined text-[12px] text-on-surface-variant">
                  group
                </span>
                <span className="truncate">{table.group_name || "بدون مجموعة"}</span>
              </span>
            </div>
          </div>
        </div>

        {/* أدوات الطاولة عند التحديد */}
        {selected && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 flex items-center gap-1 bg-surface-container-highest rounded-full px-1.5 py-1 shadow-xl border border-outline-variant/20 z-40 ${
              toolbarAbove ? "-top-1 -translate-y-full" : "-bottom-1 translate-y-full"
            }`}
            onPointerDown={stop}
          >
            <button
              type="button"
              disabled={busy}
              onClick={onRemoveChair}
              className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-black/10 disabled:opacity-40"
              title="إزالة كرسي"
            >
              <span className="material-symbols-outlined text-base">remove</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onAddChair}
              className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/15 disabled:opacity-40"
              title="إضافة كرسي"
            >
              <span className="material-symbols-outlined text-base">chair</span>
            </button>
            <span className="w-px h-4 bg-outline-variant/30" />
            <button
              type="button"
              onClick={onEdit}
              className="w-7 h-7 rounded-full flex items-center justify-center text-primary hover:bg-primary-container/15"
              title="تعديل الطاولة"
            >
              <span className="material-symbols-outlined text-base">edit</span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="w-7 h-7 rounded-full flex items-center justify-center text-red-400 hover:bg-red-400/10"
              title="حذف الطاولة"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

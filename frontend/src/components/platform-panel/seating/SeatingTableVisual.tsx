"use client";

import type { EventSeatingTable } from "@/lib/api";
import { computeSeatPositions, tableDimensions, type TableShape } from "@/lib/seatingLayout";
import { guestTooltipSideFromSeatOffset } from "@/lib/seatingTooltipPlacement";
import SeatingChair from "./SeatingChair";

interface SeatingTableVisualProps {
  table: EventSeatingTable;
}

export default function SeatingTableVisual({ table }: SeatingTableVisualProps) {
  const shape = (table.shape as TableShape) || "round";
  const { w, h } = tableDimensions(shape);
  const defaults = computeSeatPositions(shape, table.seats.length, w, h);
  const seatByNumber = new Map(table.seats.map((s) => [s.seat_number, s]));
  const seatPositions = defaults.map((d) => {
    const seat = seatByNumber.get(d.seatNumber);
    if (seat && seat.pos_x != null && seat.pos_y != null) {
      return { seatNumber: d.seatNumber, x: seat.pos_x, y: seat.pos_y };
    }
    return d;
  });

  const isFull = table.occupied_seats >= table.capacity && table.capacity > 0;
  const tableRound = shape === "round";
  const tableRect = shape === "rectangle";

  const badgeClass =
    isFull
      ? "bg-primary/10 text-primary font-bold border border-primary/20"
      : table.occupied_seats === 0
        ? "bg-surface-container-highest text-on-surface-variant"
        : "bg-surface-container-highest text-on-surface-variant";

  const meta = [table.section_name, table.group_name].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col items-center gap-4 shrink-0">
      <div
        className="relative group/table overflow-visible"
        style={{ width: w + 80, height: h + 80 }}
        title={`${table.name}${meta ? ` — ${meta}` : ""}`}
      >
        {seatPositions.map((pos) => {
          const seat = seatByNumber.get(pos.seatNumber);
          return (
            <div
              key={pos.seatNumber}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
              }}
            >
              <SeatingChair
                initials={seat?.initials}
                occupied={seat?.occupied}
                isVip={seat?.is_vip}
                guestName={seat?.guest_name}
                tooltipSide={guestTooltipSideFromSeatOffset(pos.x, pos.y)}
              />
            </div>
          );
        })}

        <div
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center border-4 ${
            tableRound ? "rounded-full" : tableRect ? "rounded-2xl" : "rounded-xl"
          } ${isFull ? "border-emerald-400/70 ring-2 ring-emerald-400/20" : "border-[#7d2240]/80"}`}
          style={{
            width: w,
            height: h,
            backgroundImage: isFull
              ? "linear-gradient(150deg, #2b3a30 0%, #1d2a23 100%)"
              : "linear-gradient(150deg, #5e1b2e 0%, #3a0f1f 100%)",
            boxShadow: isFull
              ? "0 14px 34px rgba(16,185,129,0.2), inset 0 1px 0 rgba(255,255,255,0.06)"
              : "0 14px 34px rgba(123,34,64,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <span
            className={`text-xs uppercase font-headline tracking-widest ${
              isFull ? "text-emerald-300 font-bold" : "text-on-surface-variant opacity-70"
            }`}
          >
            {isFull ? "مكتملة" : "طاولة"}
          </span>
          <span className={`text-3xl sm:text-4xl font-black ${isFull ? "text-emerald-200" : "text-on-surface"}`}>
            {table.name.replace(/[^\d]/g, "").slice(0, 2) || table.name.slice(0, 2)}
          </span>
        </div>

        {(table.section_name || table.group_name) && (
          <div className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/table:opacity-100 transition-opacity z-20 px-3 py-1.5 rounded-xl bg-surface-container-highest border border-outline-variant/20 text-[10px] text-on-surface whitespace-nowrap shadow-xl max-w-[200px] truncate">
            {meta}
          </div>
        )}
      </div>

      <span className={`px-3 py-1 rounded-full text-xs ${badgeClass} max-w-[220px] truncate text-center`}>
        {table.status_label}
        {meta && table.occupied_seats > 0 ? ` — ${meta}` : ""}
      </span>
    </div>
  );
}

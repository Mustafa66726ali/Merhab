"use client";

import type { EventSeatingPlan } from "@/lib/api";
import SeatingTableVisual from "./SeatingTableVisual";

interface SeatingPlanCanvasProps {
  plan: EventSeatingPlan;
  zoom: number;
}

export default function SeatingPlanCanvas({ plan, zoom }: SeatingPlanCanvasProps) {
  return (
    <div
      className="rounded-2xl sm:rounded-3xl overflow-hidden relative min-h-[480px] sm:min-h-[640px] shadow-inner border border-outline-variant/10"
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

      {/* وسيلة إيضاح */}
      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 z-10">
        <div className="bg-surface-container-highest/80 backdrop-blur-md px-3 sm:px-4 py-2 rounded-2xl flex items-center gap-4 sm:gap-6 text-xs sm:text-sm border border-outline-variant/10">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundImage: "linear-gradient(135deg, #6a3bff, #a78bff)" }}
            />
            <span>محجوز</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full border border-[#d98ca0]/50"
              style={{ backgroundImage: "linear-gradient(135deg, #f4a6ba, #e07a93)" }}
            />
            <span>متاح</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-[4px]"
              style={{ backgroundImage: "linear-gradient(135deg, #ffd2b3, #ff9d6e)" }}
            />
            <span>VIP</span>
          </div>
        </div>
      </div>

      {/* شبكة خلفية */}
      <div
        className="absolute inset-0 opacity-[0.045] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#c8bfff 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />

      <div className="overflow-auto max-h-[70vh] sm:max-h-[75vh] p-6 sm:p-10">
        <div
          className="relative min-w-min mx-auto transition-transform origin-center"
          style={{ transform: `scale(${zoom})` }}
        >
          {plan.tables.length === 0 ? (
            <div className="py-24 text-center text-on-surface-variant text-sm">
              لا توجد طاولات في هذا المخطط
            </div>
          ) : (
            <div className="flex flex-wrap justify-center items-start gap-x-8 sm:gap-x-12 gap-y-12 sm:gap-y-16 min-w-max">
              {plan.tables.map((table) => (
                <SeatingTableVisual key={table.id} table={table} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

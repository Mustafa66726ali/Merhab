"use client";

import type { TooltipSide } from "@/lib/seatingTooltipPlacement";
import { guestTooltipClass } from "@/lib/seatingTooltipPlacement";

interface SeatingChairProps {
  initials?: string;
  occupied?: boolean;
  isVip?: boolean;
  guestName?: string;
  size?: "sm" | "md";
  /** جانب عرض اسم الضيف عند التمرير */
  tooltipSide?: TooltipSide;
}

export default function SeatingChair({
  initials = "",
  occupied = false,
  isVip = false,
  guestName = "",
  size = "md",
  tooltipSide = "top",
}: SeatingChairProps) {
  const dim = size === "sm" ? "w-8 h-8 text-[9px]" : "w-10 h-10 text-[10px]";
  const shapeClass = occupied && isVip ? "rounded-[10px]" : "rounded-full";

  let stateClass = "";
  let style: React.CSSProperties | undefined;

  if (occupied && isVip) {
    // ضيف VIP — تدرّج مرجاني (لون tertiary للمشروع)
    stateClass = "text-[#3a1000] ring-1 ring-white/30";
    style = {
      backgroundImage: "linear-gradient(135deg, #ffd2b3 0%, #ff9d6e 100%)",
      boxShadow: "0 4px 14px rgba(255,138,92,0.45)",
    };
  } else if (occupied) {
    // مقعد مشغول — تدرّج بنفسجي (لون primary للمشروع)
    stateClass = "text-white ring-1 ring-white/20";
    style = {
      backgroundImage: "linear-gradient(135deg, #6a3bff 0%, #a78bff 100%)",
      boxShadow: "0 4px 14px rgba(91,46,255,0.5)",
    };
  } else {
    // مقعد فارغ — قرمزي فاتح
    stateClass = "border border-[#d98ca0]/50 text-transparent";
    style = {
      backgroundImage: "linear-gradient(135deg, #f4a6ba 0%, #e07a93 100%)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    };
  }

  return (
    <div
      className={`group/chair relative ${dim} ${shapeClass} flex items-center justify-center font-bold transition-all duration-150 hover:scale-110 ${stateClass}`}
      style={style}
      title={guestName || "مقعد متاح"}
    >
      {occupied ? initials : null}
      {guestName && (
        <div className={guestTooltipClass(tooltipSide)} title={guestName}>
          {guestName}
        </div>
      )}
    </div>
  );
}

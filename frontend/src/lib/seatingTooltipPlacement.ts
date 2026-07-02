export type TooltipSide = "top" | "bottom" | "left" | "right";

const THRESHOLD = 12;

/**
 * يحدّد جانب عرض اسم الضيف بناءً على موضع الكرسي بالنسبة لمركز الطاولة.
 * الكرسي أعلى الطاولة → الاسم أسفله (بعيداً عن مركز الطاولة)، وهكذا.
 */
export function guestTooltipSideFromSeatOffset(seatX: number, seatY: number): TooltipSide {
  const ax = Math.abs(seatX);
  const ay = Math.abs(seatY);

  if (ay >= ax) {
    return seatY < -THRESHOLD ? "bottom" : "top";
  }
  return seatX < -THRESHOLD ? "right" : "left";
}

/** تعديل الجانب عند قرب الطاولة من حافة اللوحة (نسب مئوية). */
export function guestTooltipSideWithCanvas(
  seatX: number,
  seatY: number,
  canvasX?: number,
  canvasY?: number
): TooltipSide {
  let side = guestTooltipSideFromSeatOffset(seatX, seatY);

  if (canvasY != null && canvasY < 18) {
    if (side === "top") side = "bottom";
  }
  if (canvasY != null && canvasY > 82) {
    if (side === "bottom") side = "top";
  }
  if (canvasX != null && canvasX < 15) {
    if (side === "left") side = "right";
  }
  if (canvasX != null && canvasX > 85) {
    if (side === "right") side = "left";
  }

  return side;
}

export function guestTooltipClass(side: TooltipSide): string {
  const base =
    "pointer-events-none absolute px-2 py-1 rounded-lg bg-surface-container-highest border border-outline-variant/20 text-[10px] text-on-surface whitespace-nowrap opacity-0 group-hover/chair:opacity-100 transition-opacity z-[60] shadow-xl max-w-[160px] truncate";
  switch (side) {
    case "top":
      return `${base} bottom-full left-1/2 -translate-x-1/2 mb-2`;
    case "bottom":
      return `${base} top-full left-1/2 -translate-x-1/2 mt-2`;
    case "left":
      return `${base} right-full top-1/2 -translate-y-1/2 mr-2`;
    case "right":
      return `${base} left-full top-1/2 -translate-y-1/2 ml-2`;
  }
}

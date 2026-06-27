/** حساب مواقع الكراسي حول الطاولة حسب الشكل */

export type TableShape = "round" | "square" | "rectangle";

export interface SeatPosition {
  x: number;
  y: number;
  seatNumber: number;
}

export function computeSeatPositions(
  shape: TableShape,
  count: number,
  tableWidth: number,
  tableHeight: number
): SeatPosition[] {
  const n = Math.max(count, 1);
  const positions: SeatPosition[] = [];

  if (shape === "round") {
    const radius = Math.max(tableWidth, tableHeight) / 2 + 28;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions.push({
        seatNumber: i + 1,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    }
    return positions;
  }

  if (shape === "square") {
    const radius = Math.max(tableWidth, tableHeight) / 2 + 28;
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions.push({
        seatNumber: i + 1,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    }
    return positions;
  }

  // rectangle — كراسي على الطولين
  const longSide = Math.max(n / 2, 1);
  let seat = 1;
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    const spread = tableWidth * 0.6;
    const x = -spread / 2 + (spread * i) / Math.max(Math.ceil(n / 2) - 1, 1);
    positions.push({ seatNumber: seat++, x, y: -tableHeight / 2 - 32 });
  }
  for (let i = 0; i < Math.floor(n / 2); i++) {
    const spread = tableWidth * 0.6;
    const x = -spread / 2 + (spread * i) / Math.max(Math.floor(n / 2) - 1, 1);
    positions.push({ seatNumber: seat++, x, y: tableHeight / 2 + 32 });
  }
  return positions.slice(0, n);
}

export function tableDimensions(shape: TableShape) {
  if (shape === "rectangle") return { w: 256, h: 128 };
  if (shape === "square") return { w: 160, h: 160 };
  return { w: 192, h: 192 };
}

"use client";

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  trend?: { value: string; positive: boolean };
  color?: "primary" | "tertiary" | "emerald" | "rose";
}

const cm: Record<string, { bg: string; text: string; glow: string }> = {
  primary: { bg: "bg-primary-container/20", text: "text-primary-fixed-dim", glow: "bg-primary/10" },
  tertiary: { bg: "bg-tertiary-container/20", text: "text-tertiary", glow: "bg-tertiary/10" },
  emerald: { bg: "bg-emerald-500/20", text: "text-emerald-400", glow: "bg-emerald-500/10" },
  rose: { bg: "bg-rose-500/20", text: "text-rose-400", glow: "bg-rose-500/10" },
};

export default function StatCard({ title, value, icon, trend, color = "primary" }: StatCardProps) {
  const c = cm[color];

  return (
    <div className="bg-surface-container-high p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
      <div
        className={
          "absolute -right-4 -top-4 w-24 h-24 " +
          c.glow +
          " rounded-full blur-2xl group-hover:opacity-100 transition-all"
        }
      />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={c.bg + " p-3 rounded-xl"}>
          <span className={"material-symbols-outlined " + c.text}>{icon}</span>
        </div>
        {trend && (
          <span
            className={
              "text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 " +
              (trend.positive ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10")
            }
          >
            {trend.value}
            <span className="material-symbols-outlined text-[14px]">
              {trend.positive ? "trending_up" : "trending_down"}
            </span>
          </span>
        )}
      </div>
      <p className="text-on-surface-variant text-sm font-medium mb-1">{title}</p>
      <h3 className="text-3xl font-headline font-extrabold text-on-surface">{value}</h3>
    </div>
  );
}

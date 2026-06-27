import os
BASE = r"d:\Merhab\frontend\src"
def w(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  OK: {path}")
def fix(s):
    return s.replace("CLOSE_", "\x3c/")

w("components/StatCard.tsx", fix('''"use client";
interface StatCardProps { title: string; value: string; icon: string; trend?: { value: string; positive: boolean }; color?: "primary" | "tertiary" | "emerald" | "rose"; }
const cm: any = {
  primary: { bg: "bg-primary-container/20", text: "text-primary-fixed-dim", glow: "bg-primary/10" },
  tertiary: { bg: "bg-tertiary-container/20", text: "text-tertiary", glow: "bg-tertiary/10" },
  emerald: { bg: "bg-emerald-500/20", text: "text-emerald-400", glow: "bg-emerald-500/10" },
  rose: { bg: "bg-rose-500/20", text: "text-rose-400", glow: "bg-rose-500/10" },
};
export default function StatCard({ title, value, icon, trend, color = "primary" }: StatCardProps) {
  const c = cm[color];
  return (
    CLOSE_div className="bg-surface-container-high p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
      CLOSE_div className={"absolute -right-4 -top-4 w-24 h-24 " + c.glow + " rounded-full blur-2xl group-hover:opacity-100 transition-all"} />
      CLOSE_div className="flex justify-between items-start mb-4 relative z-10">
        CLOSE_div className={c.bg + " p-3 rounded-xl"}>CLOSE_span className={"material-symbols-outlined " + c.text}>{icon}CLOSE_span>CLOSE_div>
        {trend && (
          CLOSE_span className={"text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 " + (trend.positive ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10")}>
            {trend.value} CLOSE_span className="material-symbols-outlined text-[14px]">{trend.positive ? "trending_up" : "trending_down"}CLOSE_span>
          CLOSE_span>
        )}
      CLOSE_div>
      CLOSE_p className="text-on-surface-variant text-sm font-medium mb-1">{title}CLOSE_p>
      CLOSE_h3 className="text-3xl font-headline font-extrabold text-on-surface">{value}CLOSE_h3>
    CLOSE_div>
  );
}
'''))
print("StatCard done")

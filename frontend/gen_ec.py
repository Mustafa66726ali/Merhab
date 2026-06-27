import os
BASE = r"d:\Merhab\frontend\src"
def w(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"OK: {path}")
def fix(s):
    return s.replace("CLOSE_", "\x3c/")

w("components/EventCard.tsx", fix('''"use client";
interface EventCardProps { title: string; status: "active" | "draft" | "completed"; organizer: string; guests: number; image: string; updatedAt: string; onView?: () => void; onEdit?: () => void; onDelete?: () => void; }
const sc: any = {
  active: { label: "نشط", grad: "from-emerald-500 to-teal-400", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  draft: { label: "مسودة", grad: "from-amber-500 to-orange-400", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  completed: { label: "مكتمل", grad: "from-blue-500 to-indigo-400", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
};
export default function EventCard(p: EventCardProps) {
  const s = sc[p.status];
  return (
    CLOSE_div className="group bg-surface-container-high rounded-2xl p-6 border border-outline-variant/5 hover:border-primary/20 transition-all duration-300 relative overflow-hidden flex flex-col h-full">
      CLOSE_div className={"absolute top-0 left-0 w-full h-1 bg-gradient-to-r " + s.grad + " opacity-50"} />
      CLOSE_div className="flex flex-row-reverse justify-between items-start mb-6">
        CLOSE_div className="flex flex-col items-end">
          CLOSE_span className={s.bg + " " + s.text + " " + s.border + " px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-2"}>{s.label}CLOSE_span>
          CLOSE_h3 className="text-lg font-bold text-on-surface">{p.title}CLOSE_h3>
        CLOSE_div>
        CLOSE_div className="w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center overflow-hidden border border-outline-variant/10 shrink-0">
          CLOSE_img className="w-full h-full object-cover" src={p.image} alt={p.title} />
        CLOSE_div>
      CLOSE_div>
      CLOSE_div className="space-y-4 mb-6 flex-grow">
        CLOSE_div className="flex flex-row-reverse items-center gap-3">
          CLOSE_span className="material-symbols-outlined text-primary/60 text-lg">personCLOSE_span>
          CLOSE_div className="text-right">CLOSE_p className="text-[10px] text-on-surface-variant uppercase">صاحب الفعاليةCLOSE_p>CLOSE_p className="text-sm font-semibold">{p.organizer}CLOSE_p>CLOSE_div>
        CLOSE_div>
        CLOSE_div className="flex flex-row-reverse items-center gap-3">
          CLOSE_span className="material-symbols-outlined text-primary/60 text-lg">groupCLOSE_span>
          CLOSE_div className="text-right">CLOSE_p className="text-[10px] text-on-surface-variant uppercase">عدد المدعوينCLOSE_p>CLOSE_p className="text-sm font-semibold">{p.guests.toLocaleString()} ضيفCLOSE_p>CLOSE_div>
        CLOSE_div>
      CLOSE_div>
      CLOSE_div className="flex flex-row-reverse justify-between items-center pt-4 border-t border-outline-variant/10">
        CLOSE_div className="flex gap-1">
          CLOSE_button onClick={p.onView} className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all">CLOSE_span className="material-symbols-outlined text-lg">visibilityCLOSE_span>CLOSE_button>
          CLOSE_button onClick={p.onEdit} className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface-container-lowest text-on-surface-variant hover:text-tertiary hover:bg-surface-container-highest transition-all">CLOSE_span className="material-symbols-outlined text-lg">editCLOSE_span>CLOSE_button>
          CLOSE_button onClick={p.onDelete} className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface-container-lowest text-on-surface-variant hover:text-error hover:bg-surface-container-highest transition-all">CLOSE_span className="material-symbols-outlined text-lg">deleteCLOSE_span>CLOSE_button>
        CLOSE_div>
        CLOSE_p className="text-xs text-on-surface-variant">{p.updatedAt}CLOSE_p>
      CLOSE_div>
    CLOSE_div>
  );
}
'''))
print("EventCard done")

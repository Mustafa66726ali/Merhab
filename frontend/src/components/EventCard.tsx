"use client";

interface EventCardProps {
  title: string;
  status: "active" | "draft" | "completed";
  organizer: string;
  guests: number;
  image: string;
  updatedAt: string;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const statusStyles = {
  active: { label: "نشط", badge: "bg-emerald-500/10 text-emerald-400", grad: "from-emerald-500 to-teal-500" },
  draft: { label: "مسودة", badge: "bg-amber-500/10 text-amber-400", grad: "from-amber-500 to-orange-500" },
  completed: { label: "مكتمل", badge: "bg-primary-container/10 text-primary", grad: "from-primary-container to-primary" },
};

export default function EventCard(props: EventCardProps) {
  const status = statusStyles[props.status];

  return (
    <div className="group bg-surface-container-high rounded-2xl p-6 border border-outline-variant/5 hover:border-primary/20 transition-all duration-300 relative overflow-hidden flex flex-col h-full">
      <div className={"absolute top-0 left-0 w-full h-1 bg-gradient-to-r " + status.grad + " opacity-50"} />

      <div className="flex flex-row-reverse justify-between items-start mb-6">
        <div className="flex flex-col items-end">
          <span className={status.badge + " px-3 py-1 rounded-full text-[10px] font-bold mb-2"}>
            {status.label}
          </span>
          <h3 className="text-lg font-bold text-on-surface">{props.title}</h3>
        </div>
        <div className="w-14 h-14 rounded-xl bg-surface-container-lowest flex items-center justify-center overflow-hidden border border-outline-variant/10 shrink-0">
          <img src={props.image} alt={props.title} className="w-full h-full object-cover" />
        </div>
      </div>

      <div className="space-y-4 mb-6 flex-grow">
        <div className="flex flex-row-reverse items-center gap-3">
          <span className="material-symbols-outlined text-primary/60 text-lg">person</span>
          <div className="text-right">
            <p className="text-[10px] text-on-surface-variant uppercase">صاحب الفعالية</p>
            <p className="text-sm font-semibold">{props.organizer}</p>
          </div>
        </div>
        <div className="flex flex-row-reverse items-center gap-3">
          <span className="material-symbols-outlined text-primary/60 text-lg">group</span>
          <div className="text-right">
            <p className="text-[10px] text-on-surface-variant uppercase">عدد المدعوين</p>
            <p className="text-sm font-semibold">{props.guests.toLocaleString()} ضيف</p>
          </div>
        </div>
      </div>

      <div className="flex flex-row-reverse justify-between items-center pt-4 border-t border-outline-variant/10">
        <div className="flex gap-1">
          {props.onView && (
            <button type="button" onClick={props.onView} className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all">
              <span className="material-symbols-outlined text-lg">visibility</span>
            </button>
          )}
          {props.onEdit && (
            <button type="button" onClick={props.onEdit} className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface-container-lowest text-on-surface-variant hover:text-tertiary hover:bg-surface-container-highest transition-all">
              <span className="material-symbols-outlined text-lg">edit</span>
            </button>
          )}
          {props.onDelete && (
            <button type="button" onClick={props.onDelete} className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface-container-lowest text-on-surface-variant hover:text-error hover:bg-surface-container-highest transition-all">
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          )}
        </div>
        <p className="text-xs text-on-surface-variant">{props.updatedAt}</p>
      </div>
    </div>
  );
}

import Link from "next/link";

interface EventPageHeaderProps {
  eventId: number;
  eventTitle?: string;
  currentLabel: string;
  subtitle?: string;
  /** جذر مسار المناسبات — افتراضي لوحة المنصة */
  eventsBasePath?: string;
}

export default function EventPageHeader({
  eventId,
  eventTitle,
  currentLabel,
  subtitle,
  eventsBasePath = "/platform/events",
}: EventPageHeaderProps) {
  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-2 text-sm text-on-surface-variant flex-wrap">
        <Link href={eventsBasePath} className="hover:text-primary transition-colors">
          المناسبات
        </Link>
        <span className="material-symbols-outlined text-base text-outline">chevron_left</span>
        <Link
          href={`${eventsBasePath}/${eventId}`}
          className="hover:text-primary transition-colors truncate max-w-[200px]"
        >
          {eventTitle || `مناسبة #${eventId}`}
        </Link>
        <span className="material-symbols-outlined text-base text-outline">chevron_left</span>
        <span className="text-on-surface font-medium">{currentLabel}</span>
      </nav>

      {subtitle && (
        <p className="text-sm text-on-surface-variant max-w-2xl leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

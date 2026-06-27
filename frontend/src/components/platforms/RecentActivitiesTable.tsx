import Link from "next/link";
import EventCoverImage from "@/components/common/EventCoverImage";
import type { PlatformActivity } from "@/lib/api";
import { activityStatusClass } from "@/components/events/eventStatus";

export default function RecentActivitiesTable({
  activities,
  subtitle = "متابعة الفعاليات المضافة مؤخراً إلى المنصة",
  viewAllHref,
  viewAllLabel = "عرض مناسبات المنصة",
}: {
  activities: PlatformActivity[];
  subtitle?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  return (
    <section className="bg-surface-container-low rounded-2xl p-4 sm:p-6 lg:p-8 border border-outline-variant/10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-on-surface">أحدث المناسبات</h3>
          <p className="text-on-surface-variant text-sm">{subtitle}</p>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-primary-container/30 bg-primary-container/10 text-primary hover:bg-primary-container/20 transition-all shrink-0"
            title={viewAllLabel}
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            {viewAllLabel}
          </Link>
        )}
      </div>

      {activities.length === 0 ? (
        <p className="text-center text-on-surface-variant py-10">لا توجد مناسبات حالياً</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right min-w-[640px]">
            <thead>
              <tr className="text-on-surface-variant text-xs font-bold border-b border-outline-variant/10">
                <th className="pb-4 px-4">المناسبة</th>
                <th className="pb-4 px-4">المنظم</th>
                <th className="pb-4 px-4 text-center">المدعوين</th>
                <th className="pb-4 px-4">الحالة</th>
                <th className="pb-4 px-4 text-left">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {activities.map((event) => (
                <tr key={event.id} className="hover:bg-surface-container-high/50 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-outline-variant/10">
                        <EventCoverImage
                          coverImage={event.cover_image}
                          alt={event.title}
                          variant="thumb"
                        />
                      </div>
                      <span className="font-bold text-sm text-on-surface">{event.title}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary-container/20 flex items-center justify-center text-[10px] text-primary font-bold">
                        {event.organizer[0]}
                      </div>
                      <span className="text-sm text-on-surface-variant">{event.organizer}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center text-sm font-bold">{event.guests}</td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 text-[10px] font-bold rounded-full border ${activityStatusClass(event.status)}`}>
                      {event.status_label}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-left text-xs text-on-surface-variant">{event.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

import Link from "next/link";
import type { PlatformStaffMember } from "@/lib/api";

export default function PlatformStaffSection({
  staff,
  platformId,
  platformName,
}: {
  staff: PlatformStaffMember[];
  platformId: number;
  platformName: string;
}) {
  return (
    <section className="bg-surface-container-low rounded-2xl p-4 sm:p-6 lg:p-8 border border-outline-variant/10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-on-surface">فريق العمل / الاستاف</h3>
          <p className="text-on-surface-variant text-sm">
            أعضاء فريق عمل المنصة المختارة
          </p>
        </div>
        <Link
          href={`/platforms/${platformId}/staff`}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-tertiary/30 bg-tertiary/10 text-tertiary hover:bg-tertiary/20 transition-all shrink-0"
          title="عرض استاف المنصة"
        >
          <span className="material-symbols-outlined text-base">groups</span>
          عرض استاف المنصة
        </Link>
      </div>

      {staff.length === 0 ? (
        <p className="text-center text-on-surface-variant py-10">لا يوجد فريق عمل مسجل</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {staff.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/10 bg-surface-container/40 hover:border-primary-container/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-tertiary-container/25 text-tertiary font-bold flex items-center justify-center shrink-0">
                {member.avatar_initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-on-surface truncate">{member.name}</p>
                <p className="text-[10px] text-on-surface-variant truncate" dir="ltr">{member.email}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-primary-container/10 text-primary shrink-0">
                {member.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import RsvpTrendsChart from "@/components/charts/RsvpTrendsChart";
import OwnerCommsModals from "@/components/platforms/OwnerCommsModals";
import PlatformStaffSection from "@/components/platforms/PlatformStaffSection";
import RecentActivitiesTable from "@/components/platforms/RecentActivitiesTable";
import { platformsAPI, type PlatformOverview, type PlatformKpis } from "@/lib/api";

const emptyKpis: PlatformKpis = {
  activities_count: 0,
  schedules_count: 0,
  staff_count: 0,
  guests_count: 0,
  attendance_rate: 0,
  confirmation_rate: 0,
};

export default function PlatformViewPage() {
  const params = useParams();
  const id = Number(params.id);
  const [data, setData] = useState<PlatformOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    platformsAPI.overview(id)
      .then((r) => setData(r.data))
      .catch(() => setError("فشل تحميل بيانات المنصة"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-red-400 mb-4">{error || "المنصة غير موجودة"}</p>
        <Link href="/platforms" className="text-primary text-sm font-bold">العودة إلى ادارة المنصات</Link>
      </div>
    );
  }

  const { platform, kpis, recent_activities, rsvp_charts, staff_preview } = data;
  const k = kpis || emptyKpis;

  const kpiCards = [
    { label: "اجمالي الفعاليات (مناسبات)", value: k.activities_count, icon: "celebration", color: "primary" },
    { label: "اجمالي الاحداث", value: k.schedules_count, icon: "event", color: "tertiary" },
    { label: "اجمالي المستخدمين / الاستاف", value: k.staff_count, icon: "group", color: "primary" },
    { label: "اجمالي المدعوين / الضيوف", value: k.guests_count, icon: "person_add", color: "tertiary" },
    { label: "نسبة حضور الضيوف", value: `${k.attendance_rate}%`, icon: "how_to_reg", color: "primary" },
    { label: "نسبة تأكيد الحضور", value: `${k.confirmation_rate}%`, icon: "mark_email_read", color: "tertiary" },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link
            href="/platforms"
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary mb-3 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
            العودة إلى ادارة المنصات
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">{platform.name}</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            المالك: <span className="text-on-surface font-medium">{platform.owner_name}</span>
            <span className="mx-2 text-outline">·</span>
            <span dir="ltr" className="font-mono text-xs">{platform.owner_email}</span>
          </p>
          <OwnerCommsModals platformId={id} ownerName={platform.owner_name} />
        </div>
        <div className="flex gap-2">
          <Link
            href={`/platforms/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-outline-variant/30 hover:bg-surface-container-high transition-all"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            تعديل
          </Link>
          <span
            className={`px-4 py-2.5 rounded-xl text-xs font-bold border ${
              platform.status === "active"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                : "bg-red-500/10 text-red-400 border-red-500/25"
            }`}
          >
            {platform.status === "active" ? "نشطة" : "محظورة"}
          </span>
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="bg-surface-container-low rounded-2xl p-5 sm:p-6 border border-outline-variant/10 relative overflow-hidden group hover:border-primary-container/30 transition-colors"
          >
            <div
              className={`absolute top-0 right-0 w-24 h-24 blur-[50px] rounded-full -mr-10 -mt-10 ${
                card.color === "tertiary" ? "bg-tertiary/10" : "bg-primary-container/10"
              }`}
            />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <span className="text-xs font-bold text-on-surface-variant tracking-wide">{card.label}</span>
              <span
                className={`material-symbols-outlined ${
                  card.color === "tertiary" ? "text-tertiary" : "text-primary"
                }`}
              >
                {card.icon}
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-on-surface font-headline relative z-10">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <RecentActivitiesTable
        activities={recent_activities}
        subtitle="متابعة الفعاليات المضافة مؤخراً إلى هذه المنصة"
        viewAllHref={`/platforms/${id}/events`}
        viewAllLabel="عرض مناسبات المنصة"
      />

      <PlatformStaffSection
        staff={staff_preview ?? []}
        platformId={id}
        platformName={platform.name}
      />

      <RsvpTrendsChart
        monthly={rsvp_charts.monthly}
        subtitle="معدل النمو الشهري للمدعوين والفعاليات لهذه المنصة فقط"
      />
    </div>
  );
}

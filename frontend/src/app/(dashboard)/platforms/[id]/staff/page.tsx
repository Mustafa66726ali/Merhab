"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import StaffMembersView from "@/components/platforms/StaffMembersView";
import {
  platformsAPI,
  type PlatformStaffMember,
  type PlatformStaffStats,
} from "@/lib/api";

const emptyStats: PlatformStaffStats = {
  total: 0,
  event_managers: 0,
  event_organizers: 0,
};

export default function PlatformStaffPage() {
  const params = useParams();
  const id = Number(params.id);
  const [platformName, setPlatformName] = useState("");
  const [staff, setStaff] = useState<PlatformStaffMember[]>([]);
  const [stats, setStats] = useState<PlatformStaffStats>(emptyStats);
  const [roleOptions, setRoleOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformsAPI.staff(id)
      .then((r) => {
        setPlatformName(r.data.platform.name);
        setStaff(r.data.staff);
        setStats(r.data.stats);
        setRoleOptions(r.data.role_options ?? []);
      })
      .catch(() => {
        setStaff([]);
        setStats(emptyStats);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <StaffMembersView
      title={`استاف ${platformName}`}
      subtitle="فريق العمل والاستاف في المنصة المختارة"
      staff={staff}
      stats={stats}
      roleOptions={roleOptions}
      backHref={`/platforms/${id}`}
      backLabel="العودة إلى معلومات المنصة"
      searchPlaceholder="بحث باسم العضو..."
    />
  );
}

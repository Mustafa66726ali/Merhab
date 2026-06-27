"use client";

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

export default function PlatformMembersPage() {
  const [staff, setStaff] = useState<PlatformStaffMember[]>([]);
  const [stats, setStats] = useState<PlatformStaffStats>(emptyStats);
  const [roleOptions, setRoleOptions] = useState<{ value: string; label: string }[]>([]);
  const [platformOptions, setPlatformOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformsAPI.allStaff()
      .then((r) => {
        setStaff(r.data.staff);
        setStats(r.data.stats);
        setRoleOptions(r.data.role_options ?? []);
        setPlatformOptions(r.data.platform_options ?? []);
      })
      .catch(() => {
        setStaff([]);
        setStats(emptyStats);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <StaffMembersView
      title="اعضاء المنصات"
      subtitle="جميع أعضاء واستاف المنصات — بحث وفلترة حسب العضو والمنصة والدور"
      staff={staff}
      stats={stats}
      roleOptions={roleOptions}
      platformOptions={platformOptions}
      showPlatformColumn
      searchPlaceholder="بحث باسم العضو أو المنصة..."
    />
  );
}

"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import EventsDashboard from "@/components/events/EventsDashboard";
import { platformsAPI } from "@/lib/api";

export default function PlatformEventsPage() {
  const params = useParams();
  const id = Number(params.id);
  const [platformName, setPlatformName] = useState("");

  useEffect(() => {
    platformsAPI.get(id).then((r) => setPlatformName(r.data.name)).catch(() => setPlatformName(""));
  }, [id]);

  return (
    <EventsDashboard
      platformId={id}
      platformName={platformName}
      backHref={`/platforms/${id}`}
      backLabel="العودة إلى معلومات المنصة"
      showPlatformInTable={false}
    />
  );
}

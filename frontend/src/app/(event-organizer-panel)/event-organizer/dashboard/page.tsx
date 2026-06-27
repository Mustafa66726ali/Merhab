"use client";

import EventManagerDashboardView from "@/components/event-manager-panel/EventManagerDashboardView";
import { platformsAPI } from "@/lib/api";

export default function EventOrganizerDashboardPage() {
  return (
    <EventManagerDashboardView
      basePath="/event-organizer"
      fetchOverview={platformsAPI.myOrganizerOverview}
      teamHref={null}
    />
  );
}

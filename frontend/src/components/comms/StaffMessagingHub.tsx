"use client";

import { useState } from "react";
import MessagesView from "@/components/comms/MessagesView";
import GuestMessagesView from "@/components/comms/GuestMessagesView";

type MessagingTab = "staff" | "guests";

interface StaffMessagingHubProps {
  scopeLabel: string;
  showGuestTab?: boolean;
  defaultTab?: MessagingTab;
}

export default function StaffMessagingHub({
  scopeLabel,
  showGuestTab = true,
  defaultTab = "staff",
}: StaffMessagingHubProps) {
  const [tab, setTab] = useState<MessagingTab>(defaultTab);

  return (
    <div className="space-y-4">
      {showGuestTab && (
        <div className="flex gap-1 p-1 bg-surface-container-high rounded-xl border border-outline-variant/10 max-w-md">
          <button
            type="button"
            onClick={() => setTab("staff")}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === "staff"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            مراسلة الفريق
          </button>
          <button
            type="button"
            onClick={() => setTab("guests")}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === "guests"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            مراسلة الضيوف
          </button>
        </div>
      )}

      {tab === "staff" || !showGuestTab ? (
        <MessagesView scopeLabel={scopeLabel} />
      ) : (
        <GuestMessagesView />
      )}
    </div>
  );
}

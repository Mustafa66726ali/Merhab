import { Suspense } from "react";
import StaffMessagingHub from "@/components/comms/StaffMessagingHub";

export default function EventManagerMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <span className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      }
    >
      <StaffMessagingHub scopeLabel="مدير الفعالية — مراسلة مدير المنصة ومنظم الفعالية" />
    </Suspense>
  );
}

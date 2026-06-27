import { Suspense } from "react";
import StaffMessagingHub from "@/components/comms/StaffMessagingHub";

export default function PlatformMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
        </div>
      }
    >
      <StaffMessagingHub scopeLabel="مدير المنصة — مراسلة مدير النظام ومديري الفعاليات" />
    </Suspense>
  );
}

import { Suspense } from "react";
import MessagesView from "@/components/comms/MessagesView";

export default function AdminMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
        </div>
      }
    >
      <MessagesView scopeLabel="مراسلة مديري المنصات في النظام" />
    </Suspense>
  );
}

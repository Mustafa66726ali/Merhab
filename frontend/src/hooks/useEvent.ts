import { useQuery } from "@tanstack/react-query";
import { eventsAPI, type EventDetail } from "@/lib/api";

export function useEvent(eventId: number) {
  return useQuery<EventDetail>({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const res = await eventsAPI.get(eventId);
      return res.data;
    },
    enabled: eventId > 0,
    staleTime: 2 * 60 * 1000,
  });
}

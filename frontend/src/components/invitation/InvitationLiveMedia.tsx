"use client";

import { useCallback, useEffect, useState } from "react";
import { publicInvitationAPI, type PublicLiveMedia } from "@/lib/api";
import LiveMediaPlayer from "@/components/invitation/LiveMediaPlayer";

interface InvitationLiveMediaProps {
  token: string;
  initial: PublicLiveMedia | null | undefined;
}

export default function InvitationLiveMedia({ token, initial }: InvitationLiveMediaProps) {
  const [live, setLive] = useState<PublicLiveMedia | null>(initial || null);

  const poll = useCallback(async () => {
    try {
      const res = await publicInvitationAPI.liveMedia(token);
      setLive(res.data);
    } catch {
      /* تجاهل */
    }
  }, [token]);

  useEffect(() => {
    if (!initial?.enabled) return;
    const needsPoll =
      initial.mode === "microphone" ||
      initial.mode === "camera" ||
      initial.stream_active;
    if (!needsPoll) return;
    const id = window.setInterval(poll, 3500);
    return () => window.clearInterval(id);
  }, [initial, poll]);

  if (!live?.enabled || live.mode === "off") return null;
  return <LiveMediaPlayer live={live} />;
}

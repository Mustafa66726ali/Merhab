"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { commsAPI, type GuestMessageItem } from "@/lib/api";

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

type InboundKind = "all" | "greeting" | "inquiry";

export default function GuestInboundView() {
  const [messages, setMessages] = useState<GuestMessageItem[]>([]);
  const [kind, setKind] = useState<InboundKind>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await commsAPI.guestMessagesInbound({
        kind: kind === "all" ? undefined : kind,
      });
      setMessages(res.data.messages);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const greetings = messages.filter((m) => m.kind === "greeting").length;
    const inquiries = messages.filter((m) => m.kind === "inquiry").length;
    return { greetings, inquiries, total: messages.length };
  }, [messages]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-on-surface">تهنئات واستفسارات الضيوف</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          ما يرسله الضيوف من صفحة الدعوة — التهنئات لأهل الحفل، والاستفسارات للمنسّق مباشرة
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "الكل"],
            ["greeting", "تهنئات"],
            ["inquiry", "استفسارات"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              kind === value
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 divide-y divide-outline-variant/10">
        {messages.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-16">
            لا توجد رسائل واردة بعد
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="p-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-on-surface">{m.guest_name}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      m.kind === "greeting"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {m.kind_label || (m.kind === "greeting" ? "تهنئة" : "استفسار")}
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant">{formatDateTime(m.created_at)}</span>
              </div>
              <p className="text-sm text-on-surface whitespace-pre-wrap">{m.content}</p>
              {m.kind === "inquiry" && m.recipient_name && (
                <p className="text-xs text-on-surface-variant">
                  أُرسل إلى المنسّق: {m.recipient_name}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {kind === "all" && messages.length > 0 && (
        <p className="text-xs text-on-surface-variant text-center">
          {counts.greetings} تهنئة · {counts.inquiries} استفسار
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { platformsAPI } from "@/lib/api";

interface OwnerCommsModalsProps {
  platformId: number;
  ownerName: string;
}

export default function OwnerCommsModals({ platformId, ownerName }: OwnerCommsModalsProps) {
  const [msgOpen, setMsgOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [msgBody, setMsgBody] = useState("");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await platformsAPI.sendMessage(platformId, msgBody.trim());
      setSuccess("تم إرسال الرسالة إلى مالك المنصة");
      setMsgBody("");
      setMsgOpen(false);
    } catch {
      setError("فشل إرسال الرسالة");
    } finally {
      setLoading(false);
    }
  };

  const sendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await platformsAPI.sendNotification(
        platformId,
        notifTitle.trim() || "إشعار من مدير النظام",
        notifBody.trim()
      );
      setSuccess("تم إرسال الإشعار إلى مالك المنصة");
      setNotifTitle("");
      setNotifBody("");
      setNotifOpen(false);
    } catch {
      setError("فشل إرسال الإشعار");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={() => {
            setMsgOpen(true);
            setError("");
            setSuccess("");
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-primary-container/30 bg-primary-container/10 text-primary hover:bg-primary-container/20 transition-all"
        >
          <span className="material-symbols-outlined text-base">mail</span>
          إرسال رسالة
        </button>
        <button
          type="button"
          onClick={() => {
            setNotifOpen(true);
            setError("");
            setSuccess("");
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-tertiary/30 bg-tertiary/10 text-tertiary hover:bg-tertiary/20 transition-all"
        >
          <span className="material-symbols-outlined text-base">notifications_active</span>
          إرسال إشعار
        </button>
      </div>

      {success && (
        <p className="text-sm text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 rounded-xl px-3 py-2 mt-3">
          {success}
        </p>
      )}
      {error && !msgOpen && !notifOpen && (
        <p className="text-sm text-red-400 mt-2">{error}</p>
      )}

      {msgOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={sendMessage}
            className="w-full max-w-md bg-surface-container border border-outline-variant/20 rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">رسالة إلى {ownerName}</h3>
              <button type="button" onClick={() => setMsgOpen(false)} className="p-2 rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {error && msgOpen && <p className="text-sm text-red-400 mb-3">{error}</p>}
            <textarea
              className="input-field min-h-[120px] resize-y"
              placeholder="اكتب رسالتك هنا..."
              value={msgBody}
              onChange={(e) => setMsgBody(e.target.value)}
              required
            />
            <div className="flex gap-2 mt-4">
              <button type="submit" disabled={loading} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
                {loading ? "جاري الإرسال..." : "إرسال"}
              </button>
              <button type="button" onClick={() => setMsgOpen(false)} className="px-4 py-2.5 rounded-xl border border-outline-variant/30 text-sm font-bold">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {notifOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form
            onSubmit={sendNotification}
            className="w-full max-w-md bg-surface-container border border-outline-variant/20 rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">إشعار لـ {ownerName}</h3>
              <button type="button" onClick={() => setNotifOpen(false)} className="p-2 rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {error && notifOpen && <p className="text-sm text-red-400 mb-3">{error}</p>}
            <input
              className="input-field mb-3"
              placeholder="عنوان الإشعار (اختياري)"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
            />
            <textarea
              className="input-field min-h-[100px] resize-y"
              placeholder="محتوى الإشعار..."
              value={notifBody}
              onChange={(e) => setNotifBody(e.target.value)}
              required
            />
            <div className="flex gap-2 mt-4">
              <button type="submit" disabled={loading} className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50">
                {loading ? "جاري الإرسال..." : "إرسال الإشعار"}
              </button>
              <button type="button" onClick={() => setNotifOpen(false)} className="px-4 py-2.5 rounded-xl border border-outline-variant/30 text-sm font-bold">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

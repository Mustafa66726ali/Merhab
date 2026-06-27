"use client";

import { parseTimeFromIso, buildScheduleDateTime } from "./scheduleUtils";
import type { EventScheduleItem } from "@/lib/api";

export interface ScheduleFormState {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  locationMode: "general" | "custom";
  customLocation: string;
}

export function emptyScheduleForm(): ScheduleFormState {
  return {
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    locationMode: "general",
    customLocation: "",
  };
}

export function scheduleToForm(item: EventScheduleItem): ScheduleFormState {
  const loc = (item.location || "").trim();
  return {
    title: item.title,
    description: item.description || "",
    startTime: parseTimeFromIso(item.start_time),
    endTime: parseTimeFromIso(item.end_time),
    locationMode: loc ? "custom" : "general",
    customLocation: loc,
  };
}

export function formToPayload(form: ScheduleFormState, eventDate: string) {
  const location = form.locationMode === "custom" ? form.customLocation.trim() : "";
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    start_time: buildScheduleDateTime(eventDate, form.startTime),
    end_time: buildScheduleDateTime(eventDate, form.endTime),
    location,
  };
}

interface ScheduleActivityFormProps {
  form: ScheduleFormState;
  onChange: (patch: Partial<ScheduleFormState>) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving?: boolean;
  deleting?: boolean;
  compact?: boolean;
}

const inputClass =
  "bg-surface-container-lowest border border-outline-variant/30 text-on-surface rounded-xl w-full focus:border-primary focus:ring-2 focus:ring-primary/30 transition-colors text-sm px-3 py-2.5 outline-none";

export default function ScheduleActivityForm({
  form,
  onChange,
  onSave,
  onCancel,
  onDelete,
  saving = false,
  deleting = false,
  compact = false,
}: ScheduleActivityFormProps) {
  return (
    <div
      className={`rounded-2xl border border-primary/40 shadow-xl shadow-primary/10 ${
        compact ? "p-4 sm:p-5" : "p-5 sm:p-6"
      } bg-surface-container-highest/95 backdrop-blur-sm space-y-4`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-primary tracking-widest">
            اسم النشاط
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className={inputClass}
            placeholder="مثال: استقبال الضيوف"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-primary tracking-widest">
              وقت البداية
            </label>
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => onChange({ startTime: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-primary tracking-widest">
              وقت الانتهاء
            </label>
            <input
              type="time"
              value={form.endTime}
              onChange={(e) => onChange({ endTime: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] uppercase font-bold text-primary tracking-widest">
          الموقع
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange({ locationMode: "general", customLocation: "" })}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
              form.locationMode === "general"
                ? "bg-primary-container text-on-primary-container shadow-sm"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            عام — جميع المواقع
          </button>
          <button
            type="button"
            onClick={() => onChange({ locationMode: "custom" })}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
              form.locationMode === "custom"
                ? "bg-primary-container text-on-primary-container shadow-sm"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            موقع مخصص
          </button>
        </div>
        {form.locationMode === "custom" && (
          <input
            type="text"
            value={form.customLocation}
            onChange={(e) => onChange({ customLocation: e.target.value })}
            className={inputClass}
            placeholder="مثال: القاعة 4، المسرح الرئيسي..."
          />
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] uppercase font-bold text-primary tracking-widest">
          الوصف
        </label>
        <textarea
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={3}
          className={inputClass + " resize-y min-h-[80px]"}
          placeholder="تفاصيل النشاط..."
        />
      </div>

      <div className="flex flex-wrap justify-between items-center pt-4 border-t border-outline-variant/20 gap-3">
        <div className="flex gap-2">
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting || saving}
              className="inline-flex items-center gap-1 px-3 py-2 text-error hover:bg-error/10 rounded-lg transition-colors disabled:opacity-50 text-sm font-bold"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              حذف
            </button>
          )}
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving || deleting}
            className="px-4 py-2 text-on-surface-variant text-sm font-bold disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || deleting}
            className="px-5 sm:px-6 py-2 bg-primary-container text-on-primary-container rounded-xl text-sm font-bold disabled:opacity-50 hover:brightness-110 transition-all"
          >
            {saving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}

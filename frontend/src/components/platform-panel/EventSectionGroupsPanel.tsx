"use client";

import { useState } from "react";
import {
  groupsAPI,
  sectionsAPI,
  type EventSectionDetail,
} from "@/lib/api";

function GroupRow({
  name,
  location,
  confirmed,
  total,
  color,
}: {
  name: string;
  location?: string;
  confirmed: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-high/40 p-3 sm:p-4">
      <div className="flex justify-between gap-2 mb-1">
        <div className="min-w-0">
          <p className="text-sm font-bold text-on-surface truncate">{name}</p>
          {location && location !== name && (
            <p className="text-[11px] text-on-surface-variant mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-outline">location_on</span>
              <span className="truncate">{location}</span>
            </p>
          )}
        </div>
        <span className="text-xs font-bold tabular-nums shrink-0" style={{ color }}>
          {confirmed}/{total}
        </span>
      </div>
      <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden mt-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface EventSectionGroupsPanelProps {
  eventId: number;
  sections: EventSectionDetail[];
  canManage: boolean;
  onRefresh: () => void;
}

export default function EventSectionGroupsPanel({
  eventId,
  sections,
  canManage,
  onRefresh,
}: EventSectionGroupsPanelProps) {
  const [error, setError] = useState("");
  const [sectionModal, setSectionModal] = useState(false);
  const [groupModal, setGroupModal] = useState<{
    sectionId: number;
    sectionName: string;
    sectionColor: string;
  } | null>(null);
  const [sectionName, setSectionName] = useState("");
  const [sectionLocation, setSectionLocation] = useState("");
  const [sectionColor, setSectionColor] = useState("#5b2eff");
  const [sectionDescription, setSectionDescription] = useState("");
  const [groupLocation, setGroupLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const openSectionModal = () => {
    setSectionName("");
    setSectionLocation("");
    setSectionColor("#5b2eff");
    setSectionDescription("");
    setError("");
    setSectionModal(true);
  };

  const openGroupModal = (section: EventSectionDetail) => {
    setGroupLocation("");
    setError("");
    setGroupModal({
      sectionId: section.id,
      sectionName: section.name,
      sectionColor: section.color || "#5b2eff",
    });
  };

  const handleAddSection = async () => {
    const name = sectionName.trim();
    if (!name) {
      setError("اسم القسم مطلوب.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await sectionsAPI.create({
        event: eventId,
        name,
        location: sectionLocation.trim(),
        color: sectionColor,
        description: sectionDescription.trim(),
      });
      setSectionModal(false);
      onRefresh();
    } catch {
      setError("تعذّر إضافة القسم.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddGroup = async () => {
    if (!groupModal) return;
    const location = groupLocation.trim();
    if (!location) {
      setError("موقع المجموعة مطلوب (مثال: الطابق الأرضي - القاعة 4).");
      return;
    }
    const name = `${groupModal.sectionName} - ${location}`;
    setSaving(true);
    setError("");
    try {
      await groupsAPI.create({
        event: eventId,
        section: groupModal.sectionId,
        name,
        location,
        color: groupModal.sectionColor,
      });
      setGroupModal(null);
      onRefresh();
    } catch {
      setError("تعذّر إضافة المجموعة.");
    } finally {
      setSaving(false);
    }
  };

  const groupNamePreview =
    groupModal && groupLocation.trim()
      ? `${groupModal.sectionName} - ${groupLocation.trim()}`
      : "";

  return (
    <>
      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/60 backdrop-blur-xl p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
          <h4 className="text-lg sm:text-xl font-bold text-on-surface">الأقسام والمجموعات</h4>
          {canManage && (
            <button
              type="button"
              onClick={openSectionModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-container/15 border border-primary-container/25 text-primary text-xs font-bold hover:bg-primary-container/25 transition-colors shrink-0"
              title="إضافة قسم"
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              <span className="hidden sm:inline">إضافة قسم</span>
            </button>
          )}
        </div>

        {error && !sectionModal && !groupModal && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {sections.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <span className="material-symbols-outlined text-4xl text-outline/40">grid_view</span>
            <p className="text-sm text-on-surface-variant">
              لا توجد أقسام بعد. أضف الأقسام ثم المجموعات لتوزيع المدعوين.
            </p>
            {canManage && (
              <button
                type="button"
                onClick={openSectionModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-container text-on-primary-container text-sm font-bold hover:brightness-110 transition-all"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                إضافة أول قسم
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((section) => (
              <div
                key={section.id}
                className="rounded-xl border border-outline-variant/10 bg-surface-container-high/30 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: section.color || "#5b2eff" }}
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-on-surface truncate">{section.name}</p>
                      {section.location && (
                        <p className="text-[11px] text-on-surface-variant mt-0.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-outline">location_on</span>
                          <span className="truncate">{section.location}</span>
                        </p>
                      )}
                      <p className="text-[11px] text-on-surface-variant tabular-nums mt-0.5">
                        {section.guests_confirmed}/{section.guests_count} ضيف
                      </p>
                    </div>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => openGroupModal(section)}
                      className="p-2 rounded-lg text-primary hover:bg-primary-container/15 border border-primary-container/20 transition-colors shrink-0"
                      title="إضافة مجموعة"
                    >
                      <span className="material-symbols-outlined text-lg">group_add</span>
                    </button>
                  )}
                </div>

                {section.groups.length === 0 ? (
                  <p className="text-xs text-on-surface-variant pr-1">
                    لا توجد مجموعات — أضف مجموعة بموقعها (مثال: الطابق الأرضي - القاعة 4)
                  </p>
                ) : (
                  <div className="space-y-2">
                    {section.groups.map((group) => (
                      <GroupRow
                        key={group.id}
                        name={group.name}
                        location={group.location}
                        confirmed={group.guests_confirmed}
                        total={group.guests_count}
                        color={group.color || section.color || "#5b2eff"}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {sectionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !saving && setSectionModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
              <h2 className="font-bold text-on-surface text-lg">إضافة قسم</h2>
              <button
                type="button"
                onClick={() => !saving && setSectionModal(false)}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && sectionModal && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  اسم القسم
                </label>
                <input
                  type="text"
                  value={sectionName}
                  onChange={(e) => setSectionName(e.target.value)}
                  placeholder="مثال: كبار الشخصيات"
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  موقع القسم
                </label>
                <input
                  type="text"
                  value={sectionLocation}
                  onChange={(e) => setSectionLocation(e.target.value)}
                  placeholder="الطابق الأرضي - القاعة 4"
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  لون القسم
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={sectionColor}
                    onChange={(e) => setSectionColor(e.target.value)}
                    className="h-10 w-14 rounded-lg border border-outline-variant/20 cursor-pointer bg-transparent"
                  />
                  <span className="text-sm text-on-surface-variant tabular-nums">{sectionColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  وصف (اختياري)
                </label>
                <textarea
                  value={sectionDescription}
                  onChange={(e) => setSectionDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={() => setSectionModal(false)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant/20 text-on-surface-variant font-bold text-sm"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAddSection}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm disabled:opacity-50"
              >
                {saving ? "جاري الإضافة..." : "إضافة القسم"}
              </button>
            </div>
          </div>
        </div>
      )}

      {groupModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !saving && setGroupModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
              <h2 className="font-bold text-on-surface text-lg">إضافة مجموعة</h2>
              <button
                type="button"
                onClick={() => !saving && setGroupModal(null)}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && groupModal && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}
              <div className="rounded-xl bg-surface-container-high/60 px-4 py-3 border border-outline-variant/10">
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1">
                  القسم
                </p>
                <p className="font-bold text-on-surface">{groupModal.sectionName}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  الموقع داخل المناسبة
                </label>
                <input
                  type="text"
                  value={groupLocation}
                  onChange={(e) => setGroupLocation(e.target.value)}
                  placeholder="الطابق الأرضي - القاعة 4"
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-[11px] text-on-surface-variant mt-2">
                  سيُسمى المجموعة:{" "}
                  <span className="text-primary font-bold">
                    {groupNamePreview || `${groupModal.sectionName} - ...`}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={() => setGroupModal(null)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant/20 text-on-surface-variant font-bold text-sm"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAddGroup}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm disabled:opacity-50"
              >
                {saving ? "جاري الإضافة..." : "إضافة المجموعة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

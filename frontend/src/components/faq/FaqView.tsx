"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { faqAPI, type FAQAdminItem } from "@/lib/api";

type FilterTab = "all" | "pending" | "answered" | "published";

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
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

const statusBadge: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  answered: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  closed: "bg-outline/10 text-outline border-outline/30",
};

export default function FaqView() {
  const [items, setItems] = useState<FAQAdminItem[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, answered: 0, published: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<FAQAdminItem | null>(null);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [listRes, overviewRes] = await Promise.all([faqAPI.list(), faqAPI.overview()]);
      setItems(listRes.data);
      setStats(overviewRes.data.stats);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = items;
    if (tab === "pending") list = list.filter((i) => i.status === "pending");
    if (tab === "answered") list = list.filter((i) => i.status === "answered");
    if (tab === "published") list = list.filter((i) => i.is_published);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.question.toLowerCase().includes(q) ||
          i.answer.toLowerCase().includes(q) ||
          i.asker_name.toLowerCase().includes(q) ||
          i.asker_email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, tab, search]);

  const openItem = (item: FAQAdminItem) => {
    setSelected(item);
    setAnswer(item.answer);
    setMessage("");
  };

  const saveReply = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await faqAPI.update(selected.id, {
        answer,
        status: answer.trim() ? "answered" : selected.status,
        is_published: selected.is_published,
      });
      setItems((prev) => prev.map((i) => (i.id === res.data.id ? res.data : i)));
      setSelected(res.data);
      setMessage("تم حفظ الرد");
      const overviewRes = await faqAPI.overview();
      setStats(overviewRes.data.stats);
    } catch {
      setMessage("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (item: FAQAdminItem) => {
    if (!item.answer.trim()) return;
    try {
      const res = await faqAPI.update(item.id, {
        is_published: !item.is_published,
        status: "answered",
      });
      setItems((prev) => prev.map((i) => (i.id === res.data.id ? res.data : i)));
      if (selected?.id === item.id) setSelected(res.data);
      const overviewRes = await faqAPI.overview();
      setStats(overviewRes.data.stats);
    } catch {
      /* ignore */
    }
  };

  const deleteItem = async (id: number) => {
    if (!confirm("حذف هذا السؤال؟")) return;
    await faqAPI.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selected?.id === id) setSelected(null);
    const overviewRes = await faqAPI.overview();
    setStats(overviewRes.data.stats);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container/20">
            <span className="material-symbols-outlined text-primary text-xl">quiz</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">الأسئلة والاستفسارات</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              رد على أسئلة الزوار من صفحة الهبوط وانشرها للجميع
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي", value: stats.total, icon: "forum" },
          { label: "بانتظار الرد", value: stats.pending, icon: "pending" },
          { label: "تم الرد", value: stats.answered, icon: "check_circle" },
          { label: "منشور", value: stats.published, icon: "public" },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-primary text-xl">{k.icon}</span>
            <div>
              <p className="text-xs text-on-surface-variant">{k.label}</p>
              <p className="text-xl font-bold tabular-nums">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-[42%] space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "all", label: "الكل" },
                { id: "pending", label: "بانتظار الرد" },
                { id: "answered", label: "تم الرد" },
                { id: "published", label: "منشور" },
              ] as { id: FilterTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  tab === t.id
                    ? "bg-primary-container/20 border-primary-container/40 text-primary"
                    : "border-outline-variant/20 text-on-surface-variant hover:border-primary/30"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            className="input-field"
            placeholder="بحث في الأسئلة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="space-y-2 max-h-[520px] overflow-y-auto sidebar-scroll">
            {filtered.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">لا توجد أسئلة</p>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={`w-full text-right rounded-xl border p-4 transition-all ${
                    selected?.id === item.id
                      ? "border-primary-container/50 bg-primary-container/10"
                      : "border-outline-variant/10 bg-surface-container-low hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge[item.status]}`}
                    >
                      {item.status_label}
                    </span>
                    <span className="text-[10px] text-outline">{formatDate(item.created_at)}</span>
                  </div>
                  <p className="text-sm font-bold text-on-surface line-clamp-2">{item.question}</p>
                  {item.asker_name && (
                    <p className="text-xs text-on-surface-variant mt-1">{item.asker_name}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:flex-1 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6">
          {!selected ? (
            <div className="text-center py-16 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl text-outline/40 mb-3 block">touch_app</span>
              <p className="text-sm">اختر سؤالاً من القائمة للرد عليه</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-outline mb-1">السؤال</p>
                  <p className="font-bold text-on-surface leading-relaxed">{selected.question}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteItem(selected.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                  aria-label="حذف"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
              {(selected.asker_name || selected.asker_email) && (
                <div className="text-sm text-on-surface-variant flex flex-wrap gap-3">
                  {selected.asker_name && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">person</span>
                      {selected.asker_name}
                    </span>
                  )}
                  {selected.asker_email && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">mail</span>
                      {selected.asker_email}
                    </span>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-on-surface-variant mb-2 block">الرد</label>
                <textarea
                  className="input-field min-h-[140px]"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="اكتب ردك هنا..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={selected.is_published}
                  disabled={!answer.trim()}
                  onChange={() => togglePublish({ ...selected, answer })}
                />
                نشر في صفحة الهبوط (الأسئلة الشائعة)
              </label>
              {message && (
                <p className="text-sm text-emerald-400">{message}</p>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={saveReply}
                className="px-6 py-3 rounded-xl text-sm font-bold bg-primary-container text-on-primary-container disabled:opacity-50"
              >
                {saving ? "جاري الحفظ..." : "حفظ الرد"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

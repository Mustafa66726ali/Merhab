"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import UserAvatarPicker from "@/components/common/UserAvatarPicker";
import ToggleSwitch from "@/components/common/ToggleSwitch";
import { platformsAPI, type PlatformTeamMemberDetail } from "@/lib/api";

export interface MemberFormState {
  first_name: string;
  last_name: string;
  email: string;
  role_key: string;
  coordinator_label: string;
  password: string;
  account_status: string;
  perm_scan_qr: boolean;
  perm_edit_guests: boolean;
  perm_send_messages: boolean;
}

const emptyForm: MemberFormState = {
  first_name: "",
  last_name: "",
  email: "",
  role_key: "event_manager",
  coordinator_label: "",
  password: "",
  account_status: "active",
  perm_scan_qr: false,
  perm_edit_guests: false,
  perm_send_messages: false,
};

interface PlatformMemberFormProps {
  mode: "add" | "edit";
  userId?: number;
}

export default function PlatformMemberForm({ mode, userId }: PlatformMemberFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<MemberFormState>(emptyForm);
  const [assignableRoles, setAssignableRoles] = useState<{ value: string; label: string }[]>([]);
  const [statusOptions, setStatusOptions] = useState<{ value: string; label: string }[]>([]);
  const [permissionOptions, setPermissionOptions] = useState<
    { key: string; label: string }[]
  >([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [detail, setDetail] = useState<PlatformTeamMemberDetail | null>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    platformsAPI.myStaff().then((res) => {
      setAssignableRoles(res.data.assignable_roles ?? []);
      setStatusOptions(res.data.status_options ?? []);
      setPermissionOptions(res.data.permission_options ?? []);
    });
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !userId) return;
    platformsAPI
      .myStaffDetail(userId)
      .then((res) => {
        const d = res.data;
        setDetail(d);
        setForm({
          first_name: d.first_name ?? "",
          last_name: d.last_name ?? "",
          email: d.email,
          role_key: d.role_key,
          coordinator_label: d.coordinator_label ?? "",
          password: "",
          account_status: d.account_status ?? "active",
          perm_scan_qr: d.perm_scan_qr ?? false,
          perm_edit_guests: d.perm_edit_guests ?? false,
          perm_send_messages: d.perm_send_messages ?? false,
        });
      })
      .catch(() => setError("تعذّر تحميل بيانات العضو"))
      .finally(() => setLoading(false));
  }, [mode, userId]);

  const buildFormData = useCallback(() => {
    const fd = new FormData();
    fd.append("email", form.email.trim());
    fd.append("first_name", form.first_name.trim());
    fd.append("last_name", form.last_name.trim());
    fd.append("role_key", form.role_key);
    fd.append("coordinator_label", form.coordinator_label.trim());
    fd.append("perm_scan_qr", String(form.perm_scan_qr));
    fd.append("perm_edit_guests", String(form.perm_edit_guests));
    fd.append("perm_send_messages", String(form.perm_send_messages));
    if (mode === "add") {
      fd.append("password", form.password);
    } else {
      fd.append("account_status", form.account_status);
      if (form.password.trim()) fd.append("password", form.password);
    }
    if (avatarFile) fd.append("avatar", avatarFile);
    return fd;
  }, [form, mode, avatarFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "add" && !form.password.trim()) {
      setError("كلمة المرور مطلوبة");
      return;
    }
    if (form.role_key === "coordinator" && !form.coordinator_label.trim()) {
      setError("يرجى تحديد نوع المنسق (مثال: منسق رجال)");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (mode === "add") {
        await platformsAPI.myStaffAdd(buildFormData());
      } else if (userId) {
        await platformsAPI.myStaffUpdate(userId, buildFormData());
      }
      router.push("/platform/users");
    } catch {
      setError("فشل حفظ البيانات — تحقق من الحقول وحاول مجدداً");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/platform/users"
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary mb-4 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_forward</span>
          العودة إلى الأعضاء
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
          {mode === "add" ? "إضافة عضو جديد" : "تعديل العضو"}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          {mode === "add"
            ? "أنشئ حساباً جديداً وحدد الدور والصلاحيات"
            : `تعديل بيانات ${detail?.name ?? "العضو"}`}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 sm:p-6 space-y-5">
          <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">person</span>
            البيانات الأساسية
          </h2>
          <UserAvatarPicker
            initialUrl={mode === "edit" ? detail?.avatar_url : null}
            onChange={setAvatarFile}
            disabled={submitting}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="الاسم الأول">
              <input
                className="input-field w-full"
                value={form.first_name}
                onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              />
            </Field>
            <Field label="الاسم الأخير">
              <input
                className="input-field w-full"
                value={form.last_name}
                onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="البريد الإلكتروني">
            <input
              type="email"
              className="input-field w-full"
              dir="ltr"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <Field
            label={
              mode === "add"
                ? "كلمة المرور"
                : "كلمة المرور (اتركها فارغة إن لم تُرد التغيير)"
            }
          >
            <input
              type="password"
              className="input-field w-full"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
          </Field>
          {mode === "edit" && (
            <Field label="الحالة">
              <select
                className="input-field w-full"
                value={form.account_status}
                onChange={(e) => setForm((f) => ({ ...f, account_status: e.target.value }))}
              >
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
          )}
        </section>

        <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 sm:p-6 space-y-5">
          <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">badge</span>
            الدور
          </h2>
          <Field label="اختر الدور">
            <select
              className="input-field w-full"
              value={form.role_key}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  role_key: e.target.value,
                  coordinator_label:
                    e.target.value !== "coordinator" ? "" : f.coordinator_label,
                }))
              }
            >
              {assignableRoles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>
          {form.role_key === "coordinator" && (
            <Field label="نوع المنسق">
              <input
                className="input-field w-full"
                placeholder="مثال: منسق رجال، منسق نساء"
                value={form.coordinator_label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, coordinator_label: e.target.value }))
                }
              />
            </Field>
          )}
        </section>

        <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">admin_panel_settings</span>
            الصلاحيات
          </h2>
          <p className="text-xs text-on-surface-variant">
            فعّل أو عطّل الصلاحيات لهذا العضو على منصتك
          </p>
          <div className="space-y-3">
            {permissionOptions.map((perm) => {
              const key = perm.key as keyof Pick<
                MemberFormState,
                "perm_scan_qr" | "perm_edit_guests" | "perm_send_messages"
              >;
              return (
                <div
                  key={perm.key}
                  className="flex items-center justify-between gap-4 rounded-xl border border-outline-variant/10 bg-surface-container/40 px-4 py-3"
                >
                  <span className="text-sm font-medium text-on-surface">{perm.label}</span>
                  <ToggleSwitch
                    checked={form[key]}
                    onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
                    disabled={submitting}
                    label={perm.label}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {error && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/platform/users"
            className="flex-1 py-3 rounded-xl text-center text-sm font-bold border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-primary-container text-on-primary-container disabled:opacity-50 hover:brightness-110 transition-all"
          >
            {submitting ? "جاري الحفظ..." : mode === "add" ? "إضافة العضو" : "حفظ التغييرات"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-on-surface-variant mb-1.5">{label}</label>
      {children}
    </div>
  );
}

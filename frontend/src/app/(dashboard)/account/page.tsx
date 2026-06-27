"use client";

import { useEffect, useState } from "react";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function AccountPage() {
  const { user, setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [recoveryMsg, setRecoveryMsg] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingRecovery, setLoadingRecovery] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setPhone(user.phone || "");
      setRecoveryEnabled(user.recovery_email_enabled || false);
    }
  }, [user]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg("");
    setLoadingProfile(true);
    try {
      const r = await authAPI.updateProfile({ email, first_name: firstName, last_name: lastName, phone });
      setUser(r.data);
      setProfileMsg("تم تحديث معلومات الحساب بنجاح");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string; email?: string[] } } })?.response?.data;
      setProfileMsg(detail?.detail || detail?.email?.[0] || "فشل تحديث المعلومات");
    } finally {
      setLoadingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg("");
    if (newPassword !== confirmPassword) {
      setPasswordMsg("كلمة المرور الجديدة غير متطابقة");
      return;
    }
    setLoadingPassword(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setPasswordMsg("تم تغيير كلمة المرور بنجاح");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPasswordMsg(detail || "فشل تغيير كلمة المرور");
    } finally {
      setLoadingPassword(false);
    }
  };

  const toggleRecovery = async () => {
    setRecoveryMsg("");
    setLoadingRecovery(true);
    const next = !recoveryEnabled;
    try {
      const r = await authAPI.setRecoveryEmail(next);
      setRecoveryEnabled(r.data.recovery_email_enabled);
      setUser(r.data);
      setRecoveryMsg(next ? "تم تفعيل بريد استرداد كلمة المرور" : "تم إيقاف بريد استرداد كلمة المرور");
    } catch {
      setRecoveryMsg("فشل تحديث إعداد الاسترداد");
    } finally {
      setLoadingRecovery(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-on-surface mb-1">معلومات الحساب</h1>
        <p className="text-sm text-on-surface-variant">إدارة بياناتك الشخصية وإعدادات الأمان</p>
      </div>

      <form onSubmit={saveProfile} className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-4">
        <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">person</span>
          البيانات الشخصية
        </h2>

        {profileMsg && (
          <p className={`text-sm p-3 rounded-xl border ${profileMsg.includes("نجاح") ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" : "text-red-400 bg-red-400/10 border-red-400/30"}`}>
            {profileMsg}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1.5 text-on-surface-variant">الاسم الأول</label>
            <input className="input-field" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1.5 text-on-surface-variant">الاسم الأخير</label>
            <input className="input-field" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs mb-1.5 text-on-surface-variant">البريد الإلكتروني</label>
          <input type="email" dir="ltr" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs mb-1.5 text-on-surface-variant">رقم الهاتف</label>
          <input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
        </div>
        <button type="submit" disabled={loadingProfile} className="btn-primary px-6 py-2.5 text-sm">
          {loadingProfile ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </form>

      <form onSubmit={savePassword} className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-4">
        <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">lock</span>
          تغيير كلمة المرور
        </h2>

        {passwordMsg && (
          <p className={`text-sm p-3 rounded-xl border ${passwordMsg.includes("نجاح") ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" : "text-red-400 bg-red-400/10 border-red-400/30"}`}>
            {passwordMsg}
          </p>
        )}

        <div>
          <label className="block text-xs mb-1.5 text-on-surface-variant">كلمة المرور الحالية</label>
          <input type="password" className="input-field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1.5 text-on-surface-variant">كلمة المرور الجديدة</label>
            <input type="password" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
          </div>
          <div>
            <label className="block text-xs mb-1.5 text-on-surface-variant">تأكيد كلمة المرور</label>
            <input type="password" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>
        </div>
        <button type="submit" disabled={loadingPassword} className="btn-primary px-6 py-2.5 text-sm">
          {loadingPassword ? "جاري التحديث..." : "تحديث كلمة المرور"}
        </button>
      </form>

      <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/10 space-y-4">
        <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">mark_email_read</span>
          بريد استرداد كلمة المرور
        </h2>
        <p className="text-sm text-on-surface-variant">
          عند التفعيل، سيتم إرسال رابط استرداد كلمة المرور إلى بريدك: <span className="text-primary font-mono">{email}</span>
        </p>

        {recoveryMsg && (
          <p className="text-sm p-3 rounded-xl border text-emerald-400 bg-emerald-400/10 border-emerald-400/30">
            {recoveryMsg}
          </p>
        )}

        <button
          type="button"
          onClick={toggleRecovery}
          disabled={loadingRecovery}
          className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-bold transition-all border ${
            recoveryEnabled
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
              : "bg-surface-container-highest text-on-surface-variant border-outline-variant/30 hover:border-primary/40"
          }`}
        >
          <span className="material-symbols-outlined">
            {recoveryEnabled ? "toggle_on" : "toggle_off"}
          </span>
          {loadingRecovery ? "جاري التحديث..." : recoveryEnabled ? "مفعّل — اضغط للإيقاف" : "غير مفعّل — اضغط للتفعيل"}
        </button>
      </div>
    </div>
  );
}

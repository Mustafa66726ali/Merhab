"use client";

import Link from "next/link";

export default function EventManagerSettingsView() {
  return (
    <div className="space-y-6 sm:space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">الإعدادات</h1>
        <p className="text-sm text-on-surface-variant mt-1">إعدادات حساب مدير الفعالية والرسائل</p>
      </div>

      <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-6 sm:p-8 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-emerald-400 text-2xl">chat</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">رسائل واتساب — دعوات الضيوف</h2>
            <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
              ستتمكن قريباً من إرسال دعوات واتساب للضيوف مباشرة من لوحة التحكم. سيتم ربط هذه الميزة
              مع إعدادات المنصة ورقم واتساب المفعّل.
            </p>
            <p className="text-xs text-outline mt-3 font-medium">قريباً — قيد التطوير</p>
          </div>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-6 sm:p-8">
        <h2 className="text-lg font-bold text-on-surface mb-2">حسابك</h2>
        <p className="text-sm text-on-surface-variant mb-4">
          تحديث معلومات الحساب وكلمة المرور من صفحة الملف الشخصي.
        </p>
        <Link
          href="/event-manager/account"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-container text-on-primary-container text-sm font-bold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-base">account_circle</span>
          معلومات الحساب
        </Link>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authAPI } from "@/lib/api";

type Step = "email" | "code";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    authAPI
      .recoveryStatus()
      .then((r) => setConfigured(r.data.configured))
      .catch(() => setConfigured(false));
  }, []);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("أدخل بريدك الإلكتروني");
      return;
    }
    setLoading(true);
    try {
      const r = await authAPI.forgotPassword(email);
      setNotice(r.data.detail);
      setStep("code");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "تعذّر إرسال رمز التحقق";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!code.trim()) {
      setError("أدخل رمز التحقق");
      return;
    }
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setLoading(true);
    try {
      const r = await authAPI.resetPassword(email, code, password);
      setNotice(r.data.detail);
      setTimeout(() => router.replace("/login"), 2000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "رمز التحقق غير صحيح أو منتهي";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(91,46,255,0.15) 0%, transparent 60%), #0d0d18",
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          background: "rgba(20, 19, 32, 0.85)",
          border: "1px solid rgba(71, 69, 87, 0.4)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold" style={{ color: "#e3e0f1" }}>
            استعادة كلمة المرور
          </h1>
          <p className="text-sm mt-2" style={{ color: "#928ea3" }}>
            {step === "email"
              ? "أدخل بريدك ليصلك رمز تحقق"
              : "أدخل الرمز وكلمة المرور الجديدة"}
          </p>
        </div>

        {configured === false && (
          <div
            className="mb-4 rounded-xl p-3 text-xs"
            style={{
              background: "rgba(245, 158, 11, 0.1)",
              color: "#fbbf24",
              border: "1px solid rgba(245, 158, 11, 0.25)",
            }}
          >
            استعادة كلمة المرور غير مفعّلة بعد — يجب على مدير النظام إعداد بريد
            Gmail من صفحة التكاملات.
          </div>
        )}

        {error && (
          <div
            className="mb-4 rounded-xl p-3 text-sm"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              color: "#fca5a5",
              border: "1px solid rgba(239, 68, 68, 0.25)",
            }}
          >
            {error}
          </div>
        )}
        {notice && (
          <div
            className="mb-4 rounded-xl p-3 text-sm"
            style={{
              background: "rgba(34, 197, 94, 0.1)",
              color: "#86efac",
              border: "1px solid rgba(34, 197, 94, 0.25)",
            }}
          >
            {notice}
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={requestCode} className="space-y-4">
            <div>
              <label className="block text-xs mb-2" style={{ color: "#c9c3da" }}>
                البريد الإلكتروني
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl py-3 px-4 text-sm outline-none"
                style={{
                  background: "rgba(13, 13, 24, 0.8)",
                  border: "1px solid rgba(71, 69, 87, 0.5)",
                  color: "#e3e0f1",
                }}
                dir="ltr"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading || configured === false}
              className="w-full rounded-xl py-3.5 font-bold text-sm disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #5b2eff 0%, #7b52ff 100%)",
                color: "#dcd4ff",
              }}
            >
              {loading ? "جارٍ الإرسال..." : "إرسال رمز التحقق"}
            </button>
          </form>
        ) : (
          <form onSubmit={resetPassword} className="space-y-4">
            <div>
              <label className="block text-xs mb-2" style={{ color: "#c9c3da" }}>
                رمز التحقق (6 أرقام)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl py-3 px-4 text-sm outline-none tracking-widest text-center"
                style={{
                  background: "rgba(13, 13, 24, 0.8)",
                  border: "1px solid rgba(71, 69, 87, 0.5)",
                  color: "#e3e0f1",
                  fontSize: "1.25rem",
                }}
                placeholder="••••••"
              />
            </div>
            <div>
              <label className="block text-xs mb-2" style={{ color: "#c9c3da" }}>
                كلمة المرور الجديدة
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl py-3 px-4 text-sm outline-none"
                style={{
                  background: "rgba(13, 13, 24, 0.8)",
                  border: "1px solid rgba(71, 69, 87, 0.5)",
                  color: "#e3e0f1",
                }}
              />
            </div>
            <div>
              <label className="block text-xs mb-2" style={{ color: "#c9c3da" }}>
                تأكيد كلمة المرور
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-xl py-3 px-4 text-sm outline-none"
                style={{
                  background: "rgba(13, 13, 24, 0.8)",
                  border: "1px solid rgba(71, 69, 87, 0.5)",
                  color: "#e3e0f1",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3.5 font-bold text-sm disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #5b2eff 0%, #7b52ff 100%)",
                color: "#dcd4ff",
              }}
            >
              {loading ? "جارٍ الحفظ..." : "تغيير كلمة المرور"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
              }}
              className="w-full text-xs"
              style={{ color: "#928ea3" }}
            >
              إعادة إرسال الرمز
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs">
          <Link href="/login" style={{ color: "#a78bfa" }}>
            العودة لتسجيل الدخول
          </Link>
        </p>
      </div>
    </div>
  );
}

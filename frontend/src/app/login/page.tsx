"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const { login, setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("platform_info");
    localStorage.removeItem("user_info");
  }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement | null;
    const passwordInput = form.elements.namedItem("password") as HTMLInputElement | null;
    const emailVal = (emailInput?.value ?? email).trim().toLowerCase();
    const passwordVal = (passwordInput?.value ?? password).trim();

    if (!emailVal || !passwordVal) {
      setError("يرجى إدخال البريد وكلمة المرور");
      return;
    }
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("platform_info");
        localStorage.removeItem("user_info");
      }
      const r = await authAPI.login(emailVal, passwordVal);
      const { access, refresh, user, platform, membership } = r.data;
      const allowedRoles = [
        "system_manager",
        "platform_admin",
        "event_manager",
        "event_organizer",
        "staff",
      ];
      if (!allowedRoles.includes(user.role)) {
        setError("هذا الحساب غير مصرح له بدخول لوحة التحكم");
        return;
      }
      const userWithMembership = membership ? { ...user, membership } : user;
      login(userWithMembership, access, refresh, platform || null);
      setUser(userWithMembership);
      if (user.role === "platform_admin") {
        router.replace("/platform/dashboard");
      } else if (user.role === "event_manager") {
        router.replace("/event-manager/dashboard");
      } else if (user.role === "event_organizer") {
        router.replace("/event-organizer/dashboard");
      } else if (user.role === "staff") {
        const memberRole = membership?.member_role;
        if (memberRole === "coordinator") {
          router.replace("/coordinator/check-in");
        } else if (memberRole === "entry_manager") {
          router.replace("/entry-manager/check-in");
        } else {
          setError("هذا الحساب غير مصرح له بدخول لوحة التحكم");
        }
      } else {
        router.replace("/dashboard");
      }
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "فشل تسجيل الدخول — تحقق من البريد وكلمة المرور";
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d0d18 0%, #12121d 50%, #1a1230 100%)" }}
    >
      {/* Decorative blobs */}
      <div
        className="absolute top-[-120px] left-[-100px] w-[500px] h-[500px] rounded-full opacity-30 blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, #5b2eff 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-[-80px] right-[-80px] w-[400px] h-[400px] rounded-full opacity-20 blur-[100px] pointer-events-none"
        style={{ background: "radial-gradient(circle, #c8bfff 0%, transparent 70%)" }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-5 blur-[180px] pointer-events-none"
        style={{ background: "radial-gradient(circle, #5b2eff 0%, transparent 60%)" }}
      />

      {/* Decorative grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#c8bfff 1px, transparent 1px), linear-gradient(90deg, #c8bfff 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-[420px] rounded-3xl p-8 border"
        style={{
          background: "rgba(31, 30, 42, 0.85)",
          backdropFilter: "blur(24px)",
          borderColor: "rgba(71, 69, 87, 0.4)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(91,46,255,0.08)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: "linear-gradient(135deg, #5b2eff 0%, #7b52ff 50%, #c8bfff 100%)",
              boxShadow: "0 8px 32px rgba(91,46,255,0.45)",
            }}
          >
            <span
              style={{
                fontFamily: '"Material Symbols Outlined"',
                fontSize: "32px",
                color: "white",
                fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 40",
              }}
            >
              diamond
            </span>
          </div>
          <h1
            className="text-3xl font-extrabold mb-1"
            style={{
              background: "linear-gradient(135deg, #c8bfff 0%, #e5deff 60%, #ffffff 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontFamily: "'Plus Jakarta Sans', 'Noto Sans Arabic', sans-serif",
            }}
          >
            مرحّاب
          </h1>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-4 text-sm p-3 rounded-xl border"
            style={{
              color: "#ffb4ab",
              background: "rgba(255,180,171,0.08)",
              borderColor: "rgba(255,180,171,0.25)",
            }}
          >
            <span
              style={{
                fontFamily: '"Material Symbols Outlined"',
                fontSize: "16px",
                verticalAlign: "middle",
                marginLeft: "6px",
              }}
            >
              error
            </span>
            {error}
          </div>
        )}

        <form
          id="login-form"
          onSubmit={onSubmit}
          className="space-y-4"
          autoComplete="off"
        >
          {/* Email */}
          <div>
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "#c9c3da" }}
            >
              البريد الإلكتروني
            </label>
            <div className="relative">
              <span
                className="absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none"
                style={{
                  fontFamily: '"Material Symbols Outlined"',
                  fontSize: "18px",
                  color: "#928ea3",
                }}
              >
                mail
              </span>
              <input
                type="email"
                name="email"
                required
                dir="ltr"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl py-3 pr-10 pl-4 text-sm outline-none transition-all"
                placeholder="you@example.com"
                style={{
                  background: "rgba(13, 13, 24, 0.8)",
                  border: "1px solid rgba(71, 69, 87, 0.5)",
                  color: "#e3e0f1",
                  fontFamily: "'Inter', monospace",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(91,46,255,0.6)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(91,46,255,0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(71, 69, 87, 0.5)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "#c9c3da" }}
            >
              كلمة المرور
            </label>
            <div className="relative">
              <span
                className="absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none"
                style={{
                  fontFamily: '"Material Symbols Outlined"',
                  fontSize: "18px",
                  color: "#928ea3",
                }}
              >
                lock
              </span>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl py-3 pr-10 pl-10 text-sm outline-none transition-all"
                placeholder="••••••••••••"
                style={{
                  background: "rgba(13, 13, 24, 0.8)",
                  border: "1px solid rgba(71, 69, 87, 0.5)",
                  color: "#e3e0f1",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(91,46,255,0.6)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(91,46,255,0.12)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(71, 69, 87, 0.5)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                className="absolute top-1/2 -translate-y-1/2 left-3"
                style={{ color: "#928ea3" }}
                onClick={() => setShowPassword((v) => !v)}
              >
                <span
                  style={{
                    fontFamily: '"Material Symbols Outlined"',
                    fontSize: "18px",
                  }}
                >
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            <p className="text-left mt-2">
              <a
                href="/forgot-password"
                className="text-xs hover:underline"
                style={{ color: "#a78bfa" }}
              >
                نسيت كلمة المرور؟
              </a>
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-sm transition-all mt-2"
            style={{
              background: loading
                ? "rgba(91,46,255,0.5)"
                : "linear-gradient(135deg, #5b2eff 0%, #7b52ff 100%)",
              color: "#dcd4ff",
              boxShadow: loading ? "none" : "0 8px 24px rgba(91,46,255,0.35)",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'Plus Jakarta Sans', 'Noto Sans Arabic', sans-serif",
            }}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-[#dcd4ff] border-t-transparent rounded-full animate-spin" />
                <span>جاري الدخول...</span>
              </>
            ) : (
              <>
                <span
                  style={{
                    fontFamily: '"Material Symbols Outlined"',
                    fontSize: "18px",
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  login
                </span>
                <span>تسجيل الدخول</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, setRememberMe } from "../../lib/supabaseClient";
import { useLanguage } from "../../lib/i18n/LanguageContext";

export default function LoginPage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    setRememberMe(remember);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg("로그인 실패: " + error.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "coach") {
        router.push("/coach/select-profile");
        return;
      }
    }

    router.push("/dashboard");
  }

  async function handleGoogleLogin() {
    setErrorMsg("");
    setGoogleLoading(true);
    setRememberMe(remember);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setGoogleLoading(false);
      setErrorMsg("Google 로그인 실패: " + error.message);
    }
    // 성공 시 Google 페이지로 리다이렉트되므로 별도 처리 불필요
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        justifyContent: "center",
        padding: "32px 16px",
      }}
    >
      <img
        src="/login-bg.png"
        alt=""
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
          objectPosition: "top center",
          zIndex: 0,
        }}
      />
      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
        {/* 로고 + 브랜드 */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <img
            src="/logo-main.png"
            alt="Double J Sports"
            style={{ width: 140, height: "auto", margin: "0 auto" }}
          />
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 20,
            fontWeight: 800,
            color: "#1b3a63",
            marginBottom: 4,
          }}
        >
          {t("login.title")}
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: 14,
            color: "#5b7699",
            marginBottom: 28,
          }}
        >
          아이들의 성장과 즐거운 축구, 함께합니다.
        </div>

        {/* 언어 전환 토글 */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              background: "white",
              borderRadius: 20,
              padding: 3,
              boxShadow: "0 2px 8px rgba(59,130,196,0.12)",
            }}
          >
            <button
              type="button"
              onClick={() => setLang("ko")}
              style={{
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                borderRadius: 16,
                cursor: "pointer",
                background: lang === "ko" ? "#3B82C4" : "transparent",
                color: lang === "ko" ? "white" : "#5b7699",
              }}
            >
              한국어
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              style={{
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                borderRadius: 16,
                cursor: "pointer",
                background: lang === "en" ? "#3B82C4" : "transparent",
                color: lang === "en" ? "white" : "#5b7699",
              }}
            >
              EN
            </button>
          </div>
        </div>

        {/* 로그인 카드 */}
        <div
          style={{
            background: "white",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 10px 30px rgba(59,130,196,0.15)",
          }}
        >
          <form onSubmit={handleSubmit}>
            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 700,
                color: "#1b3a63",
                marginBottom: 8,
              }}
            >
              {t("login.emailLabel")}
            </label>
            <div style={{ position: "relative", marginBottom: 18 }}>
              <span
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9db3cc",
                  display: "flex",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 6-10 7L2 6" />
                </svg>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("login.emailPlaceholder")}
                required
                style={{
                  width: "100%",
                  padding: "14px 14px 14px 40px",
                  fontSize: 14,
                  border: "1px solid #dce6f2",
                  borderRadius: 12,
                  background: "#f8fafd",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <label
              style={{
                display: "block",
                fontSize: 14,
                fontWeight: 700,
                color: "#1b3a63",
                marginBottom: 8,
              }}
            >
              {t("login.passwordLabel")}
            </label>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <span
                style={{
                  position: "absolute",
                  left: 14,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#9db3cc",
                  display: "flex",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("login.passwordPlaceholder")}
                required
                style={{
                  width: "100%",
                  padding: "14px 44px 14px 40px",
                  fontSize: 14,
                  border: "1px solid #dce6f2",
                  borderRadius: 12,
                  background: "#f8fafd",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label="비밀번호 표시 전환"
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#9db3cc",
                  padding: 4,
                  display: "flex",
                }}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  color: "#4a5a72",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#3B82C4" }}
                />
                {t("login.rememberMe")}
              </label>
              <Link
                href="/forgot-password"
                style={{
                  fontSize: 13,
                  color: "#3B82C4",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {t("login.forgotPassword")}
              </Link>
            </div>

            {errorMsg && (
              <div
                style={{
                  fontSize: 13,
                  color: "#b3261e",
                  background: "#fdecec",
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 14,
                }}
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: 15,
                fontSize: 15,
                fontWeight: 700,
                color: "white",
                background: "#3B82C4",
                border: "none",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              {loading ? t("login.loggingIn") : t("login.loginButton")}
            </button>
          </form>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "20px 0",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#e5edf6" }} />
            <span style={{ fontSize: 12, color: "#9db3cc" }}>{t("login.or")}</span>
            <div style={{ flex: 1, height: 1, background: "#e5edf6" }} />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 14,
              fontWeight: 700,
              color: "#333",
              background: "white",
              border: "1px solid #dce6f2",
              borderRadius: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.5 0-14 4.2-17.7 10.4z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.4C29.6 35.4 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.6 5.1C9.9 39.9 16.4 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.6 5.4C41.4 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-3.5z"
              />
            </svg>
            {t("login.googleLogin")}
          </button>

          <div
            style={{
              textAlign: "center",
              fontSize: 13,
              color: "#5b7699",
              marginTop: 20,
            }}
          >
            {t("login.noAccount")}{" "}
            <Link
              href="/"
              style={{ color: "#3B82C4", fontWeight: 700, textDecoration: "none" }}
            >
              {t("login.signup")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

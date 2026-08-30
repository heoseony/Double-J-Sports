"use client";

import Link from "next/link";
import { useLanguage } from "../lib/i18n/LanguageContext";

const BLUE = "#3B82C4";

export default function HomePage() {
  const { lang, setLang, t } = useLanguage();
  return (
    <main
      style={{
        background: "#f3f7fc",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <img
            src="/logo-main.png"
            alt="Logo"
            style={{ width: 56, height: 56, objectFit: "contain", marginBottom: 10 }}
          />
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1b3a63" }}>
            {t("login.title")}
          </div>
          <div style={{ fontSize: 13, color: "#8ea0b8", marginTop: 4 }}>
            {t("landing.subtitle")}
          </div>
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

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <p
            style={{
              fontSize: 14,
              color: "#33455e",
              margin: "0 0 20px",
              textAlign: "center",
            }}
          >
            {t("landing.notSignedUp")}
          </p>

          <Link href="/signup" style={{ textDecoration: "none" }}>
            <button
              type="button"
              style={{
                width: "100%",
                padding: 14,
                fontSize: 15,
                fontWeight: 700,
                color: "white",
                background: BLUE,
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              {t("landing.parentSignup")}
            </button>
          </Link>

          <Link href="/signup/adult" style={{ textDecoration: "none" }}>
            <button
              type="button"
              style={{
                width: "100%",
                marginTop: 12,
                padding: 14,
                fontSize: 15,
                fontWeight: 700,
                color: "white",
                background: BLUE,
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              {t("landing.adultSignup")}
            </button>
          </Link>

          <div
            style={{
              textAlign: "center",
              marginTop: 18,
              fontSize: 13,
              color: "#8ea0b8",
            }}
          >
            {t("landing.haveAccount")}{" "}
            <Link href="/login" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
              {t("landing.login")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

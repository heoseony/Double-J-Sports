"use client";

import Link from "next/link";

const BLUE = "#3B82C4";

export default function HomePage() {
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
            alt="로고"
            style={{ width: 56, height: 56, objectFit: "contain", marginBottom: 10 }}
          />
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1b3a63" }}>
            더블제이 축구 아카데미
          </div>
          <div style={{ fontSize: 13, color: "#8ea0b8", marginTop: 4 }}>
            회원관리 및 수업예약 시스템
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
            아직 회원가입을 하지 않으셨다면 먼저 가입해주세요.
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
              학부모 회원가입 (Kids)
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
              성인 회원가입 (Women's / Men's)
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
            이미 계정이 있으신가요?{" "}
            <Link href="/login" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
              로그인
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

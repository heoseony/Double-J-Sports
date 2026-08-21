"use client";

import { useRouter, usePathname } from "next/navigation";

const HIDDEN_PATHS = ["/login", "/signup", "/auth"];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  // 로그인/회원가입 화면 등에서는 하단 네비게이션을 아예 표시하지 않는다.
  if (HIDDEN_PATHS.some((p) => pathname?.startsWith(p))) {
    return null;
  }

  const itemStyle = (active) => ({
    flex: 1,
    padding: "16px 0",
    border: "none",
    background: "white",
    fontSize: 13,
    fontWeight: 700,
    color: active ? "#0b3d2e" : "#555",
    cursor: "pointer",
  });

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        borderTop: "1px solid #e5e5e5",
        background: "white",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        zIndex: 50,
      }}
    >
      <button
        type="button"
        onClick={() => router.back()}
        style={{ ...itemStyle(false), fontSize: 24 }}
      >
        ‹
      </button>

      <button
        type="button"
        onClick={() => router.forward()}
        style={{ ...itemStyle(false), fontSize: 24 }}
      >
        ›
      </button>

      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        style={{
          flex: 1,
          padding: "10px 0",
          border: "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            background: "#0b3d2e",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Home
        </span>
      </button>

      <button
        type="button"
        onClick={() => router.push("/notices")}
        style={itemStyle(pathname?.startsWith("/notices"))}
      >
        공지
      </button>

      <button
        type="button"
        onClick={() => router.push("/photos")}
        style={itemStyle(pathname?.startsWith("/photos"))}
      >
        갤러리
      </button>
    </div>
  );
}

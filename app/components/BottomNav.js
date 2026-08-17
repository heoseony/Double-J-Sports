"use client";

import { useRouter } from "next/navigation";

export default function BottomNav() {
  const router = useRouter();

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        borderTop: "1px solid #e5e5e5",
        background: "white",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        zIndex: 50,
      }}
    >
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          flex: 1,
          padding: "14px 0",
          border: "none",
          background: "white",
          fontSize: 14,
          fontWeight: 700,
          color: "#333",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <span style={{ fontSize: 18 }}>←</span>
        뒤로가기
      </button>
      <div style={{ width: 1, background: "#e5e5e5" }} />
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        style={{
          flex: 1,
          padding: "14px 0",
          border: "none",
          background: "white",
          fontSize: 14,
          fontWeight: 700,
          color: "#0b3d2e",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <span style={{ fontSize: 18 }}>🏠</span>
        홈
      </button>
    </div>
  );
}

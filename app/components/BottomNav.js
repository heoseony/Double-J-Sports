"use client";

import { useRouter, usePathname } from "next/navigation";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const itemStyle = (active) => ({
    flex: 1,
    padding: "10px 0",
    border: "none",
    background: "white",
    fontSize: 12,
    fontWeight: 700,
    color: active ? "#0b3d2e" : "#555",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  });

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
        style={itemStyle(false)}
      >
        <span style={{ fontSize: 16 }}>‹</span>
        뒤로
      </button>

      <button
        type="button"
        onClick={() => router.forward()}
        style={itemStyle(false)}
      >
        <span style={{ fontSize: 16 }}>›</span>
        앞으로
      </button>

      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        style={{
          flex: 1,
          padding: "8px 0",
          border: "none",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
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
        <span style={{ fontSize: 16 }}>📋</span>
        공지
      </button>

      <button
        type="button"
        onClick={() => router.push("/photos")}
        style={itemStyle(pathname?.startsWith("/photos"))}
      >
        <span style={{ fontSize: 16 }}>🖼️</span>
        사진
      </button>
    </div>
  );
}

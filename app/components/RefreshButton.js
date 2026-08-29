"use client";

import { useState } from "react";

export default function RefreshButton() {
  const [spinning, setSpinning] = useState(false);

  function handleRefresh() {
    setSpinning(true);
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={handleRefresh}
      aria-label="새로고침"
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 12px)",
        right: 14,
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "1px solid #e5eaf2",
        background: "rgba(255,255,255,0.92)",
        boxShadow: "0 2px 8px rgba(30,60,110,0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: 200,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#3B82C4"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          animation: spinning ? "double-j-refresh-spin 0.6s linear infinite" : "none",
        }}
      >
        <path d="M23 4v6h-6" />
        <path d="M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      <style jsx>{`
        @keyframes double-j-refresh-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </button>
  );
}

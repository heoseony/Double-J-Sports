"use client";

import { createRoot } from "react-dom/client";

const BLUE = "#3B82C4";

function Dialog({ title, message, keepLabel, goLabel, onResult }) {
  return (
    <div
      onClick={() => onResult(false)}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 10000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: "24px 20px 16px",
          width: "100%",
          maxWidth: 340,
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 6 }}>⚠️</div>
        {title ? (
          <div style={{ fontSize: 17, fontWeight: 800, textAlign: "center", color: "#111827", marginBottom: 8 }}>
            {title}
          </div>
        ) : null}
        <div style={{ fontSize: 14, lineHeight: 1.6, textAlign: "center", color: "#4B5563", marginBottom: 18, wordBreak: "keep-all" }}>
          {message}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            onClick={() => onResult(false)}
            style={{
              width: "100%",
              padding: "13px 0",
              borderRadius: 12,
              border: "none",
              background: BLUE,
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {keepLabel}
          </button>
          <button
            type="button"
            onClick={() => onResult(true)}
            style={{
              width: "100%",
              padding: "13px 0",
              borderRadius: 12,
              border: "1px solid #E5E7EB",
              background: "#fff",
              color: "#DC2626",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {goLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function confirmDialog({ title, message, keepLabel, goLabel }) {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const finish = (result) => {
      root.unmount();
      host.remove();
      resolve(result);
    };
    root.render(
      <Dialog title={title} message={message} keepLabel={keepLabel} goLabel={goLabel} onResult={finish} />
    );
  });
}

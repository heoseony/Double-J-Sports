"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import LoadingScreen from "../components/LoadingScreen";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [openingId, setOpeningId] = useState(null);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/invoices", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await res.json();

      if (!res.ok) {
        setErrorMsg(result.error || "인보이스를 불러오지 못했습니다.");
        setLoading(false);
        return;
      }

      setInvoices(result.invoices || []);
      setLoading(false);
    }

    load();
  }, [router]);

  async function handleOpen(invoiceId) {
    setErrorMsg("");
    setOpeningId(invoiceId);

    // 모바일 사파리 등은 fetch(비동기) 이후에 호출되는 window.open을
    // 팝업으로 간주해서 차단하는 경우가 많다. 그래서 클릭한 "그 순간"에
    // 곧바로 빈 탭부터 열어두고, URL이 준비되면 그 탭의 주소만 바꿔준다.
    const newTab = window.open("", "_blank");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch("/api/invoice-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ invoiceId }),
    });
    const result = await res.json();

    setOpeningId(null);

    if (!res.ok) {
      setErrorMsg(result.error || "다운로드 링크 생성 실패");
      if (newTab) newTab.close();
      return;
    }

    if (newTab) {
      try {
        // 서명된 supabase URL로 바로 이동하면 주소창에 supabase.co 도메인이
        // 그대로 노출된다. 그래서 PDF 파일 자체를 한 번 받아온 뒤,
        // blob(우리 앱 도메인 기준 임시 주소)로 바꿔서 열어준다.
        const pdfRes = await fetch(result.url);
        const blob = await pdfRes.blob();
        const blobUrl = URL.createObjectURL(blob);
        newTab.location.href = blobUrl;
      } catch (e) {
        // 혹시 실패하면 기존 방식으로 폴백
        newTab.location.href = result.url;
      }
    } else {
      // 팝업 자체가 막힌 경우의 폴백: 현재 화면에서 바로 이동
      window.location.href = result.url;
    }
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  return (
    <main className="page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 4 }}>
        <img src="/logo-main.png" alt="" style={{ width: 30, height: "auto" }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          더블제이 축구 아카데미
        </div>
      </div>
      <div style={{ fontSize: 14, color: "#8ea0b8", marginBottom: 28, textAlign: "center" }}>내 인보이스</div>

      {errorMsg && (
        <div className="message error" style={{ marginBottom: 14 }}>
          {errorMsg}
        </div>
      )}

      <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
        {invoices.length === 0 && !errorMsg && (
          <p style={{ fontSize: 14, color: "#8ea0b8", padding: 18, margin: 0 }}>
            아직 발급된 인보이스가 없습니다.
          </p>
        )}

        {invoices.map((inv, idx) => (
          <div
            key={inv.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              borderBottom: idx === invoices.length - 1 ? "none" : "1px solid #f0f3f8",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#e9f1fb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82C4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1b3a63" }}>
                {inv.invoice_number} · {inv.payments?.members?.name || "회원"}
              </div>
              <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 2 }}>
                {formatDate(inv.issued_at)} · {inv.total_amount} EUR
              </div>
            </div>

            <button
              type="button"
              disabled={openingId === inv.id}
              onClick={() => handleOpen(inv.id)}
              style={{
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 700,
                border: "1px solid #3B82C4",
                borderRadius: 8,
                background: "white",
                color: "#3B82C4",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {openingId === inv.id ? "여는 중..." : "PDF 보기"}
            </button>
          </div>
        ))}
      </div>

      <div className="link-row">
        <Link href="/members">← 자녀 관리로</Link>
      </div>
    </main>
  );
}

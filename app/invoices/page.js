"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

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
      newTab.location.href = result.url;
    } else {
      // 팝업 자체가 막힌 경우의 폴백: 현재 화면에서 바로 이동
      window.location.href = result.url;
    }
  }

  if (loading) {
    return (
      <main className="page">
        <div className="subtitle">불러오는 중...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">내 인보이스</div>

      {errorMsg && (
        <div className="message error" style={{ marginBottom: 14 }}>
          {errorMsg}
        </div>
      )}

      <div className="card">
        {invoices.length === 0 && !errorMsg && (
          <p style={{ fontSize: 14, color: "#777" }}>
            아직 발급된 인보이스가 없습니다.
          </p>
        )}

        {invoices.map((inv) => (
          <div
            key={inv.id}
            style={{
              padding: "14px 0",
              borderBottom: "1px solid #eee",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {inv.invoice_number} · {inv.payments?.members?.name || "회원"}
            </div>
            <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
              발급일: {formatDate(inv.issued_at)} · {inv.total_amount} EUR
            </div>
            <button
              type="button"
              disabled={openingId === inv.id}
              onClick={() => handleOpen(inv.id)}
              style={{
                marginTop: 8,
                padding: "8px 16px",
                fontSize: 13,
                border: "none",
                borderRadius: 8,
                background: "#0b3d2e",
                color: "white",
                cursor: "pointer",
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

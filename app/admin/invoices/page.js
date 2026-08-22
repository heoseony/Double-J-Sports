"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function monthKey(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-");
  return `${y}년 ${Number(m)}월`;
}

export default function AdminInvoicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [invoices, setInvoices] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
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

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        router.push("/dashboard");
        return;
      }
      setIsAdmin(true);

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
        const pdfRes = await fetch(result.url);
        const blob = await pdfRes.blob();
        const blobUrl = URL.createObjectURL(blob);
        newTab.location.href = blobUrl;
      } catch (e) {
        newTab.location.href = result.url;
      }
    } else {
      window.location.href = result.url;
    }
  }

  if (loading || !isAdmin) {
    return (
      <main className="page">
        <div className="subtitle">확인 중...</div>
      </main>
    );
  }

  const filtered = invoices.filter((inv) => {
    const matchesQuery = (() => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.payments?.members?.name?.toLowerCase().includes(q) ||
        inv.payments?.members?.guardians?.name?.toLowerCase().includes(q)
      );
    })();

    const matchesMonth =
      selectedMonth === "all" || monthKey(inv.issued_at) === selectedMonth;

    return matchesQuery && matchesMonth;
  });

  const monthOptions = Array.from(
    new Set(invoices.map((inv) => monthKey(inv.issued_at)).filter(Boolean))
  ).sort((a, b) => (a < b ? 1 : -1)); // 최신 달이 위로

  return (
    <main className="page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 4 }}>
        <img src="/logo-main.png" alt="" style={{ width: 30, height: "auto" }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          더블제이 축구 아카데미
        </div>
      </div>
      <div style={{ fontSize: 14, color: "#8ea0b8", marginBottom: 28, textAlign: "center" }}>인보이스 관리</div>

      {errorMsg && (
        <div className="message error" style={{ marginBottom: 14 }}>
          {errorMsg}
        </div>
      )}

      <div className="card">
        <label>검색 (인보이스 번호 / 회원명 / 보호자명)</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="예: 2026-001, 서니, Sunny heo"
        />

        <label style={{ marginTop: 14 }}>발급 월</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            fontSize: 14,
            border: "1px solid #ddd",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          <option value="all">전체</option>
          {monthOptions.map((key) => (
            <option key={key} value={key}>
              {monthLabel(key)}
            </option>
          ))}
        </select>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          전체 인보이스 ({filtered.length}건)
        </div>

        {filtered.length === 0 && (
          <p style={{ fontSize: 14, color: "#8ea0b8", padding: 18, margin: 0 }}>
            발급된 인보이스가 없습니다.
          </p>
        )}

        {filtered.map((inv, idx) => (
          <div
            key={inv.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              borderBottom: idx === filtered.length - 1 ? "none" : "1px solid #f0f3f8",
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
                {inv.invoice_number} · {inv.payments?.members?.name || "(알 수 없음)"}
              </div>
              <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 2 }}>
                {inv.payments?.members?.guardians?.name || "-"} · {formatDate(inv.issued_at)} · {inv.total_amount} EUR
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
        <Link href="/admin">← 관리자 홈으로</Link>
      </div>
    </main>
  );
}

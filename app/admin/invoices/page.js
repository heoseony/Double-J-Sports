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
      return;
    }

    window.open(result.url, "_blank");
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
      <div className="brand">Double J Sports</div>
      <div className="subtitle">인보이스 관리</div>

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
          <p style={{ fontSize: 14, color: "#777" }}>
            발급된 인보이스가 없습니다.
          </p>
        )}

        {filtered.map((inv) => (
          <div
            key={inv.id}
            style={{
              padding: "14px 0",
              borderBottom: "1px solid #eee",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {inv.invoice_number} · {inv.payments?.members?.name || "(알 수 없음)"}
            </div>
            <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
              보호자: {inv.payments?.members?.guardians?.name || "-"} · 발급일:{" "}
              {formatDate(inv.issued_at)} · <strong>{inv.total_amount} EUR</strong>
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
        <Link href="/admin">← 관리자 홈으로</Link>
      </div>
    </main>
  );
}

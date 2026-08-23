"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import LoadingScreen from "../../components/LoadingScreen";

const BLUE = "#3B82C4";

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function defaultDescription() {
  const monthLabel = new Date().toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  return `Double J GmbH --\nAkademie-Training (${monthLabel})`;
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabelKr(key) {
  const [y, m] = key.split("-");
  return `${y}년 ${Number(m)}월`;
}

const TABS = [
  { key: "pending", label: "입금확인" },
  { key: "invoices", label: "인보이스" },
  { key: "settings", label: "계좌설정" },
  { key: "revenue", label: "매출현황" },
];

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ===== 입금확인 탭 상태 =====
  const [pendingPayments, setPendingPayments] = useState([]);
  const [confirmedPayments, setConfirmedPayments] = useState([]);
  const [clearedBefore, setClearedBefore] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [modalPayment, setModalPayment] = useState(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");

  // ===== 인보이스 탭 상태 =====
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [openingPdfPath, setOpeningPdfPath] = useState(null);
  const [invoiceMonthOffset, setInvoiceMonthOffset] = useState(0); // 0=이번달, -1=지난달, +1=다음달
  const [downloadingZip, setDownloadingZip] = useState(false);

  // ===== 계좌설정 탭 상태 =====
  const [settingsId, setSettingsId] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    bank_name: "",
    account_holder: "",
    iban: "",
    bic: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // ===== 매출현황 탭 상태 =====
  const [allConfirmedPayments, setAllConfirmedPayments] = useState([]);
  const [revenueLoaded, setRevenueLoaded] = useState(false);

  async function loadPayments() {
    const { data: pending } = await supabase
      .from("payments")
      .select(
        "id, total_amount, net_amount, vat_amount, discount_amount, depositor_name, requested_at, member_id, plan_id, members(name, program), membership_plans(name, sessions_per_month)"
      )
      .eq("status", "pending")
      .order("requested_at", { ascending: true });
    setPendingPayments(pending || []);

    const { data: confirmed } = await supabase
      .from("payments")
      .select(
        "id, total_amount, depositor_name, confirmed_at, members(name), membership_plans(name)"
      )
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .limit(20);
    setConfirmedPayments(confirmed || []);
  }

  async function loadInvoices() {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, invoice_number, issued_at, total_amount, payment_id, pdf_url"
      )
      .order("issued_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("인보이스 조회 실패:", error);
      setInvoices([]);
      setInvoicesLoaded(true);
      return;
    }

    const invoiceList = data || [];
    const paymentIds = invoiceList.map((inv) => inv.payment_id).filter(Boolean);

    let paymentsMap = {};
    if (paymentIds.length > 0) {
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("id, members(name), membership_plans(name)")
        .in("id", paymentIds);

      (paymentsData || []).forEach((p) => {
        paymentsMap[p.id] = p;
      });
    }

    const merged = invoiceList.map((inv) => ({
      ...inv,
      payments: paymentsMap[inv.payment_id] || null,
    }));

    setInvoices(merged);
    setInvoicesLoaded(true);
  }

  async function handleOpenInvoicePdf(invoiceId) {
    setOpeningPdfPath(invoiceId);

    // 팝업 차단 우회: 클릭 이벤트 직후(비동기 작업 전에) 빈 탭을 먼저 열어둔다
    const newTab = window.open("", "_blank");

    try {
  async function loadRevenue() {
    // 2026년 8월까지는 테스트 운영 기간이라 매출 집계에서 제외, 9월부터 정식 집계
    const { data } = await supabase
      .from("payments")
      .select("total_amount, confirmed_at, membership_plans(program)")
      .eq("status", "confirmed")
      .gte("confirmed_at", "2026-09-01")
      .order("confirmed_at", { ascending: true });
    setAllConfirmedPayments(data || []);
    setRevenueLoaded(true);
  }

      const res = await fetch("/api/invoice-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invoiceId }),
      });
      const result = await res.json();

      if (!res.ok || !result.url) {
        setErrorMsg("PDF를 여는 데 실패했습니다: " + (result.error || "알 수 없는 오류"));
        setOpeningPdfPath(null);
        if (newTab) newTab.close();
        return;
      }

      if (newTab) {
        newTab.location.href = result.url;
      } else {
        // 팝업이 아예 차단되어 새 탭 자체가 안 열린 경우, 같은 탭에서라도 열어준다
        window.location.href = result.url;
      }
    } catch (e) {
      setErrorMsg("PDF를 여는 데 실패했습니다: " + e.message);
      if (newTab) newTab.close();
    }
    setOpeningPdfPath(null);
  }

  async function handleDownloadZip(invoiceList) {
    setDownloadingZip(true);
    setErrorMsg("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setErrorMsg("로그인이 필요합니다.");
        setDownloadingZip(false);
        return;
      }

      const invoiceIds = invoiceList.map((inv) => inv.id);

      const res = await fetch("/api/invoices-zip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ invoiceIds }),
      });

      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        setErrorMsg("다운로드 실패: " + (result.error || "알 수 없는 오류"));
        setDownloadingZip(false);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "invoices.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setErrorMsg("다운로드 실패: " + e.message);
    }
    setDownloadingZip(false);
  }

  async function loadSettings() {
    const { data } = await supabase
      .from("payment_settings")
      .select("id, bank_name, account_holder, iban, bic")
      .limit(1)
      .maybeSingle();

    if (data) {
      setSettingsId(data.id);
      setSettingsForm({
        bank_name: data.bank_name || "",
        account_holder: data.account_holder || "",
        iban: data.iban || "",
        bic: data.bic || "",
      });
    }
    setSettingsLoaded(true);
  }

  async function loadRevenue() {
    // 2026년 8월까지는 테스트 운영 기간이라 매출 집계에서 제외, 9월부터 정식 집계
    const { data } = await supabase
      .from("payments")
      .select("total_amount, confirmed_at")
      .eq("status", "confirmed")
      .gte("confirmed_at", "2026-09-01")
      .order("confirmed_at", { ascending: true });
    setAllConfirmedPayments(data || []);
    setRevenueLoaded(true);
  }

  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      setIsAdmin(true);
      setAdminUserId(user.id);

      try {
        const stored = localStorage.getItem(
          "double-j-sports-payments-cleared-before"
        );
        if (stored) setClearedBefore(stored);
      } catch (e) {
        // localStorage 접근 불가 시 그냥 무시 (숨김 기능만 안 됨)
      }

      await loadPayments();
      setLoading(false);
    }

    check();
  }, [router]);

  // 탭 전환 시 필요한 데이터 지연 로딩
  useEffect(() => {
    if (activeTab === "invoices" && !invoicesLoaded) loadInvoices();
    if (activeTab === "settings" && !settingsLoaded) loadSettings();
    if (activeTab === "revenue" && !revenueLoaded) loadRevenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function openConfirmModal(payment) {
    setModalPayment(payment);
    setDescriptionDraft(defaultDescription());
  }

  function closeConfirmModal() {
    setModalPayment(null);
    setDescriptionDraft("");
  }

  function handleClearConfirmedList() {
    const now = new Date().toISOString();
    try {
      localStorage.setItem("double-j-sports-payments-cleared-before", now);
    } catch (e) {
      // localStorage 접근 불가 시에도 이번 세션 동안은 화면에서 숨겨지도록 진행
    }
    setClearedBefore(now);
  }

  async function handleConfirm(payment, description) {
    setErrorMsg("");
    setSuccessMsg("");
    setConfirmingId(payment.id);
    closeConfirmModal();

    const { error: paymentUpdateError } = await supabase
      .from("payments")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: adminUserId,
      })
      .eq("id", payment.id);

    if (paymentUpdateError) {
      setConfirmingId(null);
      setErrorMsg("결제 확인 실패: " + paymentUpdateError.message);
      return;
    }

    const { error: membershipError } = await supabase
      .from("memberships")
      .insert({
        member_id: payment.member_id,
        plan_id: payment.plan_id,
        start_date: todayStr(),
        status: "active",
        sessions_used: 0,
      });

    if (membershipError) {
      setConfirmingId(null);
      setErrorMsg(
        "결제는 확인됐지만 회원권 배정에 실패했습니다: " +
          membershipError.message +
          " (회원권 배정 화면에서 수동으로 배정해주세요)"
      );
      await loadPayments();
      return;
    }

    let invoiceNote = "";
    try {
      const res = await fetch("/api/generate-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          descriptionOverride: description,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        invoiceNote = ` (⚠ 인보이스 발급 실패: ${result.error || "알 수 없는 오류"})`;
      } else if (!result.emailSent) {
        invoiceNote = ` (인보이스 ${result.invoiceNumber} 발급됨, 이메일 발송은 실패: ${
          result.emailError || "알 수 없는 이유"
        })`;
      } else {
        invoiceNote = ` (인보이스 ${result.invoiceNumber} 발급 및 이메일 발송 완료)`;
      }
    } catch (e) {
      invoiceNote = ` (⚠ 인보이스 발급 요청 자체가 실패했습니다: ${e.message})`;
    }

    setConfirmingId(null);
    setSuccessMsg(
      `${payment.members?.name || "회원"}님의 결제가 확인되고 회원권이 배정되었습니다.${invoiceNote}`
    );
    await loadPayments();
    // 인보이스/매출현황 탭 캐시 무효화 (다음에 탭 전환 시 새로 불러오도록)
    setInvoicesLoaded(false);
    setRevenueLoaded(false);
  }

  function handleSettingsChange(key, value) {
    setSettingsForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSettingsSubmit(e) {
    e.preventDefault();
    setSettingsError("");
    setSettingsSuccess("");
    setSettingsSaving(true);

    let error;

    if (settingsId) {
      const { error: updateError } = await supabase
        .from("payment_settings")
        .update(settingsForm)
        .eq("id", settingsId);
      error = updateError;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("payment_settings")
        .insert(settingsForm)
        .select()
        .single();
      error = insertError;
      if (inserted) setSettingsId(inserted.id);
    }

    setSettingsSaving(false);

    if (error) {
      setSettingsError("저장 실패: " + error.message);
      return;
    }

    setSettingsSuccess("저장되었습니다.");
  }

  if (loading || !isAdmin) {
    return <LoadingScreen text="확인 중..." />;
  }

  // ===== 매출현황 집계 계산 =====
  const revenueByMonth = {};
  allConfirmedPayments.forEach((p) => {
    if (!p.confirmed_at) return;
    const key = monthKey(p.confirmed_at);
    revenueByMonth[key] = (revenueByMonth[key] || 0) + Number(p.total_amount || 0);
  });
  const sortedMonthKeys = Object.keys(revenueByMonth).sort();
  const last6Months = sortedMonthKeys.slice(-6);
  const maxRevenue = Math.max(1, ...last6Months.map((k) => revenueByMonth[k]));
  const thisMonthKey = monthKey(todayStr());
  const thisMonthRevenue = revenueByMonth[thisMonthKey] || 0;

  return (
    <main
      style={{
        background: "#f3f7fc",
        minHeight: "100vh",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <Link href="/dashboard" style={{ color: "#1b3a63", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>결제 관리</div>
      </div>

      {/* 탭 바 */}
  // ===== 매출현황 집계 계산 =====
  const revenueByMonth = {};
  allConfirmedPayments.forEach((p) => {
    if (!p.confirmed_at) return;
    const key = monthKey(p.confirmed_at);
    revenueByMonth[key] = (revenueByMonth[key] || 0) + Number(p.total_amount || 0);
  });
  const sortedMonthKeys = Object.keys(revenueByMonth).sort();
  const last6Months = sortedMonthKeys.slice(-6);
  const maxRevenue = Math.max(1, ...last6Months.map((k) => revenueByMonth[k]));
  const thisMonthKey = monthKey(todayStr());
  const thisMonthRevenue = revenueByMonth[thisMonthKey] || 0;

  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  const thisYearRevenue = sortedMonthKeys
    .filter((k) => k.startsWith(String(currentYear)))
    .reduce((sum, k) => sum + revenueByMonth[k], 0);
  const lastYearRevenue = sortedMonthKeys
    .filter((k) => k.startsWith(String(lastYear)))
    .reduce((sum, k) => sum + revenueByMonth[k], 0);
  const yoyChangePct =
    lastYearRevenue > 0
      ? Math.round(((thisYearRevenue - lastYearRevenue) / lastYearRevenue) * 1000) / 10
      : null;

  const revenueByProgram = { kids: 0, women: 0, men: 0 };
  allConfirmedPayments.forEach((p) => {
    const program = p.membership_plans?.program;
    if (program && revenueByProgram[program] !== undefined) {
      revenueByProgram[program] += Number(p.total_amount || 0);
    }
  });
  const totalProgramRevenue =
    revenueByProgram.kids + revenueByProgram.women + revenueByProgram.men;
  const programLabels = { kids: "Kids", women: "Women's", men: "Men's" };
  const programColors = { kids: "#3B82C4", women: "#8b5cf6", men: "#2fa370" };
              fontWeight: 700,
              border: "none",
              borderRadius: 999,
              background: activeTab === tab.key ? BLUE : "white",
              color: activeTab === tab.key ? "white" : "#5b7699",
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 1px 4px rgba(30,60,110,0.06)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "14px 18px 0" }}>
        {errorMsg && (
          <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ background: "#e9f1fb", color: "#1b3a63", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            {successMsg}
          </div>
        )}

        {/* ===================== 입금확인 탭 ===================== */}
        {activeTab === "pending" && (
          <>
            <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 12 }}>
                입금 확인 대기 ({pendingPayments.length}건)
              </div>

              {pendingPayments.length === 0 && (
                <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
                  현재 입금 확인 대기 중인 신청이 없습니다.
                </p>
              )}

              {pendingPayments.map((p, idx) => (
                <div key={p.id} style={{ padding: "14px 0", borderTop: idx === 0 ? "none" : "1px solid #f0f3f8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>
                      {p.members?.name || "(알 수 없음)"}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: BLUE, background: "#e9f1fb", padding: "2px 8px", borderRadius: 999 }}>
                      {p.members?.program}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#33455e", marginTop: 6 }}>
                    {p.membership_plans?.name} ({p.membership_plans?.sessions_per_month}회) ·{" "}
                    <strong>{p.total_amount} EUR</strong>
                {Number(p.discount_amount) > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#3B82C4", background: "#e9f1fb", padding: "2px 8px", borderRadius: 999, marginLeft: 8 }}>
                    쿠폰 {p.discount_amount} EUR 할인 적용
                  </span>
                )}
                  </div>
                  <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 4 }}>
                    입금자명: <strong>{p.depositor_name}</strong> · 신청일시: {new Date(p.requested_at).toLocaleString("ko-KR")}
                  </div>
                  <button
                    type="button"
                    style={{ marginTop: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 10, background: BLUE, color: "white", cursor: "pointer" }}
                    disabled={confirmingId === p.id}
                    onClick={() => openConfirmModal(p)}
                  >
                    {confirmingId === p.id ? "처리 중..." : "입금확인 · 회원권 활성화"}
                  </button>
                </div>
              ))}
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63" }}>최근 확인 완료 내역</div>
                {confirmedPayments.some((p) => !clearedBefore || p.confirmed_at > clearedBefore) && (
                  <button
                    type="button"
                    onClick={handleClearConfirmedList}
                    style={{ fontSize: 12, fontWeight: 700, color: "#8ea0b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    모두 지우기
                  </button>
                )}
              </div>

              {(() => {
                const visibleConfirmed = confirmedPayments.filter((p) => !clearedBefore || p.confirmed_at > clearedBefore);
                if (visibleConfirmed.length === 0) {
                  return <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>아직 확인된 결제 내역이 없습니다.</p>;
                }
                return visibleConfirmed.map((p, idx) => (
                  <div key={p.id} style={{ padding: "10px 0", borderTop: idx === 0 ? "none" : "1px solid #f0f3f8", fontSize: 13 }}>
                    <div style={{ color: "#1b3a63", fontWeight: 600 }}>
                      {p.members?.name} — {p.membership_plans?.name} · {p.total_amount} EUR
                    </div>
                    <div style={{ color: "#8ea0b8", fontSize: 12, marginTop: 2 }}>
                      입금자명: {p.depositor_name} · 확인일시: {new Date(p.confirmed_at).toLocaleString("ko-KR")}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </>
        )}

        {/* ===================== 인보이스 탭 ===================== */}
        {activeTab === "invoices" && (
          <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 12 }}>
              발급된 인보이스 ({invoices.length}건)
            </div>

            <input
              type="text"
              value={invoiceSearchQuery}
              onChange={(e) => setInvoiceSearchQuery(e.target.value)}
              placeholder="회원 이름으로 검색"
              style={{
                width: "100%",
                padding: 12,
                fontSize: 14,
                border: "1px solid #e5eaf2",
                borderRadius: 10,
                background: "#f7fafd",
                marginBottom: 14,
                boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />

            {!invoicesLoaded && <p style={{ fontSize: 13, color: "#8ea0b8" }}>불러오는 중...</p>}

            {invoicesLoaded && invoices.length === 0 && (
              <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>아직 발급된 인보이스가 없습니다.</p>
            )}

            {invoicesLoaded && invoices.length > 0 && (() => {
              const isSearching = invoiceSearchQuery.trim().length > 0;

              const filtered = invoices.filter((inv) => {
                if (!isSearching) return true;
                const name = inv.payments?.members?.name || "";
                return name.includes(invoiceSearchQuery.trim());
              });

              if (isSearching) {
                if (filtered.length === 0) {
                  return <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>검색 결과가 없습니다.</p>;
                }

                const groupedByMonth = {};
                filtered.forEach((inv) => {
                  const key = inv.issued_at ? inv.issued_at.slice(0, 7) : "미상";
                  if (!groupedByMonth[key]) groupedByMonth[key] = [];
                  groupedByMonth[key].push(inv);
                });
                const monthKeys = Object.keys(groupedByMonth).sort((a, b) => (a < b ? 1 : -1));

                return monthKeys.map((monthKey) => (
                  <div key={monthKey} style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BLUE, marginBottom: 8 }}>
                      {monthKey === "미상" ? "날짜 미상" : `${monthKey.slice(0, 4)}년 ${Number(monthKey.slice(5, 7))}월`}
                    </div>
                    {groupedByMonth[monthKey].map((inv, idx) => (
                      <InvoiceRow key={inv.id} inv={inv} idx={idx} openingPdfPath={openingPdfPath} handleOpenInvoicePdf={handleOpenInvoicePdf} />
                    ))}
                  </div>
                ));
              }

              // 검색 중이 아닐 때: 월 하나씩 넘겨보기
              const now = new Date();
              const targetDate = new Date(now.getFullYear(), now.getMonth() + invoiceMonthOffset, 1);
              const targetKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
              const targetLabel = `${targetDate.getFullYear()}년 ${targetDate.getMonth() + 1}월`;

              const monthInvoices = invoices.filter((inv) => inv.issued_at && inv.issued_at.slice(0, 7) === targetKey);

              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <button
                      type="button"
                      onClick={() => setInvoiceMonthOffset((v) => v - 1)}
                      style={{ padding: "6px 12px", border: "1px solid #e5eaf2", borderRadius: 8, background: "white", color: "#1b3a63", cursor: "pointer" }}
                    >
                      ‹
                    </button>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63" }}>{targetLabel}</div>
                    <button
                      type="button"
                      onClick={() => setInvoiceMonthOffset((v) => v + 1)}
                      style={{ padding: "6px 12px", border: "1px solid #e5eaf2", borderRadius: 8, background: "white", color: "#1b3a63", cursor: "pointer" }}
                    >
                      ›
                    </button>
                  </div>

                  {monthInvoices.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleDownloadZip(monthInvoices)}
                      disabled={downloadingZip}
                      style={{
                        width: "100%",
                        padding: 12,
                        fontSize: 13,
                        fontWeight: 700,
                        border: "1px solid #e5eaf2",

            <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ fontSize: 13, color: "#8ea0b8", marginBottom: 4 }}>
                {currentYear}년 누적 매출
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#1b3a63" }}>
                  {thisYearRevenue.toLocaleString()} EUR
                </div>
                {yoyChangePct !== null && (
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: yoyChangePct >= 0 ? "#2fa370" : "#b3261e",
                    }}
                  >
                    전년 대비 {yoyChangePct >= 0 ? "+" : ""}{yoyChangePct}%
                  </div>
                )}
              </div>
              {yoyChangePct === null && (
                <div style={{ fontSize: 12, color: "#aab9cc", marginTop: 4 }}>
                  {lastYear}년 데이터가 없어 전년 대비 비교는 제공되지 않습니다.
                </div>
              )}
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 14 }}>
                프로그램별 매출 비중
              </div>

              {totalProgramRevenue === 0 ? (
                <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>아직 집계된 매출이 없습니다.</p>
              ) : (
                <>
                  <div style={{ display: "flex", width: "100%", height: 14, borderRadius: 999, overflow: "hidden", marginBottom: 14 }}>
                    {["kids", "women", "men"].map((key) => {
                      const pct = (revenueByProgram[key] / totalProgramRevenue) * 100;
                      if (pct <= 0) return null;
                      return (
                        <div
                          key={key}
                          style={{ width: `${pct}%`, background: programColors[key] }}
                        />
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {["kids", "women", "men"].map((key) => {
                      const amount = revenueByProgram[key];
                      const pct = totalProgramRevenue > 0 ? Math.round((amount / totalProgramRevenue) * 1000) / 10 : 0;
                      return (
                        <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: programColors[key], display: "inline-block" }} />
                            <span style={{ color: "#33455e" }}>{programLabels[key]}</span>
                          </div>
                          <div>
                            <strong style={{ color: "#1b3a63" }}>{amount.toLocaleString()} EUR</strong>
                            <span style={{ color: "#8ea0b8", marginLeft: 6 }}>({pct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ fontSize: 13, color: "#8ea0b8", marginBottom: 4 }}>
                {currentYear}년 누적 매출
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#1b3a63" }}>
                  {thisYearRevenue.toLocaleString()} EUR
                </div>
                {yoyChangePct !== null && (
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: yoyChangePct >= 0 ? "#2fa370" : "#b3261e",
                    }}
                  >
                    전년 대비 {yoyChangePct >= 0 ? "+" : ""}{yoyChangePct}%
                  </div>
                )}
              </div>
              {yoyChangePct === null && (
                <div style={{ fontSize: 12, color: "#aab9cc", marginTop: 4 }}>
                  {lastYear}년 데이터가 없어 전년 대비 비교는 제공되지 않습니다.
                </div>
              )}
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 14 }}>
                프로그램별 매출 비중
              </div>

              {totalProgramRevenue === 0 ? (
                <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>아직 집계된 매출이 없습니다.</p>
              ) : (
                <>
                  <div style={{ display: "flex", width: "100%", height: 14, borderRadius: 999, overflow: "hidden", marginBottom: 14 }}>
                    {["kids", "women", "men"].map((key) => {
                      const pct = (revenueByProgram[key] / totalProgramRevenue) * 100;
                      if (pct <= 0) return null;
                      return (
                        <div
                          key={key}
                          style={{ width: `${pct}%`, background: programColors[key] }}
                        />
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {["kids", "women", "men"].map((key) => {
                      const amount = revenueByProgram[key];
                      const pct = totalProgramRevenue > 0 ? Math.round((amount / totalProgramRevenue) * 1000) / 10 : 0;
                      return (
                        <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: programColors[key], display: "inline-block" }} />
                            <span style={{ color: "#33455e" }}>{programLabels[key]}</span>
                          </div>
                          <div>
                            <strong style={{ color: "#1b3a63" }}>{amount.toLocaleString()} EUR</strong>
                            <span style={{ color: "#8ea0b8", marginLeft: 6 }}>({pct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
                        borderRadius: 10,
                        background: "white",
                        color: BLUE,
                        cursor: downloadingZip ? "default" : "pointer",
                        marginBottom: 14,
                      }}
                    >
                      {downloadingZip ? "압축 중..." : `이 달 인보이스 모두 다운받기 (${monthInvoices.length}건)`}
                    </button>
                  )}

                  {monthInvoices.length === 0 && (
                    <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>이 달에는 발급된 인보이스가 없습니다.</p>
                  )}

                  {monthInvoices.map((inv, idx) => (
                    <InvoiceRow key={inv.id} inv={inv} idx={idx} openingPdfPath={openingPdfPath} handleOpenInvoicePdf={handleOpenInvoicePdf} />
                  ))}
                </>
              );
            })()}
          </div>
        )}

        {/* ===================== 계좌설정 탭 ===================== */}
        {activeTab === "settings" && (
          <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
            <p style={{ fontSize: 13, color: "#8ea0b8", marginTop: 0, marginBottom: 16 }}>
              회원권 신청 시 학부모/회원에게 안내되는 입금 계좌 정보입니다.
            </p>

            {!settingsLoaded ? (
              <p style={{ fontSize: 13, color: "#8ea0b8" }}>불러오는 중...</p>
            ) : (
              <form onSubmit={handleSettingsSubmit}>
                {[
                  { key: "bank_name", label: "은행명" },
                  { key: "account_holder", label: "예금주" },
                  { key: "iban", label: "IBAN" },
                  { key: "bic", label: "BIC" },
                ].map((f) => (
                  <div key={f.key}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", display: "block", marginBottom: 6 }}>
                      {f.label}
                    </label>
                    <input
                      type="text"
                      value={settingsForm[f.key]}
                      onChange={(e) => handleSettingsChange(f.key, e.target.value)}
                      style={{ width: "100%", padding: 14, fontSize: 15, border: "1px solid #e5eaf2", borderRadius: 10, background: "#f7fafd", marginBottom: 14, boxSizing: "border-box", fontFamily: "inherit" }}
                    />
                  </div>
                ))}

                {settingsError && (
                  <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
                    {settingsError}
                  </div>
                )}
                {settingsSuccess && (
                  <div style={{ background: "#e9f1fb", color: "#1b3a63", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
                    {settingsSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={settingsSaving}
                  style={{ width: "100%", padding: 14, fontSize: 15, fontWeight: 700, color: "white", background: settingsSaving ? "#9db8d6" : BLUE, border: "none", borderRadius: 10, cursor: settingsSaving ? "default" : "pointer" }}
                >
                  {settingsSaving ? "저장 중..." : "저장"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ===================== 매출현황 탭 ===================== */}
        {activeTab === "revenue" && (
          <>
            <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ fontSize: 13, color: "#8ea0b8", marginBottom: 4 }}>이번 달 매출</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#1b3a63" }}>
                {thisMonthRevenue.toLocaleString()} EUR
              </div>
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 16 }}>
                최근 {last6Months.length}개월 매출
              </div>

              {!revenueLoaded && <p style={{ fontSize: 13, color: "#8ea0b8" }}>불러오는 중...</p>}

              {revenueLoaded && last6Months.length === 0 && (
                <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>아직 확정된 매출 데이터가 없습니다.</p>
              )}

              {revenueLoaded && last6Months.length > 0 && (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 160, paddingTop: 10 }}>
                  {last6Months.map((key) => {
                    const value = revenueByMonth[key];
                    const heightPct = Math.max(4, (value / maxRevenue) * 100);
                    return (
                      <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                        <div style={{ fontSize: 11, color: "#1b3a63", fontWeight: 700, marginBottom: 4 }}>
                          {value.toLocaleString()}
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height: `${heightPct}%`,
                            background: key === thisMonthKey ? BLUE : "#bcd7ee",
                            borderRadius: "6px 6px 0 0",
                          }}
                        />
                        <div style={{ fontSize: 11, color: "#8ea0b8", marginTop: 6 }}>
                          {key.slice(5, 7)}월
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 12 }}>월별 매출 상세</div>

              {revenueLoaded && sortedMonthKeys.length === 0 && (
                <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>데이터가 없습니다.</p>
              )}

              {[...sortedMonthKeys].reverse().map((key, idx) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: idx === 0 ? "none" : "1px solid #f0f3f8", fontSize: 13 }}>
                  <span style={{ color: "#33455e" }}>{monthLabelKr(key)}</span>
                  <strong style={{ color: "#1b3a63" }}>{revenueByMonth[key].toLocaleString()} EUR</strong>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/dashboard" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 관리자 홈으로
          </Link>
        </div>
      </div>

      {/* ===================== 입금확인 모달 ===================== */}
      {modalPayment && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(20,35,60,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}
          onClick={closeConfirmModal}
        >
          <div style={{ background: "white", borderRadius: 16, padding: 20, width: "100%", maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1b3a63", marginBottom: 6 }}>
              입금 확인 · 인보이스 발급
            </div>
            <p style={{ fontSize: 13, color: "#8ea0b8", marginTop: 0 }}>
              {modalPayment.members?.name || "회원"}님 · {modalPayment.membership_plans?.name} ·{" "}
              <strong style={{ color: "#1b3a63" }}>{modalPayment.total_amount} EUR</strong>
            </p>

            <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>인보이스 항목 설명 (Description)</label>
            <textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              rows={3}
              style={{ width: "100%", marginTop: 6, padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 10, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <p style={{ fontSize: 12, color: "#aab9cc", marginTop: 4 }}>
              보통 자동으로 채워진 이번 달 문구 그대로 발급하면 됩니다. 필요할 때만 수정해주세요.
              (회차·금액은 자동 계산되어 여기서 바뀌지 않습니다)
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => handleConfirm(modalPayment, descriptionDraft)}
                style={{ flex: 1, padding: "12px 16px", fontSize: 14, fontWeight: 700, border: "none", borderRadius: 10, background: BLUE, color: "white", cursor: "pointer" }}
              >
                이대로 발급
              </button>
              <button
                type="button"
                onClick={closeConfirmModal}
                style={{ padding: "12px 16px", fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 10, background: "white", color: "#5b7699", cursor: "pointer" }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function InvoiceRow({ inv, idx, openingPdfPath, handleOpenInvoicePdf }) {
  return (
    <div style={{ padding: "12px 0", borderTop: idx === 0 ? "none" : "1px solid #f0f3f8", fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <div>
          <span style={{ color: "#1b3a63", fontWeight: 700 }}>{inv.invoice_number}</span>
          <span style={{ color: "#33455e", marginLeft: 8 }}>
            {inv.payments?.members?.name} · {inv.payments?.membership_plans?.name}
          </span>
        </div>
        {inv.pdf_url && (
          <button
            type="button"
            onClick={() => handleOpenInvoicePdf(inv.id)}
            disabled={openingPdfPath === inv.id}
            style={{
              color: BLUE,
              fontWeight: 700,
              fontSize: 12,
              background: "none",
              border: "none",
              cursor: openingPdfPath === inv.id ? "default" : "pointer",
              padding: 0,
            }}
          >
            {openingPdfPath === inv.id ? "여는 중..." : "PDF 보기"}
          </button>
        )}
      </div>
      <div style={{ color: "#8ea0b8", fontSize: 12, marginTop: 4 }}>
        발행일: {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString("ko-KR") : "-"} · 금액: {inv.total_amount} EUR
      </div>
    </div>
  );
}

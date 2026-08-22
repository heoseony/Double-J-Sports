"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

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

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState(null);

  const [pendingPayments, setPendingPayments] = useState([]);
  const [confirmedPayments, setConfirmedPayments] = useState([]);
  const [clearedBefore, setClearedBefore] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [modalPayment, setModalPayment] = useState(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");

  async function loadPayments() {
    const { data: pending } = await supabase
      .from("payments")
      .select(
        "id, total_amount, net_amount, vat_amount, depositor_name, requested_at, member_id, plan_id, members(name, program), membership_plans(name, sessions_per_month)"
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
  }

  if (loading || !isAdmin) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div style={{ fontSize: 14, color: "#5b7699" }}>확인 중...</div>
      </main>
    );
  }

  return (
    <main style={{ background: "#f3f7fc", minHeight: "100vh", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <Link href="/admin" style={{ color: "#1b3a63", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>결제 관리</div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
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
            <div
              key={p.id}
              style={{
                padding: "14px 0",
                borderTop: idx === 0 ? "none" : "1px solid #f0f3f8",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>
                  {p.members?.name || "(알 수 없음)"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: BLUE,
                    background: "#e9f1fb",
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  {p.members?.program}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#33455e", marginTop: 6 }}>
                {p.membership_plans?.name} ({p.membership_plans?.sessions_per_month}회) ·{" "}
                <strong>{p.total_amount} EUR</strong>
              </div>
              <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 4 }}>
                입금자명: <strong>{p.depositor_name}</strong> · 신청일시:{" "}
                {new Date(p.requested_at).toLocaleString("ko-KR")}
              </div>
              <button
                type="button"
                style={{
                  marginTop: 10,
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 10,
                  background: BLUE,
                  color: "white",
                  cursor: "pointer",
                }}
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
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63" }}>
              최근 확인 완료 내역
            </div>
            {confirmedPayments.some(
              (p) => !clearedBefore || p.confirmed_at > clearedBefore
            ) && (
              <button
                type="button"
                onClick={handleClearConfirmedList}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#8ea0b8",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                모두 지우기
              </button>
            )}
          </div>

          {(() => {
            const visibleConfirmed = confirmedPayments.filter(
              (p) => !clearedBefore || p.confirmed_at > clearedBefore
            );

            if (visibleConfirmed.length === 0) {
              return (
                <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
                  아직 확인된 결제 내역이 없습니다.
                </p>
              );
            }

            return visibleConfirmed.map((p, idx) => (
              <div
                key={p.id}
                style={{
                  padding: "10px 0",
                  borderTop: idx === 0 ? "none" : "1px solid #f0f3f8",
                  fontSize: 13,
                }}
              >
                <div style={{ color: "#1b3a63", fontWeight: 600 }}>
                  {p.members?.name} — {p.membership_plans?.name} · {p.total_amount} EUR
                </div>
                <div style={{ color: "#8ea0b8", fontSize: 12, marginTop: 2 }}>
                  입금자명: {p.depositor_name} · 확인일시:{" "}
                  {new Date(p.confirmed_at).toLocaleString("ko-KR")}
                </div>
              </div>
            ));
          })()}
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/admin" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 관리자 홈으로
          </Link>
        </div>
      </div>

      {modalPayment && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20,35,60,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={closeConfirmModal}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 20,
              width: "100%",
              maxWidth: 420,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1b3a63", marginBottom: 6 }}>
              입금 확인 · 인보이스 발급
            </div>
            <p style={{ fontSize: 13, color: "#8ea0b8", marginTop: 0 }}>
              {modalPayment.members?.name || "회원"}님 · {modalPayment.membership_plans?.name} ·{" "}
              <strong style={{ color: "#1b3a63" }}>{modalPayment.total_amount} EUR</strong>
            </p>

            <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>
              인보이스 항목 설명 (Description)
            </label>
            <textarea
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                marginTop: 6,
                padding: 10,
                fontSize: 14,
                border: "1px solid #e5eaf2",
                borderRadius: 10,
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <p style={{ fontSize: 12, color: "#aab9cc", marginTop: 4 }}>
              보통 자동으로 채워진 이번 달 문구 그대로 발급하면 됩니다. 필요할 때만 수정해주세요.
              (회차·금액은 자동 계산되어 여기서 바뀌지 않습니다)
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => handleConfirm(modalPayment, descriptionDraft)}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 10,
                  background: BLUE,
                  color: "white",
                  cursor: "pointer",
                }}
              >
                이대로 발급
              </button>
              <button
                type="button"
                onClick={closeConfirmModal}
                style={{
                  padding: "12px 16px",
                  fontSize: 14,
                  border: "1px solid #e5eaf2",
                  borderRadius: 10,
                  background: "white",
                  color: "#5b7699",
                  cursor: "pointer",
                }}
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

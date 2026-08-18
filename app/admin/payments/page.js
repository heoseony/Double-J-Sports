"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState(null);

  const [pendingPayments, setPendingPayments] = useState([]);
  const [confirmedPayments, setConfirmedPayments] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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
      await loadPayments();
      setLoading(false);
    }

    check();
  }, [router]);

  async function handleConfirm(payment) {
    setErrorMsg("");
    setSuccessMsg("");
    setConfirmingId(payment.id);

    // 1. 결제 상태를 confirmed로 변경
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

    // 2. 회원권 자동 배정 (기존 admin/memberships 페이지와 같은 방식)
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

    // 참고: Invoice 생성 + 이메일 발송은 다음 단계에서 여기에 연결됩니다.

    setConfirmingId(null);
    setSuccessMsg(
      `${payment.members?.name || "회원"}님의 결제가 확인되고 회원권이 배정되었습니다.`
    );
    await loadPayments();
  }

  if (loading || !isAdmin) {
    return (
      <main className="page">
        <div className="subtitle">확인 중...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">결제 관리</div>

      {errorMsg && (
        <div className="message error" style={{ marginBottom: 14 }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div
          className="message"
          style={{
            marginBottom: 14,
            background: "#f0f7f2",
            color: "#0b3d2e",
            padding: 12,
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {successMsg}
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          입금 확인 대기 ({pendingPayments.length}건)
        </div>

        {pendingPayments.length === 0 && (
          <p style={{ fontSize: 14, color: "#777" }}>
            현재 입금 확인 대기 중인 신청이 없습니다.
          </p>
        )}

        {pendingPayments.map((p) => (
          <div
            key={p.id}
            style={{
              padding: "14px 0",
              borderBottom: "1px solid #eee",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {p.members?.name || "(알 수 없음)"} · [{p.members?.program}]
            </div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              {p.membership_plans?.name} ({p.membership_plans?.sessions_per_month}
              회) · <strong>{p.total_amount} EUR</strong>
            </div>
            <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
              입금자명: <strong>{p.depositor_name}</strong> · 신청일시:{" "}
              {new Date(p.requested_at).toLocaleString("ko-KR")}
            </div>
            <button
              type="button"
              style={{
                marginTop: 10,
                padding: "8px 16px",
                fontSize: 13,
                border: "none",
                borderRadius: 8,
                background: "#0b3d2e",
                color: "white",
                cursor: "pointer",
              }}
              disabled={confirmingId === p.id}
              onClick={() => handleConfirm(p)}
            >
              {confirmingId === p.id ? "처리 중..." : "입금확인 · 회원권 활성화"}
            </button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          최근 확인 완료 내역
        </div>

        {confirmedPayments.length === 0 && (
          <p style={{ fontSize: 14, color: "#777" }}>
            아직 확인된 결제 내역이 없습니다.
          </p>
        )}

        {confirmedPayments.map((p) => (
          <div
            key={p.id}
            style={{
              padding: "10px 0",
              borderBottom: "1px solid #eee",
              fontSize: 14,
            }}
          >
            <div>
              {p.members?.name} — {p.membership_plans?.name} ·{" "}
              {p.total_amount} EUR
            </div>
            <div style={{ color: "#777", fontSize: 12, marginTop: 2 }}>
              입금자명: {p.depositor_name} · 확인일시:{" "}
              {new Date(p.confirmed_at).toLocaleString("ko-KR")}
            </div>
          </div>
        ))}
      </div>

      <div className="link-row">
        <Link href="/admin">← 관리자 홈으로</Link>
      </div>
    </main>
  );
}

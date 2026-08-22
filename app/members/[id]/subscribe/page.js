"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

const BLUE = "#3B82C4";

export default function SubscribePage() {
  const router = useRouter();
  const params = useParams();
  const memberId = params.id;

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [plans, setPlans] = useState([]);
  const [settings, setSettings] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [planId, setPlanId] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // 신청 완료 후 결과(계좌정보 표시용)

  const [pendingPayments, setPendingPayments] = useState([]);

  async function loadPendingPayments() {
    const { data } = await supabase
      .from("payments")
      .select("id, total_amount, depositor_name, status, requested_at, membership_plans(name)")
      .eq("member_id", memberId)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    setPendingPayments(data || []);
  }

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("id, name, program")
        .eq("id", memberId)
        .single();

      if (memberError || !memberData) {
        setErrorMsg("회원 정보를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }
      setMember(memberData);

      const { data: planData } = await supabase
        .from("membership_plans")
        .select("id, name, program, sessions_per_month, price, currency")
        .eq("active", true)
        .eq("program", memberData.program)
        .order("price", { ascending: true });
      setPlans(planData || []);

      const { data: settingsData } = await supabase
        .from("payment_settings")
        .select("bank_name, account_holder, iban, bic")
        .single();
      setSettings(settingsData);

      await loadPendingPayments();
      setLoading(false);
    }

    load();
  }, [router, memberId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!planId || !depositorName.trim()) {
      setErrorMsg("상품과 입금자명을 모두 입력해주세요.");
      return;
    }

    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      setErrorMsg("선택한 상품을 찾을 수 없습니다.");
      return;
    }

    setSubmitting(true);

    const totalAmount = Number(plan.price);
    const netAmount = Math.round((totalAmount / 1.19) * 100) / 100;
    const vatAmount = Math.round((totalAmount - netAmount) * 100) / 100;

    const { data: paymentData, error } = await supabase
      .from("payments")
      .insert({
        member_id: memberId,
        plan_id: planId,
        depositor_name: depositorName.trim(),
        total_amount: totalAmount,
        net_amount: netAmount,
        vat_amount: vatAmount,
        status: "pending",
      })
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      setErrorMsg("신청 실패: " + error.message);
      return;
    }

    setSubmitted({ ...paymentData, planName: plan.name });
    setPlanId("");
    setDepositorName("");
    await loadPendingPayments();
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div style={{ fontSize: 14, color: "#5b7699" }}>불러오는 중...</div>
      </main>
    );
  }

  if (errorMsg && !member) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div
          style={{
            background: "#fdecec",
            color: "#b3261e",
            padding: 12,
            borderRadius: 10,
            fontSize: 13,
          }}
        >
          {errorMsg}
        </div>
      </main>
    );
  }

  const selectStyle = {
    width: "100%",
    padding: 14,
    fontSize: 16,
    border: "1px solid #e5eaf2",
    borderRadius: 10,
    background: "#f7fafd",
    marginBottom: 12,
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: 700,
    color: "#1b3a63",
    display: "block",
    marginBottom: 6,
  };

  const inputStyle = {
    width: "100%",
    padding: 14,
    fontSize: 16,
    border: "1px solid #e5eaf2",
    borderRadius: 10,
    background: "#f7fafd",
    marginBottom: 4,
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <main
      style={{
        background: "#f3f7fc",
        minHeight: "100vh",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "18px 18px 4px",
        }}
      >
        <Link href="/members" style={{ color: "#1b3a63", display: "flex" }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          {member?.name} · 회원권 신청
        </div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        {submitted && (
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 18,
              marginBottom: 16,
              boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
              border: "1px solid #d9ecdd",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "#1b7a45",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ✓ 신청이 접수되었습니다
            </div>
            <p style={{ fontSize: 14, margin: 0, lineHeight: 1.6, color: "#33455e" }}>
              아래 계좌로 <strong style={{ color: "#1b3a63" }}>{submitted.total_amount} EUR</strong>를
              입금해주세요. 입금자명은 신청하신{" "}
              <strong style={{ color: "#1b3a63" }}>"{submitted.depositor_name}"</strong>과 동일해야 확인이
              빠릅니다.
            </p>
            <div
              style={{
                marginTop: 12,
                padding: 14,
                background: "#f7fafd",
                borderRadius: 12,
                fontSize: 14,
                lineHeight: 1.9,
                color: "#1b3a63",
              }}
            >
              <div>은행: {settings?.bank_name || "-"}</div>
              <div>예금주: {settings?.account_holder || "-"}</div>
              <div>IBAN: {settings?.iban || "-"}</div>
              <div>BIC: {settings?.bic || "-"}</div>
            </div>
            <p style={{ fontSize: 12, color: "#8ea0b8", marginTop: 10, marginBottom: 0 }}>
              입금 확인 후 관리자가 회원권을 활성화하며, 완료되면 Invoice가
              발급됩니다.
            </p>
          </div>
        )}

        {pendingPayments.length > 0 && (
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 18,
              marginBottom: 16,
              boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 12 }}>
              입금 확인 대기 중
            </div>
            {pendingPayments.map((p, idx) => (
              <div
                key={p.id}
                style={{
                  padding: "12px 0",
                  borderTop: idx === 0 ? "none" : "1px solid #f0f3f8",
                  fontSize: 14,
                }}
              >
                <div style={{ color: "#33455e" }}>
                  {p.membership_plans?.name} ·{" "}
                  <strong style={{ color: "#1b3a63" }}>{p.total_amount} EUR</strong>
                </div>
                <div style={{ color: "#8ea0b8", fontSize: 12, marginTop: 4 }}>
                  입금자명: {p.depositor_name} · 신청일:{" "}
                  {new Date(p.requested_at).toLocaleDateString("ko-KR")}
                </div>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 14 }}>
            새 회원권 신청
          </div>

          {plans.length === 0 ? (
            <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
              현재 신청 가능한 회원권 상품이 없습니다.
            </p>
          ) : (
            <form onSubmit={handleSubmit}>
              <label style={labelStyle}>회원권 상품 선택</label>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                style={selectStyle}
              >
                <option value="">-- 선택하세요 --</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sessions_per_month}회 / {p.price} {p.currency})
                  </option>
                ))}
              </select>

              <label style={labelStyle}>입금자명</label>
              <input
                type="text"
                value={depositorName}
                onChange={(e) => setDepositorName(e.target.value)}
                placeholder="실제 입금하실 분의 이름"
                style={inputStyle}
              />

              {errorMsg && (
                <div
                  style={{
                    background: "#fdecec",
                    color: "#b3261e",
                    padding: 12,
                    borderRadius: 10,
                    fontSize: 13,
                    marginTop: 10,
                  }}
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%",
                  marginTop: 16,
                  padding: 14,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "white",
                  background: submitting ? "#9db8d6" : BLUE,
                  border: "none",
                  borderRadius: 10,
                  cursor: submitting ? "default" : "pointer",
                }}
              >
                {submitting ? "신청 중..." : "신청하기"}
              </button>
            </form>
          )}
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/members" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 자녀 관리로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}

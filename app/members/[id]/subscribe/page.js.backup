"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

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
      <main className="page">
        <div className="subtitle">불러오는 중...</div>
      </main>
    );
  }

  if (errorMsg && !member) {
    return (
      <main className="page">
        <div className="message error">{errorMsg}</div>
      </main>
    );
  }

  const selectStyle = {
    width: "100%",
    padding: 14,
    fontSize: 16,
    border: "1px solid #ddd",
    borderRadius: 10,
    background: "#fafafa",
    marginBottom: 12,
  };

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">{member?.name} · 회원권 신청</div>

      {submitted && (
        <div className="card" style={{ marginBottom: 20, background: "#f0f7f2" }}>
          <div style={{ fontWeight: 700, marginBottom: 10, color: "#0b3d2e" }}>
            ✓ 신청이 접수되었습니다
          </div>
          <p style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>
            아래 계좌로 <strong>{submitted.total_amount} EUR</strong>를
            입금해주세요. 입금자명은 신청하신{" "}
            <strong>"{submitted.depositor_name}"</strong>과 동일해야 확인이
            빠릅니다.
          </p>
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: "white",
              borderRadius: 8,
              fontSize: 14,
              lineHeight: 1.8,
            }}
          >
            <div>은행: {settings?.bank_name || "-"}</div>
            <div>예금주: {settings?.account_holder || "-"}</div>
            <div>IBAN: {settings?.iban || "-"}</div>
            <div>BIC: {settings?.bic || "-"}</div>
          </div>
          <p style={{ fontSize: 13, color: "#777", marginTop: 10 }}>
            입금 확인 후 관리자가 회원권을 활성화하며, 완료되면 Invoice가
            발급됩니다.
          </p>
        </div>
      )}

      {pendingPayments.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>
            입금 확인 대기 중
          </div>
          {pendingPayments.map((p) => (
            <div
              key={p.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid #eee",
                fontSize: 14,
              }}
            >
              <div>
                {p.membership_plans?.name} · {p.total_amount} EUR
              </div>
              <div style={{ color: "#777", fontSize: 12, marginTop: 2 }}>
                입금자명: {p.depositor_name} · 신청일:{" "}
                {new Date(p.requested_at).toLocaleDateString("ko-KR")}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>새 회원권 신청</div>

        {plans.length === 0 ? (
          <p style={{ fontSize: 14, color: "#777" }}>
            현재 신청 가능한 회원권 상품이 없습니다.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>회원권 상품 선택</label>
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

            <label>입금자명</label>
            <input
              type="text"
              value={depositorName}
              onChange={(e) => setDepositorName(e.target.value)}
              placeholder="실제 입금하실 분의 이름"
            />

            {errorMsg && <div className="message error">{errorMsg}</div>}

            <button
              className="primary"
              type="submit"
              disabled={submitting}
              style={{ marginTop: 14 }}
            >
              {submitting ? "신청 중..." : "신청하기"}
            </button>
          </form>
        )}
      </div>

      <div className="link-row">
        <Link href="/members">← 자녀 관리로 돌아가기</Link>
      </div>
    </main>
  );
}

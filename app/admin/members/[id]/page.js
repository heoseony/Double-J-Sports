"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

const PROGRAM_LABEL = {
  kids: "Kids",
  womens: "Women's",
  mens: "Men's",
};

function addOneMonth(dateStr) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export default function MemberDetailPage() {
  const params = useParams();
  const memberId = params.id;

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [plans, setPlans] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // 배정 폼 상태
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [assigning, setAssigning] = useState(false);

  // 수동 조정 상태 (membership id -> 입력값)
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  async function loadAll() {
    setLoading(true);
    setErrorMsg("");

    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("id, name, birth_date, program, status, guardians(name, phone)")
      .eq("id", memberId)
      .single();

    if (memberError || !memberData) {
      setErrorMsg("회원 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    setMember(memberData);

    const { data: membershipData } = await supabase
      .from("memberships")
      .select("*, membership_plans(name, sessions_per_month)")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false });

    setMemberships(membershipData || []);

    const { data: planData } = await supabase
      .from("membership_plans")
      .select("*")
      .eq("program", memberData.program)
      .eq("is_active", true)
      .order("sessions_per_month", { ascending: true });

    setPlans(planData || []);
    if (planData && planData.length > 0) {
      setSelectedPlanId(planData[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (memberId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  async function handleAssign(e) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!selectedPlanId) {
      setErrorMsg("배정할 회원권을 선택해주세요.");
      return;
    }

    const plan = plans.find((p) => p.id === selectedPlanId);
    setAssigning(true);

    const { error } = await supabase.from("memberships").insert({
      member_id: memberId,
      plan_id: selectedPlanId,
      start_date: startDate,
      end_date: addOneMonth(startDate),
      sessions_used: 0,
      sessions_remaining: plan.sessions_per_month,
      status: "active",
    });

    setAssigning(false);

    if (error) {
      setErrorMsg("회원권 배정 실패: " + error.message);
      return;
    }

    setSuccessMsg("회원권이 배정되었습니다.");
    loadAll();
  }

  async function handleAdjust(membershipId, currentRemaining) {
    setErrorMsg("");
    setSuccessMsg("");

    const delta = Number(adjustDelta);
    if (!delta) {
      setErrorMsg("조정할 횟수를 입력해주세요. (예: +2, -1)");
      return;
    }

    setAdjusting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: adjError } = await supabase
      .from("membership_adjustments")
      .insert({
        membership_id: membershipId,
        admin_id: user?.id,
        delta,
        reason: adjustReason || null,
      });

    if (adjError) {
      setAdjusting(false);
      setErrorMsg("조정 이력 저장 실패: " + adjError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("memberships")
      .update({ sessions_remaining: currentRemaining + delta })
      .eq("id", membershipId);

    setAdjusting(false);

    if (updateError) {
      setErrorMsg("잔여 횟수 반영 실패: " + updateError.message);
      return;
    }

    setSuccessMsg("잔여 횟수가 조정되었습니다.");
    setAdjustDelta("");
    setAdjustReason("");
    loadAll();
  }

  if (loading) {
    return (
      <main className="admin-page">
        <div className="subtitle">불러오는 중...</div>
      </main>
    );
  }

  if (!member) {
    return (
      <main className="admin-page">
        <div className="card">
          <div className="message error">{errorMsg}</div>
          <Link href="/admin/members">← 회원 목록으로</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="brand">{member.name}</div>
      <div className="subtitle">
        <span className={`badge ${member.program}`}>
          {PROGRAM_LABEL[member.program] || member.program}
        </span>{" "}
        · 보호자: {member.guardians?.name || "-"} ({member.guardians?.phone || "-"})
      </div>

      {errorMsg && <div className="message error">{errorMsg}</div>}
      {successMsg && <div className="message success">{successMsg}</div>}

      <div className="section-title">현재 회원권</div>
      <div className="card">
        {memberships.length === 0 && (
          <p style={{ marginTop: 0, fontSize: 15, color: "#555" }}>
            아직 배정된 회원권이 없습니다.
          </p>
        )}

        {memberships.map((m) => (
          <div key={m.id} className="list-row" style={{ display: "block" }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {m.membership_plans?.name} · {m.status}
            </div>
            <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
              {m.start_date} ~ {m.end_date || "-"}
            </div>
            <div style={{ fontSize: 14, marginTop: 6 }}>
              잔여 {m.sessions_remaining}회 / 사용 {m.sessions_used}회
            </div>

            {m.status === "active" && (
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <input
                  type="number"
                  placeholder="+2 또는 -1"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(e.target.value)}
                  style={{ flex: "0 0 90px" }}
                />
                <input
                  type="text"
                  placeholder="조정 사유 (선택)"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className="small-btn"
                  disabled={adjusting}
                  onClick={() => handleAdjust(m.id, m.sessions_remaining)}
                >
                  {adjusting ? "처리중" : "조정"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="section-title">새 회원권 배정</div>
      <div className="card">
        {plans.length === 0 ? (
          <p style={{ marginTop: 0, fontSize: 15, color: "#555" }}>
            {PROGRAM_LABEL[member.program]} 프로그램에 등록된 회원권 상품이
            없습니다. Supabase의 membership_plans 테이블에서 먼저
            추가해주세요.
          </p>
        ) : (
          <form onSubmit={handleAssign}>
            <label>회원권 상품</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (월 {p.sessions_per_month}회)
                </option>
              ))}
            </select>

            <label>시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <button className="primary" type="submit" disabled={assigning}>
              {assigning ? "배정 중..." : "회원권 배정하기"}
            </button>
          </form>
        )}
      </div>

      <div className="link-row">
        <Link href="/admin/members">← 회원 목록으로</Link>
      </div>
    </main>
  );
}

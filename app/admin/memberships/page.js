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

export default function AdminMembershipsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [memberId, setMemberId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState(todayStr());

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function loadData() {
    const { data: memberData } = await supabase
      .from("members")
      .select("id, name, program")
      .order("name", { ascending: true });
    setMembers(memberData || []);

    const { data: planData } = await supabase
      .from("membership_plans")
      .select("id, name, program, sessions_per_month, price, currency")
      .eq("active", true)
      .order("program", { ascending: true });
    setPlans(planData || []);

    const { data: membershipData } = await supabase
      .from("memberships")
      .select(
        "id, start_date, status, sessions_used, members(name), membership_plans(name, sessions_per_month)"
      )
      .order("start_date", { ascending: false })
      .limit(20);
    setAssignments(membershipData || []);
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
      await loadData();
      setLoading(false);
    }

    check();
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!memberId || !planId || !startDate) {
      setErrorMsg("회원, 상품, 시작일을 모두 선택해주세요.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("memberships").insert({
      member_id: memberId,
      plan_id: planId,
      start_date: startDate,
      status: "active",
      sessions_used: 0,
    });

    setSaving(false);

    if (error) {
      setErrorMsg("배정 실패: " + error.message);
      return;
    }

    setMemberId("");
    setPlanId("");
    await loadData();
  }

  if (loading || !isAdmin) {
    return (
      <main className="page">
        <div className="subtitle">확인 중...</div>
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
  };

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">회원권 배정</div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <label>회원 (자녀) 선택</label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            style={selectStyle}
          >
            <option value="">-- 선택하세요 --</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.program})
              </option>
            ))}
          </select>

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

          <label>시작일</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          {errorMsg && <div className="message error">{errorMsg}</div>}

          <button className="primary" type="submit" disabled={saving}>
            {saving ? "배정 중..." : "회원권 배정"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          최근 배정 내역
        </div>

        {assignments.length === 0 && (
          <p style={{ fontSize: 14, color: "#777" }}>
            아직 배정된 회원권이 없습니다.
          </p>
        )}

        {assignments.map((a) => (
          <div
            key={a.id}
            style={{
              padding: "12px 0",
              borderBottom: "1px solid #eee",
              fontSize: 14,
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {a.members?.name || "(알 수 없음)"} —{" "}
              {a.membership_plans?.name || "(알 수 없음)"}
            </div>
            <div style={{ color: "#777", marginTop: 2 }}>
              시작일: {a.start_date} · 사용: {a.sessions_used}/
              {a.membership_plans?.sessions_per_month} · 상태: {a.status}
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

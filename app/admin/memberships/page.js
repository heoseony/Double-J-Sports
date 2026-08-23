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

const statusLabel = {
  active: "활성",
  expired: "만료",
  cancelled: "취소",
};

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

    // 기존 활성 회원권이 있으면 자동 비활성화 (한 사람당 1개만 유지)
    await supabase
      .from("memberships")
      .update({ status: "inactive" })
      .eq("member_id", req.member_id)
      .eq("status", "active");

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
      <LoadingScreen text="확인 중..." />
    );
  }

  const labelStyle = {
    fontSize: 13,
    fontWeight: 700,
    color: "#1b3a63",
    display: "block",
    marginBottom: 6,
  };

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

  const inputStyle = {
    width: "100%",
    padding: 14,
    fontSize: 16,
    border: "1px solid #e5eaf2",
    borderRadius: 10,
    background: "#f7fafd",
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
        <Link href="/dashboard" style={{ color: "#1b3a63", display: "flex" }}>
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
          회원권 배정
        </div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 18,
            marginBottom: 16,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: "#1b3a63",
              marginBottom: 14,
            }}
          >
            새 회원권 배정
          </div>
          <form onSubmit={handleSubmit}>
            <label style={labelStyle}>회원 (자녀) 선택</label>
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

            <label style={labelStyle}>시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
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
                  marginTop: 12,
                }}
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                marginTop: 16,
                padding: 14,
                fontSize: 15,
                fontWeight: 700,
                color: "white",
                background: saving ? "#9db8d6" : BLUE,
                border: "none",
                borderRadius: 10,
                cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "배정 중..." : "회원권 배정"}
            </button>
          </form>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: "#1b3a63",
              marginBottom: 12,
            }}
          >
            최근 배정 내역
          </div>

          {assignments.length === 0 && (
            <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
              아직 배정된 회원권이 없습니다.
            </p>
          )}

          {assignments.map((a, idx) => (
            <div
              key={a.id}
              style={{
                padding: "14px 0",
                borderTop: idx === 0 ? "none" : "1px solid #f0f3f8",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>
                  {a.members?.name || "(알 수 없음)"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color:
                      a.status === "active"
                        ? BLUE
                        : a.status === "cancelled"
                        ? "#b3261e"
                        : "#8ea0b8",
                    background:
                      a.status === "active"
                        ? "#e9f1fb"
                        : a.status === "cancelled"
                        ? "#fdecec"
                        : "#f0f3f8",
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  {statusLabel[a.status] || a.status}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#33455e", marginTop: 6 }}>
                {a.membership_plans?.name || "(알 수 없음)"}
              </div>
              <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 4 }}>
                시작일: {a.start_date} · 사용: {a.sessions_used}/
                {a.membership_plans?.sessions_per_month}
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/dashboard" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 관리자 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}

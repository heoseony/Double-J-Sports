"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

export default function AdminMembersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState(null);

  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [expandedId, setExpandedId] = useState(null);
  const [membershipsByMember, setMembershipsByMember] = useState({});
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustingId, setAdjustingId] = useState(null);
  const [adjustMsg, setAdjustMsg] = useState("");

  async function loadMembers() {
    const { data, error } = await supabase
      .from("members")
      .select(
        "id, name, program, status, birth_date, gender, referred_by, guardians(name, phone, referred_by), users(email, phone)"
      )
      .order("created_at", { ascending: false });

    if (!error) {
      setMembers(data || []);
    }
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
      await loadMembers();
      setLoading(false);
    }

    check();
  }, [router]);

  async function loadMemberships(memberId) {
    const { data } = await supabase
      .from("memberships")
      .select(
        "id, start_date, status, sessions_used, membership_plans(name, sessions_per_month)"
      )
      .eq("member_id", memberId)
      .order("start_date", { ascending: false });

    setMembershipsByMember((prev) => ({ ...prev, [memberId]: data || [] }));
  }

  async function toggleExpand(memberId) {
    if (expandedId === memberId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(memberId);
    setAdjustAmount("");
    setAdjustReason("");
    setAdjustMsg("");
    if (!membershipsByMember[memberId]) {
      await loadMemberships(memberId);
    }
  }

  async function handleAdjust(membershipId, memberId) {
    setAdjustMsg("");

    const amount = Number(adjustAmount);
    if (!amount || !adjustReason) {
      setAdjustMsg("조정량과 사유를 모두 입력해주세요.");
      return;
    }

    setAdjustingId(membershipId);

    const list = membershipsByMember[memberId] || [];
    const target = list.find((m) => m.id === membershipId);
    const currentUsed = target?.sessions_used || 0;
    const newUsed = Math.max(currentUsed - amount, 0);

    const { error: updateError } = await supabase
      .from("memberships")
      .update({ sessions_used: newUsed })
      .eq("id", membershipId);

    if (updateError) {
      setAdjustingId(null);
      setAdjustMsg("조정 실패: " + updateError.message);
      return;
    }

    await supabase.from("membership_adjustments").insert({
      membership_id: membershipId,
      adjustment_amount: amount,
      reason: adjustReason,
      created_by: adminUserId,
    });

    setAdjustingId(null);
    setAdjustAmount("");
    setAdjustReason("");
    setAdjustMsg("조정이 완료되었습니다.");
    await loadMemberships(memberId);
  }

  const filtered = members.filter((m) => {
    const matchesQuery =
      !query || m.name?.toLowerCase().includes(query.toLowerCase());
    const matchesProgram =
      programFilter === "all" || m.program === programFilter;
    const matchesStatus =
      statusFilter === "all" || m.status === statusFilter;
    return matchesQuery && matchesProgram && matchesStatus;
  });

  if (loading || !isAdmin) {
    return (
      <main className="page">
        <div className="subtitle">확인 중...</div>
      </main>
    );
  }

  const selectStyle = {
    width: "100%",
    padding: 12,
    fontSize: 14,
    border: "1px solid #ddd",
    borderRadius: 8,
    background: "#fafafa",
  };

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">회원 검색 · 회원권 조정</div>

      <div className="card">
        <label>이름 검색</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름으로 검색"
        />

        <label style={{ marginTop: 14 }}>프로그램</label>
        <select
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">전체</option>
          <option value="kids">Kids</option>
          <option value="women">Women's</option>
          <option value="men">Men's</option>
        </select>

        <label style={{ marginTop: 14 }}>상태</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">전체</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
          <option value="trial">체험</option>
          <option value="withdrawn">탈퇴</option>
        </select>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          검색 결과 ({filtered.length}명)
        </div>

        {filtered.map((m) => {
          const contact = m.guardians
            ? `보호자: ${m.guardians.name} (${m.guardians.phone || "-"})`
            : m.users
            ? `본인 계정: ${m.users.email}`
            : "연락처 정보 없음";

          const referredBy = m.guardians?.referred_by || m.referred_by;

          const isExpanded = expandedId === m.id;
          const memberships = membershipsByMember[m.id] || [];

          return (
            <div
              key={m.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <div
                style={{ cursor: "pointer" }}
                onClick={() => toggleExpand(m.id)}
              >
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {m.name} · [{m.program}] · {m.status}
                </div>
                <div style={{ fontSize: 13, color: "#777", marginTop: 2 }}>
                  {contact}
                </div>
                {referredBy && (
                  <div style={{ fontSize: 12, color: "#0b3d2e", marginTop: 2 }}>
                    추천인: {referredBy}
                  </div>
                )}
              </div>

              {isExpanded && (
                <div style={{ marginTop: 12, paddingLeft: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    회원권 목록
                  </div>

                  {memberships.length === 0 && (
                    <p style={{ fontSize: 13, color: "#777" }}>
                      배정된 회원권이 없습니다.
                    </p>
                  )}

                  {memberships.map((ms) => (
                    <div
                      key={ms.id}
                      style={{
                        marginTop: 8,
                        padding: 10,
                        background: "#fafafa",
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ fontSize: 13 }}>
                        {ms.membership_plans?.name} · 사용{" "}
                        {ms.sessions_used}/
                        {ms.membership_plans?.sessions_per_month} · 상태:{" "}
                        {ms.status}
                      </div>

                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <input
                          type="number"
                          placeholder="조정량 (예: 1 또는 -1)"
                          value={
                            adjustingId === null ? adjustAmount : undefined
                          }
                          onChange={(e) => setAdjustAmount(e.target.value)}
                          style={{
                            flex: 1,
                            padding: 8,
                            fontSize: 13,
                            border: "1px solid #ddd",
                            borderRadius: 6,
                          }}
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="사유 (예: 사정으로 인한 보충)"
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        style={{
                          marginTop: 6,
                          width: "100%",
                          padding: 8,
                          fontSize: 13,
                          border: "1px solid #ddd",
                          borderRadius: 6,
                        }}
                      />
                      <button
                        type="button"
                        style={{
                          marginTop: 8,
                          padding: "8px 14px",
                          fontSize: 13,
                          border: "none",
                          borderRadius: 6,
                          background: "#0b3d2e",
                          color: "white",
                          cursor: "pointer",
                        }}
                        disabled={adjustingId === ms.id}
                        onClick={() => handleAdjust(ms.id, m.id)}
                      >
                        {adjustingId === ms.id ? "적용 중..." : "횟수 조정 적용"}
                      </button>
                      {adjustMsg && (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            color: "#0b3d2e",
                          }}
                        >
                          {adjustMsg}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="link-row">
        <Link href="/admin">← 관리자 홈으로</Link>
      </div>
    </main>
  );
}

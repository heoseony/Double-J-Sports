"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const BLUE = "#3B82C4";

const PROGRAM_TABS = [
  { value: "all", label: "전체" },
  { value: "kids", label: "Kids" },
  { value: "women", label: "Women's" },
  { value: "men", label: "Men's" },
];

const STATUS_STYLE = {
  active: { label: "활동", bg: "#e9f1fb", color: BLUE },
  inactive: { label: "비활성", bg: "#f0f3f8", color: "#8ea0b8" },
  trial: { label: "체험", bg: "#fff4e5", color: "#c07a1e" },
  withdrawn: { label: "탈퇴", bg: "#fdecec", color: "#b3261e" },
};

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function ChevronDown({ open }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

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

  const [nameEnDrafts, setNameEnDrafts] = useState({});
  const [savingNameEnId, setSavingNameEnId] = useState(null);
  const [nameEnMsg, setNameEnMsg] = useState("");

  async function loadMembers() {
    const { data, error } = await supabase
      .from("members")
      .select(
        "id, name, name_en, program, status, birth_date, gender, referred_by, guardians(name, phone, referred_by), users(email, phone)"
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
    setNameEnMsg("");
    if (!membershipsByMember[memberId]) {
      await loadMemberships(memberId);
    }
  }

  function getNameEnDraft(member) {
    return nameEnDrafts[member.id] !== undefined
      ? nameEnDrafts[member.id]
      : member.name_en || "";
  }

  async function handleSaveNameEn(memberId) {
    setNameEnMsg("");
    const value = (nameEnDrafts[memberId] ?? "").trim();

    setSavingNameEnId(memberId);

    const { error } = await supabase
      .from("members")
      .update({ name_en: value || null })
      .eq("id", memberId);

    setSavingNameEnId(null);

    if (error) {
      setNameEnMsg("영문 이름 저장 실패: " + error.message);
      return;
    }

    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, name_en: value || null } : m))
    );
    setNameEnMsg("영문 이름이 저장되었습니다.");
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
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div style={{ fontSize: 14, color: "#5b7699" }}>확인 중...</div>
      </main>
    );
  }

  return (
    <main style={{ background: "#f3f7fc", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      {/* 상단 바 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "18px 18px 4px",
        }}
      >
        <Link href="/admin" style={{ color: "#1b3a63", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>회원 관리</div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        {/* 검색창 */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9aa8bc",
            }}
          >
            <SearchIcon />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름으로 검색"
            style={{
              width: "100%",
              padding: "12px 12px 12px 38px",
              fontSize: 14,
              border: "1px solid #e5eaf2",
              borderRadius: 12,
              background: "white",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* 프로그램 탭 */}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 10,
            overflowX: "auto",
            paddingBottom: 2,
          }}
        >
          {PROGRAM_TABS.map((t) => {
            const active = programFilter === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setProgramFilter(t.value)}
                style={{
                  flexShrink: 0,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  background: active ? BLUE : "white",
                  color: active ? "white" : "#5b7699",
                  boxShadow: active ? "none" : "0 1px 4px rgba(30,60,110,0.08)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* 상태 필터 */}
        <div style={{ marginBottom: 14 }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 600,
              color: "#33455e",
              border: "1px solid #e5eaf2",
              borderRadius: 10,
              background: "white",
            }}
          >
            <option value="all">상태: 전체</option>
            <option value="active">활동</option>
            <option value="inactive">비활성</option>
            <option value="trial">체험</option>
            <option value="withdrawn">탈퇴</option>
          </select>
        </div>

        {/* 결과 카운트 */}
        <div style={{ fontSize: 13, color: "#8ea0b8", marginBottom: 8, fontWeight: 600 }}>
          전체 회원 · {filtered.length}명
        </div>

        {/* 회원 목록 */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          {filtered.length === 0 && (
            <p style={{ fontSize: 14, color: "#8ea0b8", padding: 18, margin: 0 }}>
              검색 결과가 없습니다.
            </p>
          )}

          {filtered.map((m, idx) => {
            const contact = m.guardians
              ? `보호자: ${m.guardians.name} (${m.guardians.phone || "-"})`
              : m.users
              ? `본인 계정: ${m.users.email}`
              : "연락처 정보 없음";

            const referredBy = m.guardians?.referred_by || m.referred_by;
            const isExpanded = expandedId === m.id;
            const memberships = membershipsByMember[m.id] || [];
            const statusInfo = STATUS_STYLE[m.status] || STATUS_STYLE.inactive;

            return (
              <div
                key={m.id}
                style={{
                  borderBottom:
                    idx === filtered.length - 1 ? "none" : "1px solid #f0f3f8",
                }}
              >
                <div
                  style={{ padding: "14px 16px", cursor: "pointer" }}
                  onClick={() => toggleExpand(m.id)}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>
                          {m.name}
                        </span>
                        <span style={{ fontSize: 11, color: "#8ea0b8", fontWeight: 600 }}>
                          {m.program}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 4 }}>
                        {contact}
                      </div>
                      {referredBy && (
                        <div style={{ fontSize: 11, color: BLUE, marginTop: 3, fontWeight: 600 }}>
                          추천인: {referredBy}
                        </div>
                      )}
                      {!m.name_en && (
                        <div style={{ fontSize: 11, color: "#b3261e", marginTop: 3, fontWeight: 600 }}>
                          ⚠ 영문 이름 미입력
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "4px 10px",
                          borderRadius: 999,
                          background: statusInfo.bg,
                          color: statusInfo.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {statusInfo.label}
                      </span>
                      <span style={{ color: "#c2cbd9" }}>
                        <ChevronDown open={isExpanded} />
                      </span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: "0 16px 16px" }}>
                    <div
                      style={{
                        background: "#f8fafd",
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>
                        영문 이름 (인보이스용)
                      </div>
                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <input
                          type="text"
                          placeholder="예: Seowon Park"
                          value={getNameEnDraft(m)}
                          onChange={(e) =>
                            setNameEnDrafts((prev) => ({
                              ...prev,
                              [m.id]: e.target.value,
                            }))
                          }
                          style={{
                            flex: 1,
                            padding: 9,
                            fontSize: 13,
                            border: "1px solid #e5eaf2",
                            borderRadius: 8,
                            background: "white",
                          }}
                        />
                        <button
                          type="button"
                          disabled={savingNameEnId === m.id}
                          onClick={() => handleSaveNameEn(m.id)}
                          style={{
                            padding: "9px 14px",
                            fontSize: 13,
                            fontWeight: 700,
                            border: "none",
                            borderRadius: 8,
                            background: BLUE,
                            color: "white",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {savingNameEnId === m.id ? "저장 중..." : "저장"}
                        </button>
                      </div>
                      {nameEnMsg && (
                        <div style={{ marginTop: 6, fontSize: 12, color: BLUE, fontWeight: 600 }}>
                          {nameEnMsg}
                        </div>
                      )}

                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", marginTop: 16 }}>
                        회원권 목록
                      </div>

                      {memberships.length === 0 && (
                        <p style={{ fontSize: 13, color: "#8ea0b8", margin: "6px 0 0" }}>
                          배정된 회원권이 없습니다.
                        </p>
                      )}

                      {memberships.map((ms) => (
                        <div
                          key={ms.id}
                          style={{
                            marginTop: 10,
                            padding: 12,
                            background: "white",
                            borderRadius: 10,
                            border: "1px solid #eef2f8",
                          }}
                        >
                          <div style={{ fontSize: 13, color: "#33455e" }}>
                            {ms.membership_plans?.name} · 사용{" "}
                            {ms.sessions_used}/
                            {ms.membership_plans?.sessions_per_month} · 상태:{" "}
                            {ms.status}
                          </div>

                          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                            <input
                              type="number"
                              placeholder="조정량 (예: 1 또는 -1)"
                              value={adjustingId === null ? adjustAmount : undefined}
                              onChange={(e) => setAdjustAmount(e.target.value)}
                              style={{
                                flex: 1,
                                padding: 8,
                                fontSize: 13,
                                border: "1px solid #e5eaf2",
                                borderRadius: 8,
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
                              border: "1px solid #e5eaf2",
                              borderRadius: 8,
                              boxSizing: "border-box",
                            }}
                          />
                          <button
                            type="button"
                            style={{
                              marginTop: 8,
                              padding: "8px 14px",
                              fontSize: 13,
                              fontWeight: 700,
                              border: "none",
                              borderRadius: 8,
                              background: BLUE,
                              color: "white",
                              cursor: "pointer",
                            }}
                            disabled={adjustingId === ms.id}
                            onClick={() => handleAdjust(ms.id, m.id)}
                          >
                            {adjustingId === ms.id ? "적용 중..." : "횟수 조정 적용"}
                          </button>
                          {adjustMsg && (
                            <div style={{ marginTop: 6, fontSize: 12, color: BLUE, fontWeight: 600 }}>
                              {adjustMsg}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

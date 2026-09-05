"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { nowInGermany } from "../../../lib/germanyTime";
import LoadingScreen from "../../components/LoadingScreen";

const BLUE = "#3B82C4";

function todayStr() {
  const d = nowInGermany();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const PROGRAM_TABS = [
  { value: "all", label: "전체" },
  { value: "kids", label: "Kids" },
  { value: "pro", label: "프로" },
  { value: "general", label: "일반/취미" },
  { value: "test", label: "테스트" },
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

function MemberBookingHistory({ memberId }) {
  const [loading, setLoading] = useState(true);
  const [monthGroups, setMonthGroups] = useState([]); // [{ key: 'YYYY-MM', label, bookings: [] }]
  const [openMonths, setOpenMonths] = useState(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, status, class_sessions(session_date, start_time, end_time, classes(class_name))"
        )
        .eq("member_id", memberId)
        .order("class_sessions(session_date)", { ascending: false });

      if (cancelled) return;

      const groups = {};
      (data || [])
        .filter((b) => b.class_sessions?.session_date)
        .forEach((b) => {
          const d = b.class_sessions.session_date; // 'YYYY-MM-DD'
          const key = d.slice(0, 7); // 'YYYY-MM'
          if (!groups[key]) groups[key] = [];
          groups[key].push(b);
        });

      const sortedKeys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));
      const result = sortedKeys.map((key) => {
        const [y, m] = key.split("-");
        return {
          key,
          label: `${y}년 ${parseInt(m, 10)}월`,
          bookings: groups[key],
        };
      });

      setMonthGroups(result);
      // 가장 최근 달은 기본으로 펼쳐둠
      if (result.length > 0) setOpenMonths(new Set([result[0].key]));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  function toggleMonth(key) {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function statusLabel(status) {
    if (status === "attended") return { label: "출석", color: "#2e7d32" };
    if (status === "absent") return { label: "결석", color: "#b3261e" };
    if (status === "cancelled_same_day") return { label: "당일취소", color: "#8a97a8" };
    return { label: "예정", color: BLUE };
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", marginBottom: 8 }}>
        수업 신청 내역
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: "#8ea0b8" }}>불러오는 중...</div>
      )}

      {!loading && monthGroups.length === 0 && (
        <div style={{ fontSize: 12, color: "#8ea0b8" }}>신청 내역이 없습니다.</div>
      )}

      {!loading &&
        monthGroups.map((group) => {
          const isOpen = openMonths.has(group.key);
          return (
            <div
              key={group.key}
              style={{
                border: "1px solid #eef2f8",
                borderRadius: 10,
                marginBottom: 8,
                overflow: "hidden",
              }}
            >
              <div
                onClick={() => toggleMonth(group.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  cursor: "pointer",
                  background: "white",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>
                  {group.label} ({group.bookings.length}건)
                </span>
                <span style={{ color: "#8ea0b8" }}>
                  <ChevronDown open={isOpen} />
                </span>
              </div>

              {isOpen && (
                <div style={{ borderTop: "1px solid #f0f3f8" }}>
                  {group.bookings.map((b, i) => {
                    const s = b.class_sessions;
                    const st = statusLabel(b.status);
                    return (
                      <div
                        key={b.id}
                        style={{
                          padding: "9px 12px",
                          borderTop: i === 0 ? "none" : "1px solid #f5f7fa",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#33455e" }}>
                            {s?.session_date} · {s?.start_time?.slice(0, 5)}~{s?.end_time?.slice(0, 5)}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#8ea0b8",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {s?.classes?.class_name || "반 정보 없음"}
                          </div>
                        </div>
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 11,
                            fontWeight: 700,
                            color: st.color,
                          }}
                        >
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

export default function AdminMembersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState(null);
  const [couponModalMember, setCouponModalMember] = useState(null);
  const [deleteConfirmMember, setDeleteConfirmMember] = useState(null);
  const [deletingMember, setDeletingMember] = useState(false);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState("");
  const [issuingCoupon, setIssuingCoupon] = useState(false);
  const [couponSuccessMsg, setCouponSuccessMsg] = useState("");

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

  const [plans, setPlans] = useState([]);
  const [assignPlanId, setAssignPlanId] = useState({});
  const [assigningId, setAssigningId] = useState(null);
  const [assignMsg, setAssignMsg] = useState("");

  async function loadMembers() {
    const { data, error } = await supabase
      .from("members")
      .select(
        "id, name, name_en, program, status, birth_date, gender, referred_by, is_test, guardians(name, phone, referred_by), users(email, phone)"
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

      const { data: planData } = await supabase
        .from("membership_plans")
        .select("id, name, program, sessions_per_month, price, currency")
        .eq("active", true)
        .order("price", { ascending: true });
      setPlans(planData || []);

      setLoading(false);
    }

    check();
  }, [router]);

  async function handleToggleTest(member) {
    const { error } = await supabase
      .from("members")
      .update({ is_test: !member.is_test })
      .eq("id", member.id);

    if (!error) {
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id ? { ...m, is_test: !member.is_test } : m
        )
      );
    }
  }

  async function handleAssignMembership(memberId, program) {
    setAssignMsg("");
    const planId = assignPlanId[memberId];

    if (!planId) {
      setAssignMsg("배정할 회원권을 선택해주세요.");
      return;
    }

    setAssigningId(memberId);

    // 기존 active 회원권이 있으면 먼저 만료 처리 (중복 방지)
    await supabase
      .from("memberships")
      .update({ status: "expired" })
      .eq("member_id", memberId)
      .eq("status", "active");

    const { error } = await supabase.from("memberships").insert({
      member_id: memberId,
      plan_id: planId,
      start_date: todayStr(),
      status: "active",
      sessions_used: 0,
    });

    setAssigningId(null);

    if (error) {
      setAssignMsg("배정 실패: " + error.message);
      return;
    }

    setAssignPlanId((prev) => ({ ...prev, [memberId]: "" }));
    setAssignMsg("회원권이 배정되었습니다.");
    await loadMemberships(memberId);
  }

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

  async function handleAdjust(membershipId, memberId, delta) {
    // delta: +1 = "1회 추가" (잔여 횟수 증가 → sessions_used 감소)
    //        -1 = "1회 차감" (잔여 횟수 감소 → sessions_used 증가)
    setAdjustMsg("");

    if (!adjustReason) {
      setAdjustMsg("사유를 입력해주세요.");
      return;
    }

    setAdjustingId(membershipId);

    const list = membershipsByMember[memberId] || [];
    const target = list.find((m) => m.id === membershipId);
    const currentUsed = target?.sessions_used || 0;
    const newUsed = Math.max(currentUsed - delta, 0);

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
      adjustment_amount: delta,
      reason: adjustReason,
      created_by: adminUserId,
    });

    setAdjustingId(null);
    setAdjustReason("");
    setAdjustMsg("조정이 완료되었습니다.");
    await loadMemberships(memberId);
  }

  function openDeleteConfirm(member) {
    setDeleteErrorMsg("");
    setDeleteConfirmMember(member);
  }

  function closeDeleteConfirm() {
    setDeleteConfirmMember(null);
    setDeleteErrorMsg("");
  }

  async function handleDeleteMember() {
    if (!deleteConfirmMember) return;
    setDeletingMember(true);
    setDeleteErrorMsg("");

    const { error } = await supabase
      .from("members")
      .delete()
      .eq("id", deleteConfirmMember.id);

    if (error) {
      // 예약/결제 기록 등 연결된 데이터가 있어서 삭제가 막히는 경우가 흔함 (FK 제약)
      setDeleteErrorMsg(
        "삭제 실패: " +
          error.message +
          " (연결된 예약/결제 기록이 있으면 삭제가 제한될 수 있어요)"
      );
      setDeletingMember(false);
      return;
    }

    setDeletingMember(false);
    setDeleteConfirmMember(null);
    await loadMembers();
  }

  function openCouponModal(member) {
    setCouponModalMember(member);
  }

  function closeCouponModal() {
    setCouponModalMember(null);
  }

  async function handleIssueCoupon() {
    if (!couponModalMember) return;

    setIssuingCoupon(true);
    setCouponSuccessMsg("");

    const { error } = await supabase.from("coupons").insert({
      member_id: couponModalMember.id,
      amount: 20,
      issued_by: adminUserId,
    });

    setIssuingCoupon(false);

    if (error) {
      alert("쿠폰 발급 실패: " + error.message);
      return;
    }

    setCouponSuccessMsg(`${couponModalMember.name}님에게 20 EUR 쿠폰이 발급되었습니다.`);
    setCouponModalMember(null);
    setTimeout(() => setCouponSuccessMsg(""), 4000);
  }

  const filtered = members.filter((m) => {
    const matchesQuery =
      !query || m.name?.toLowerCase().includes(query.toLowerCase());

    if (programFilter === "test") {
      return matchesQuery && m.is_test === true;
    }
    if (m.is_test === true) return false;

    const matchesProgram =
      programFilter === "all" || m.program === programFilter;
    const matchesStatus =
      statusFilter === "all" || m.status === statusFilter;
    return matchesQuery && matchesProgram && matchesStatus;
  });

  if (loading || !isAdmin) {
    return (
      <LoadingScreen text="확인 중..." />
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
        <Link href="/dashboard" style={{ color: "#1b3a63", display: "flex" }}>
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
            const allMemberships = membershipsByMember[m.id] || [];
            const memberships = allMemberships.filter((ms) => ms.status === "active").slice(0, 1);
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
                        {m.is_test && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#c07a1e",
                              background: "#fff4e5",
                              padding: "2px 6px",
                              borderRadius: 999,
                            }}
                          >
                            테스트
                          </span>
                        )}
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

                      <label
                        style={{
                          marginTop: 16,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          color: "#5b7699",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!m.is_test}
                          onChange={() => handleToggleTest(m)}
                        />
                        테스트 계정으로 표시
                      </label>

                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", marginTop: 16 }}>
                        회원권 배정 (현장 결제 등 수동 배정)
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <select
                          value={assignPlanId[m.id] || ""}
                          onChange={(e) =>
                            setAssignPlanId((prev) => ({ ...prev, [m.id]: e.target.value }))
                          }
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            padding: 8,
                            fontSize: 13,
                            border: "1px solid #e5eaf2",
                            borderRadius: 8,
                            background: "white",
                          }}
                        >
                          <option value="">회원권 선택</option>
                          {plans
                            .filter((p) => p.program === m.program)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sessions_per_month}회) ·{" "}
                                {p.price} {p.currency}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          disabled={assigningId === m.id}
                          onClick={() => handleAssignMembership(m.id, m.program)}
                          style={{
                            marginTop: 8,
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "10px 14px",
                            fontSize: 13,
                            fontWeight: 700,
                            border: "none",
                            borderRadius: 8,
                            background: BLUE,
                            color: "white",
                            cursor: "pointer",
                          }}
                        >
                          {assigningId === m.id ? "배정 중..." : "배정하기"}
                        </button>
                      </div>
                      {assignMsg && (
                        <div style={{ marginTop: 6, fontSize: 12, color: BLUE, fontWeight: 600 }}>
                          {assignMsg}
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
                <button
                  type="button"
                  onClick={() => openCouponModal(m)}
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    fontWeight: 700,
                    border: "1px solid #bcd7ee",
                    color: "#3B82C4",
                    borderRadius: 8,
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  쿠폰 발급
                </button>

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

                          <input
                            type="text"
                            placeholder="사유 (예: 사정으로 인한 보충)"
                            value={adjustReason}
                            onChange={(e) => setAdjustReason(e.target.value)}
                            style={{
                              marginTop: 8,
                              width: "100%",
                              padding: 8,
                              fontSize: 13,
                              border: "1px solid #e5eaf2",
                              borderRadius: 8,
                              boxSizing: "border-box",
                            }}
                          />
                          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              style={{
                                flex: 1,
                                padding: "10px 14px",
                                fontSize: 13,
                                fontWeight: 700,
                                border: "none",
                                borderRadius: 8,
                                background: BLUE,
                                color: "white",
                                cursor: "pointer",
                              }}
                              disabled={adjustingId === ms.id}
                              onClick={() => handleAdjust(ms.id, m.id, 1)}
                            >
                              {adjustingId === ms.id ? "적용 중..." : "➕ 1회 추가"}
                            </button>
                            <button
                              type="button"
                              style={{
                                flex: 1,
                                padding: "10px 14px",
                                fontSize: 13,
                                fontWeight: 700,
                                border: "1px solid #f3c6c2",
                                borderRadius: 8,
                                background: "white",
                                color: "#b3261e",
                                cursor: "pointer",
                              }}
                              disabled={adjustingId === ms.id}
                              onClick={() => handleAdjust(ms.id, m.id, -1)}
                            >
                              {adjustingId === ms.id ? "적용 중..." : "➖ 1회 차감"}
                            </button>
                          </div>
                          {adjustMsg && (
                            <div style={{ marginTop: 6, fontSize: 12, color: BLUE, fontWeight: 600 }}>
                              {adjustMsg}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <MemberBookingHistory memberId={m.id} />

                    <button
                      type="button"
                      onClick={() => openDeleteConfirm(m)}
                      style={{
                        width: "100%",
                        marginTop: 14,
                        padding: "10px 0",
                        fontSize: 12,
                        fontWeight: 700,
                        border: "1px solid #f3c6c6",
                        borderRadius: 10,
                        background: "#fdecec",
                        color: "#b3261e",
                        cursor: "pointer",
                      }}
                    >
                      회원 삭제
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {couponModalMember && (
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
          onClick={closeCouponModal}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 20,
              width: "100%",
              maxWidth: 380,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1b3a63", marginBottom: 8 }}>
              쿠폰을 발급하시겠어요?
            </div>
            <p style={{ fontSize: 14, color: "#33455e", marginTop: 0 }}>
              <strong>{couponModalMember.name}</strong>님에게{" "}
              <strong style={{ color: "#3B82C4" }}>20 EUR 할인 쿠폰</strong>을 발급합니다.
              다음 결제 시 1회 사용할 수 있습니다.
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={closeCouponModal}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 700,
                  border: "1px solid #e5eaf2",
                  borderRadius: 10,
                  background: "white",
                  color: "#5b7699",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={issuingCoupon}
                onClick={handleIssueCoupon}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 10,
                  background: issuingCoupon ? "#9db8d6" : "#3B82C4",
                  color: "white",
                  cursor: issuingCoupon ? "default" : "pointer",
                }}
              >
                {issuingCoupon ? "발급 중..." : "발급하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmMember && (
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
          onClick={closeDeleteConfirm}
        >
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 20,
              width: "100%",
              maxWidth: 380,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1b3a63", marginBottom: 8 }}>
              정말 삭제하시겠습니까?
            </div>
            <p style={{ fontSize: 14, color: "#33455e", marginTop: 0 }}>
              <strong>{deleteConfirmMember.name}</strong>님을 회원 목록에서 완전히 삭제합니다.
              이 작업은 되돌릴 수 없습니다.
            </p>

            {deleteErrorMsg && (
              <div style={{ fontSize: 12, color: "#b3261e", marginTop: 8 }}>{deleteErrorMsg}</div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={closeDeleteConfirm}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 700,
                  border: "1px solid #e5eaf2",
                  borderRadius: 10,
                  background: "white",
                  color: "#5b7699",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={deletingMember}
                onClick={handleDeleteMember}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 10,
                  background: deletingMember ? "#e79a9a" : "#b3261e",
                  color: "white",
                  cursor: deletingMember ? "default" : "pointer",
                }}
              >
                {deletingMember ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {couponSuccessMsg && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1b3a63",
            color: "white",
            padding: "12px 20px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 1100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          {couponSuccessMsg}
        </div>
      )}
    </main>
  );
}

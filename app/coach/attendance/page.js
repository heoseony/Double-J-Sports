"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { getRegionLabel } from "../../../lib/classColors";
import LoadingScreen from "../../components/LoadingScreen";

const BLUE = "#3B82C4";

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function AttendanceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionInfo, setSessionInfo] = useState(null);
  const [sessionCoaches, setSessionCoaches] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [confirmerName, setConfirmerName] = useState("");
  const [bookings, setBookings] = useState([]);
  const [remainingByMember, setRemainingByMember] = useState({});
  const [updatingId, setUpdatingId] = useState(null);
  const [editingBookingId, setEditingBookingId] = useState(null);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [savingNoteId, setSavingNoteId] = useState(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateRemaining, setCandidateRemaining] = useState(null);
  const [candidateHasMembership, setCandidateHasMembership] = useState(false);
  const [addMemberError, setAddMemberError] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [forceConfirm, setForceConfirm] = useState(false);

  async function loadData() {
    setErrorMsg("");

    if (!sessionId) {
      setErrorMsg("세션 정보가 없습니다.");
      setLoading(false);
      return;
    }

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

    if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
      router.push("/dashboard");
      return;
    }

    setMyRole(profile.role);

    const { data: session } = await supabase
      .from("class_sessions")
      .select("id, session_date, start_time, end_time, class_id, classes(class_name, program, region)")
      .eq("id", sessionId)
      .single();

    setSessionInfo(session);

    let sessionCoachList = [];
    if (session?.class_id) {
      const { data: cc } = await supabase
        .from("class_coaches")
        .select("id, coach_role, coach_profile_id, coach_profiles(name, profile_type)")
        .eq("class_id", session.class_id);
      // 메인 코치가 먼저, 보조 코치가 나중에 오도록 정렬
      sessionCoachList = (cc || []).sort((a, b) =>
        a.coach_role === b.coach_role ? 0 : a.coach_role === "main" ? -1 : 1
      );
      setSessionCoaches(sessionCoachList);
    }

    // 코치 로그인인 경우, 지금 선택된 프로필이 이 수업에 실제로 배정되어 있는지 확인
    // (관리자는 항상 접근 가능, 배정 안 된 코치는 접근 차단)
    if (profile.role === "coach") {
      let activeProfileId = null;
      try {
        const stored = localStorage.getItem(
          "double-j-sports-active-coach-profile"
        );
        activeProfileId = stored ? JSON.parse(stored)?.id : null;
      } catch (e) {
        activeProfileId = null;
      }

      const isAssigned = sessionCoachList.some(
        (cc) => cc.coach_profile_id === activeProfileId
      );

      if (!isAssigned) {
        setErrorMsg("이 수업에 배정된 코치가 아니라서 출석체크를 할 수 없습니다.");
        setLoading(false);
        return;
      }
    }

    // 지금 출석체크를 누르는 "확인자" 이름 결정
    // - 코치로 로그인: 선택해둔 코치 프로필 이름
    // - 관리자로 로그인: 이 수업에 배정된 감독님 이름 (없으면 "관리자")
    if (profile.role === "coach") {
      try {
        const stored = localStorage.getItem(
          "double-j-sports-active-coach-profile"
        );
        setConfirmerName(stored ? JSON.parse(stored)?.name : "코치");
      } catch (e) {
        setConfirmerName("코치");
      }
    } else {
      const director = sessionCoachList.find(
        (cc) => cc.coach_profiles?.profile_type === "director"
      );
      setConfirmerName(director?.coach_profiles?.name || "관리자");
    }

    const { data: bookingData, error } = await supabase
      .from("bookings")
      .select("id, status, member_id, checked_by_name, coach_note, members(name, profile_image_url)")
      .eq("class_session_id", sessionId)
      .neq("status", "cancelled_prior")
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMsg("예약자 목록을 불러오지 못했습니다: " + error.message);
      setLoading(false);
      return;
    }

    setBookings(bookingData || []);

    const memberIds = [...new Set((bookingData || []).map((b) => b.member_id))];

    if (memberIds.length > 0) {
      const { data: membershipData } = await supabase
        .from("memberships")
        .select(
          "member_id, sessions_used, status, start_date, membership_plans(sessions_per_month)"
        )
        .in("member_id", memberIds)
        .eq("status", "active")
        .order("start_date", { ascending: false });

      const map = {};
      (membershipData || []).forEach((m) => {
        if (map[m.member_id] !== undefined) return;
        const total = m.membership_plans?.sessions_per_month || 0;
        map[m.member_id] = total - m.sessions_used;
      });
      setRemainingByMember(map);
    } else {
      setRemainingByMember({});
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleSetStatus(bookingId, status) {
    setUpdatingId(bookingId);
    await supabase
      .from("bookings")
      .update({ status, checked_by_name: confirmerName })
      .eq("id", bookingId);
    setEditingBookingId(null);
    await loadData();
    setUpdatingId(null);
  }

  async function handleSaveNote(bookingId, value) {
    setSavingNoteId(bookingId);
    await supabase
      .from("bookings")
      .update({ coach_note: value })
      .eq("id", bookingId);
    setSavingNoteId(null);
  }

  async function handleSearchMembers(query) {
    setSearchQuery(query);
    setSelectedCandidate(null);
    setAddMemberError("");
    if (!query.trim() || !sessionInfo?.classes?.program) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const alreadyBookedIds = new Set(bookings.map((b) => b.member_id));
    const { data } = await supabase
      .from("members")
      .select("id, name, name_en, status")
      .eq("program", sessionInfo.classes.program)
      .eq("status", "active")
      .ilike("name", `%${query.trim()}%`)
      .limit(10);
    setSearchResults((data || []).filter((m) => !alreadyBookedIds.has(m.id)));
    setSearching(false);
  }

  async function handleSelectCandidate(member) {
    setSelectedCandidate(member);
    setForceConfirm(false);
    setAddMemberError("");
    const { data } = await supabase
      .from("memberships")
      .select("id, sessions_used, status, start_date, membership_plans(sessions_per_month)")
      .eq("member_id", member.id)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1);
    const ms = (data || [])[0];
    if (ms) {
      const total = ms.membership_plans?.sessions_per_month || 0;
      setCandidateHasMembership(true);
      setCandidateRemaining(total - (ms.sessions_used || 0));
    } else {
      setCandidateHasMembership(false);
      setCandidateRemaining(null);
    }
  }

  async function handleConfirmAddMember() {
    if (!selectedCandidate) return;
    setAddingMember(true);
    setAddMemberError("");

    const { error: bookingError } = await supabase.from("bookings").insert({
      class_session_id: sessionId,
      member_id: selectedCandidate.id,
      status: "booked",
    });

    if (bookingError) {
      setAddMemberError("추가 실패: " + bookingError.message);
      setAddingMember(false);
      return;
    }

    if (candidateHasMembership) {
      const { data: currentMembership } = await supabase
        .from("memberships")
        .select("id, sessions_used")
        .eq("member_id", selectedCandidate.id)
        .eq("status", "active")
        .order("start_date", { ascending: false })
        .limit(1)
        .single();

      if (currentMembership) {
        await supabase
          .from("memberships")
          .update({ sessions_used: (currentMembership.sessions_used || 0) + 1 })
          .eq("id", currentMembership.id);
      }
    }

    setShowAddPanel(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedCandidate(null);
    setCandidateRemaining(null);
    setCandidateHasMembership(false);
    setForceConfirm(false);
    setAddingMember(false);
    await loadData();
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  const attendedCount = bookings.filter((b) => b.status === "attended").length;
  const absentCount = bookings.filter((b) => b.status === "absent").length;
  const totalCount = bookings.filter((b) => b.status !== "cancelled_same_day").length;

  return (
    <main style={{ background: "#f3f7fc", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      {/* 상단 바 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <Link href="/coach" style={{ color: "#1b3a63", display: "flex" }}>
          <BackIcon />
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>출석 체크</div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        {errorMsg && (
          <div
            style={{
              background: "#fdecec",
              color: "#b3261e",
              padding: 12,
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* 수업 정보 카드 */}
        <div
          style={{
            background: `linear-gradient(135deg, ${BLUE} 0%, #2a5f94 100%)`,
            borderRadius: 16,
            padding: 18,
            color: "white",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            {sessionInfo?.classes?.class_name}
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.25)",
              }}
            >
              {getRegionLabel(sessionInfo?.classes?.region)}
            </span>
          </div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
            {sessionInfo?.session_date} · {sessionInfo?.start_time?.slice(0, 5)}~
            {sessionInfo?.end_time?.slice(0, 5)}
          </div>
          {sessionCoaches.length > 0 && (
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
              {sessionCoaches
                .map(
                  (cc) =>
                    cc.coach_profiles?.name +
                    (cc.coach_profiles?.profile_type === "coach" ? " 코치" : "")
                )
                .join(" · ")}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 12,
              fontSize: 12,
              opacity: 0.95,
            }}
          >
            <span>출석 {attendedCount}</span>
            <span>결석 {absentCount}</span>
            <span>전체 {totalCount}명</span>
          </div>
        </div>

        {/* 참가자 목록 */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          {bookings.length === 0 && !errorMsg && (
            <p style={{ fontSize: 14, color: "#8ea0b8", padding: 18, margin: 0 }}>
              이 수업에 출석체크할 회원이 없습니다.
            </p>
          )}

          {bookings.map((b, idx) => {
            const remaining = remainingByMember[b.member_id];
            const isSameDayCancel = b.status === "cancelled_same_day";
            const isDecided = b.status === "attended" || b.status === "absent";
            const showButtons =
              !isSameDayCancel && (!isDecided || editingBookingId === b.id);

            return (
              <div
                key={b.id}
                style={{
                  padding: "14px 16px",
                  borderBottom: idx === bookings.length - 1 ? "none" : "1px solid #f0f3f8",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {b.members?.profile_image_url ? (
                      <img
                        src={b.members.profile_image_url}
                        alt=""
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: "#e9f1fb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#3B82C4",
                          flexShrink: 0,
                        }}
                      >
                        {(b.members?.name || "?")[0]}
                      </div>
                    )}
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>
                      {b.members?.name || "(알 수 없음)"}
                    </span>

                    {!showButtons && b.status === "attended" && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#2e7d32",
                          background: "#e8f5ec",
                          padding: "3px 9px",
                          borderRadius: 999,
                        }}
                      >
                        <CheckIcon /> 출석
                      </span>
                    )}

                    {!showButtons && b.status === "absent" && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#b3261e",
                          background: "#fdecec",
                          padding: "3px 9px",
                          borderRadius: 999,
                        }}
                      >
                        <XIcon /> 결석
                      </span>
                    )}

                    {isSameDayCancel && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#8ea0b8",
                          background: "#f0f3f8",
                          padding: "3px 9px",
                          borderRadius: 999,
                        }}
                      >
                        당일취소
                      </span>
                    )}
                  </div>

                  {remaining !== undefined && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: remaining > 0 ? BLUE : "#b3261e",
                        background: remaining > 0 ? "#e9f1fb" : "#fdecec",
                        padding: "4px 10px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                      }}
                    >
                      잔여 {remaining}회
                    </div>
                  )}
                </div>

                {showButtons && (
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      disabled={updatingId === b.id}
                      onClick={() => handleSetStatus(b.id, "attended")}
                      style={{
                        flex: 1,
                        padding: "11px 0",
                        fontSize: 13,
                        fontWeight: 700,
                        borderRadius: 10,
                        cursor: "pointer",
                        border: b.status === "attended" ? "none" : "1px solid #e5eaf2",
                        background: b.status === "attended" ? "#2e7d32" : "white",
                        color: b.status === "attended" ? "white" : "#2e7d32",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <CheckIcon /> 출석
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === b.id}
                      onClick={() => handleSetStatus(b.id, "absent")}
                      style={{
                        flex: 1,
                        padding: "11px 0",
                        fontSize: 13,
                        fontWeight: 700,
                        borderRadius: 10,
                        cursor: "pointer",
                        border: b.status === "absent" ? "none" : "1px solid #e5eaf2",
                        background: b.status === "absent" ? "#b3261e" : "white",
                        color: b.status === "absent" ? "white" : "#b3261e",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <XIcon /> 결석
                    </button>
                  </div>
                )}

                {!showButtons && isDecided && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                    {b.checked_by_name && (
                      <span style={{ fontSize: 11, color: "#aab9cc" }}>
                        확인자: {b.checked_by_name}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingBookingId(b.id)}
                      style={{
                        padding: "6px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        border: "1px solid #e5eaf2",
                        borderRadius: 8,
                        background: "white",
                        color: "#5b7699",
                        cursor: "pointer",
                      }}
                    >
                      수정
                    </button>
                  </div>
                )}

                {!showButtons && isDecided && (
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      placeholder="이번 주 한 줄 메모 (선택)"
                      value={
                        noteDrafts[b.id] !== undefined ? noteDrafts[b.id] : b.coach_note || ""
                      }
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({ ...prev, [b.id]: e.target.value }))
                      }
                      onBlur={(e) => {
                        if (e.target.value !== (b.coach_note || "")) {
                          handleSaveNote(b.id, e.target.value);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        fontSize: 12,
                        border: "1px solid #e5eaf2",
                        borderRadius: 8,
                        color: "#33455e",
                      }}
                    />
                    {savingNoteId === b.id && (
                      <span style={{ fontSize: 11, color: "#8ea0b8", alignSelf: "center" }}>
                        저장 중...
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 회원 수동 추가 */}
        <div style={{ marginTop: 16 }}>
          {!showAddPanel ? (
            <button
              type="button"
              onClick={() => setShowAddPanel(true)}
              style={{
                width: "100%",
                padding: 14,
                fontSize: 14,
                fontWeight: 700,
                border: "1px dashed #c7d2e0",
                borderRadius: 12,
                background: "white",
                color: BLUE,
                cursor: "pointer",
              }}
            >
              + 회원 추가
            </button>
          ) : (
            <div
              style={{
                background: "white",
                borderRadius: 16,
                padding: 16,
                boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63" }}>
                  회원 추가
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPanel(false);
                    setSearchQuery("");
                    setSearchResults([]);
                    setSelectedCandidate(null);
                    setAddMemberError("");
                  }}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#8ea0b8",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  닫기
                </button>
              </div>

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchMembers(e.target.value)}
                placeholder="선수 이름 검색"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  fontSize: 13,
                  border: "1px solid #e5eaf2",
                  borderRadius: 10,
                  marginBottom: 10,
                }}
              />

              {searching && (
                <p style={{ fontSize: 12, color: "#8ea0b8" }}>검색 중...</p>
              )}

              {!selectedCandidate && searchResults.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  {searchResults.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectCandidate(m)}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1b3a63",
                        border: "1px solid #eef2f8",
                        borderRadius: 10,
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              )}

              {!selectedCandidate &&
                searchQuery.trim() &&
                !searching &&
                searchResults.length === 0 && (
                  <p style={{ fontSize: 12, color: "#8ea0b8", marginBottom: 10 }}>
                    검색 결과가 없습니다.
                  </p>
                )}

              {selectedCandidate && (
                <div style={{ border: "1px solid #eef2f8", borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1b3a63", marginBottom: 6 }}>
                    {selectedCandidate.name}
                  </div>

                  {candidateHasMembership ? (
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: candidateRemaining > 0 ? BLUE : "#b3261e",
                        marginBottom: 10,
                      }}
                    >
                      잔여 {candidateRemaining}회
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#b3261e", marginBottom: 10 }}>
                      활성 회원권 없음 (차감 없이 명단에만 추가됩니다)
                    </div>
                  )}

                  {addMemberError && (
                    <div style={{ fontSize: 12, color: "#b3261e", marginBottom: 10 }}>
                      {addMemberError}
                    </div>
                  )}

                  {candidateHasMembership && candidateRemaining <= 0 && !forceConfirm ? (
                    <button
                      type="button"
                      onClick={() => setForceConfirm(true)}
                      style={{
                        width: "100%",
                        padding: 12,
                        fontSize: 13,
                        fontWeight: 700,
                        border: "none",
                        borderRadius: 10,
                        background: "#fdecec",
                        color: "#b3261e",
                        cursor: "pointer",
                      }}
                    >
                      잔여 횟수 없음 · 그래도 추가하기
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={addingMember}
                      onClick={handleConfirmAddMember}
                      style={{
                        width: "100%",
                        padding: 12,
                        fontSize: 13,
                        fontWeight: 700,
                        border: "none",
                        borderRadius: 10,
                        background: BLUE,
                        color: "white",
                        cursor: addingMember ? "default" : "pointer",
                      }}
                    >
                      {addingMember ? "추가 중..." : "명단에 추가"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <LoadingScreen />
      }
    >
      <AttendanceInner />
    </Suspense>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
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
      .select("id, status, member_id, checked_by_name, members(name, profile_image_url)")
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
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            {sessionInfo?.classes?.class_name}
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
              </div>
            );
          })}
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

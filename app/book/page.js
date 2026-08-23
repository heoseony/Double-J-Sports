"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getProgramTextColor } from "../../lib/classColors";
import { supabase } from "../../lib/supabaseClient";
import LoadingScreen from "../components/LoadingScreen";

const WEEKDAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];

function maskName(name) {
  if (!name) return "";
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayStr() {
  return toDateStr(new Date());
}

function BookPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberId = searchParams.get("memberId");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [member, setMember] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [membershipId, setMembershipId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [participantsBySession, setParticipantsBySession] = useState({});
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [bookingSessionId, setBookingSessionId] = useState(null);
  const [myBookedSessionIds, setMyBookedSessionIds] = useState([]);
  const [myBookingIdBySession, setMyBookingIdBySession] = useState({});
  const [cancellingSessionId, setCancellingSessionId] = useState(null);
  const [cutoffHours, setCutoffHours] = useState(24);
  const [bookingCutoffHours, setBookingCutoffHours] = useState(2);
  const [allClassesAllowed, setAllClassesAllowed] = useState(true);
  const [allowedClassIds, setAllowedClassIds] = useState([]);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(todayStr());

  // state(setBookingSessionId)는 비동기라 더블클릭/연타 시 두 번째 클릭이
  // 아직 갱신 전인 state를 보고 통과할 수 있음 → ref로 동기적으로 즉시 막는다.
  // (DB 쪽에도 유니크 제약을 걸어 이중 안전장치를 둔다 — Step 1 SQL 참고)
  const isBookingRef = useRef(false);

  async function loadAll() {
    setErrorMsg("");

    if (!memberId) {
      setErrorMsg("자녀 정보가 없습니다. 자녀 목록에서 다시 시도해주세요.");
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

    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("id, name, program")
      .eq("id", memberId)
      .single();

    if (memberError || !memberData) {
      setErrorMsg("자녀 정보를 불러오지 못했습니다.");
      setLoading(false);
      return;
    }
    setMember(memberData);

    const { data: memberships } = await supabase
      .from("memberships")
      .select(
        "id, sessions_used, status, plan_id, membership_plans(sessions_per_month, all_classes_allowed)"
      )
      .eq("member_id", memberId)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1);

    if (memberships && memberships.length > 0) {
      const m = memberships[0];
      const total = m.membership_plans?.sessions_per_month || 0;
      setRemaining(total - m.sessions_used);
      setMembershipId(m.id);

      const allAllowed = m.membership_plans?.all_classes_allowed !== false;
      setAllClassesAllowed(allAllowed);

      if (!allAllowed) {
        const { data: allowedRows } = await supabase
          .from("membership_plan_classes")
          .select("class_id")
          .eq("plan_id", m.plan_id);
        setAllowedClassIds((allowedRows || []).map((r) => r.class_id));
      } else {
        setAllowedClassIds([]);
      }
    } else {
      setRemaining(0);
      setMembershipId(null);
      setAllClassesAllowed(true);
      setAllowedClassIds([]);
    }

    const { data: myBookings } = await supabase
      .from("bookings")
      .select("id, class_session_id")
      .eq("member_id", memberId)
      .eq("status", "booked");
    setMyBookedSessionIds((myBookings || []).map((b) => b.class_session_id));
    const bookingMap = {};
    (myBookings || []).forEach((b) => {
      bookingMap[b.class_session_id] = b.id;
    });
    setMyBookingIdBySession(bookingMap);

    const { data: policyData } = await supabase
      .from("cancellation_policy")
      .select("cutoff_hours, booking_cutoff_hours")
      .limit(1)
      .maybeSingle();
    if (policyData?.cutoff_hours != null) {
      setCutoffHours(policyData.cutoff_hours);
    }
    if (policyData?.booking_cutoff_hours != null) {
      setBookingCutoffHours(policyData.booking_cutoff_hours);
    }

    const today = todayStr();
    const { data: sessionData, error: sessionError } = await supabase
      .from("class_sessions")
      .select(
        "id, class_id, session_date, start_time, end_time, status, classes(id, class_name, program, weekday, active, region)"
      )
      .gte("session_date", today)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (sessionError) {
      setErrorMsg("수업 목록을 불러오지 못했습니다: " + sessionError.message);
      setLoading(false);
      return;
    }

    let kidsSessions = (sessionData || []).filter(
      (s) => s.classes?.program === "kids" && s.classes?.active
    );

    const currentAllAllowed =
      memberships && memberships.length > 0
        ? memberships[0].membership_plans?.all_classes_allowed !== false
        : true;

    if (!currentAllAllowed) {
      const { data: allowedRows2 } = await supabase
        .from("membership_plan_classes")
        .select("class_id")
        .eq("plan_id", memberships[0].plan_id);
      const allowedIds = (allowedRows2 || []).map((r) => r.class_id);
      kidsSessions = kidsSessions.filter((s) => allowedIds.includes(s.class_id));
    }

    setSessions(kidsSessions);

    // member_id를 같이 받아와서, 렌더링할 때 "이 참가자가 지금 보고 있는 내 자녀인지"를
    // 판별할 수 있게 한다 (본인은 마스킹 해제 + 파란색 표시).
    const { data: participantData } = await supabase
      .from("session_participants_kids")
      .select("class_session_id, member_id, name");

    const grouped = {};
    (participantData || []).forEach((p) => {
      if (!grouped[p.class_session_id]) grouped[p.class_session_id] = [];
      grouped[p.class_session_id].push({ memberId: p.member_id, name: p.name });
    });
    setParticipantsBySession(grouped);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const sessionsByDate = useMemo(() => {
    const map = {};
    sessions.forEach((s) => {
      if (!map[s.session_date]) map[s.session_date] = [];
      map[s.session_date].push(s);
    });
    return map;
  }, [sessions]);

  const calendarCells = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${year}-${pad2(month + 1)}-${pad2(d)}`);
    }
    return cells;
  }, [currentMonth]);

  function goPrevMonth() {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonth(d);
  }

  function goNextMonth() {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonth(d);
  }

  async function handleBook(sessionId) {
    // 더블클릭/연타 방지: state 반영을 기다리지 않고 ref로 즉시 잠근다.
    if (isBookingRef.current) return;
    isBookingRef.current = true;

    setErrorMsg("");
    setSuccessMsg("");

    if (remaining <= 0 || !membershipId) {
      setErrorMsg("잔여 이용 횟수가 없습니다. 관리자에게 문의해주세요.");
      isBookingRef.current = false;
      return;
    }

    if (myBookedSessionIds.includes(sessionId)) {
      setErrorMsg("이미 이 수업에 예약되어 있습니다.");
      isBookingRef.current = false;
      return;
    }

    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      const sessionDateTime = new Date(
        `${session.session_date}T${session.start_time}`
      );
      const deadline = new Date(
        sessionDateTime.getTime() - bookingCutoffHours * 60 * 60 * 1000
      );
      if (new Date() > deadline) {
        setErrorMsg(
          `예약이 마감되었습니다. (수업 시작 ${bookingCutoffHours}시간 전까지 예약 가능)`
        );
        isBookingRef.current = false;
        return;
      }
    }

    setBookingSessionId(sessionId);

    const { error: bookingError } = await supabase.from("bookings").insert({
      member_id: memberId,
      class_session_id: sessionId,
      status: "booked",
    });

    if (bookingError) {
      setBookingSessionId(null);
      isBookingRef.current = false;
      // DB 유니크 제약(bookings_unique_active_booking) 위반 = 이미 예약된 경우.
      // 사용자에게는 에러 메시지 대신 안내 문구를 보여주고 최신 상태로 새로고침한다.
      if (bookingError.code === "23505") {
        setErrorMsg("이미 이 수업에 예약되어 있습니다.");
        await loadAll();
      } else {
        setErrorMsg("예약 실패: " + bookingError.message);
      }
      return;
    }

    const { data: currentMembership } = await supabase
      .from("memberships")
      .select("sessions_used")
      .eq("id", membershipId)
      .single();

    await supabase
      .from("memberships")
      .update({ sessions_used: (currentMembership?.sessions_used || 0) + 1 })
      .eq("id", membershipId);

    setBookingSessionId(null);
    setSuccessMsg("예약이 완료되었습니다.");
    isBookingRef.current = false;
    await loadAll();
  }

  async function handleCancel(sessionId) {
    setErrorMsg("");
    setSuccessMsg("");

    const bookingId = myBookingIdBySession[sessionId];
    if (!bookingId) {
      setErrorMsg("예약 정보를 찾을 수 없습니다.");
      return;
    }

    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      setErrorMsg("수업 정보를 찾을 수 없습니다.");
      return;
    }

    setCancellingSessionId(sessionId);

    const sessionDateTime = new Date(
      `${session.session_date}T${session.start_time}`
    );
    const cutoffTime = new Date(
      sessionDateTime.getTime() - cutoffHours * 60 * 60 * 1000
    );
    const now = new Date();
    const isPrior = now < cutoffTime;
    const newStatus = isPrior ? "cancelled_prior" : "cancelled_same_day";

    const { error: cancelError } = await supabase
      .from("bookings")
      .update({ status: newStatus, cancelled_at: new Date().toISOString() })
      .eq("id", bookingId);

    if (cancelError) {
      setCancellingSessionId(null);
      setErrorMsg("취소 실패: " + cancelError.message);
      return;
    }

    if (isPrior && membershipId) {
      const { data: currentMembership } = await supabase
        .from("memberships")
        .select("sessions_used")
        .eq("id", membershipId)
        .single();

      const newUsed = Math.max((currentMembership?.sessions_used || 0) - 1, 0);

      await supabase
        .from("memberships")
        .update({ sessions_used: newUsed })
        .eq("id", membershipId);
    }

    setCancellingSessionId(null);
    setSuccessMsg(
      isPrior
        ? "취소되었습니다. 잔여 횟수가 복구되었습니다."
        : "취소되었습니다. 당일 취소라 잔여 횟수는 복구되지 않습니다."
    );
    await loadAll();
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;
  const selectedSessions = sessionsByDate[selectedDate] || [];

  return (
    <main style={{ background: "#f3f7fc", minHeight: "100vh", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "18px 18px 4px" }}>
        <img src="/logo-main.png" alt="" style={{ width: 30, height: "auto" }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          더블제이 축구 아카데미
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#8ea0b8", marginBottom: 20, textAlign: "center" }}>
        {member?.name}님 수업 예약 · 잔여 {Math.max(remaining, 0)}회
        {!allClassesAllowed && " · 특정 수업만 예약 가능한 회원권"}
      </div>

      <div style={{ padding: "0 18px" }}>
        {errorMsg && (
          <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ background: "#e9f1fb", color: "#1b3a63", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            {successMsg}
          </div>
        )}

        <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <button
            type="button"
            onClick={goPrevMonth}
            style={{
              padding: "6px 12px",
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "white",
              cursor: "pointer",
            }}
          >
            ‹
          </button>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{monthLabel}</div>
          <button
            type="button"
            onClick={goNextMonth}
            style={{
              padding: "6px 12px",
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "white",
              cursor: "pointer",
            }}
          >
            ›
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
            fontSize: 12,
            textAlign: "center",
            color: "#777",
            marginBottom: 4,
          }}
        >
          {WEEKDAY_HEADERS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
          }}
        >
          {calendarCells.map((dateStr, idx) => {
            if (!dateStr) return <div key={`empty-${idx}`} />;
            const daySessions = sessionsByDate[dateStr] || [];
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr();
            const dayNum = Number(dateStr.split("-")[2]);

            return (
              <button
                type="button"
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                style={{
                  aspectRatio: "1",
                  padding: 2,
                  border: isSelected
                    ? "2px solid #3B82C4"
                    : "1px solid #eee",
                  borderRadius: 8,
                  background: isSelected ? "#e9f1fb" : "white",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? "#3B82C4" : "#1a1a1a",
                }}
              >
                <span>{dayNum}</span>
                {daySessions.length > 0 && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "#3B82C4",
                      marginTop: 2,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
        </div>

        <div style={{ background: "white", borderRadius: 16, padding: 18, marginTop: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 12 }}>
          {selectedDate} 수업
        </div>

        {selectedSessions.length === 0 && (
          <p style={{ fontSize: 14, color: "#777" }}>
            이 날짜에는 예약 가능한 수업이 없습니다.
          </p>
        )}

        {selectedSessions.map((s) => {
          const names = participantsBySession[s.id] || [];
          const isExpanded = expandedSessionId === s.id;
          const alreadyBooked = myBookedSessionIds.includes(s.id);

          const sessionDateTime = new Date(`${s.session_date}T${s.start_time}`);
          const bookingDeadline = new Date(
            sessionDateTime.getTime() - bookingCutoffHours * 60 * 60 * 1000
          );
          const isPastDeadline = new Date() > bookingDeadline;

          return (
            <div
              key={s.id}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {s.start_time?.slice(0, 5)}~{s.end_time?.slice(0, 5)} ·{" "}
                {s.classes.class_name}
              </div>
              <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
                현재 신청 {names.length}명
              </div>

              <button
                type="button"
                style={{
                  marginTop: 8,
                  padding: "6px 12px",
                  fontSize: 13,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  background: "white",
                  cursor: "pointer",
                }}
                onClick={() =>
                  setExpandedSessionId(isExpanded ? null : s.id)
                }
              >
                {isExpanded ? "참가자 숨기기" : "참가자 보기"}
              </button>

              {isExpanded && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: "#444",
                    lineHeight: 1.8,
                  }}
                >
                  {names.length === 0
                    ? "아직 신청자가 없습니다."
                    : names.map((p, i) => {
                        const isMe = p.memberId === memberId;
                        return (
                          <span key={i}>
                            <span
                              style={{
                                color: isMe ? "#1a73e8" : "#444",
                                fontWeight: isMe ? 700 : 400,
                              }}
                            >
                              {isMe ? p.name : maskName(p.name)}
                            </span>
                            {i < names.length - 1 ? ", " : ""}
                          </span>
                        );
                      })}
                </div>
              )}

              <div style={{ marginTop: 10 }}>
                {alreadyBooked ? (
                  <div>
                    <span
                      style={{
                        fontSize: 13,
                        color: "#3B82C4",
                        fontWeight: 700,
                      }}
                    >
                      ✓ 예약됨
                    </span>
                    <button
                      type="button"
                      style={{
                        marginLeft: 12,
                        padding: "6px 12px",
                        fontSize: 13,
                        border: "1px solid #b3261e",
                        color: "#b3261e",
                        borderRadius: 8,
                        background: "white",
                        cursor: "pointer",
                      }}
                      disabled={cancellingSessionId === s.id}
                      onClick={() => handleCancel(s.id)}
                    >
                      {cancellingSessionId === s.id
                        ? "취소 중..."
                        : "예약 취소"}
                    </button>
                  </div>
                ) : isPastDeadline ? (
                  <div
                    style={{
                      fontSize: 13,
                      color: "#999",
                      fontWeight: 700,
                    }}
                  >
                    예약 마감 (수업 시작 {bookingCutoffHours}시간 전까지 예약
                    가능)
                  </div>
                ) : (
                  <button
                    style={{
                      padding: "10px 18px",
                      fontSize: 13,
                      fontWeight: 700,
                      border: "none",
                      borderRadius: 10,
                      background: "#3B82C4",
                      color: "white",
                      cursor: "pointer",
                    }}
                    disabled={bookingSessionId === s.id}
                    onClick={() => handleBook(s.id)}
                  >
                    {bookingSessionId === s.id ? "예약 중..." : "예약하기"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        </div>

        <div style={{ textAlign: "center", padding: "16px 0", fontSize: 13 }}>
          <Link href="/members" style={{ color: "#3B82C4", fontWeight: 700, textDecoration: "none" }}>
            ← 자녀 관리로
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <LoadingScreen />
      }
    >
      <BookPageInner />
    </Suspense>
  );
}

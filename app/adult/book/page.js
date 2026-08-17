"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const WEEKDAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayStr() {
  return toDateStr(new Date());
}

export default function AdultBookPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [member, setMember] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [membershipId, setMembershipId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [countsBySession, setCountsBySession] = useState({});
  const [bookingSessionId, setBookingSessionId] = useState(null);
  const [cancellingSessionId, setCancellingSessionId] = useState(null);
  const [myBookingIdBySession, setMyBookingIdBySession] = useState({});
  const [cutoffHours, setCutoffHours] = useState(24);
  const [bookingCutoffHours, setBookingCutoffHours] = useState(2);
  const [allClassesAllowed, setAllClassesAllowed] = useState(true);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(todayStr());

  async function loadAll() {
    setErrorMsg("");

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
      .eq("user_id", user.id)
      .single();

    if (memberError || !memberData) {
      setErrorMsg("회원 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }
    setMember(memberData);

    const { data: memberships } = await supabase
      .from("memberships")
      .select(
        "id, sessions_used, status, plan_id, membership_plans(sessions_per_month, all_classes_allowed)"
      )
      .eq("member_id", memberData.id)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1);

    if (memberships && memberships.length > 0) {
      const m = memberships[0];
      const total = m.membership_plans?.sessions_per_month || 0;
      setRemaining(total - m.sessions_used);
      setMembershipId(m.id);
      setAllClassesAllowed(m.membership_plans?.all_classes_allowed !== false);
    } else {
      setRemaining(0);
      setMembershipId(null);
      setAllClassesAllowed(true);
    }

    const { data: myBookings } = await supabase
      .from("bookings")
      .select("id, class_session_id")
      .eq("member_id", memberData.id)
      .eq("status", "booked");
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
        "id, class_id, session_date, start_time, end_time, classes(id, class_name, program, weekday, active)"
      )
      .gte("session_date", today)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (sessionError) {
      setErrorMsg("수업 목록을 불러오지 못했습니다: " + sessionError.message);
      setLoading(false);
      return;
    }

    let programSessions = (sessionData || []).filter(
      (s) => s.classes?.program === memberData.program && s.classes?.active
    );

    const currentAllAllowed =
      memberships && memberships.length > 0
        ? memberships[0].membership_plans?.all_classes_allowed !== false
        : true;

    if (!currentAllAllowed) {
      const { data: allowedRows } = await supabase
        .from("membership_plan_classes")
        .select("class_id")
        .eq("plan_id", memberships[0].plan_id);
      const allowedIds = (allowedRows || []).map((r) => r.class_id);
      programSessions = programSessions.filter((s) =>
        allowedIds.includes(s.class_id)
      );
    }

    setSessions(programSessions);

    const { data: countData } = await supabase
      .from("session_booking_counts")
      .select("class_session_id, cnt");

    const countsMap = {};
    (countData || []).forEach((c) => {
      countsMap[c.class_session_id] = c.cnt;
    });
    setCountsBySession(countsMap);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setErrorMsg("");
    setSuccessMsg("");

    if (remaining <= 0 || !membershipId) {
      setErrorMsg("잔여 이용 횟수가 없습니다. 관리자에게 문의해주세요.");
      return;
    }

    if (myBookingIdBySession[sessionId]) {
      setErrorMsg("이미 이 수업에 예약되어 있습니다.");
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
        return;
      }
    }

    setBookingSessionId(sessionId);

    const { error: bookingError } = await supabase.from("bookings").insert({
      member_id: member.id,
      class_session_id: sessionId,
      status: "booked",
    });

    if (bookingError) {
      setBookingSessionId(null);
      setErrorMsg("예약 실패: " + bookingError.message);
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
    if (!session) return;

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
      <main className="page">
        <div className="subtitle">불러오는 중...</div>
      </main>
    );
  }

  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;
  const selectedSessions = sessionsByDate[selectedDate] || [];

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">
        {member?.name}님 수업 예약 · 잔여 {Math.max(remaining, 0)}회
        {!allClassesAllowed && " · 특정 수업만 예약 가능한 회원권"}
      </div>

      <div className="card">
        {errorMsg && <div className="message error">{errorMsg}</div>}
        {successMsg && <div className="message success">{successMsg}</div>}

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
                    ? "2px solid #0b3d2e"
                    : "1px solid #eee",
                  borderRadius: 8,
                  background: isSelected ? "#e8f5ec" : "white",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? "#0b3d2e" : "#1a1a1a",
                }}
              >
                <span>{dayNum}</span>
                {daySessions.length > 0 && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "#0b3d2e",
                      marginTop: 2,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          {selectedDate} 수업
        </div>

        {selectedSessions.length === 0 && (
          <p style={{ fontSize: 14, color: "#777" }}>
            이 날짜에는 예약 가능한 수업이 없습니다.
          </p>
        )}

        {selectedSessions.map((s) => {
          const count = countsBySession[s.id] || 0;
          const bookingId = myBookingIdBySession[s.id];

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
                현재 신청 {count}명
              </div>

              <div style={{ marginTop: 10 }}>
                {bookingId ? (
                  <div>
                    <span
                      style={{
                        fontSize: 13,
                        color: "#0b3d2e",
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
                    className="primary"
                    style={{ marginTop: 0, padding: "10px 16px" }}
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

        <div className="link-row">
          <Link href="/dashboard">← 홈으로</Link>
        </div>
      </div>
    </main>
  );
}

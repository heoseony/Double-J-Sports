"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getRegionBg, getProgramTextColor } from "../../../lib/classColors";
import { supabase } from "../../../lib/supabaseClient";

const BLUE = "#3B82C4";
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

  const [member, setMember] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [countsBySession, setCountsBySession] = useState({});
  const [myBookedSessionIds, setMyBookedSessionIds] = useState(new Set());
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
      setAllClassesAllowed(m.membership_plans?.all_classes_allowed !== false);
    } else {
      setRemaining(0);
      setAllClassesAllowed(true);
    }

    const { data: myBookings } = await supabase
      .from("bookings")
      .select("id, class_session_id")
      .eq("member_id", memberData.id)
      .eq("status", "booked");
    const bookedIds = new Set((myBookings || []).map((b) => b.class_session_id));
    setMyBookedSessionIds(bookedIds);

    const today = todayStr();
    const { data: sessionData, error: sessionError } = await supabase
      .from("class_sessions")
      .select(
        "id, class_id, session_date, start_time, end_time, classes(id, class_name, program, weekday, active, region)"
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

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div style={{ fontSize: 14, color: "#5b7699" }}>불러오는 중...</div>
      </main>
    );
  }

  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;
  const selectedSessions = sessionsByDate[selectedDate] || [];

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
          justifyContent: "center",
          gap: 10,
          padding: "18px 18px 4px",
        }}
      >
        <img src="/logo-main.png" alt="로고" style={{ width: 28, height: 28, objectFit: "contain" }} />
        <div style={{ fontSize: 17, fontWeight: 800, color: "#1b3a63" }}>더블제이 축구 아카데미</div>
      </div>

      <div style={{ padding: "0 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: "#8ea0b8" }}>
            {member?.name}님 · 잔여 {Math.max(remaining, 0)}회
            {!allClassesAllowed && " · 특정 수업만 예약 가능한 회원권"}
          </div>
          <Link href="/adult/reservations" style={{ fontSize: 12, fontWeight: 700, color: BLUE, textDecoration: "none" }}>
            예약내역 →
          </Link>
        </div>

        {errorMsg && (
          <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            {errorMsg}
          </div>
        )}

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 18,
            marginBottom: 16,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button
              type="button"
              onClick={goPrevMonth}
              style={{ padding: "6px 12px", border: "1px solid #e5eaf2", borderRadius: 8, background: "white", color: "#1b3a63", cursor: "pointer" }}
            >
              ‹
            </button>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63" }}>{monthLabel}</div>
            <button
              type="button"
              onClick={goNextMonth}
              style={{ padding: "6px 12px", border: "1px solid #e5eaf2", borderRadius: 8, background: "white", color: "#1b3a63", cursor: "pointer" }}
            >
              ›
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 12, textAlign: "center", color: "#8ea0b8", marginBottom: 6 }}>
            {WEEKDAY_HEADERS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
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
                    border: isSelected ? `2px solid ${BLUE}` : "1px solid #f0f3f8",
                    borderRadius: 8,
                    background: isSelected ? "#e9f1fb" : "white",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? BLUE : "#1b3a63",
                  }}
                >
                  <span>{dayNum}</span>
                  {daySessions.length > 0 && (
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: BLUE, marginTop: 2 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 12 }}>
            {selectedDate} 수업
          </div>

          {selectedSessions.length === 0 && (
            <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
              이 날짜에는 예약 가능한 수업이 없습니다.
            </p>
          )}

          {selectedSessions.map((s, idx) => {
            const count = countsBySession[s.id] || 0;
            const isBooked = myBookedSessionIds.has(s.id);

            return (
              <Link key={s.id} href={`/adult/book/${s.id}`} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    padding: "14px 0",
                    borderTop: idx === 0 ? "none" : "1px solid #f0f3f8",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: getProgramTextColor(s.classes?.program) }}>
                        {s.start_time?.slice(0, 5)}~{s.end_time?.slice(0, 5)} · {s.classes.class_name}
                      </div>
                      <div style={{ fontSize: 13, color: "#8ea0b8", marginTop: 4 }}>
                        현재 신청 {count}명
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      {isBooked && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: BLUE,
                            background: "#e9f1fb",
                            padding: "3px 10px",
                            borderRadius: 999,
                          }}
                        >
                          예약됨
                        </span>
                      )}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c7d2e0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/dashboard" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}

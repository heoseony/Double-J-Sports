"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { nowInGermany } from "../../../lib/germanyTime";
import { getRegionLabel, getRegionTextColor, getProgramTextColor } from "../../../lib/classColors";
import { supabase } from "../../../lib/supabaseClient";
import LoadingScreen from "../../components/LoadingScreen";

const BLUE = "#3B82C4";
const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateWithWeekday(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${dateStr} (${WEEKDAY_LABEL[d.getDay()]})`;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}
function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function AdminAttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [weekStart, setWeekStart] = useState(() => getMonday(nowInGermany()));
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    async function load() {
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

      const weekEnd = addDays(weekStart, 6);
      const startStr = toDateStr(weekStart);
      const endStr = toDateStr(weekEnd);

      const { data: sessionData, error } = await supabase
        .from("class_sessions")
        .select(
          "id, class_id, session_date, start_time, end_time, classes(class_name, program, region)"
        )
        .gte("session_date", startStr)
        .lte("session_date", endStr)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) {
        setErrorMsg("수업 목록을 불러오지 못했습니다: " + error.message);
        setLoading(false);
        return;
      }

      const classIds = [...new Set((sessionData || []).map((s) => s.class_id))];

      let coachNamesByClass = {};
      if (classIds.length > 0) {
        const { data: coachRows } = await supabase
          .from("class_coaches")
          .select("class_id, coach_role, coach_profiles(name)")
          .in("class_id", classIds);

        (coachRows || []).forEach((c) => {
          if (!coachNamesByClass[c.class_id]) {
            coachNamesByClass[c.class_id] = { main: null, assistants: [] };
          }
          const name = c.coach_profiles?.name;
          if (!name) return;
          if (c.coach_role === "main") coachNamesByClass[c.class_id].main = name;
          else if (c.coach_role === "assistant") coachNamesByClass[c.class_id].assistants.push(name);
        });
      }

      const withCoach = (sessionData || []).map((s) => {
        const info = coachNamesByClass[s.class_id];
        const names = info
          ? [info.main, ...info.assistants.map((n) => `${n} 코치님`)].filter(Boolean)
          : [];
        return {
          ...s,
          coachEmail: names.length > 0 ? names.join(", ") : "미지정",
        };
      });

      const sessionIds = withCoach.map((s) => s.id);
      let bookingCountBySession = {};
      let bookingPendingBySession = {};
      if (sessionIds.length > 0) {
        const { data: bookingRows } = await supabase
          .from("bookings")
          .select("class_session_id, status")
          .in("class_session_id", sessionIds)
          .neq("status", "cancelled_prior");

        (bookingRows || []).forEach((b) => {
          bookingCountBySession[b.class_session_id] =
            (bookingCountBySession[b.class_session_id] || 0) + 1;
          if (b.status === "booked") {
            bookingPendingBySession[b.class_session_id] = true;
          }
        });
      }

      const withCounts = withCoach.map((s) => ({
        ...s,
        applicantCount: bookingCountBySession[s.id] || 0,
        isAttendanceDone: !bookingPendingBySession[s.id],
      }));

      setSessions(withCounts);
      setLoading(false);
    }

    setLoading(true);
    load();
  }, [router, weekStart]);

  function goPrevWeek() {
    setWeekStart((prev) => addDays(prev, -7));
  }
  function goNextWeek() {
    setWeekStart((prev) => addDays(prev, 7));
  }
  function goThisWeek() {
    setWeekStart(getMonday(nowInGermany()));
  }

  if (loading || !isAdmin) {
    return (
      <LoadingScreen text="확인 중..." />
    );
  }

  const weekEnd = addDays(weekStart, 6);
  const rangeLabel = toDateStr(weekStart) + " ~ " + toDateStr(weekEnd);
  const todayStr = toDateStr(nowInGermany());

  const visibleSessions = showCompleted
    ? sessions
    : sessions.filter((s) => !(s.session_date < todayStr && s.isAttendanceDone));

  const sessionsByDate = {};
  visibleSessions.forEach((s) => {
    if (!sessionsByDate[s.session_date]) sessionsByDate[s.session_date] = [];
    sessionsByDate[s.session_date].push(s);
  });
  const dateKeys = Object.keys(sessionsByDate).sort();

  return (
    <main style={{ background: "#f3f7fc", minHeight: "100vh", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <Link href="/dashboard" style={{ color: "#1b3a63", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>출석 현황 (전체)</div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        <div style={{ background: "white", borderRadius: 16, padding: 14, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              type="button"
              onClick={goPrevWeek}
              style={{ width: 34, height: 34, border: "1px solid #e5eaf2", borderRadius: 10, background: "white", color: "#5b7699", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              onClick={goThisWeek}
              style={{ padding: "6px 14px", fontSize: 13, fontWeight: 700, border: "none", background: "#e9f1fb", color: BLUE, borderRadius: 999, cursor: "pointer" }}
            >
              이번 주
            </button>
            <button
              type="button"
              onClick={goNextWeek}
              style={{ width: 34, height: 34, border: "1px solid #e5eaf2", borderRadius: 10, background: "white", color: "#5b7699", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <ChevronRight />
            </button>
          </div>
          <div style={{ textAlign: "center", fontSize: 12, color: "#8ea0b8", marginTop: 8 }}>
            {rangeLabel}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              border: "1px solid #e5eaf2",
              borderRadius: 999,
              background: showCompleted ? "#e9f1fb" : "white",
              color: showCompleted ? BLUE : "#5b7699",
              cursor: "pointer",
            }}
          >
            {showCompleted ? "완료된 수업 숨기기" : "완료된 수업 보기"}
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
            {errorMsg}
          </div>
        )}

        {sessions.length === 0 && !errorMsg && (
          <div style={{ background: "white", borderRadius: 16, padding: 18, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
            <p style={{ fontSize: 14, color: "#8ea0b8", margin: 0 }}>이 기간에 예정된 수업이 없습니다.</p>
          </div>
        )}

        {dateKeys.map((dateStr) => (
          <div key={dateStr} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1b3a63", marginBottom: 8 }}>
              {formatDateWithWeekday(dateStr)}
            </div>
            <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
              {sessionsByDate[dateStr].map((s, idx) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    gap: 10,
                    borderBottom: idx === sessionsByDate[dateStr].length - 1 ? "none" : "1px solid #f0f3f8",
                  }}
                >
                  <div
                    style={{
                      width: 4,
                      flexShrink: 0,
                      background: getProgramTextColor(s.classes?.program),
                    }}
                  />
                  <div style={{ padding: "12px 4px 12px 0", flexShrink: 0, textAlign: "center", minWidth: 46 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#1b3a63" }}>
                      {s.start_time ? s.start_time.slice(0, 5) : ""}
                    </div>
                    <div style={{ fontSize: 10, color: "#8ea0b8", marginTop: 1 }}>
                      ~{s.end_time ? s.end_time.slice(0, 5) : ""}
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: "12px 0", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 999,
                          color: getRegionTextColor(s.classes?.region),
                          background: "white",
                          border: "1px solid #eef2f8",
                        }}
                      >
                        {getRegionLabel(s.classes?.region || "frankfurt")}
                      </span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1b3a63", marginTop: 4 }}>
                      {s.classes?.class_name}
                    </div>
                    <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 2 }}>
                      담당 코치: {s.coachEmail}
                    </div>
                    <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      신청 {s.applicantCount}명
                      {s.isAttendanceDone && s.applicantCount > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#2e7d32", background: "#e8f5ec", padding: "1px 7px", borderRadius: 999 }}>
                          완료
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", paddingRight: 14 }}>
                    <Link href={"/coach/attendance?sessionId=" + s.id}>
                      <button
                        style={{ padding: "9px 16px", fontSize: 13, fontWeight: 700, color: "white", background: BLUE, border: "none", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        출석 체크
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

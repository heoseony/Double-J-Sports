"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getRegionBg, getProgramTextColor } from "../../lib/classColors";
import { nowInGermany } from "../../lib/germanyTime";
import { supabase } from "../../lib/supabaseClient";
import LoadingScreen from "../components/LoadingScreen";

const BLUE = "#3B82C4";

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

export default function CoachHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isCoach, setIsCoach] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [weekStart, setWeekStart] = useState(() => getMonday(nowInGermany()));

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

      if (!profile || profile.role !== "coach") {
        router.push("/dashboard");
        return;
      }

      setIsCoach(true);

      // 로그인 시 선택한 코치 프로필 확인 (없으면 프로필 선택 화면으로)
      let activeProfileId = null;
      try {
        const stored = localStorage.getItem(
          "double-j-sports-active-coach-profile"
        );
        activeProfileId = stored ? JSON.parse(stored)?.id : null;
      } catch (e) {
        activeProfileId = null;
      }

      if (!activeProfileId) {
        router.push("/coach/select-profile");
        return;
      }

      const { data: myClassCoaches } = await supabase
        .from("class_coaches")
        .select("class_id, classes(id, class_name, program, region)")
        .eq("coach_profile_id", activeProfileId);

      const classIds = (myClassCoaches || []).map((cc) => cc.class_id);
      const classMap = {};
      (myClassCoaches || []).forEach((cc) => {
        if (cc.classes) classMap[cc.class_id] = cc.classes;
      });

      const weekEnd = addDays(weekStart, 6);
      const startStr = toDateStr(weekStart);
      const endStr = toDateStr(weekEnd);

      const { data: sessionData, error } = await supabase
        .from("class_sessions")
        .select("id, session_date, start_time, end_time, class_id")
        .in("class_id", classIds)
        .gte("session_date", startStr)
        .lte("session_date", endStr)
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) {
        setErrorMsg("수업 목록을 불러오지 못했습니다: " + error.message);
        setLoading(false);
        return;
      }

      const withClassInfo = (sessionData || []).map((s) => ({
        ...s,
        classInfo: classMap[s.class_id],
      }));

      setSessions(withClassInfo);
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

  if (loading || !isCoach) {
    return (
      <LoadingScreen text="확인 중..." />
    );
  }

  const weekEnd = addDays(weekStart, 6);
  const rangeLabel = `${toDateStr(weekStart)} ~ ${toDateStr(weekEnd)}`;

  // 날짜별로 묶어서 표시
  const sessionsByDate = {};
  sessions.forEach((s) => {
    if (!sessionsByDate[s.session_date]) sessionsByDate[s.session_date] = [];
    sessionsByDate[s.session_date].push(s);
  });
  const dateKeys = Object.keys(sessionsByDate).sort();

  return (
    <main style={{ background: "#f3f7fc", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ padding: "18px 18px 4px", fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
        수업 관리
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        {/* 주간 네비게이션 */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 14,
            marginBottom: 16,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <button
              type="button"
              onClick={goPrevWeek}
              style={{
                width: 34,
                height: 34,
                border: "1px solid #e5eaf2",
                borderRadius: 10,
                background: "white",
                color: "#5b7699",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              onClick={goThisWeek}
              style={{
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                background: "#e9f1fb",
                color: BLUE,
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              이번 주
            </button>
            <button
              type="button"
              onClick={goNextWeek}
              style={{
                width: 34,
                height: 34,
                border: "1px solid #e5eaf2",
                borderRadius: 10,
                background: "white",
                color: "#5b7699",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight />
            </button>
          </div>
          <div style={{ textAlign: "center", fontSize: 12, color: "#8ea0b8", marginTop: 8 }}>
            {rangeLabel}
          </div>
        </div>

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

        {sessions.length === 0 && !errorMsg && (
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 18,
              boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
            }}
          >
            <p style={{ fontSize: 14, color: "#8ea0b8", margin: 0 }}>
              이 기간에 담당하는 수업이 없습니다.
            </p>
          </div>
        )}

        {dateKeys.map((dateStr) => (
          <div key={dateStr} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1b3a63", marginBottom: 8 }}>
              {dateStr}
            </div>
            <div
              style={{
                background: "white",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
              }}
            >
              {sessionsByDate[dateStr].map((s, idx) => (
                <div
                  key={s.id}
                  style={{
                    padding: "14px 16px",
                    borderBottom:
                      idx === sessionsByDate[dateStr].length - 1
                        ? "none"
                        : "1px solid #f0f3f8",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: getProgramTextColor(s.classInfo?.program) }}>
                      {s.classInfo?.class_name}
                      <span style={{ fontWeight: 500, color: "#8ea0b8" }}>
                        {" "}
                        ({s.classInfo?.program})
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 3 }}>
                      {s.start_time?.slice(0, 5)}~{s.end_time?.slice(0, 5)}
                    </div>
                  </div>
                  <Link href={`/coach/attendance?sessionId=${s.id}`}>
                    <button
                      style={{
                        padding: "9px 16px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "white",
                        background: BLUE,
                        border: "none",
                        borderRadius: 10,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      출석 체크
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

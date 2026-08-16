"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

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

export default function AdminAttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

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
          "id, session_date, start_time, end_time, classes(class_name, program, coach_id)"
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

      const coachIds = [
        ...new Set(
          (sessionData || [])
            .map((s) => s.classes?.coach_id)
            .filter(Boolean)
        ),
      ];

      let coachEmailById = {};
      if (coachIds.length > 0) {
        const { data: coachRows } = await supabase
          .from("users")
          .select("id, email")
          .in("id", coachIds);
        (coachRows || []).forEach((c) => {
          coachEmailById[c.id] = c.email;
        });
      }

      const withCoach = (sessionData || []).map((s) => ({
        ...s,
        coachEmail: s.classes?.coach_id
          ? coachEmailById[s.classes.coach_id] || "(알 수 없음)"
          : "미지정",
      }));

      setSessions(withCoach);
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
    setWeekStart(getMonday(new Date()));
  }

  if (loading || !isAdmin) {
    return (
      <main className="page">
        <div className="subtitle">확인 중...</div>
      </main>
    );
  }

  const weekEnd = addDays(weekStart, 6);
  const rangeLabel = `${toDateStr(weekStart)} ~ ${toDateStr(weekEnd)}`;

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">출석 현황 (전체)</div>

      <div className="card">
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
            onClick={goPrevWeek}
            style={{
              padding: "6px 12px",
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "white",
              cursor: "pointer",
            }}
          >
            ‹ 이전 주
          </button>
          <button
            type="button"
            onClick={goThisWeek}
            style={{
              padding: "6px 10px",
              fontSize: 13,
              border: "none",
              background: "transparent",
              color: "#0b3d2e",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            이번 주
          </button>
          <button
            type="button"
            onClick={goNextWeek}
            style={{
              padding: "6px 12px",
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "white",
              cursor: "pointer",
            }}
          >
            다음 주 ›
          </button>
        </div>

        <div
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "#777",
            marginBottom: 10,
          }}
        >
          {rangeLabel}
        </div>

        {errorMsg && <div className="message error">{errorMsg}</div>}

        {sessions.length === 0 && !errorMsg && (
          <p style={{ fontSize: 14, color: "#777" }}>
            이 기간에 예정된 수업이 없습니다.
          </p>
        )}

        {sessions.map((s) => (
          <div
            key={s.id}
            style={{
              padding: "14px 0",
              borderBottom: "1px solid #eee",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              {s.session_date} · {s.start_time?.slice(0, 5)}~
              {s.end_time?.slice(0, 5)} · {s.classes?.class_name} (
              {s.classes?.program})
            </div>
            <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
              담당 코치: {s.coachEmail}
            </div>
            <Link href={`/coach/attendance?sessionId=${s.id}`}>
              <button
                className="primary"
                style={{ marginTop: 10, padding: "10px 16px" }}
              >
                출석 체크
              </button>
            </Link>
          </div>
        ))}
      </div>

      <div className="link-row">
        <Link href="/admin">← 관리자 홈으로</Link>
      </div>
    </main>
  );
}

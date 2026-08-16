"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function CoachHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isCoach, setIsCoach] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

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

      const { data: myClasses } = await supabase
        .from("classes")
        .select("id, class_name, program")
        .eq("coach_id", user.id);

      const classIds = (myClasses || []).map((c) => c.id);
      const classMap = {};
      (myClasses || []).forEach((c) => (classMap[c.id] = c));

      if (classIds.length === 0) {
        setSessions([]);
        setLoading(false);
        return;
      }

      const today = todayStr();
      const { data: sessionData, error } = await supabase
        .from("class_sessions")
        .select("id, session_date, start_time, end_time, class_id")
        .in("class_id", classIds)
        .gte("session_date", today)
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

    load();
  }, [router]);

  if (loading || !isCoach) {
    return (
      <main className="page">
        <div className="subtitle">확인 중...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">코치 화면 · 담당 수업</div>

      <div className="card">
        {errorMsg && <div className="message error">{errorMsg}</div>}

        {sessions.length === 0 && !errorMsg && (
          <p style={{ fontSize: 14, color: "#777" }}>
            담당하는 수업이나 예정된 세션이 없습니다.
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
              {s.session_date} · {s.classInfo?.class_name} (
              {s.classInfo?.program})
            </div>
            <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
              {s.start_time?.slice(0, 5)}~{s.end_time?.slice(0, 5)}
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
    </main>
  );
}

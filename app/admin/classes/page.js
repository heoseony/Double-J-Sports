"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

const PROGRAM_LABEL = {
  kids: "Kids",
  womens: "Women's",
  mens: "Men's",
};

function formatTime(t) {
  if (!t) return "";
  return t.slice(0, 5);
}

export default function AdminClassesPage() {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [sessionCounts, setSessionCounts] = useState({});
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function load() {
      const { data: classList, error } = await supabase
        .from("classes")
        .select("*")
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) {
        setErrorMsg("수업 목록을 불러오지 못했습니다: " + error.message);
        setLoading(false);
        return;
      }

      setClasses(classList || []);

      // 오늘 이후 예정된 회차 수 (참고용)
      if (classList && classList.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: sessions } = await supabase
          .from("class_sessions")
          .select("class_id")
          .gte("session_date", today);

        const counts = {};
        (sessions || []).forEach((s) => {
          counts[s.class_id] = (counts[s.class_id] || 0) + 1;
        });
        setSessionCounts(counts);
      }

      setLoading(false);
    }

    load();
  }, []);

  if (loading) {
    return (
      <main className="admin-page">
        <div className="subtitle">불러오는 중...</div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="brand">수업 관리</div>
      <div className="subtitle">
        Kids / Women's / Men's 수업을 요일별로 관리합니다. (정원 없음 —
        신청자 수만 표시)
      </div>

      <div className="card">
        {errorMsg && <div className="message error">{errorMsg}</div>}

        {classes.length === 0 && !errorMsg && (
          <p style={{ marginTop: 0, fontSize: 15, color: "#555" }}>
            아직 등록된 수업이 없습니다.
          </p>
        )}

        {classes.map((c) => (
          <div key={c.id} className="list-row">
            <div>
              <span className={`badge ${c.program}`}>
                {PROGRAM_LABEL[c.program] || c.program}
              </span>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>
                {c.class_name}
                {c.age_group ? ` (${c.age_group})` : ""}
              </div>
              <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
                매주 {WEEKDAY_LABEL[c.weekday]}요일{" "}
                {formatTime(c.start_time)}~{formatTime(c.end_time)}
                {c.coach_name ? ` · ${c.coach_name} 코치` : ""}
                {c.location ? ` · ${c.location}` : ""}
              </div>
              <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                예정된 회차: {sessionCounts[c.id] || 0}개
                {!c.is_active && " · 비활성"}
              </div>
            </div>
          </div>
        ))}

        <Link href="/admin/classes/new">
          <button className="primary">+ 새 수업 만들기</button>
        </Link>

        <div className="link-row">
          <Link href="/admin">← 관리자 홈으로</Link>
        </div>
      </div>
    </main>
  );
}

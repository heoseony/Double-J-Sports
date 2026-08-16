"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";

const WEEKDAYS = [
  { value: 0, label: "일요일" },
  { value: 1, label: "월요일" },
  { value: 2, label: "화요일" },
  { value: 3, label: "수요일" },
  { value: 4, label: "목요일" },
  { value: 5, label: "금요일" },
  { value: 6, label: "토요일" },
];

const WEEKS_TO_GENERATE = 8; // 수업 생성 시 앞으로 8주치 회차를 미리 만들어둠

function nextDatesForWeekday(weekday, count) {
  const dates = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = (weekday - today.getDay() + 7) % 7;
  const first = new Date(today);
  first.setDate(today.getDate() + diff);

  for (let i = 0; i < count; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() + i * 7);
    dates.push(d.toISOString().slice(0, 10));
  }

  return dates;
}

export default function NewClassPage() {
  const router = useRouter();

  const [program, setProgram] = useState("kids");
  const [className, setClassName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:00");
  const [coachName, setCoachName] = useState("");
  const [location, setLocation] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const canSubmit = className && startTime && endTime;

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!canSubmit) {
      setErrorMsg("수업명, 시작/종료 시간은 필수입니다.");
      return;
    }

    if (endTime <= startTime) {
      setErrorMsg("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    setLoading(true);

    const { data: newClass, error: classError } = await supabase
      .from("classes")
      .insert({
        program,
        class_name: className,
        age_group: ageGroup || null,
        weekday: Number(weekday),
        start_time: startTime,
        end_time: endTime,
        coach_name: coachName || null,
        location: location || null,
      })
      .select()
      .single();

    if (classError) {
      setErrorMsg("수업 생성 실패: " + classError.message);
      setLoading(false);
      return;
    }

    // 앞으로 8주치 회차(class_sessions) 자동 생성
    const dates = nextDatesForWeekday(Number(weekday), WEEKS_TO_GENERATE);
    const sessionsToInsert = dates.map((session_date) => ({
      class_id: newClass.id,
      session_date,
    }));

    const { error: sessionError } = await supabase
      .from("class_sessions")
      .insert(sessionsToInsert);

    setLoading(false);

    if (sessionError) {
      setErrorMsg(
        "수업은 생성됐지만 회차 생성에 실패했습니다: " + sessionError.message
      );
      return;
    }

    router.push("/admin/classes");
  }

  return (
    <main className="admin-page">
      <div className="brand">새 수업 만들기</div>
      <div className="subtitle">
        저장하면 앞으로 {WEEKS_TO_GENERATE}주치 회차가 자동으로 생성됩니다.
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <label>프로그램</label>
          <select value={program} onChange={(e) => setProgram(e.target.value)}>
            <option value="kids">Kids</option>
            <option value="womens">Women's</option>
            <option value="mens">Men's</option>
          </select>

          <label>수업명</label>
          <input
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="예: Kids U8 클래스"
          />

          <label>대상 연령대 (선택)</label>
          <input
            type="text"
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            placeholder="예: 6-8세"
          />

          <label>요일</label>
          <select
            value={weekday}
            onChange={(e) => setWeekday(e.target.value)}
          >
            {WEEKDAYS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>

          <label>시작 시간</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />

          <label>종료 시간</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />

          <label>코치 (선택)</label>
          <input
            type="text"
            value={coachName}
            onChange={(e) => setCoachName(e.target.value)}
            placeholder="예: 이코치"
          />

          <label>장소 (선택)</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="예: Frankfurt Sportplatz A"
          />

          {errorMsg && <div className="message error">{errorMsg}</div>}

          <button className="primary" type="submit" disabled={loading}>
            {loading ? "생성 중..." : "수업 만들기"}
          </button>
        </form>

        <div className="link-row">
          <Link href="/admin/classes">← 수업 목록으로</Link>
        </div>
      </div>
    </main>
  );
}

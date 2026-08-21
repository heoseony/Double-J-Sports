"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const WEEKDAY_LABELS = {
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
};

const CAL_WEEKDAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];
const BLUE = "#3B82C4";

function pad2(n) {
  return String(n).padStart(2, "0");
}
function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function todayStr() {
  return toDateStr(new Date());
}

export default function AdminClassesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [classes, setClasses] = useState([]);

  const [program, setProgram] = useState("kids");
  const [className, setClassName] = useState("Kids");
  const [weekday, setWeekday] = useState("1");
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:00");
  const [location, setLocation] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState("");
  const [coaches, setCoaches] = useState([]);
  const [assigningClassId, setAssigningClassId] = useState(null);
  const [editingClassId, setEditingClassId] = useState(null);
  const [editProgram, setEditProgram] = useState("kids");
  const [editClassName, setEditClassName] = useState("");
  const [editWeekday, setEditWeekday] = useState("1");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteMsg, setDeleteMsg] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [showClassList, setShowClassList] = useState(true);

  // ── 캘린더 관련 상태 ──────────────────────────
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [monthSessions, setMonthSessions] = useState([]); // 이번 달 전체 세션(클래스 정보 포함)
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);
  const [addClassId, setAddClassId] = useState("");
  const [addStartTime, setAddStartTime] = useState("16:00");
  const [addEndTime, setAddEndTime] = useState("17:00");
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg, setAddMsg] = useState("");

  async function loadClasses() {
    const { data, error } = await supabase
      .from("classes")
      .select(
        "id, program, class_name, weekday, start_time, end_time, location, active, coach_id"
      )
      .order("weekday", { ascending: true })
      .order("start_time", { ascending: true });

    if (!error) {
      setClasses(data || []);
    }
  }

  async function loadCoaches() {
    const { data } = await supabase
      .from("users")
      .select("id, email")
      .eq("role", "coach");
    setCoaches(data || []);
  }

  async function loadMonthSessions(monthDate) {
    setLoadingCalendar(true);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = toDateStr(new Date(year, month, 1));
    const lastDay = toDateStr(new Date(year, month + 1, 0));

    const { data } = await supabase
      .from("class_sessions")
      .select("id, session_date, start_time, end_time, class_id, status")
      .gte("session_date", firstDay)
      .lte("session_date", lastDay)
      .order("start_time", { ascending: true });

    setMonthSessions(data || []);
    setLoadingCalendar(false);
  }

  useEffect(() => {
    async function check() {
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
      await loadClasses();
      await loadCoaches();
      await loadMonthSessions(currentMonth);
      setLoading(false);
    }

    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!loading) {
      loadMonthSessions(currentMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const classMap = {};
  classes.forEach((c) => (classMap[c.id] = c));

  const sessionsByDate = {};
  monthSessions.forEach((s) => {
    if (!sessionsByDate[s.session_date]) sessionsByDate[s.session_date] = [];
    sessionsByDate[s.session_date].push(s);
  });

  const calendarCells = (() => {
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
  })();

  async function handleAddSession() {
    setAddMsg("");
    if (!addClassId) {
      setAddMsg("추가할 수업(상품)을 선택해주세요.");
      return;
    }
    setAddSaving(true);

    const { error } = await supabase.from("class_sessions").insert({
      class_id: addClassId,
      session_date: selectedDate,
      start_time: addStartTime,
      end_time: addEndTime,
      status: "scheduled",
    });

    setAddSaving(false);

    if (error) {
      setAddMsg("추가 실패: " + error.message);
      return;
    }

    setAddMsg("이 날짜에 수업이 추가되었습니다. 계속해서 다른 수업도 추가할 수 있습니다.");
    await loadMonthSessions(currentMonth);
  }

  async function handleGenerateSessions() {
    setGenerateMsg("");
    setGenerating(true);

    let createdCount = 0;

    for (const c of classes) {
      if (!c.active) continue;

      const targetDates = [];
      const today = new Date();
      for (let i = 0; i < 28; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        if (d.getDay() === c.weekday) {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          targetDates.push(`${yyyy}-${mm}-${dd}`);
        }
      }

      for (const dateStr of targetDates) {
        const { data: existing } = await supabase
          .from("class_sessions")
          .select("id")
          .eq("class_id", c.id)
          .eq("session_date", dateStr)
          .maybeSingle();

        if (!existing) {
          const { error } = await supabase.from("class_sessions").insert({
            class_id: c.id,
            session_date: dateStr,
            start_time: c.start_time,
            end_time: c.end_time,
            status: "scheduled",
          });
          if (!error) createdCount += 1;
        }
      }
    }

    setGenerating(false);
    setGenerateMsg(`${createdCount}개의 새 세션이 생성되었습니다. (앞으로 4주치)`);
    await loadMonthSessions(currentMonth);
  }

  async function handleAssignCoach(classId, coachId) {
    setAssigningClassId(classId);
    await supabase
      .from("classes")
      .update({ coach_id: coachId || null })
      .eq("id", classId);
    await loadClasses();
    setAssigningClassId(null);
  }

  function startEdit(c) {
    setEditingClassId(c.id);
    setEditProgram(c.program);
    setEditClassName(c.class_name);
    setEditWeekday(String(c.weekday));
    setEditStartTime(c.start_time?.slice(0, 5) || "");
    setEditEndTime(c.end_time?.slice(0, 5) || "");
    setEditLocation(c.location || "");
  }

  function cancelEdit() {
    setEditingClassId(null);
  }

  async function saveEdit(classId) {
    setSavingEdit(true);
    const { error } = await supabase
      .from("classes")
      .update({
        program: editProgram,
        class_name: editClassName,
        weekday: Number(editWeekday),
        start_time: editStartTime,
        end_time: editEndTime,
        location: editLocation || null,
      })
      .eq("id", classId);

    setSavingEdit(false);

    if (!error) {
      setEditingClassId(null);
      await loadClasses();
    }
  }

  async function toggleActive(classId, currentActive) {
    setTogglingId(classId);
    await supabase
      .from("classes")
      .update({ active: !currentActive })
      .eq("id", classId);
    await loadClasses();
    setTogglingId(null);
  }

  async function handleDeleteClass(classId, classLabel) {
    setDeleteMsg("");

    const ok = window.confirm(
      `"${classLabel}" 수업을 정말 삭제할까요?\n\n이미 생성된 세션/예약이 있으면 삭제가 안 될 수 있어요 (그런 경우엔 "비활성화"를 대신 사용해주세요).`
    );
    if (!ok) return;

    setDeletingId(classId);

    const { error } = await supabase.from("classes").delete().eq("id", classId);

    setDeletingId(null);

    if (error) {
      setDeleteMsg(
        "삭제 실패: 이미 생성된 세션/예약 기록이 연결되어 있어서 삭제할 수 없습니다. 대신 '비활성화'를 사용해주세요. (" +
          error.message +
          ")"
      );
      return;
    }

    setDeleteMsg("수업이 삭제되었습니다.");
    await loadClasses();
    await loadMonthSessions(currentMonth);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setSaving(true);

    const { error } = await supabase.from("classes").insert({
      program,
      class_name: className,
      weekday: Number(weekday),
      start_time: startTime,
      end_time: endTime,
      location: location || null,
      active: true,
    });

    setSaving(false);

    if (error) {
      setErrorMsg("생성 실패: " + error.message);
      return;
    }

    setClassName("Kids");
    setLocation("");
    await loadClasses();
  }

  if (loading || !isAdmin) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div style={{ fontSize: 14, color: "#5b7699" }}>확인 중...</div>
      </main>
    );
  }

  const monthLabel = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;
  const selectedDaySessions = sessionsByDate[selectedDate] || [];

  return (
    <main style={{ background: "#f3f7fc", minHeight: "100vh", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <Link href="/admin" style={{ color: "#1b3a63", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>수업 관리</div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>

      {/* ── 캘린더 카드 ────────────────────── */}
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
          {CAL_WEEKDAY_HEADERS.map((w) => (
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
                onClick={() => {
                  setSelectedDate(dateStr);
                  setShowAddSession(false);
                  setAddMsg("");
                }}
                style={{
                  aspectRatio: "1",
                  padding: 2,
                  border: isSelected ? `2px solid ${BLUE}` : "1px solid #eee",
                  borderRadius: 8,
                  background: isSelected ? "#e9f1fb" : "white",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? BLUE : "#1a1a1a",
                }}
              >
                <span>{dayNum}</span>
                {daySessions.length > 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      color: BLUE,
                      fontWeight: 700,
                      marginTop: 1,
                    }}
                  >
                    ●{daySessions.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loadingCalendar && (
          <p style={{ fontSize: 12, color: "#999", marginTop: 10 }}>
            불러오는 중...
          </p>
        )}

        {/* 선택한 날짜의 세션 목록 */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #eee" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
            {selectedDate} 수업 ({selectedDaySessions.length}개)
          </div>

          {selectedDaySessions.length === 0 && (
            <p style={{ fontSize: 13, color: "#777", margin: 0 }}>
              이 날짜에 등록된 수업이 없습니다.
            </p>
          )}

          {selectedDaySessions.map((s) => {
            const info = classMap[s.class_id];
            return (
              <div
                key={s.id}
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid #f5f5f5",
                  fontSize: 13,
                }}
              >
                <strong>[{info?.program}] {info?.class_name || "(알 수 없는 수업)"}</strong>
                {" · "}
                {s.start_time?.slice(0, 5)}~{s.end_time?.slice(0, 5)}
              </div>
            );
          })}

          {!showAddSession ? (
            <button
              type="button"
              onClick={() => {
                setShowAddSession(true);
                setAddClassId("");
                setAddMsg("");
              }}
              style={{
                marginTop: 12,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                borderRadius: 8,
                background: BLUE,
                color: "white",
                cursor: "pointer",
              }}
            >
              + 이 날짜에 수업 추가
            </button>
          ) : (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: "#f8fafd",
                borderRadius: 10,
              }}
            >
              <label style={{ fontSize: 12 }}>추가할 수업(상품)</label>
              <select
                value={addClassId}
                onChange={(e) => {
                  const c = classMap[e.target.value];
                  setAddClassId(e.target.value);
                  if (c) {
                    setAddStartTime(c.start_time?.slice(0, 5) || "16:00");
                    setAddEndTime(c.end_time?.slice(0, 5) || "17:00");
                  }
                }}
                style={{
                  width: "100%",
                  padding: 10,
                  fontSize: 13,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  marginBottom: 8,
                  background: "white",
                }}
              >
                <option value="">-- 선택 --</option>
                {classes
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.program}] {c.class_name} ({WEEKDAY_LABELS[c.weekday]}요일 기본{" "}
                      {c.start_time?.slice(0, 5)}~{c.end_time?.slice(0, 5)})
                    </option>
                  ))}
              </select>

              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12 }}>시작 시간</label>
                  <input
                    type="time"
                    value={addStartTime}
                    onChange={(e) => setAddStartTime(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 10,
                      fontSize: 13,
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12 }}>종료 시간</label>
                  <input
                    type="time"
                    value={addEndTime}
                    onChange={(e) => setAddEndTime(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 10,
                      fontSize: 13,
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {addMsg && (
                <div
                  style={{
                    fontSize: 12,
                    color: addMsg.includes("실패") ? "#b3261e" : BLUE,
                    marginBottom: 8,
                    fontWeight: 600,
                  }}
                >
                  {addMsg}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={addSaving}
                  onClick={handleAddSession}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    fontSize: 13,
                    fontWeight: 700,
                    border: "none",
                    borderRadius: 8,
                    background: BLUE,
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  {addSaving ? "추가 중..." : "추가"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSession(false)}
                  style={{
                    padding: "10px 16px",
                    fontSize: 13,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  닫기
                </button>
              </div>
              <p style={{ fontSize: 11, color: "#999", marginTop: 8 }}>
                * 추가 후에도 이 화면에 그대로 남아있어서, 같은 날짜에 다른 수업을 계속 이어서 추가할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── 기존 반복 스케줄 생성 폼 (그대로 유지, 접기 가능) ────────────────────── */}
      <div style={{ background: "white", borderRadius: 16, padding: 18, marginTop: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63" }}>
            새 반복 수업 만들기
          </span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9aa8bc"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: showCreateForm ? "rotate(180deg)" : "none",
              transition: "transform 0.15s",
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {showCreateForm && (
        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <label>프로그램</label>
          <select
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 16,
              border: "1px solid #ddd",
              borderRadius: 10,
              background: "#fafafa",
            }}
          >
            <option value="kids">Kids</option>
            <option value="women">Women's</option>
            <option value="men">Men's</option>
          </select>

          <label>수업 이름</label>
          <input
            type="text"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="예: Kids"
          />

          <label>요일</label>
          <select
            value={weekday}
            onChange={(e) => setWeekday(e.target.value)}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 16,
              border: "1px solid #ddd",
              borderRadius: 10,
              background: "#fafafa",
            }}
          >
            <option value="1">월요일</option>
            <option value="2">화요일</option>
            <option value="3">수요일</option>
            <option value="4">목요일</option>
            <option value="5">금요일</option>
            <option value="6">토요일</option>
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

          <label>장소 (선택)</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="예: Frankfurt Training Center"
          />

          {errorMsg && <div className="message error">{errorMsg}</div>}

          <button
            type="submit"
            disabled={saving}
            style={{ width: "100%", marginTop: 20, padding: 15, fontSize: 15, fontWeight: 700, color: "white", background: "#3B82C4", border: "none", borderRadius: 10, cursor: "pointer" }}
          >
            {saving ? "생성 중..." : "수업 생성"}
          </button>
        </form>
        )}
      </div>

      <div style={{ background: "white", borderRadius: 16, padding: 18, marginTop: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
        <button
          type="button"
          onClick={() => setShowClassList((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "none",
            border: "none",
            padding: 0,
            marginBottom: showClassList ? 10 : 0,
            cursor: "pointer",
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63" }}>
            등록된 수업 ({classes.length}개)
          </span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9aa8bc"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: showClassList ? "rotate(180deg)" : "none",
              transition: "transform 0.15s",
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {showClassList && (
        <>

        {classes.length > 0 && (
          <button
            style={{ marginBottom: 16, width: "100%", padding: 14, fontSize: 14, fontWeight: 700, color: "white", background: "#3B82C4", border: "none", borderRadius: 10, cursor: "pointer" }}
            onClick={handleGenerateSessions}
            disabled={generating}
          >
            {generating ? "생성 중..." : "앞으로 4주 실제 날짜 세션 생성"}
          </button>
        )}

        {generateMsg && <div className="message success">{generateMsg}</div>}

        {classes.length === 0 && (
          <p style={{ fontSize: 14, color: "#777" }}>
            아직 등록된 수업이 없습니다.
          </p>
        )}

        {classes.map((c) => {
          const isEditing = editingClassId === c.id;

          if (isEditing) {
            return (
              <div
                key={c.id}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid #eee",
                  fontSize: 14,
                  background: "#fafafa",
                }}
              >
                <label style={{ fontSize: 12 }}>프로그램</label>
                <select
                  value={editProgram}
                  onChange={(e) => setEditProgram(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    fontSize: 14,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <option value="kids">Kids</option>
                  <option value="women">Women's</option>
                  <option value="men">Men's</option>
                </select>

                <label style={{ fontSize: 12 }}>수업 이름</label>
                <input
                  type="text"
                  value={editClassName}
                  onChange={(e) => setEditClassName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    fontSize: 14,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    marginBottom: 8,
                    boxSizing: "border-box",
                  }}
                />

                <label style={{ fontSize: 12 }}>요일</label>
                <select
                  value={editWeekday}
                  onChange={(e) => setEditWeekday(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    fontSize: 14,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <option value="1">월요일</option>
                  <option value="2">화요일</option>
                  <option value="3">수요일</option>
                  <option value="4">목요일</option>
                  <option value="5">금요일</option>
                  <option value="6">토요일</option>
                </select>

                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12 }}>시작 시간</label>
                    <input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 10,
                        fontSize: 14,
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12 }}>종료 시간</label>
                    <input
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      style={{
                        width: "100%",
                        padding: 10,
                        fontSize: 14,
                        border: "1px solid #ddd",
                        borderRadius: 8,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <label style={{ fontSize: 12 }}>장소</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 10,
                    fontSize: 14,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    marginBottom: 10,
                    boxSizing: "border-box",
                  }}
                />

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      border: "none",
                      borderRadius: 8,
                      background: "#3B82C4",
                      color: "white",
                      cursor: "pointer",
                    }}
                    disabled={savingEdit}
                    onClick={() => saveEdit(c.id)}
                  >
                    {savingEdit ? "저장 중..." : "저장"}
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      background: "white",
                      cursor: "pointer",
                    }}
                    onClick={cancelEdit}
                  >
                    취소
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={c.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #eee",
                fontSize: 14,
                opacity: c.active ? 1 : 0.5,
              }}
            >
              <div style={{ fontWeight: 700 }}>
                [{c.program}] {c.class_name} — {WEEKDAY_LABELS[c.weekday]}요일{" "}
                {c.start_time?.slice(0, 5)}~{c.end_time?.slice(0, 5)}
                {!c.active && " (비활성)"}
              </div>
              <div style={{ color: "#777", marginTop: 2 }}>
                {c.location || "장소 미입력"}
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 12, marginBottom: 4 }}>
                  담당 코치
                </label>
                <select
                  value={c.coach_id || ""}
                  onChange={(e) => handleAssignCoach(c.id, e.target.value)}
                  disabled={assigningClassId === c.id}
                  style={{
                    width: "100%",
                    padding: 10,
                    fontSize: 14,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    background: "#fafafa",
                  }}
                >
                  <option value="">-- 미지정 --</option>
                  {coaches.map((co) => (
                    <option key={co.id} value={co.id}>
                      {co.email}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    background: "white",
                    cursor: "pointer",
                  }}
                  onClick={() => startEdit(c)}
                >
                  수정
                </button>
                <button
                  type="button"
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    border: c.active
                      ? "1px solid #b3261e"
                      : "1px solid #3B82C4",
                    color: c.active ? "#b3261e" : "#3B82C4",
                    borderRadius: 8,
                    background: "white",
                    cursor: "pointer",
                  }}
                  disabled={togglingId === c.id}
                  onClick={() => toggleActive(c.id, c.active)}
                >
                  {togglingId === c.id
                    ? "처리 중..."
                    : c.active
                    ? "비활성화"
                    : "활성화"}
                </button>
                <button
                  type="button"
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    border: "1px solid #b3261e",
                    color: "#b3261e",
                    borderRadius: 8,
                    background: "white",
                    cursor: "pointer",
                  }}
                  disabled={deletingId === c.id}
                  onClick={() =>
                    handleDeleteClass(
                      c.id,
                      `[${c.program}] ${c.class_name} (${WEEKDAY_LABELS[c.weekday]}요일)`
                    )
                  }
                >
                  {deletingId === c.id ? "삭제 중..." : "삭제"}
                </button>
              </div>
              {deleteMsg && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: deleteMsg.includes("실패") ? "#b3261e" : "#3B82C4",
                  }}
                >
                  {deleteMsg}
                </div>
              )}
            </div>
          );
        })}
        </>
        )}
      </div>

      <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
        <Link href="/admin" style={{ color: "#3B82C4", fontWeight: 700, textDecoration: "none" }}>← 관리자 홈으로</Link>
      </div>
      </div>
      </div>
    </main>
  );
}

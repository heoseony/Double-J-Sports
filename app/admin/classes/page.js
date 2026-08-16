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
      setLoading(false);
    }

    check();
  }, [router]);

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
      <main className="page">
        <div className="subtitle">확인 중...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">수업 관리 (반복 스케줄)</div>

      <div className="card">
        <form onSubmit={handleSubmit}>
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

          <button className="primary" type="submit" disabled={saving}>
            {saving ? "생성 중..." : "수업 생성"}
          </button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>등록된 수업</div>

        {classes.length > 0 && (
          <button
            className="primary"
            style={{ marginBottom: 16 }}
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
                      background: "#0b3d2e",
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
                      : "1px solid #0b3d2e",
                    color: c.active ? "#b3261e" : "#0b3d2e",
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
              </div>
            </div>
          );
        })}
      </div>

      <div className="link-row">
        <Link href="/admin">← 관리자 홈으로</Link>
      </div>
    </main>
  );
}

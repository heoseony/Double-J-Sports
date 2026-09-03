"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import LoadingScreen from "../../components/LoadingScreen";

const BLUE = "#3B82C4";

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function BallIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7l4 3-1.5 4.5h-5L8 10z" strokeLinejoin="round" />
      <path d="M12 7V3.5M16 10l3.2-1M8 10L4.8 9M9.5 14.5L7 18M14.5 14.5L17 18" strokeLinecap="round" />
    </svg>
  );
}
function PassIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="12" r="2.5" />
      <path d="M8.5 12h7" strokeDasharray="2.5 2.5" />
      <path d="M13 9l2.5 3-2.5 3" />
    </svg>
  );
}
function GoalIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16v3H4z" />
      <path d="M5 8v11M19 8v11M5 8l2 2M9 8l2 2M13 8l2 2M17 8l2 2" />
    </svg>
  );
}
function DribbleIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="6" r="2.3" />
      <path d="M9 10l-3 4M15 10l3 4M8 22l3-6h2l3 6M12 12v4" />
    </svg>
  );
}
function StarShapeIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M12 2l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17l-6.1 3.5 1.5-6.8-5.2-4.7 6.9-.7z" />
    </svg>
  );
}

const SKILL_ICON_COMPONENTS = {
  볼컨트롤: BallIcon,
  패스: PassIcon,
  슈팅: GoalIcon,
  드리블: DribbleIcon,
};
const SKILL_ICON_COLORS = ["#5b9bd5", "#e8a25c", "#5cb586", "#a586d9"];
const SKILL_ICON_BG = ["#eaf3fb", "#fdeee0", "#eafaf0", "#f4eefd"];

function SkillIcon({ name, color }) {
  const Comp = SKILL_ICON_COMPONENTS[name] || StarShapeIcon;
  return <Comp color={color} />;
}

// 집중도/수업태도/기술점수 공용: 숫자 pill (1~5)
function NumberPillRating({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: n === value ? "none" : "1px solid #dbe4ee",
            background: n === value ? BLUE : "white",
            color: n === value ? "white" : "#4a5c73",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// 기술항목: 점(dot) 게이지, 점을 클릭하면 그 값까지 채워짐
function SkillDotGauge({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n}점`}
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "none",
            padding: 0,
            background: n <= value ? BLUE : "#dbe4ee",
            cursor: "pointer",
          }}
        />
      ))}
    </div>
  );
}

function GrowthJournalInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberId = searchParams.get("memberId");
  const yearMonth = searchParams.get("yearMonth"); // '2026-09-01' 형태

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [member, setMember] = useState(null);
  const [myUserId, setMyUserId] = useState(null);

  const [journalId, setJournalId] = useState(null);
  const [attendedCount, setAttendedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [concentrationScore, setConcentrationScore] = useState(0);
  const [attitudeScore, setAttitudeScore] = useState(0);
  const [trainingTopic, setTrainingTopic] = useState("");
  const [trainingDetail, setTrainingDetail] = useState("");
  const [strengths, setStrengths] = useState("");
  const [nextMonthGoal, setNextMonthGoal] = useState("");
  const [coachComment, setCoachComment] = useState("");

  const [skillCategories, setSkillCategories] = useState([]);
  const [skillRatings, setSkillRatings] = useState({}); // { skill_name: { score, trend } }
  const [classNames, setClassNames] = useState([]);

  async function loadData() {
    setErrorMsg("");

    if (!memberId || !yearMonth) {
      setErrorMsg("회원 정보가 없습니다.");
      setLoading(false);
      return;
    }

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

    if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
      router.push("/dashboard");
      return;
    }

    setMyUserId(user.id);

    const { data: memberData } = await supabase
      .from("members")
      .select("id, name, birth_date, program, profile_image_url")
      .eq("id", memberId)
      .single();

    if (!memberData) {
      setErrorMsg("회원을 찾을 수 없습니다.");
      setLoading(false);
      return;
    }
    setMember(memberData);

    const monthStart = yearMonth;
    const d = new Date(yearMonth);
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const monthEnd = nextMonth.toISOString().slice(0, 10);

    const { data: categories } = await supabase
      .from("program_skill_categories")
      .select("skill_name, sort_order")
      .eq("program", memberData.program)
      .eq("active", true)
      .order("sort_order");
    setSkillCategories(categories || []);

    const { data: existingJournal } = await supabase
      .from("growth_journals")
      .select("*")
      .eq("member_id", memberId)
      .eq("year_month", yearMonth)
      .maybeSingle();

    const { data: sessions } = await supabase
      .from("class_sessions")
      .select("id, session_date, class_id, classes(class_name)")
      .gte("session_date", monthStart)
      .lt("session_date", monthEnd);

    const sessionIds = (sessions || []).map((s) => s.id);

    let bookings = [];
    if (sessionIds.length > 0) {
      const { data: bookingData } = await supabase
        .from("bookings")
        .select("status, coach_note, class_session_id")
        .eq("member_id", memberId)
        .in("class_session_id", sessionIds);
      bookings = bookingData || [];
    }

    const finalized = bookings.filter((b) =>
      ["attended", "absent", "cancelled_same_day"].includes(b.status)
    );
    const attended = finalized.filter((b) => b.status === "attended").length;
    setTotalCount(finalized.length);
    setAttendedCount(attended);

    // 이번 달 회원이 실제로 들은(예약된) 반 이름들 (여러 개면 " / "로 이어붙임)
    const sessionIdToClassName = {};
    (sessions || []).forEach((s) => {
      if (s.classes?.class_name) {
        sessionIdToClassName[s.id] = s.classes.class_name;
      }
    });
    const relevantBookings = bookings.filter((b) =>
      ["attended", "absent", "cancelled_same_day", "booked"].includes(b.status)
    );
    const classNameSet = new Set(
      relevantBookings
        .map((b) => sessionIdToClassName[b.class_session_id])
        .filter(Boolean)
    );
    setClassNames(Array.from(classNameSet));

    const notesJoined = bookings
      .filter((b) => b.coach_note && b.coach_note.trim())
      .map((b) => `- ${b.coach_note.trim()}`)
      .join("\n");

    if (existingJournal) {
      setJournalId(existingJournal.id);
      setConcentrationScore(existingJournal.concentration_score || 0);
      setAttitudeScore(existingJournal.attitude_score || 0);
      setTrainingTopic(existingJournal.training_topic || "");
      setTrainingDetail(existingJournal.training_detail || "");
      setStrengths(existingJournal.strengths || "");
      setNextMonthGoal(existingJournal.next_month_goal || "");
      setCoachComment(existingJournal.coach_comment || notesJoined);

      const { data: ratings } = await supabase
        .from("journal_skill_ratings")
        .select("skill_name, score, trend")
        .eq("journal_id", existingJournal.id);

      const ratingsMap = {};
      (ratings || []).forEach((r) => {
        ratingsMap[r.skill_name] = { score: r.score, trend: r.trend };
      });
      setSkillRatings(ratingsMap);
    } else {
      setCoachComment(notesJoined);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, yearMonth]);

  function updateSkillScore(skillName, score) {
    setSkillRatings((prev) => ({
      ...prev,
      [skillName]: { ...(prev[skillName] || {}), score },
    }));
  }

  function updateSkillTrend(skillName, trend) {
    setSkillRatings((prev) => ({
      ...prev,
      [skillName]: { ...(prev[skillName] || {}), trend },
    }));
  }

  async function handleSave(status) {
    setSaving(true);
    setErrorMsg("");

    const payload = {
      member_id: memberId,
      year_month: yearMonth,
      attended_count: attendedCount,
      total_count: totalCount,
      concentration_score: concentrationScore || null,
      attitude_score: attitudeScore || null,
      training_topic: trainingTopic,
      training_detail: trainingDetail,
      strengths,
      next_month_goal: nextMonthGoal,
      coach_comment: coachComment,
      status,
      created_by: myUserId,
    };

    if (status === "published") {
      payload.published_at = new Date().toISOString();
    }

    let savedJournalId = journalId;

    if (journalId) {
      const { error } = await supabase
        .from("growth_journals")
        .update(payload)
        .eq("id", journalId);
      if (error) {
        setErrorMsg("저장 실패: " + error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data: inserted, error } = await supabase
        .from("growth_journals")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        setErrorMsg("저장 실패: " + error.message);
        setSaving(false);
        return;
      }
      savedJournalId = inserted.id;
      setJournalId(inserted.id);
    }

    await supabase.from("journal_skill_ratings").delete().eq("journal_id", savedJournalId);

    const ratingRows = skillCategories
      .filter((c) => skillRatings[c.skill_name]?.score)
      .map((c) => ({
        journal_id: savedJournalId,
        skill_name: c.skill_name,
        score: skillRatings[c.skill_name].score,
        trend: skillRatings[c.skill_name].trend || null,
        sort_order: c.sort_order,
      }));

    if (ratingRows.length > 0) {
      const { error: ratingError } = await supabase
        .from("journal_skill_ratings")
        .insert(ratingRows);
      if (ratingError) {
        setErrorMsg("기술항목 저장 실패: " + ratingError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    router.push("/admin/growth-journal");
  }

  if (loading) return <LoadingScreen />;

  const attendanceRate =
    totalCount > 0 ? Math.round((attendedCount / totalCount) * 1000) / 10 : null;

  return (
    <main style={{ background: "#f3f7fc", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <Link href="/admin/growth-journal" style={{ color: "#1b3a63", display: "flex" }}>
          <BackIcon />
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>성장일지 작성</div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
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

        {/* 헤더 카드 */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 18,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 14,
            boxShadow: "0 2px 10px rgba(27,58,99,0.06)",
          }}
        >
          {member?.profile_image_url ? (
            <img
              src={member.profile_image_url}
              alt={member.name}
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid #eaf1f8",
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "#eaf3fb",
                color: BLUE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {member?.name?.[0] || "?"}
            </div>
          )}
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>{member?.name}</div>
            <div style={{ fontSize: 13, color: "#9aa7b8", marginTop: 3 }}>
              {member?.birth_date}
            </div>
            {classNames.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {classNames.map((cn) => (
                  <span
                    key={cn}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 999,
                      background: "#eaf3fb",
                      color: BLUE,
                    }}
                  >
                    {cn}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 훈련 참여도 */}
        <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63", marginBottom: 12 }}>
            이번 달 훈련 참여도
          </div>

          <div style={{ fontSize: 13, color: "#4a5c73", marginBottom: 16 }}>
            출석율: {attendanceRate !== null ? `${attendanceRate}%` : "데이터 없음"} ({attendedCount}/
            {totalCount})
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#4a5c73", marginBottom: 8 }}>집중도</div>
            <NumberPillRating value={concentrationScore} onChange={setConcentrationScore} />
          </div>

          <div>
            <div style={{ fontSize: 13, color: "#4a5c73", marginBottom: 8 }}>수업태도</div>
            <NumberPillRating value={attitudeScore} onChange={setAttitudeScore} />
          </div>
        </div>

        {/* 기술 항목 */}
        {skillCategories.length > 0 && (
          <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63", marginBottom: 12 }}>
              기술 평가
            </div>
            {skillCategories.map((cat, idx) => (
              <div
                key={cat.skill_name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "1px solid #f0f4f8",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, width: 96 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: SKILL_ICON_BG[idx % SKILL_ICON_BG.length],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <SkillIcon
                      name={cat.skill_name}
                      color={SKILL_ICON_COLORS[idx % SKILL_ICON_COLORS.length]}
                    />
                  </div>
                  <div style={{ fontSize: 13, color: "#1b3a63", fontWeight: 600 }}>
                    {cat.skill_name}
                  </div>
                </div>
                <SkillDotGauge
                  value={skillRatings[cat.skill_name]?.score || 0}
                  onChange={(v) => updateSkillScore(cat.skill_name, v)}
                />
              </div>
            ))}
          </div>
        )}

        {/* 핵심포인트 */}
        <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63", marginBottom: 12 }}>
            이번달 핵심포인트
          </div>
          <input
            type="text"
            placeholder="훈련주제"
            value={trainingTopic}
            onChange={(e) => setTrainingTopic(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #dbe4ee",
              fontSize: 13,
              marginBottom: 8,
              boxSizing: "border-box",
            }}
          />
          <textarea
            placeholder="세부내용"
            value={trainingDetail}
            onChange={(e) => setTrainingDetail(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #dbe4ee",
              fontSize: 13,
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
        </div>

        {/* 잘한 점 / 다음 달 목표 */}
        <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63", marginBottom: 8 }}>잘한 점</div>
          <textarea
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #dbe4ee",
              fontSize: 13,
              boxSizing: "border-box",
              marginBottom: 16,
              resize: "vertical",
            }}
          />
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63", marginBottom: 8 }}>
            다음 달 목표
          </div>
          <textarea
            value={nextMonthGoal}
            onChange={(e) => setNextMonthGoal(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #dbe4ee",
              fontSize: 13,
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
        </div>

        {/* 코치 한마디 */}
        <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63", marginBottom: 4 }}>
            코치 한마디
          </div>
          <div style={{ fontSize: 12, color: "#8a97a8", marginBottom: 8 }}>
            그동안 남긴 메모가 자동으로 채워져 있습니다. 다듬어서 완성해주세요.
          </div>
          <textarea
            value={coachComment}
            onChange={(e) => setCoachComment(e.target.value)}
            rows={6}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #dbe4ee",
              fontSize: 13,
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
        </div>

        {/* 저장 버튼 */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("draft")}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 12,
              border: `1px solid ${BLUE}`,
              background: "white",
              color: BLUE,
              fontSize: 14,
              fontWeight: 800,
              cursor: saving ? "default" : "pointer",
            }}
          >
            임시저장
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("published")}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 12,
              border: "none",
              background: BLUE,
              color: "white",
              fontSize: 14,
              fontWeight: 800,
              cursor: saving ? "default" : "pointer",
            }}
          >
            바로 발행
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#8a97a8", textAlign: "center", marginBottom: 24 }}>
          여러 선수를 먼저 임시저장 해두고, 관리자 현황판에서 한 번에 발행할 수도 있어요.
        </div>
      </div>
    </main>
  );
}

export default function GrowthJournalPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <GrowthJournalInner />
    </Suspense>
  );
}

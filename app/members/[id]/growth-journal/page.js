"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import LoadingScreen from "../../../components/LoadingScreen";

const BLUE = "#3B82C4";

function badgeInfo(rate) {
  if (rate === null || rate === undefined) return null;
  if (rate >= 90) return { label: "DOUBLE J MVP", bg: "#e9f8f0", color: "#2ea86e" };
  if (rate >= 70) return { label: "잘하고 있어요!", bg: "#eaf3fb", color: BLUE };
  return { label: "다음 달에는 자주 만나요", bg: "#f3f5f8", color: "#8a97a8" };
}

function ScoreDots({ value }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: n <= (value || 0) ? BLUE : "#dbe4ee",
          }}
        />
      ))}
    </div>
  );
}

export default function GrowthJournalViewPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [member, setMember] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [journals, setJournals] = useState([]);
  const [skillsByJournal, setSkillsByJournal] = useState({});
  const [selectedYearMonth, setSelectedYearMonth] = useState(null);

  async function loadAll() {
    setLoading(true);
    setErrorMsg("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: guardian } = await supabase
      .from("guardians")
      .select("id")
      .eq("user_id", user.id)
      .single();

    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("id, name, program, guardian_id")
      .eq("id", memberId)
      .single();

    if (memberError || !memberData || memberData.guardian_id !== guardian?.id) {
      setErrorMsg("회원 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }
    setMember(memberData);

    const { data: siblingsData } = await supabase
      .from("members")
      .select("id, name")
      .eq("guardian_id", memberData.guardian_id)
      .order("created_at", { ascending: true });
    setSiblings(siblingsData || []);

    // RLS가 이미 "발행됨 + 이 학부모 자녀 + preview 허용된 계정"만 걸러줌
    const { data: journalData } = await supabase
      .from("growth_journals")
      .select(
        "id, year_month, attendance_rate, attended_count, total_count, concentration_score, attitude_score, training_topic, training_detail, strengths, next_month_goal, coach_comment"
      )
      .eq("member_id", memberId)
      .order("year_month", { ascending: false });

    setJournals(journalData || []);

    if (journalData && journalData.length > 0) {
      setSelectedYearMonth(journalData[0].year_month);

      const journalIds = journalData.map((j) => j.id);
      const { data: skillData } = await supabase
        .from("journal_skill_ratings")
        .select("journal_id, skill_name, score, sort_order")
        .in("journal_id", journalIds)
        .order("sort_order", { ascending: true });

      const grouped = {};
      (skillData || []).forEach((s) => {
        if (!grouped[s.journal_id]) grouped[s.journal_id] = [];
        grouped[s.journal_id].push(s);
      });
      setSkillsByJournal(grouped);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (errorMsg && !member) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <div
            style={{
              background: "#fdecec",
              color: "#b3261e",
              padding: 12,
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 14,
            }}
          >
            {errorMsg}
          </div>
          <Link href="/members" style={{ color: BLUE, fontWeight: 700, textDecoration: "none", fontSize: 13 }}>
            ← 선수 목록으로
          </Link>
        </div>
      </main>
    );
  }

  const selectedJournal = journals.find((j) => j.year_month === selectedYearMonth);
  const selectedSkills = selectedJournal ? skillsByJournal[selectedJournal.id] || [] : [];
  const badge = selectedJournal ? badgeInfo(selectedJournal.attendance_rate) : null;

  return (
    <main style={{ minHeight: "100vh", background: "#f3f7fc", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <Link href="/more" style={{ color: "#1b3a63", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>{member?.name}님의 성장일지</div>
      </div>

      {siblings.length > 1 && (
        <div style={{ display: "flex", gap: 8, padding: "14px 18px 0", overflowX: "auto" }}>
          {siblings.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => router.push(`/members/${s.id}/growth-journal`)}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 999,
                border: "none",
                whiteSpace: "nowrap",
                background: s.id === memberId ? BLUE : "white",
                color: s.id === memberId ? "white" : "#5b7699",
                boxShadow: s.id === memberId ? "none" : "0 1px 4px rgba(30,60,110,0.08)",
                cursor: "pointer",
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: "14px 18px 0" }}>
        {journals.length === 0 ? (
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 24,
              textAlign: "center",
              color: "#8a97a8",
              fontSize: 13,
            }}
          >
            아직 발행된 성장일지가 없어요.
          </div>
        ) : (
          <>
            {/* 월 선택 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto" }}>
              {journals.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setSelectedYearMonth(j.year_month)}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 999,
                    border: j.year_month === selectedYearMonth ? "none" : "1px solid #dbe4ee",
                    whiteSpace: "nowrap",
                    background: j.year_month === selectedYearMonth ? BLUE : "white",
                    color: j.year_month === selectedYearMonth ? "white" : "#4a5c73",
                    cursor: "pointer",
                  }}
                >
                  {j.year_month?.slice(0, 7).replace("-", "년 ")}월
                </button>
              ))}
            </div>

            {selectedJournal && (
              <>
                {/* 훈련 참여도 */}
                <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63", marginBottom: 12 }}>
                    이번 달 훈련 참여도
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{ fontSize: 13, color: "#4a5c73" }}>
                      출석율: {selectedJournal.attendance_rate !== null ? `${selectedJournal.attendance_rate}%` : "-"}{" "}
                      ({selectedJournal.attended_count}/{selectedJournal.total_count})
                    </div>
                    {badge && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 9px",
                          borderRadius: 999,
                          background: badge.bg,
                          color: badge.color,
                        }}
                      >
                        {badge.label}
                      </span>
                    )}
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: "#8a97a8", marginBottom: 6 }}>집중도</div>
                    <ScoreDots value={selectedJournal.concentration_score} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#8a97a8", marginBottom: 6 }}>수업태도</div>
                    <ScoreDots value={selectedJournal.attitude_score} />
                  </div>
                </div>

                {/* 기술 평가 */}
                {selectedSkills.length > 0 && (
                  <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63", marginBottom: 12 }}>
                      기술 평가
                    </div>
                    {selectedSkills.map((s) => (
                      <div
                        key={s.skill_name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 0",
                          borderBottom: "1px solid #f0f4f8",
                        }}
                      >
                        <div style={{ fontSize: 13, color: "#1b3a63", fontWeight: 600 }}>{s.skill_name}</div>
                        <ScoreDots value={s.score} />
                      </div>
                    ))}
                  </div>
                )}

                {/* 핵심포인트 */}
                {(selectedJournal.training_topic || selectedJournal.training_detail) && (
                  <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63", marginBottom: 8 }}>
                      이번달 핵심포인트
                    </div>
                    {selectedJournal.training_topic && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#33455e", marginBottom: 6 }}>
                        {selectedJournal.training_topic}
                      </div>
                    )}
                    {selectedJournal.training_detail && (
                      <div style={{ fontSize: 13, color: "#4a5c73", lineHeight: 1.6 }}>
                        {selectedJournal.training_detail}
                      </div>
                    )}
                  </div>
                )}

                {/* 잘한 점 / 다음 달 목표 */}
                {(selectedJournal.strengths || selectedJournal.next_month_goal) && (
                  <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 14 }}>
                    {selectedJournal.strengths && (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63", marginBottom: 8 }}>
                          잘한 점
                        </div>
                        <div style={{ fontSize: 13, color: "#4a5c73", lineHeight: 1.6, marginBottom: 16 }}>
                          {selectedJournal.strengths}
                        </div>
                      </>
                    )}
                    {selectedJournal.next_month_goal && (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63", marginBottom: 8 }}>
                          다음 달 목표
                        </div>
                        <div style={{ fontSize: 13, color: "#4a5c73", lineHeight: 1.6 }}>
                          {selectedJournal.next_month_goal}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* 코치 한마디 (작성자 이름은 표시하지 않음) */}
                {selectedJournal.coach_comment && (
                  <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63", marginBottom: 8 }}>
                      코치 한마디
                    </div>
                    <div style={{ fontSize: 13, color: "#4a5c73", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {selectedJournal.coach_comment}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

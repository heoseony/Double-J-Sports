"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function maskName(name) {
  if (!name) return "";
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function BookPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberId = searchParams.get("memberId");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [member, setMember] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [membershipId, setMembershipId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [participantsBySession, setParticipantsBySession] = useState({});
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [bookingSessionId, setBookingSessionId] = useState(null);
  const [myBookedSessionIds, setMyBookedSessionIds] = useState([]);

  async function loadAll() {
    setErrorMsg("");

    if (!memberId) {
      setErrorMsg("자녀 정보가 없습니다. 자녀 목록에서 다시 시도해주세요.");
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

    const { data: memberData, error: memberError } = await supabase
      .from("members")
      .select("id, name, program")
      .eq("id", memberId)
      .single();

    if (memberError || !memberData) {
      setErrorMsg("자녀 정보를 불러오지 못했습니다.");
      setLoading(false);
      return;
    }
    setMember(memberData);

    const { data: memberships } = await supabase
      .from("memberships")
      .select("id, sessions_used, status, membership_plans(sessions_per_month)")
      .eq("member_id", memberId)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1);

    if (memberships && memberships.length > 0) {
      const m = memberships[0];
      const total = m.membership_plans?.sessions_per_month || 0;
      setRemaining(total - m.sessions_used);
      setMembershipId(m.id);
    } else {
      setRemaining(0);
      setMembershipId(null);
    }

    const { data: myBookings } = await supabase
      .from("bookings")
      .select("class_session_id")
      .eq("member_id", memberId)
      .eq("status", "booked");
    setMyBookedSessionIds((myBookings || []).map((b) => b.class_session_id));

    const today = todayStr();
    const { data: sessionData, error: sessionError } = await supabase
      .from("class_sessions")
      .select(
        "id, session_date, start_time, end_time, status, classes(class_name, program, weekday, active)"
      )
      .gte("session_date", today)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (sessionError) {
      setErrorMsg("수업 목록을 불러오지 못했습니다: " + sessionError.message);
      setLoading(false);
      return;
    }

    const kidsSessions = (sessionData || []).filter(
      (s) => s.classes?.program === "kids" && s.classes?.active
    );
    setSessions(kidsSessions);

    const { data: participantData } = await supabase
      .from("session_participants_kids")
      .select("class_session_id, name");

    const grouped = {};
    (participantData || []).forEach((p) => {
      if (!grouped[p.class_session_id]) grouped[p.class_session_id] = [];
      grouped[p.class_session_id].push(p.name);
    });
    setParticipantsBySession(grouped);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  async function handleBook(sessionId) {
    setErrorMsg("");
    setSuccessMsg("");

    if (remaining <= 0 || !membershipId) {
      setErrorMsg("잔여 이용 횟수가 없습니다. 관리자에게 문의해주세요.");
      return;
    }

    if (myBookedSessionIds.includes(sessionId)) {
      setErrorMsg("이미 이 수업에 예약되어 있습니다.");
      return;
    }

    setBookingSessionId(sessionId);

    const { error: bookingError } = await supabase.from("bookings").insert({
      member_id: memberId,
      class_session_id: sessionId,
      status: "booked",
    });

    if (bookingError) {
      setBookingSessionId(null);
      setErrorMsg("예약 실패: " + bookingError.message);
      return;
    }

    const { data: currentMembership } = await supabase
      .from("memberships")
      .select("sessions_used")
      .eq("id", membershipId)
      .single();

    await supabase
      .from("memberships")
      .update({ sessions_used: (currentMembership?.sessions_used || 0) + 1 })
      .eq("id", membershipId);

    setBookingSessionId(null);
    setSuccessMsg("예약이 완료되었습니다.");
    await loadAll();
  }

  if (loading) {
    return (
      <main className="page">
        <div className="subtitle">불러오는 중...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">
        {member?.name}님 수업 예약 · 잔여 {Math.max(remaining, 0)}회
      </div>

      <div className="card">
        {errorMsg && <div className="message error">{errorMsg}</div>}
        {successMsg && <div className="message success">{successMsg}</div>}

        {sessions.length === 0 && (
          <p style={{ fontSize: 14, color: "#777" }}>
            예약 가능한 수업이 아직 없습니다. 관리자에게 문의해주세요.
          </p>
        )}

        {sessions.map((s) => {
          const names = participantsBySession[s.id] || [];
          const isExpanded = expandedSessionId === s.id;
          const alreadyBooked = myBookedSessionIds.includes(s.id);

          return (
            <div
              key={s.id}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {s.session_date} ({WEEKDAY_LABELS[s.classes.weekday]}){" "}
                {s.start_time?.slice(0, 5)}~{s.end_time?.slice(0, 5)} ·{" "}
                {s.classes.class_name}
              </div>
              <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
                현재 신청 {names.length}명
              </div>

              <button
                type="button"
                className="small-btn"
                style={{
                  marginTop: 8,
                  padding: "6px 12px",
                  fontSize: 13,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  background: "white",
                  cursor: "pointer",
                }}
                onClick={() =>
                  setExpandedSessionId(isExpanded ? null : s.id)
                }
              >
                {isExpanded ? "참가자 숨기기" : "참가자 보기"}
              </button>

              {isExpanded && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: "#444",
                    lineHeight: 1.8,
                  }}
                >
                  {names.length === 0
                    ? "아직 신청자가 없습니다."
                    : names.map(maskName).join(", ")}
                </div>
              )}

              <div style={{ marginTop: 10 }}>
                {alreadyBooked ? (
                  <span
                    style={{
                      fontSize: 13,
                      color: "#0b3d2e",
                      fontWeight: 700,
                    }}
                  >
                    ✓ 예약됨
                  </span>
                ) : (
                  <button
                    className="primary"
                    style={{ marginTop: 0, padding: "10px 16px" }}
                    disabled={bookingSessionId === s.id}
                    onClick={() => handleBook(s.id)}
                  >
                    {bookingSessionId === s.id ? "예약 중..." : "예약하기"}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div className="link-row">
          <Link href="/members">← 자녀 관리로</Link>
        </div>
      </div>
    </main>
  );
}

export default function BookPage() {
  return (
    <Suspense
      fallback={
        <main className="page">
          <div className="subtitle">불러오는 중...</div>
        </main>
      }
    >
      <BookPageInner />
    </Suspense>
  );
}

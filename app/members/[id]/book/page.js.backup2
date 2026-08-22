"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import LoadingScreen from "../../../components/LoadingScreen";

const BLUE = "#3B82C4";
const WEEKDAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

function formatTime(t) {
  if (!t) return "";
  return t.slice(0, 5);
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${dateStr} (${WEEKDAY_LABEL[d.getDay()]})`;
}

export default function BookClassPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id;

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [membership, setMembership] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [applicantCounts, setApplicantCounts] = useState({});
  const [myBookedSessionIds, setMyBookedSessionIds] = useState(new Set());
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [bookingSessionId, setBookingSessionId] = useState(null);

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
      setErrorMsg("자녀 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    setMember(memberData);

    const { data: membershipData } = await supabase
      .from("memberships")
      .select("*, membership_plans(name, sessions_per_month)")
      .eq("member_id", memberId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setMembership(membershipData || null);

    const today = new Date().toISOString().slice(0, 10);

    const { data: sessionData, error: sessionError } = await supabase
      .from("class_sessions")
      .select(
        "id, session_date, classes!inner(id, program, class_name, age_group, start_time, end_time, coach_name, location, is_active)"
      )
      .eq("status", "scheduled")
      .eq("classes.program", memberData.program)
      .eq("classes.is_active", true)
      .gte("session_date", today)
      .order("session_date", { ascending: true });

    if (sessionError) {
      setErrorMsg("수업표를 불러오지 못했습니다: " + sessionError.message);
      setLoading(false);
      return;
    }

    const sortedSessions = (sessionData || []).sort((a, b) => {
      if (a.session_date !== b.session_date) {
        return a.session_date < b.session_date ? -1 : 1;
      }
      return a.classes.start_time < b.classes.start_time ? -1 : 1;
    });

    setSessions(sortedSessions);

    const sessionIds = sortedSessions.map((s) => s.id);

    if (sessionIds.length > 0) {
      const { data: allBookings } = await supabase
        .from("bookings")
        .select("class_session_id, member_id, status")
        .in("class_session_id", sessionIds)
        .in("status", ["booked", "attended"]);

      const counts = {};
      const myIds = new Set();
      (allBookings || []).forEach((b) => {
        counts[b.class_session_id] = (counts[b.class_session_id] || 0) + 1;
        if (b.member_id === memberId) {
          myIds.add(b.class_session_id);
        }
      });
      setApplicantCounts(counts);
      setMyBookedSessionIds(myIds);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (memberId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  async function handleBook(sessionId) {
    setErrorMsg("");
    setSuccessMsg("");
    setBookingSessionId(sessionId);

    const { error } = await supabase.rpc("book_class_session", {
      p_member_id: memberId,
      p_class_session_id: sessionId,
    });

    setBookingSessionId(null);

    if (error) {
      setErrorMsg("예약 실패: " + error.message);
      return;
    }

    setSuccessMsg("예약이 완료되었습니다.");
    loadAll();
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
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
            ← 자녀 목록으로
          </Link>
        </div>
      </main>
    );
  }

  const remaining = membership?.sessions_remaining ?? 0;
  const canBook = !!membership && remaining > 0;

  return (
    <main
      style={{
        background: "#f3f7fc",
        minHeight: "100vh",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "18px 18px 4px",
        }}
      >
        <Link href="/members" style={{ color: "#1b3a63", display: "flex" }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          {member.name} 수업 예약
        </div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        <div style={{ fontSize: 13, color: "#8ea0b8", marginBottom: 14 }}>
          {membership
            ? `${membership.membership_plans?.name} · 잔여 ${remaining}회`
            : "활성화된 회원권이 없습니다. 관리자에게 문의해주세요."}
        </div>

        {errorMsg && (
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
        )}
        {successMsg && (
          <div
            style={{
              background: "#e9f1fb",
              color: "#1b3a63",
              padding: 12,
              borderRadius: 10,
              fontSize: 13,
              marginBottom: 14,
            }}
          >
            {successMsg}
          </div>
        )}

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          {sessions.length === 0 && (
            <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
              예약 가능한 수업이 아직 없습니다.
            </p>
          )}

          {sessions.map((s, idx) => {
            const alreadyBooked = myBookedSessionIds.has(s.id);
            const count = applicantCounts[s.id] || 0;

            return (
              <div
                key={s.id}
                style={{
                  padding: "14px 0",
                  borderTop: idx === 0 ? "none" : "1px solid #f0f3f8",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>
                  {formatDateLabel(s.session_date)} ·{" "}
                  {formatTime(s.classes.start_time)}~
                  {formatTime(s.classes.end_time)}
                </div>
                <div style={{ fontSize: 13, color: "#33455e", marginTop: 6 }}>
                  {s.classes.class_name}
                  {s.classes.age_group ? ` (${s.classes.age_group})` : ""}
                  {s.classes.coach_name ? ` · ${s.classes.coach_name} 코치` : ""}
                  {s.classes.location ? ` · ${s.classes.location}` : ""}
                </div>
                <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 4 }}>
                  현재 신청 {count}명
                </div>

                <button
                  type="button"
                  disabled={
                    alreadyBooked || !canBook || bookingSessionId === s.id
                  }
                  onClick={() => handleBook(s.id)}
                  style={{
                    marginTop: 10,
                    padding: "10px 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    border: "none",
                    borderRadius: 10,
                    background: alreadyBooked
                      ? "#c7d2e0"
                      : !canBook
                      ? "#c7d2e0"
                      : bookingSessionId === s.id
                      ? "#9db8d6"
                      : BLUE,
                    color: "white",
                    cursor:
                      alreadyBooked || !canBook || bookingSessionId === s.id
                        ? "default"
                        : "pointer",
                  }}
                >
                  {alreadyBooked
                    ? "예약됨"
                    : bookingSessionId === s.id
                    ? "예약 처리 중..."
                    : "예약하기"}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/members" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 자녀 목록으로
          </Link>
        </div>
      </div>
    </main>
  );
}

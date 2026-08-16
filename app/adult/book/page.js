"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function AdultBookPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [member, setMember] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [membershipId, setMembershipId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [countsBySession, setCountsBySession] = useState({});
  const [bookingSessionId, setBookingSessionId] = useState(null);
  const [cancellingSessionId, setCancellingSessionId] = useState(null);
  const [myBookingIdBySession, setMyBookingIdBySession] = useState({});
  const [cutoffHours, setCutoffHours] = useState(24);

  async function loadAll() {
    setErrorMsg("");

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
      .eq("user_id", user.id)
      .single();

    if (memberError || !memberData) {
      setErrorMsg("회원 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }
    setMember(memberData);

    const { data: memberships } = await supabase
      .from("memberships")
      .select("id, sessions_used, status, membership_plans(sessions_per_month)")
      .eq("member_id", memberData.id)
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
      .select("id, class_session_id")
      .eq("member_id", memberData.id)
      .eq("status", "booked");
    const bookingMap = {};
    (myBookings || []).forEach((b) => {
      bookingMap[b.class_session_id] = b.id;
    });
    setMyBookingIdBySession(bookingMap);

    const { data: policyData } = await supabase
      .from("cancellation_policy")
      .select("cutoff_hours")
      .limit(1)
      .maybeSingle();
    if (policyData?.cutoff_hours != null) {
      setCutoffHours(policyData.cutoff_hours);
    }

    const today = todayStr();
    const { data: sessionData, error: sessionError } = await supabase
      .from("class_sessions")
      .select(
        "id, session_date, start_time, end_time, classes(class_name, program, weekday, active)"
      )
      .gte("session_date", today)
      .order("session_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (sessionError) {
      setErrorMsg("수업 목록을 불러오지 못했습니다: " + sessionError.message);
      setLoading(false);
      return;
    }

    const programSessions = (sessionData || []).filter(
      (s) => s.classes?.program === memberData.program && s.classes?.active
    );
    setSessions(programSessions);

    const { data: countData } = await supabase
      .from("session_booking_counts")
      .select("class_session_id, cnt");

    const countsMap = {};
    (countData || []).forEach((c) => {
      countsMap[c.class_session_id] = c.cnt;
    });
    setCountsBySession(countsMap);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBook(sessionId) {
    setErrorMsg("");
    setSuccessMsg("");

    if (remaining <= 0 || !membershipId) {
      setErrorMsg("잔여 이용 횟수가 없습니다. 관리자에게 문의해주세요.");
      return;
    }

    if (myBookingIdBySession[sessionId]) {
      setErrorMsg("이미 이 수업에 예약되어 있습니다.");
      return;
    }

    setBookingSessionId(sessionId);

    const { error: bookingError } = await supabase.from("bookings").insert({
      member_id: member.id,
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

  async function handleCancel(sessionId) {
    setErrorMsg("");
    setSuccessMsg("");

    const bookingId = myBookingIdBySession[sessionId];
    if (!bookingId) {
      setErrorMsg("예약 정보를 찾을 수 없습니다.");
      return;
    }

    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    setCancellingSessionId(sessionId);

    const sessionDateTime = new Date(
      `${session.session_date}T${session.start_time}`
    );
    const cutoffTime = new Date(
      sessionDateTime.getTime() - cutoffHours * 60 * 60 * 1000
    );
    const now = new Date();
    const isPrior = now < cutoffTime;
    const newStatus = isPrior ? "cancelled_prior" : "cancelled_same_day";

    const { error: cancelError } = await supabase
      .from("bookings")
      .update({ status: newStatus, cancelled_at: new Date().toISOString() })
      .eq("id", bookingId);

    if (cancelError) {
      setCancellingSessionId(null);
      setErrorMsg("취소 실패: " + cancelError.message);
      return;
    }

    if (isPrior && membershipId) {
      const { data: currentMembership } = await supabase
        .from("memberships")
        .select("sessions_used")
        .eq("id", membershipId)
        .single();

      const newUsed = Math.max((currentMembership?.sessions_used || 0) - 1, 0);

      await supabase
        .from("memberships")
        .update({ sessions_used: newUsed })
        .eq("id", membershipId);
    }

    setCancellingSessionId(null);
    setSuccessMsg(
      isPrior
        ? "취소되었습니다. 잔여 횟수가 복구되었습니다."
        : "취소되었습니다. 당일 취소라 잔여 횟수는 복구되지 않습니다."
    );
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
          const count = countsBySession[s.id] || 0;
          const bookingId = myBookingIdBySession[s.id];

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
                현재 신청 {count}명
              </div>

              <div style={{ marginTop: 10 }}>
                {bookingId ? (
                  <div>
                    <span
                      style={{
                        fontSize: 13,
                        color: "#0b3d2e",
                        fontWeight: 700,
                      }}
                    >
                      ✓ 예약됨
                    </span>
                    <button
                      type="button"
                      style={{
                        marginLeft: 12,
                        padding: "6px 12px",
                        fontSize: 13,
                        border: "1px solid #b3261e",
                        color: "#b3261e",
                        borderRadius: 8,
                        background: "white",
                        cursor: "pointer",
                      }}
                      disabled={cancellingSessionId === s.id}
                      onClick={() => handleCancel(s.id)}
                    >
                      {cancellingSessionId === s.id
                        ? "취소 중..."
                        : "예약 취소"}
                    </button>
                  </div>
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
          <Link href="/dashboard">← 홈으로</Link>
        </div>
      </div>
    </main>
  );
}

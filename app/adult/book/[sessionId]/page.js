"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { nowInGermany } from "../../../../lib/germanyTime";
import { supabase } from "../../../../lib/supabaseClient";

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

export default function AdultClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [session, setSession] = useState(null);
  const [membershipId, setMembershipId] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [applicantCount, setApplicantCount] = useState(0);
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [bookingCutoffHours, setBookingCutoffHours] = useState(2);

  const [step, setStep] = useState("detail");
  const [booking, setBooking] = useState(false);

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

    const { data: sessionData, error: sessionError } = await supabase
      .from("class_sessions")
      .select(
        "id, class_id, session_date, start_time, end_time, classes(id, class_name, program, weekday, active)"
      )
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      setErrorMsg("수업 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }
    setSession(sessionData);

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

    const { data: policyData } = await supabase
      .from("cancellation_policy")
      .select("booking_cutoff_hours")
      .limit(1)
      .maybeSingle();
    if (policyData?.booking_cutoff_hours != null) {
      setBookingCutoffHours(policyData.booking_cutoff_hours);
    }

    const { data: countData } = await supabase
      .from("session_booking_counts")
      .select("cnt")
      .eq("class_session_id", sessionId)
      .maybeSingle();
    setApplicantCount(countData?.cnt || 0);

    const { data: myBooking } = await supabase
      .from("bookings")
      .select("id")
      .eq("member_id", memberData.id)
      .eq("class_session_id", sessionId)
      .eq("status", "booked")
      .maybeSingle();
    setAlreadyBooked(!!myBooking);

    setLoading(false);
  }

  useEffect(() => {
    if (sessionId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleBook() {
    setBooking(true);
    setErrorMsg("");

    const { error: bookingError } = await supabase.from("bookings").insert({
      member_id: member.id,
      class_session_id: sessionId,
      status: "booked",
    });

    if (bookingError) {
      setBooking(false);
      setErrorMsg("예약 실패: " + bookingError.message);
      return;
    }

    if (membershipId) {
      const { data: currentMembership } = await supabase
        .from("memberships")
        .select("sessions_used")
        .eq("id", membershipId)
        .single();

      await supabase
        .from("memberships")
        .update({ sessions_used: (currentMembership?.sessions_used || 0) + 1 })
        .eq("id", membershipId);
    }

    setBooking(false);
    setStep("done");
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div style={{ fontSize: 14, color: "#5b7699" }}>불러오는 중...</div>
      </main>
    );
  }

  if (errorMsg && !session) {
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
          <Link href="/adult/book" style={{ color: BLUE, fontWeight: 700, textDecoration: "none", fontSize: 13 }}>
            ← 수업 목록으로
          </Link>
        </div>
      </main>
    );
  }

  const cls = session.classes;
  const sessionDateTime = new Date(`${session.session_date}T${session.start_time}`);
  const bookingDeadline = new Date(sessionDateTime.getTime() - bookingCutoffHours * 60 * 60 * 1000);
  const isPastDeadline = nowInGermany() > bookingDeadline;
  const canBook = remaining > 0 && !alreadyBooked && !isPastDeadline;

  return (
    <main
      style={{
        background: "#f3f7fc",
        minHeight: "100vh",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <Link href="/adult/book" style={{ color: "#1b3a63", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          {step === "detail" && "수업 상세"}
          {step === "confirm" && "예약 확인"}
          {step === "done" && "예약 완료"}
        </div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        {step === "detail" && (
          <>
            <div
              style={{
                background: "white",
                borderRadius: 16,
                padding: 20,
                marginBottom: 16,
                boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
              }}
            >
              <div style={{ fontSize: 19, fontWeight: 800, color: "#1b3a63" }}>
                {cls.class_name}
              </div>
              <div style={{ fontSize: 13, color: BLUE, fontWeight: 700, marginTop: 4 }}>
                {formatDateLabel(session.session_date)} · {formatTime(session.start_time)}~{formatTime(session.end_time)}
              </div>

              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <InfoRow label="프로그램" value={cls.program === "pro" ? "프로" : "일반/취미"} />
                <InfoRow label="신청 인원" value={`${applicantCount}명 신청`} />
                <InfoRow label="예약 마감" value={`수업 시작 ${bookingCutoffHours}시간 전까지`} />
              </div>

              <div
                style={{
                  marginTop: 18,
                  padding: 14,
                  background: "#f7fafd",
                  borderRadius: 12,
                  fontSize: 13,
                  color: "#5b7699",
                  lineHeight: 1.6,
                }}
              >
                안내사항: 수업 시작 10분 전 도착해주세요. 개인 물통을 준비해주세요.
              </div>
            </div>

            {errorMsg && (
              <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              disabled={!canBook}
              onClick={() => setStep("confirm")}
              style={{
                width: "100%",
                padding: 16,
                fontSize: 15,
                fontWeight: 700,
                color: "white",
                background: canBook ? BLUE : "#c7d2e0",
                border: "none",
                borderRadius: 12,
                cursor: canBook ? "pointer" : "default",
              }}
            >
              {alreadyBooked
                ? "이미 예약된 수업입니다"
                : isPastDeadline
                ? "예약이 마감되었습니다"
                : remaining <= 0
                ? "잔여 횟수가 없습니다"
                : "수업 예약하기"}
            </button>
          </>
        )}

        {step === "confirm" && (
          <>
            <div
              style={{
                background: "white",
                borderRadius: 16,
                padding: 24,
                marginBottom: 16,
                boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 56, marginBottom: 10 }}>⚽</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#1b3a63" }}>
                {cls.class_name}
              </div>
              <div style={{ fontSize: 13, color: BLUE, fontWeight: 700, marginTop: 4, marginBottom: 18 }}>
                {formatDateLabel(session.session_date)} · {formatTime(session.start_time)}~{formatTime(session.end_time)}
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  background: "#e9f1fb",
                  borderRadius: 999,
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1b3a63" }}>{member.name}</span>
                <span style={{ fontSize: 12, color: "#5b7699" }}>{cls.program === "pro" ? "프로" : "일반/취미"}</span>
              </div>

              <p style={{ fontSize: 14, color: "#33455e", marginTop: 20 }}>
                위 내용으로 예약하시겠습니까?
              </p>
            </div>

            {errorMsg && (
              <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setStep("detail")}
                style={{
                  flex: 1,
                  padding: 16,
                  fontSize: 15,
                  fontWeight: 700,
                  border: "1px solid #e5eaf2",
                  borderRadius: 12,
                  background: "white",
                  color: "#5b7699",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={booking}
                onClick={handleBook}
                style={{
                  flex: 2,
                  padding: 16,
                  fontSize: 15,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 12,
                  background: booking ? "#9db8d6" : BLUE,
                  color: "white",
                  cursor: booking ? "default" : "pointer",
                }}
              >
                {booking ? "예약 중..." : "예약하기"}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <style>{`
              @keyframes dj-check-pop {
                0% { transform: scale(0); opacity: 0; }
                60% { transform: scale(1.15); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
              }
            `}</style>
            <div
              style={{
                background: "white",
                borderRadius: 16,
                padding: 36,
                marginBottom: 16,
                boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: BLUE,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  animation: "dj-check-pop 0.5s ease-out",
                }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>

              <div style={{ fontSize: 18, fontWeight: 800, color: "#1b3a63", marginBottom: 6 }}>
                수업 예약이 완료되었어요!
              </div>
              <div style={{ fontSize: 14, color: "#33455e" }}>
                {cls.class_name}
              </div>
              <div style={{ fontSize: 13, color: BLUE, fontWeight: 700, marginTop: 4 }}>
                {formatDateLabel(session.session_date)} · {formatTime(session.start_time)}~{formatTime(session.end_time)}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={() => router.push("/adult/reservations")}
                style={{
                  width: "100%",
                  padding: 16,
                  fontSize: 15,
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 12,
                  background: BLUE,
                  color: "white",
                  cursor: "pointer",
                }}
              >
                예약 내역 보기
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                style={{
                  width: "100%",
                  padding: 16,
                  fontSize: 15,
                  fontWeight: 700,
                  border: "1px solid #e5eaf2",
                  borderRadius: 12,
                  background: "white",
                  color: "#5b7699",
                  cursor: "pointer",
                }}
              >
                홈으로 이동
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
      <span style={{ color: "#8ea0b8" }}>{label}</span>
      <span style={{ color: "#1b3a63", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

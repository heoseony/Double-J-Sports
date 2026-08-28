"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../lib/supabaseClient";
import { nowInGermany } from "../../../../../lib/germanyTime";

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

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id;
  const sessionId = params.sessionId;

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [session, setSession] = useState(null);
  const [coachName, setCoachName] = useState(null);
  const [membership, setMembership] = useState(null);
  const [isClassAllowed, setIsClassAllowed] = useState(true);
  const [applicantCount, setApplicantCount] = useState(0);
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const [myBookingId, setMyBookingId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [step, setStep] = useState("detail"); // detail | confirm | done
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
      setErrorMsg("선수 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }
    setMember(memberData);

    const { data: sessionData, error: sessionError } = await supabase
      .from("class_sessions")
      .select(
        "id, session_date, status, class_id, classes(id, class_name, program, weekday, start_time, end_time, location, capacity)"
      )
      .eq("id", sessionId)
      .single();

    if (sessionError || !sessionData) {
      setErrorMsg("수업 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }
    setSession(sessionData);

    if (sessionData.class_id) {
      const { data: coachData } = await supabase
        .from("class_coaches")
        .select("coach_profiles(name)")
        .eq("class_id", sessionData.class_id)
        .limit(1)
        .maybeSingle();
      if (coachData?.coach_profiles?.name) setCoachName(coachData.coach_profiles.name);
    }

    const { data: membershipData } = await supabase
      .from("memberships")
      .select("*, membership_plans(name, sessions_per_month, all_classes_allowed)")
      .eq("member_id", memberId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setMembership(membershipData || null);

    if (membershipData && membershipData.membership_plans?.all_classes_allowed === false && sessionData?.class_id) {
      const { data: allowedRows } = await supabase
        .from("membership_plan_classes")
        .select("class_id")
        .eq("plan_id", membershipData.plan_id)
        .eq("class_id", sessionData.class_id);
      setIsClassAllowed((allowedRows || []).length > 0);
    } else {
      setIsClassAllowed(true);
    }

    const { data: allBookings } = await supabase
      .from("bookings")
      .select("id, member_id, status")
      .eq("class_session_id", sessionId)
      .in("status", ["booked", "attended"]);

    setApplicantCount((allBookings || []).length);
    const myBooking = (allBookings || []).find((b) => b.member_id === memberId);
    setAlreadyBooked(!!myBooking);
    setMyBookingId(myBooking ? myBooking.id : null);

    setLoading(false);
  }

  useEffect(() => {
    if (memberId && sessionId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, sessionId]);

  async function handleCancel() {
    if (!myBookingId) return;
    setCancelling(true);
    setErrorMsg("");

    const sessionDay = new Date(`${session.session_date}T00:00:00`);
    const cutoffTime = new Date(sessionDay.getTime() - 24 * 60 * 60 * 1000);
    cutoffTime.setHours(23, 59, 59, 999);
    const isPrior = nowInGermany() < cutoffTime;
    const newStatus = isPrior ? "cancelled_prior" : "cancelled_same_day";

    const { error } = await supabase
      .from("bookings")
      .update({ status: newStatus, cancelled_at: new Date().toISOString() })
      .eq("id", myBookingId);

    setCancelling(false);

    if (error) {
      setErrorMsg("취소 실패: " + error.message);
      return;
    }

    await loadAll();
  }

  async function handleBook() {
    setBooking(true);
    setErrorMsg("");

    const { error } = await supabase.rpc("book_class_session", {
      p_member_id: memberId,
      p_class_session_id: sessionId,
    });

    alert("DEBUG error: " + JSON.stringify(error));

    setBooking(false);

    if (error) {
      setErrorMsg("예약 실패: " + error.message);
      return;
    }

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
          <Link
            href={`/members/${memberId}/book`}
            style={{ color: BLUE, fontWeight: 700, textDecoration: "none", fontSize: 13 }}
          >
            ← 수업 목록으로
          </Link>
        </div>
      </main>
    );
  }

  const remaining = membership
    ? Math.max(
        (membership.membership_plans?.sessions_per_month ?? 0) -
          (membership.sessions_used ?? 0),
        0
      )
    : 0;
  const canBook = !!membership && remaining > 0 && !alreadyBooked && isClassAllowed;
  const cls = session.classes;

  return (
    <main
      style={{
        background: "#f3f7fc",
        minHeight: "100vh",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* ===================== 헤더 ===================== */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{ color: "#1b3a63", display: "flex", background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          {step === "detail" && "수업 상세"}
          {step === "confirm" && "예약 확인"}
          {step === "done" && "예약 완료"}
        </div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        {/* ===================== STEP 1: 수업 상세 ===================== */}
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
                {formatDateLabel(session.session_date)} · {formatTime(cls.start_time)}~{formatTime(cls.end_time)}
              </div>

              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <InfoRow label="장소" value={cls.location || "-"} />
                <InfoRow label="담당 코치" value={coachName || "-"} />
                <InfoRow label="대상" value={member.name + " · " + (cls.program === "kids" ? "Kids" : cls.program)} />
                <InfoRow
                  label="정원"
                  value={cls.capacity ? `${applicantCount}/${cls.capacity}명 신청` : `${applicantCount}명 신청`}
                />
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

            {alreadyBooked ? (
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancel}
                style={{
                  width: "100%",
                  padding: 16,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#b3261e",
                  background: "white",
                  border: "1px solid #f3c6c2",
                  borderRadius: 12,
                  cursor: cancelling ? "default" : "pointer",
                }}
              >
                {cancelling ? "취소 중..." : "예약 취소"}
              </button>
            ) : (
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
                {!membership ? "회원권이 없습니다" : !isClassAllowed ? "이 회원권으로 예약할 수 없는 수업입니다" : remaining <= 0 ? "잔여 횟수가 없습니다" : "수업 예약하기"}
              </button>
            )}
          </>
        )}

        {/* ===================== STEP 2: 예약 확인 ===================== */}
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
                {formatDateLabel(session.session_date)} · {formatTime(cls.start_time)}~{formatTime(cls.end_time)}
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
                <span style={{ fontSize: 12, color: "#5b7699" }}>{member.program === "kids" ? "Kids" : member.program}</span>
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

        {/* ===================== STEP 3: 예약 완료 ===================== */}
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
                {formatDateLabel(session.session_date)} · {formatTime(cls.start_time)}~{formatTime(cls.end_time)}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={() => router.push(`/members/${memberId}/reservations`)}
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

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../lib/supabaseClient";
import { nowInGermany } from "../../../../../lib/germanyTime";
import LoadingScreen from "../../../../components/LoadingScreen";
import { useLanguage } from "../../../../../lib/i18n/LanguageContext";
import { translateClassName } from "../../../../../lib/i18n/nameTranslations";

const BLUE = "#3B82C4";
const WEEKDAY_LABEL_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_LABEL_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(t) {
  if (!t) return "";
  return t.slice(0, 5);
}

function formatDateLabel(dateStr, lang) {
  const d = new Date(dateStr + "T00:00:00");
  const labels = lang === "en" ? WEEKDAY_LABEL_EN : WEEKDAY_LABEL_KO;
  return `${dateStr} (${labels[d.getDay()]})`;
}

export default function ClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id;
  const sessionId = params.sessionId;
  const { t, lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [session, setSession] = useState(null);
  const [coachName, setCoachName] = useState(null);
  const [assistantCoachNames, setAssistantCoachNames] = useState([]);
  const [membership, setMembership] = useState(null);
  const [isClassAllowed, setIsClassAllowed] = useState(true);
  const [applicantCount, setApplicantCount] = useState(0);
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const [myBookingId, setMyBookingId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState("");
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
      setErrorMsg(t("classDetail.errMemberNotFound"));
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
      setErrorMsg(t("classDetail.errSessionNotFound"));
      setLoading(false);
      return;
    }
    setSession(sessionData);

    if (sessionData.class_id) {
      const { data: coachRows } = await supabase
        .from("class_coaches")
        .select("coach_role, coach_profiles(name)")
        .eq("class_id", sessionData.class_id);

      const mainCoach = (coachRows || []).find((c) => c.coach_role === "main");
      const assistants = (coachRows || []).filter((c) => c.coach_role === "assistant");

      if (mainCoach?.coach_profiles?.name) setCoachName(mainCoach.coach_profiles.name);
      setAssistantCoachNames(
        assistants.map((c) => c.coach_profiles?.name).filter(Boolean)
      );
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

    if (error) {
      setCancelling(false);
      setErrorMsg(t("classDetail.errCancelFailedPrefix") + error.message);
      return;
    }

    if (isPrior) {
      const { data: activeMembership } = await supabase
        .from("memberships")
        .select("id, sessions_used")
        .eq("member_id", memberId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeMembership) {
        await supabase
          .from("memberships")
          .update({ sessions_used: Math.max((activeMembership.sessions_used || 0) - 1, 0) })
          .eq("id", activeMembership.id);
      }
      setCancelMsg(t("classDetail.successCancelledRestored"));
    } else {
      setCancelMsg(t("classDetail.successCancelledNotRestored"));
    }

    setCancelling(false);
    await loadAll();
    setTimeout(() => setCancelMsg(""), 4000);
  }

  async function handleBook() {
    setBooking(true);
    setErrorMsg("");

    const { error } = await supabase.rpc("book_class_session", {
      p_member_id: memberId,
      p_class_session_id: sessionId,
    });

    setBooking(false);

    if (error) {
      setErrorMsg(t("classDetail.errBookingFailedPrefix") + error.message);
      return;
    }

    setStep("done");
  }

  if (loading) {
    return <LoadingScreen />;
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
            {t("classDetail.backToClassList")}
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
  const coachDisplay =
    [coachName, ...assistantCoachNames].filter(Boolean).map((n) => (n.includes("감독님") ? n : `${n} 코치님`)).join(", ") || "-";

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
          {step === "detail" && t("classDetail.stepDetail")}
          {step === "confirm" && t("classDetail.stepConfirm")}
          {step === "done" && t("classDetail.stepDone")}
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
                {translateClassName(cls.class_name, lang)}
              </div>
              <div style={{ fontSize: 13, color: BLUE, fontWeight: 700, marginTop: 4 }}>
                {formatDateLabel(session.session_date, lang)} · {formatTime(cls.start_time)}~{formatTime(cls.end_time)}
              </div>

              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <InfoRow label={t("classDetail.location")} value={cls.location || "-"} />
                {cls.location && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -4, marginBottom: 4 }}>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cls.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: BLUE,
                        textDecoration: "none",
                      }}
                    >
                      {t("classDetail.viewLocation")} {"\u2192"}
                    </a>
                  </div>
                )}
                <InfoRow label={t("classDetail.coach")} value={coachDisplay} />
                <InfoRow label={t("classDetail.target")} value={member.name + " · " + (cls.program === "kids" ? "Kids" : cls.program)} />
                <InfoRow
                  label={t("classDetail.capacity")}
                  value={
                    cls.capacity
                      ? t("classDetail.capacityWithTotal", { count: applicantCount, capacity: cls.capacity })
                      : t("classDetail.capacityNoTotal", { count: applicantCount })
                  }
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
                {t("classDetail.noticeText")}
              </div>
            </div>

            {errorMsg && (
              <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
                {errorMsg}
              </div>
            )}

            {cancelMsg && (
              <div style={{ background: "#e9f1fb", color: BLUE, padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
                {cancelMsg}
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
                {cancelling ? t("classDetail.cancelling") : t("classDetail.cancelBooking")}
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
                {!membership
                  ? t("classDetail.noMembership")
                  : !isClassAllowed
                  ? t("classDetail.notAllowedClass")
                  : remaining <= 0
                  ? t("classDetail.noRemaining")
                  : t("classDetail.bookNow")}
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
                {translateClassName(cls.class_name, lang)}
              </div>
              <div style={{ fontSize: 13, color: BLUE, fontWeight: 700, marginTop: 4, marginBottom: 18 }}>
                {formatDateLabel(session.session_date, lang)} · {formatTime(cls.start_time)}~{formatTime(cls.end_time)}
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

              <div style={{ marginTop: 18, textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
                <InfoRow label={t("classDetail.location")} value={cls.location || "-"} />
                <InfoRow label={t("classDetail.coach")} value={coachDisplay} />
              </div>

              <p style={{ fontSize: 14, color: "#33455e", marginTop: 20 }}>
                {t("classDetail.confirmQuestion")}
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
                {t("classDetail.cancel")}
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
                {booking ? t("classDetail.booking") : t("classDetail.confirmBooking")}
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
                {t("classDetail.doneTitle")}
              </div>
              <div style={{ fontSize: 14, color: "#33455e" }}>
                {translateClassName(cls.class_name, lang)}
              </div>
              <div style={{ fontSize: 13, color: BLUE, fontWeight: 700, marginTop: 4 }}>
                {formatDateLabel(session.session_date, lang)} · {formatTime(cls.start_time)}~{formatTime(cls.end_time)}
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
                {t("classDetail.viewBookings")}
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
                {t("classDetail.goHome")}
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

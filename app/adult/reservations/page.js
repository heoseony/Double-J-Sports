"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { nowInGermany } from "../../../lib/germanyTime";
import { supabase } from "../../../lib/supabaseClient";
import LoadingScreen from "../../components/LoadingScreen";
import { useLanguage } from "../../../lib/i18n/LanguageContext";
import { translateClassName } from "../../../lib/i18n/nameTranslations";

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

function dDayLabel(dateStr, lang) {
  const today = nowInGermany();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return lang === "en" ? "Today" : "D-day";
  if (diffDays > 0) return `D-${diffDays}`;
  return `D+${Math.abs(diffDays)}`;
}

export default function AdultReservationsPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [membershipId, setMembershipId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming");
  const [cancellingId, setCancellingId] = useState(null);
  const [cutoffHours, setCutoffHours] = useState(24);

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
      setErrorMsg(t("adultBook.errMemberNotFound"));
      setLoading(false);
      return;
    }
    setMember(memberData);

    const { data: memberships } = await supabase
      .from("memberships")
      .select("id")
      .eq("member_id", memberData.id)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1);
    if (memberships && memberships.length > 0) {
      setMembershipId(memberships[0].id);
    }

    const { data: policyData } = await supabase
      .from("cancellation_policy")
      .select("cutoff_hours")
      .limit(1)
      .maybeSingle();
    if (policyData?.cutoff_hours != null) {
      setCutoffHours(policyData.cutoff_hours);
    }

    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .select(
        "id, status, class_session_id, class_sessions(id, session_date, start_time, end_time, classes(class_name))"
      )
      .eq("member_id", memberData.id)
      .order("class_sessions(session_date)", { ascending: false });

    if (bookingError) {
      setErrorMsg(t("reservations.errLoadBookingsPrefix") + bookingError.message);
      setLoading(false);
      return;
    }

    setBookings(bookingData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCancel(booking) {
    setCancellingId(booking.id);
    setErrorMsg("");

    const s = booking.class_sessions;
    const sessionDay = new Date(`${s.session_date}T00:00:00`);
    const cutoffTime = new Date(sessionDay.getTime() - 24 * 60 * 60 * 1000);
    cutoffTime.setHours(23, 59, 59, 999);
    const isPrior = nowInGermany() < cutoffTime;
    const newStatus = isPrior ? "cancelled_prior" : "cancelled_same_day";

    const { error } = await supabase
      .from("bookings")
      .update({ status: newStatus, cancelled_at: new Date().toISOString() })
      .eq("id", booking.id);

    if (error) {
      setCancellingId(null);
      setErrorMsg(t("reservations.errCancelFailedPrefix") + error.message);
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

    setCancellingId(null);
    await loadAll();
  }

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
          <Link href="/adult/book" style={{ color: BLUE, fontWeight: 700, textDecoration: "none", fontSize: 13 }}>
            {t("reservations.backToClassList")}
          </Link>
        </div>
      </main>
    );
  }

  const today = nowInGermany();
  today.setHours(0, 0, 0, 0);

  const withDate = bookings.filter((b) => b.class_sessions?.session_date);

  const upcoming = withDate.filter((b) => {
    const sessionDate = new Date(b.class_sessions.session_date + "T00:00:00");
    return b.status === "booked" && sessionDate >= today;
  });

  const done = withDate.filter((b) => b.status === "attended");

  const cancelled = withDate.filter(
    (b) =>
      b.status === "cancelled_prior" ||
      b.status === "cancelled_same_day" ||
      (b.status === "booked" && new Date(b.class_sessions.session_date + "T00:00:00") < today)
  );

  const listByTab = {
    upcoming: upcoming.sort((a, b) => (a.class_sessions.session_date < b.class_sessions.session_date ? -1 : 1)),
    done: done.sort((a, b) => (a.class_sessions.session_date > b.class_sessions.session_date ? -1 : 1)),
    cancelled: cancelled.sort((a, b) => (a.class_sessions.session_date > b.class_sessions.session_date ? -1 : 1)),
  };

  const currentList = listByTab[activeTab];
  const TABS = [
    { key: "upcoming", label: t("reservations.tabUpcoming") },
    { key: "done", label: t("reservations.tabDone") },
    { key: "cancelled", label: t("reservations.tabCancelled") },
  ];

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
          {t("adultReservations.title")}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, padding: "14px 18px 0" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 700,
              border: "none",
              borderRadius: 999,
              background: activeTab === tab.key ? BLUE : "white",
              color: activeTab === tab.key ? "white" : "#5b7699",
              cursor: "pointer",
              boxShadow: "0 1px 4px rgba(30,60,110,0.06)",
            }}
          >
            {tab.label} ({listByTab[tab.key].length})
          </button>
        ))}
      </div>

      <div style={{ padding: "14px 18px 0" }}>
        {errorMsg && (
          <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            {errorMsg}
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
          {currentList.length === 0 && (
            <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
              {activeTab === "upcoming" && t("reservations.emptyUpcoming")}
              {activeTab === "done" && t("reservations.emptyDone")}
              {activeTab === "cancelled" && t("reservations.emptyCancelled")}
            </p>
          )}

          {currentList.map((b, idx) => {
            const s = b.class_sessions;
            const cls = s.classes;

            return (
              <div
                key={b.id}
                style={{
                  padding: "14px 0",
                  borderTop: idx === 0 ? "none" : "1px solid #f0f3f8",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>
                      {translateClassName(cls?.class_name, lang)}
                    </div>
                    <div style={{ fontSize: 13, color: "#33455e", marginTop: 4 }}>
                      {formatDateLabel(s.session_date, lang)} · {formatTime(s.start_time)}~{formatTime(s.end_time)}
                    </div>
                  </div>

                  {activeTab === "upcoming" && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: BLUE,
                        background: "#e9f1fb",
                        padding: "3px 10px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {dDayLabel(s.session_date, lang)}
                    </span>
                  )}
                  {activeTab === "done" && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#2fa370",
                        background: "#e6f6ee",
                        padding: "3px 10px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t("reservations.attended")}
                    </span>
                  )}
                  {activeTab === "cancelled" && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#8ea0b8",
                        background: "#f0f3f8",
                        padding: "3px 10px",
                        borderRadius: 999,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t("reservations.cancelledBadge")}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <Link href={`/adult/book/${b.class_session_id}`} style={{ textDecoration: "none" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        border: "1px solid #e5eaf2",
                        borderRadius: 8,
                        background: "white",
                        color: "#1b3a63",
                      }}
                    >
                      상세보기
                    </span>
                  </Link>

                  {activeTab === "upcoming" && (
                    <button
                      type="button"
                      disabled={cancellingId === b.id}
                      onClick={() => handleCancel(b)}
                      style={{
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        border: "1px solid #f3c6c2",
                        color: "#b3261e",
                        borderRadius: 8,
                        background: "white",
                        cursor: cancellingId === b.id ? "default" : "pointer",
                      }}
                    >
                      {cancellingId === b.id ? "취소 중..." : "예약 취소"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/adult/book" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            {t("reservations.backToClassList")}
          </Link>
        </div>
      </div>
    </main>
  );
}

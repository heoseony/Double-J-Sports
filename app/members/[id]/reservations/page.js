"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { nowInGermany } from "../../../../lib/germanyTime";
import { supabase } from "../../../../lib/supabaseClient";
import { useLanguage } from "../../../../lib/i18n/LanguageContext";
import { translateClassName } from "../../../../lib/i18n/nameTranslations";

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

function dDayLabel(dateStr) {
  const today = nowInGermany();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "D-day";
  if (diffDays > 0) return `D-${diffDays}`;
  return `D+${Math.abs(diffDays)}`;
}

export default function ReservationsPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id;
  const { t, lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [coachNameByClassId, setCoachNameByClassId] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState("upcoming");
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelMsg, setCancelMsg] = useState("");

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
      setErrorMsg(t("reservations.errMemberNotFound"));
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

    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .select(
        "id, status, class_session_id, class_sessions(id, session_date, class_id, classes(class_name, start_time, end_time, location))"
      )
      .eq("member_id", memberId)
      .order("class_sessions(session_date)", { ascending: false });

    if (bookingError) {
      setErrorMsg(t("reservations.errLoadBookingsPrefix") + bookingError.message);
      setLoading(false);
      return;
    }


    const classIds = [...new Set((bookingData || []).map((b) => b.class_sessions?.class_id).filter(Boolean))];
    let coachNameByClassId = {};
    if (classIds.length > 0) {
      const { data: ccData } = await supabase
        .from("class_coaches")
        .select("class_id, coach_profiles(name)")
        .in("class_id", classIds);
      (ccData || []).forEach((cc) => {
        if (!coachNameByClassId[cc.class_id] && cc.coach_profiles?.name) {
          coachNameByClassId[cc.class_id] = cc.coach_profiles.name;
        }
      });
    }
    setCoachNameByClassId(coachNameByClassId);
    setBookings(bookingData || []);
    setLoading(false);
  }

  useEffect(() => {
    if (memberId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

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
      setCancelMsg(t("reservations.successCancelledRestored"));
    } else {
      setCancelMsg(t("reservations.successCancelledNotRestored"));
    }

    setCancellingId(null);
    await loadAll();
    setTimeout(() => setCancelMsg(""), 4000);
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div style={{ fontSize: 14, color: "#5b7699" }}>{t("reservations.loading")}</div>
      </main>
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
            {t("reservations.backToPlayers")}
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
        <Link href={`/members/${memberId}/book`} style={{ color: "#1b3a63", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          {t("reservations.title", { name: member.name })}
        </div>
      </div>


      {siblings.length > 1 && (
        <div style={{ display: "flex", gap: 8, padding: "14px 18px 0", overflowX: "auto" }}>
          {siblings.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => router.push(`/members/${s.id}/reservations`)}
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
      {/* 탭 바 */}
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

        {cancelMsg && (
          <div style={{ background: "#e9f1fb", color: BLUE, padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
            {cancelMsg}
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
            const classId = b.class_sessions.class_id;
            const coachName = coachNameByClassId[classId];
            const cls = b.class_sessions.classes;
            const sessionDate = b.class_sessions.session_date;

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
                      {formatDateLabel(sessionDate, lang)} · {formatTime(cls?.start_time)}~{formatTime(cls?.end_time)}
                    </div>
                    {cls?.location && (
                      <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 4 }}>
                        {cls.location}
                        {coachName ? ` · ${coachName}` : ""}
                      </div>
                    )}
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
                      {dDayLabel(sessionDate)}
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
                  <Link
                    href={`/members/${memberId}/book/${b.class_session_id}`}
                    style={{ textDecoration: "none" }}
                  >
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
                      {t("reservations.viewDetails")}
                    </span>
                  </Link>

                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href={`/members/${memberId}/book`} style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            {t("reservations.backToClassList")}
          </Link>
        </div>
      </div>
    </main>
  );
}

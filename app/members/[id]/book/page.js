"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getRegionBg, getProgramTextColor, getRegionLabel } from "../../../../lib/classColors";
import { nowInGermany } from "../../../../lib/germanyTime";
import { supabase } from "../../../../lib/supabaseClient";
import LoadingScreen from "../../../components/LoadingScreen";
import { useLanguage } from "../../../../lib/i18n/LanguageContext";
import { translateClassName, translatePlanName } from "../../../../lib/i18n/nameTranslations";

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

export default function BookClassPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id;
  const { t, lang } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState(null);
  const [membership, setMembership] = useState(null);
  const [allowedClassIds, setAllowedClassIds] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState("frankfurt");
  const [applicantCounts, setApplicantCounts] = useState({});
  const [myBookedSessionIds, setMyBookedSessionIds] = useState(new Set());
  const [errorMsg, setErrorMsg] = useState("");

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
      setErrorMsg(t("memberBook.errMemberNotFound"));
      setLoading(false);
      return;
    }

    setMember(memberData);

    const { data: membershipData } = await supabase
      .from("memberships")
      .select("*, membership_plans(name, sessions_per_month, all_classes_allowed)")
      .eq("member_id", memberId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setMembership(membershipData || null);

    let allowedIds = null;
    if (membershipData && membershipData.membership_plans?.all_classes_allowed === false) {
      const { data: allowedRows } = await supabase
        .from("membership_plan_classes")
        .select("class_id")
        .eq("plan_id", membershipData.plan_id);
      allowedIds = (allowedRows || []).map((r) => r.class_id);
    }
    setAllowedClassIds(allowedIds);

    const today = nowInGermany().toISOString().slice(0, 10);

    const { data: sessionData, error: sessionError } = await supabase
      .from("class_sessions")
      .select(
        "id, session_date, class_id, is_cancelled, classes!inner(id, program, class_name, start_time, end_time, location, active, region)"
      )
      .or("is_cancelled.is.null,is_cancelled.eq.false")
      .eq("status", "scheduled")
      .eq("classes.program", memberData.program)
      .eq("classes.active", true)
      .gte("session_date", today)
      .order("session_date", { ascending: true });

    if (sessionError) {
      setErrorMsg(t("memberBook.errLoadSessionsPrefix") + sessionError.message);
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
            {t("memberBook.backToPlayers")}
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
  const visibleSessions = sessions
    .filter((s) => (s.classes?.region || "frankfurt") === selectedRegion)
    .filter((s) => allowedClassIds === null || allowedClassIds.includes(s.class_id));

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
          {t("memberBook.title", { name: member.name })}
        </div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: "#8ea0b8" }}>
            {membership
              ? t("memberBook.membershipSummary", { planName: translatePlanName(membership.membership_plans?.name, lang), remaining }) + (allowedClassIds !== null ? t("memberBook.limitedSuffix") : "")
              : t("memberBook.noMembership")}
          </div>
          <Link
            href={`/members/${memberId}/reservations`}
            style={{ fontSize: 12, fontWeight: 700, color: BLUE, textDecoration: "none" }}
          >
            {t("memberBook.viewReservations")}
          </Link>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setSelectedRegion("frankfurt")}
            style={{
              flex: 1,
              padding: "10px 0",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
              border: selectedRegion === "frankfurt" ? "2px solid #3B82C4" : "1px solid #ddd",
              background: selectedRegion === "frankfurt" ? "#eaf4fc" : "white",
              color: "#1b3a63",
              cursor: "pointer",
            }}
          >
            {getRegionLabel("frankfurt", lang)}
          </button>
          <button
            type="button"
            onClick={() => setSelectedRegion("dusseldorf")}
            style={{
              flex: 1,
              padding: "10px 0",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 8,
              border: selectedRegion === "dusseldorf" ? "2px solid #8b5fd6" : "1px solid #ddd",
              background: selectedRegion === "dusseldorf" ? "#f2eefc" : "white",
              color: "#1b3a63",
              cursor: "pointer",
            }}
          >
            {getRegionLabel("dusseldorf", lang)}
          </button>
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

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 18,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          {visibleSessions.length === 0 && (
            <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
              {t("memberBook.noSessionsAvailable")}
            </p>
          )}

          {visibleSessions.map((s, idx) => {
            const alreadyBooked = myBookedSessionIds.has(s.id);
            const count = applicantCounts[s.id] || 0;

            return (
              <Link
                key={s.id}
                href={`/members/${memberId}/book/${s.id}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    padding: "14px 0",
                    borderTop: idx === 0 ? "none" : "1px solid #f0f3f8",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>
                        {formatDateLabel(s.session_date, lang)} ·{" "}
                        {formatTime(s.classes.start_time)}~
                        {formatTime(s.classes.end_time)}
                      </div>
                      <div style={{ fontSize: 13, color: "#33455e", marginTop: 6 }}>
                        {translateClassName(s.classes.class_name, lang)}
                        {s.classes.location ? ` · ${s.classes.location}` : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 4 }}>
                        {t("memberBook.currentApplicants", { count })}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      {alreadyBooked && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: BLUE,
                            background: "#e9f1fb",
                            padding: "3px 10px",
                            borderRadius: 999,
                          }}
                        >
                          {t("memberBook.booked")}
                        </span>
                      )}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c7d2e0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/members" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            {t("memberBook.backToPlayers")}
          </Link>
        </div>
      </div>
    </main>
  );
}

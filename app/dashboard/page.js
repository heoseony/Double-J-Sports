"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getRegionBg, getRegionLabel, getRegionTextColor, getProgramTextColor } from "../../lib/classColors";
import { nowInGermany } from "../../lib/germanyTime";
import { supabase } from "../../lib/supabaseClient";
import LoadingScreen from "../components/LoadingScreen";

const BLUE = "#3B82C4";
const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토"];

function MenuIcon({ type, color }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  if (type === "card") {
    return (
      <svg {...props}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    );
  }
  if (type === "check") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="8 12 11 15 16 9" />
      </svg>
    );
  }
  if (type === "users") {
    return (
      <svg {...props}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (type === "calendar") {
    return (
      <svg {...props}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (type === "ticket") {
    return (
      <svg {...props}>
        <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
        <line x1="13" y1="5" x2="13" y2="19" strokeDasharray="2 2" />
      </svg>
    );
  }
  if (type === "tag") {
    return (
      <svg {...props}>
        <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L3 3v6.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.82 0l4.6-4.6a2 2 0 0 0 0-2.82z" />
        <circle cx="7.5" cy="7.5" r="1.5" fill={color} stroke="none" />
      </svg>
    );
  }
  if (type === "megaphone") {
    return (
      <svg {...props}>
        <path d="M3 11v3a1 1 0 0 0 1 1h2l3.5 5.5V4.5L6 10H4a1 1 0 0 0-1 1z" />
        <path d="M14 5a9 9 0 0 1 0 14" />
        <path d="M11.5 8a5 5 0 0 1 0 8" />
      </svg>
    );
  }
  if (type === "image") {
    return (
      <svg {...props}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    );
  }
  return null;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}
function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function getDDay(dateStr) {
  if (!dateStr) return null;
  const today = toDateStr(nowInGermany());
  const diff = Math.round(
    (new Date(dateStr + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000
  );
  return diff;
}

function formatNoticeDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

const cardStyle = {
  background: "white",
  borderRadius: 16,
  padding: 18,
  marginBottom: 16,
  boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
};
const cardTitleRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};
const cardTitle = { fontSize: 15, fontWeight: 800, color: "#1b3a63" };
const seeAllLink = { fontSize: 12, color: BLUE, fontWeight: 700, textDecoration: "none" };

function WeekCalendarGrid({ weekSessions, selectedDate, onSelectDate }) {
  const monday = getMonday(nowInGermany());
  const todayStr = toDateStr(nowInGermany());

  const countByDate = {};
  const regionsByDate = {};
  weekSessions.forEach((s) => {
    if (s.is_cancelled) return;
    countByDate[s.session_date] = (countByDate[s.session_date] || 0) + 1;
    const region = s.classes?.region || "frankfurt";
    if (!regionsByDate[s.session_date]) regionsByDate[s.session_date] = new Set();
    regionsByDate[s.session_date].add(region);
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
      {[0, 1, 2, 3, 4, 5].map((offset) => {
        const date = addDays(monday, offset);
        const dateStr = toDateStr(date);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedDate;
        const count = countByDate[dateStr] || 0;

        return (
          <button
            key={dateStr}
            type="button"
            onClick={() => onSelectDate && onSelectDate(dateStr)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "8px 2px",
              borderRadius: 10,
              border: isSelected ? "1.5px solid #3B82C4" : "1px solid #eef2f8",
              background: isToday ? "#eaf2fb" : "white",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 11, color: "#8ea0b8", fontWeight: 700 }}>
              {WEEKDAY_LABELS[offset]}
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: isToday ? "#3B82C4" : "#1b3a63",
              }}
            >
              {date.getDate()}
            </span>
            <span style={{ fontSize: 10, color: count > 0 ? "#3B82C4" : "#c2ccd9" }}>
              {count > 0 ? `${count}수업` : "-"}
            </span>
            {regionsByDate[dateStr] && regionsByDate[dateStr].size > 0 && (
              <div style={{ display: "flex", gap: 2 }}>
                {[...regionsByDate[dateStr]].map((r) => (
                  <span
                    key={r}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: getRegionTextColor(r),
                    }}
                  />
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TodayClassList({ sessions, sessionCounts, targetDate, myClassIds, role, coachNamesByClass }) {
  const router = useRouter();
  const todayStr = targetDate || toDateStr(nowInGermany());
  const todaySessions = sessions
    .filter((s) => s.session_date === todayStr)
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  if (todaySessions.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
        오늘 예정된 수업이 없습니다.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {todaySessions.map((s) => {
        const info = s.classes;
        const count = sessionCounts[s.id] || 0;
        const isDusseldorf = (s.classes?.region || "frankfurt") === "dusseldorf";
        const coachInfo = coachNamesByClass?.[s.class_id];
        const coachText = coachInfo
          ? [coachInfo.main, ...coachInfo.assistants.map((n) => `${n} 코치님`)].filter(Boolean).join(", ")
          : "";

        const isMyClass =
          role !== "coach" || !myClassIds || myClassIds.includes(s.class_id);
        const clickable = role === "admin" || (role === "coach" && isMyClass);

        return (
          <div
            key={s.id}
            onClick={() => {
              if (!clickable) return;
              if (role === "coach") {
                router.push(`/coach/attendance?sessionId=${s.id}`);
              } else if (role === "admin") {
                router.push("/admin/attendance");
              }
            }}
            style={{
              display: "flex",
              alignItems: "stretch",
              gap: 10,
              borderRadius: 12,
              border: "1px solid #eef2f8",
              opacity: s.is_cancelled ? 0.5 : 1,
              overflow: "hidden",
              cursor: clickable ? "pointer" : "default",
              background: getRegionBg(s.classes?.region),
            }}
          >
            <div
              style={{
                width: 4,
                flexShrink: 0,
                background: getProgramTextColor(info?.program),
              }}
            />

            <div style={{ padding: "10px 4px 10px 0", flexShrink: 0, textAlign: "center", minWidth: 46 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1b3a63" }}>
                {s.start_time ? s.start_time.slice(0, 5) : ""}
              </div>
              <div style={{ fontSize: 10, color: "#8ea0b8", marginTop: 1 }}>
                ~{s.end_time ? s.end_time.slice(0, 5) : ""}
              </div>
            </div>

            <div style={{ flex: 1, padding: "10px 0", minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 999,
                    color: getRegionTextColor(s.classes?.region),
                    background: "white",
                  }}
                >
                  {getRegionLabel(s.classes?.region || "frankfurt")}
                </span>
                {role === "coach" && isMyClass && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: "white",
                      background: "#e05252",
                      padding: "1px 6px",
                      borderRadius: 4,
                    }}
                  >
                    MY CLASS
                  </span>
                )}
                {s.is_cancelled && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#b3261e",
                      background: "#fdecea",
                      padding: "1px 6px",
                      borderRadius: 4,
                    }}
                  >
                    휴강
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63", marginTop: 4 }}>
                {info ? `${info.program ? "[" + info.program + "] " : ""}${info.class_name}` : "수업 정보 없음"}
              </div>
              <div style={{ fontSize: 11, color: "#8ea0b8", marginTop: 2 }}>
                {coachText && <span>{coachText}</span>}
                {coachText && info?.location && " · "}
                {info?.location && <span>{info.location}</span>}
                {(coachText || info?.location) && " · "}
                {count}명
              </div>
            </div>

            {clickable && (
              <div style={{ display: "flex", alignItems: "center", paddingRight: 12 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: BLUE,
                    whiteSpace: "nowrap",
                  }}
                >
                  출석체크 →
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [isCoach, setIsCoach] = useState(false);
  const [isAdultMember, setIsAdultMember] = useState(false);
  const [adultMemberName, setAdultMemberName] = useState("");

  const [notices, setNotices] = useState([]);

  // 학부모용
  const [children, setChildren] = useState([]);
  const [weekBookings, setWeekBookings] = useState([]);
  const [weekSessions, setWeekSessions] = useState([]);
  const [selectedWeekDate, setSelectedWeekDate] = useState(toDateStr(nowInGermany()));
  const [weekSessionCounts, setWeekSessionCounts] = useState({});
  const [membershipByChild, setMembershipByChild] = useState({});

  // 코치용
  const [coachTodaySessions, setCoachTodaySessions] = useState([]);
  const [myCoachClassIds, setMyCoachClassIds] = useState([]);

  // 이번주 수업 요약(코치/관리자 공통)
  const [thisWeekSessions, setThisWeekSessions] = useState([]);
  const [coachNamesByClass, setCoachNamesByClass] = useState({});
  const [selectedDashDate, setSelectedDashDate] = useState(toDateStr(nowInGermany()));
  const [thisWeekSessionCounts, setThisWeekSessionCounts] = useState({});
  const [totalActiveMembers, setTotalActiveMembers] = useState(0);
  const [thisWeekCancelledCount, setThisWeekCancelledCount] = useState(0);
  const [todayNeedAttendanceCount, setTodayNeedAttendanceCount] = useState(0);

  // 관리자용
  const [adminStats, setAdminStats] = useState({
    bookingsToday: 0,
    classesToday: 0,
    attended: 0,
    absent: 0,
  });

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email);

      const { data: guardian } = await supabase
        .from("guardians")
        .select("id, name")
        .eq("user_id", user.id)
        .single();

      const { data: profile } = await supabase
        .from("users")
        .select("role, name")
        .eq("id", user.id)
        .single();

      const admin = profile?.role === "admin";
      const coach = profile?.role === "coach";
      setIsAdmin(admin);
      setIsCoach(coach);

      if (admin) {
        const { count: pendingCount } = await supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");
        setPendingPaymentsCount(pendingCount || 0);
      }

      const { data: selfMember } = await supabase
        .from("members")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (selfMember) {
        setIsAdultMember(true);
        setAdultMemberName(selfMember.name);
      }

      if (coach) {
        let coachProfileName = null;
        try {
          const stored = localStorage.getItem(
            "double-j-sports-active-coach-profile"
          );
          if (stored) {
            coachProfileName = JSON.parse(stored)?.name || null;
          }
        } catch (e) {
          coachProfileName = null;
        }
        setDisplayName(coachProfileName || profile?.name || user.email);
      } else if (admin) {
        setDisplayName(profile?.name || user.email);
      } else if (selfMember) {
        setDisplayName(selfMember.name);
      } else if (guardian) {
        // 학부모 이름 대신, 첫 번째로 등록한 선수 이름을 우선 표시한다.
        // (선수가 아직 없으면 학부모 본인 이름으로 대체)
        setDisplayName(guardian.name);
      } else {
        setDisplayName(user.email);
      }

      // 공지사항 최신 2건 (모든 역할 공통)
      const { data: noticeData } = await supabase
        .from("notices")
        .select("id, title, content, created_at")
        .order("created_at", { ascending: false })
        .limit(2);
      setNotices(noticeData || []);

      const monday = getMonday(nowInGermany());
      const saturday = addDays(monday, 5);
      const mondayStr = toDateStr(monday);
      const saturdayStr = toDateStr(saturday);
      const todayStr = toDateStr(nowInGermany());

      // ── 코치/관리자 공통: 이번주 수업 요약 데이터 ──────────────────────────
      if (coach || admin) {
        const sunday = addDays(monday, 6);
        const sundayStr = toDateStr(sunday);

        const { data: wSessions } = await supabase
          .from("class_sessions")
          .select(
            "id, session_date, start_time, end_time, class_id, is_cancelled, classes(id, class_name, program, location, region)"
          )
          .gte("session_date", mondayStr)
          .lte("session_date", sundayStr)
          .order("session_date", { ascending: true })
          .order("start_time", { ascending: true });

        setThisWeekSessions(wSessions || []);

        const weekClassIds = [...new Set((wSessions || []).map((s) => s.class_id))];
        if (weekClassIds.length > 0) {
          const { data: coachRows } = await supabase
            .from("class_coaches")
            .select("class_id, coach_role, coach_profiles(name)")
            .in("class_id", weekClassIds);

          const coachMap = {};
          (coachRows || []).forEach((c) => {
            if (!coachMap[c.class_id]) coachMap[c.class_id] = { main: null, assistants: [] };
            const name = c.coach_profiles?.name;
            if (!name) return;
            if (c.coach_role === "main") coachMap[c.class_id].main = name;
            else if (c.coach_role === "assistant") coachMap[c.class_id].assistants.push(name);
          });
          setCoachNamesByClass(coachMap);
        }

        const cancelledCount = (wSessions || []).filter((s) => s.is_cancelled).length;
        setThisWeekCancelledCount(cancelledCount);

        const wSessionIds = (wSessions || []).map((s) => s.id);
        if (wSessionIds.length > 0) {
          const { data: wBookings } = await supabase
            .from("bookings")
            .select("class_session_id, status")
            .in("class_session_id", wSessionIds)
            .in("status", ["booked", "attended"]);

          const counts = {};
          (wBookings || []).forEach((b) => {
            counts[b.class_session_id] = (counts[b.class_session_id] || 0) + 1;
          });
          setThisWeekSessionCounts(counts);

          const todaySessionIds = (wSessions || [])
            .filter((s) => s.session_date === todayStr)
            .map((s) => s.id);

          const needAttendance = (wBookings || []).filter(
            (b) => todaySessionIds.includes(b.class_session_id) && b.status === "booked"
          ).length;
          setTodayNeedAttendanceCount(needAttendance);
        }

        const { count: activeCount } = await supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .or("is_test.is.null,is_test.eq.false");
        setTotalActiveMembers(activeCount || 0);
      }

      // ── 학부모 데이터 ──────────────────────────
      if (guardian && !admin && !coach) {
        const { data: childList } = await supabase
          .from("members")
          .select("id, name, program")
          .eq("guardian_id", guardian.id)
          .order("created_at", { ascending: true });

        setChildren(childList || []);

        // 첫 번째로 등록한 선수 이름을 인사말에 우선 표시 (요청사항)
        if (childList && childList.length > 0) {
          setDisplayName(childList[0].name);
        }

        const childIds = (childList || []).map((c) => c.id);

        if (childIds.length > 0) {
          const { data: activeMemberships } = await supabase
            .from("memberships")
            .select(
              "member_id, sessions_used, start_date, membership_plans(sessions_per_month)"
            )
            .in("member_id", childIds)
            .eq("status", "active")
            .order("start_date", { ascending: false });

          const membershipMap = {};
          (activeMemberships || []).forEach((ms) => {
            // 선수당 가장 최근(첫 번째로 걸리는) 활성 회원권 하나만 사용
            if (membershipMap[ms.member_id] !== undefined) return;
            const total = ms.membership_plans?.sessions_per_month || 0;
            membershipMap[ms.member_id] = {
              remaining: Math.max(total - (ms.sessions_used || 0), 0),
              total,
            };
          });
          setMembershipByChild(membershipMap);
        }

        if (childIds.length > 0) {
          const { data: bk } = await supabase
            .from("bookings")
            .select("id, member_id, status, class_session_id")
            .in("member_id", childIds)
            .neq("status", "cancelled_prior");

          const sessionIds = [...new Set((bk || []).map((b) => b.class_session_id))];
          let sessionMap = {};

          if (sessionIds.length > 0) {
            const { data: sess } = await supabase
              .from("class_sessions")
              .select("id, session_date, start_time, class_id")
              .in("id", sessionIds);

            const classIds = [...new Set((sess || []).map((s) => s.class_id))];
            const { data: classesData } = await supabase
              .from("classes")
              .select("id, class_name, program")
              .in("id", classIds);

            const classMap = {};
            (classesData || []).forEach((c) => (classMap[c.id] = c));
            (sess || []).forEach((s) => {
              sessionMap[s.id] = { ...s, classInfo: classMap[s.class_id] };
            });
          }

          const enriched = (bk || [])
            .map((b) => ({ ...b, session: sessionMap[b.class_session_id] }))
            .filter((b) => b.session);

          const thisWeek = enriched.filter(
            (b) =>
              b.session.session_date >= mondayStr &&
              b.session.session_date <= saturdayStr
          );

          setWeekBookings(thisWeek);
        }
      }

      // ── 성인회원(본인) 데이터 ──────────────────────────
      if (selfMember && !admin && !coach) {
        const memberIds = [selfMember.id];
        const { data: bk } = await supabase
          .from("bookings")
          .select("id, member_id, status, class_session_id")
          .in("member_id", memberIds)
          .neq("status", "cancelled_prior");

        const sessionIds = [...new Set((bk || []).map((b) => b.class_session_id))];
        let sessionMap = {};

        if (sessionIds.length > 0) {
          const { data: sess } = await supabase
            .from("class_sessions")
            .select("id, session_date, start_time, class_id")
            .in("id", sessionIds);

          const classIds = [...new Set((sess || []).map((s) => s.class_id))];
          const { data: classesData } = await supabase
            .from("classes")
            .select("id, class_name, program")
            .in("id", classIds);

          const classMap = {};
          (classesData || []).forEach((c) => (classMap[c.id] = c));
          (sess || []).forEach((s) => {
            sessionMap[s.id] = { ...s, classInfo: classMap[s.class_id] };
          });
        }

        const enriched = (bk || [])
          .map((b) => ({ ...b, session: sessionMap[b.class_session_id] }))
          .filter((b) => b.session);

        const thisWeek = enriched.filter(
          (b) =>
            b.session.session_date >= mondayStr &&
            b.session.session_date <= saturdayStr
        );

        setWeekBookings(thisWeek);
      }

      // ── 코치 데이터 ──────────────────────────
      if (coach) {
        let activeProfileId = null;
        try {
          const stored = localStorage.getItem(
            "double-j-sports-active-coach-profile"
          );
          activeProfileId = stored ? JSON.parse(stored)?.id : null;
        } catch (e) {
          activeProfileId = null;
        }

        let classIds = [];
        const classMap = {};

        if (activeProfileId) {
          const { data: myClassCoaches } = await supabase
            .from("class_coaches")
            .select("class_id, classes(id, class_name, program)")
            .eq("coach_profile_id", activeProfileId);

          classIds = (myClassCoaches || []).map((cc) => cc.class_id);
          setMyCoachClassIds(classIds);
          (myClassCoaches || []).forEach((cc) => {
            if (cc.classes) classMap[cc.class_id] = cc.classes;
          });
        }

        if (classIds.length > 0) {
          const { data: sess } = await supabase

            .from("class_sessions")
            .select("id, session_date, start_time, end_time, class_id")
            .in("class_id", classIds)
            .eq("session_date", todayStr)
            .order("start_time", { ascending: true });

          setCoachTodaySessions(
            (sess || []).map((s) => ({ ...s, classInfo: classMap[s.class_id] }))
          );
        }
      }

      // ── 관리자 데이터 ──────────────────────────
      if (admin) {
        const { data: todaySess } = await supabase
          .from("class_sessions")
          .select("id")
          .eq("session_date", todayStr);

        const sessionIds = (todaySess || []).map((s) => s.id);
        let bookingsToday = [];

        if (sessionIds.length > 0) {
          const { data: bkAll } = await supabase
            .from("bookings")
            .select("id, status")
            .in("class_session_id", sessionIds);
          bookingsToday = bkAll || [];
        }

        setAdminStats({
          classesToday: sessionIds.length,
          bookingsToday: bookingsToday.filter((b) =>
            ["booked", "attended"].includes(b.status)
          ).length,
          attended: bookingsToday.filter((b) => b.status === "attended").length,
          absent: bookingsToday.filter((b) => b.status === "absent").length,
        });
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  const roleLabel = isAdmin ? "감독" : isCoach ? "코치" : isAdultMember ? "" : "학부모";
  const greetingSub = isAdmin
    ? "아카데미 운영을 효율적으로 관리하세요."
    : isCoach
    ? "오늘도 멋진 수업 만들어가요!"
    : "오늘도 좋은 하루 보내세요!";

  const monday = getMonday(nowInGermany());
  const todayStr = toDateStr(nowInGermany());

  const upcomingThisWeek = weekBookings
    .filter((b) => b.status === "booked" && b.session.session_date >= todayStr)
    .sort((a, b) =>
      a.session.session_date === b.session.session_date
        ? a.session.start_time.localeCompare(b.session.start_time)
        : a.session.session_date.localeCompare(b.session.session_date)
    )
    .slice(0, 3);

  function attendanceGridFor(childId) {
    return [0, 1, 2, 3, 4, 5].map((offset) => {
      const date = toDateStr(addDays(monday, offset));
      const match = weekBookings.find(
        (b) => b.member_id === childId && b.session.session_date === date
      );
      if (!match) return { symbol: "–", color: "#c7d2e0" };
      if (match.status === "attended") return { symbol: "O", color: "#2e7d32" };
      if (match.status === "absent") return { symbol: "X", color: "#b3261e" };
      if (match.status === "cancelled_same_day")
        return { symbol: "X", color: "#999" };
      return { symbol: "O", color: BLUE };
    });
  }

  const adminMenu = [
    { label: "결제 관리", href: "/admin/payments", icon: "card", bg: "#eaf2fb", color: "#3B82C4" },
    { label: "출석 현황", href: "/admin/attendance", icon: "check", bg: "#e9f8f0", color: "#2ea86e" },
    { label: "회원 관리", href: "/admin/members", icon: "users", bg: "#fdf1e6", color: "#e2892e" },
    { label: "수업 관리", href: "/admin/classes", icon: "calendar", bg: "#eaf2fb", color: "#3B82C4" },
    { label: "회원권 배정", href: "/admin/memberships", icon: "ticket", bg: "#f2eefc", color: "#8b5fd6" },
    { label: "상품 관리", href: "/admin/plans", icon: "tag", bg: "#fde9f0", color: "#d6336c" },
    { label: "공지사항", href: "/notices", icon: "megaphone", bg: "#fef6e0", color: "#d6a02e" },
    { label: "갤러리", href: "/photos", icon: "image", bg: "#e6f7f7", color: "#2ea8a0" },
  ];

  return (
    <main
      style={{
        background: "#f3f7fc",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {/* 상단 브랜드 바 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "18px 18px 8px",
        }}
      >
        <img src="/logo-main.png" alt="" style={{ width: 30, height: "auto" }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          더블제이 스포츠 아카데미
        </div>
      </div>

      <div style={{ padding: "8px 18px 0" }}>
        {/* 인사말 카드 */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            background: isCoach
              ? `linear-gradient(90deg, rgba(15,35,70,0.55) 0%, rgba(15,35,70,0.15) 60%), url(/banner-coach.jpg)`
              : isAdmin
              ? `linear-gradient(90deg, rgba(10,20,50,0.55) 0%, rgba(10,20,50,0.15) 60%), url(/banner-admin.jpg)`
              : `url(/banner-guardian.jpg)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            borderRadius: 18,
            padding: 22,
            color: "white",
            marginBottom: 18,
          }}
        >

          <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>
            안녕하세요!
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 6 }}>
            {isAdmin ? (
              "정연웅 • 정연황"
            ) : (
              displayName || email
            )}
            {roleLabel === "학부모" ? " 학부모님" : roleLabel === "" ? "님" : ` ${roleLabel}님`}
          </div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>{greetingSub}</div>
        </div>

        {/* ───────── 학부모 화면 ───────── */}
        {!isAdmin && !isCoach && (
          <>
            <div style={cardStyle}>
              <div style={cardTitleRow}>
                <span style={cardTitle}>이번 주 수업</span>
                <Link href="/members" style={seeAllLink}>
                  전체 보기 ›
                </Link>
              </div>

              {upcomingThisWeek.length === 0 && (
                <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
                  이번 주 예정된 수업이 없습니다.
                </p>
              )}

              {upcomingThisWeek.map((b) => (
                <div
                  key={b.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid #f0f3f8",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1b3a63" }}>
                      {formatShortDate(b.session.session_date)} ·{" "}
                      {b.session.start_time?.slice(0, 5)}
                    </div>
                    <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 2 }}>
                      {b.session.classInfo?.class_name}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: getDDay(b.session.session_date) === 0 ? "#b3261e" : BLUE,
                        background: "#e9f1fb",
                        padding: "4px 10px",
                        borderRadius: 999,
                      }}
                    >
                      {getDDay(b.session.session_date) === 0
                        ? "D-DAY"
                        : `D-${getDDay(b.session.session_date)}`}
                    </span>
                    <Link
                      href={`/members/${b.member_id}/book/${b.class_session_id}`}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#fff",
                        background: BLUE,
                        padding: "4px 10px",
                        borderRadius: 6,
                        textDecoration: "none",
                      }}
                    >
                      수업 상세보기
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {!isAdultMember && (
              <>
            <div style={cardStyle}>
              <div style={cardTitleRow}>
                <span style={cardTitle}>출석 체크 (이번 주)</span>
              </div>

              {children.length === 0 && (
                <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
                  등록된 선수가 없습니다.
                </p>
              )}

              {children.map((c) => {
                const ms = membershipByChild[c.id];
                return (
                <div key={c.id} style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>
                      {c.name}
                    </span>
                    {ms ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: ms.remaining > 0 ? BLUE : "#b3261e",
                          background: ms.remaining > 0 ? "#e9f1fb" : "#fdecec",
                          padding: "3px 9px",
                          borderRadius: 999,
                        }}
                      >
                        잔여 {ms.remaining}/{ms.total}회
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#c2cbd9" }}>
                        회원권 없음
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {attendanceGridFor(c.id).map((cell, i) => (
                      <div key={i} style={{ textAlign: "center", flex: 1 }}>
                        <div style={{ fontSize: 10, color: "#aab9cc", marginBottom: 3 }}>
                          {WEEKDAY_LABELS[i]}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: cell.color }}>
                          {cell.symbol}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>

            <div style={cardStyle}>
              <Link href="/members" style={{ textDecoration: "none" }}>
                <button
                  style={{
                    width: "100%",
                    padding: 14,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "white",
                    background: BLUE,
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                >
                  선수 관리 · 수업 예약
                </button>
              </Link>
            </div>
              </>
            )}
          </>
        )}

        {/* ───────── 성인 회원(자기 자신) 바로가기 ───────── */}
        {isAdultMember && (
          <div style={cardStyle}>
            <Link href="/adult/book" style={{ textDecoration: "none" }}>
              <button
                style={{
                  width: "100%",
                  padding: 14,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "white",
                  background: BLUE,
                  border: "none",
                  borderRadius: 12,
                  cursor: "pointer",
                }}
              >
                수업 예약 ({adultMemberName}님)
              </button>
            </Link>
          </div>
        )}
      {isCoach && (
        <div style={{}}>
          <div style={cardStyle}>
            <div style={cardTitleRow}>
              <span style={cardTitle}>
                이번주 수업 요약 ({formatShortDate(toDateStr(getMonday(nowInGermany())))} - {formatShortDate(toDateStr(addDays(getMonday(nowInGermany()), 6)))})
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#eaf2fb", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82C4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#1b3a63" }}>
                  {thisWeekSessions.filter((s) => !s.is_cancelled).length}
                </div>
                <div style={{ fontSize: 11, color: "#8ea0b8" }}>총 수업</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#e9f8f0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2ea86e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#1b3a63" }}>
                  {totalActiveMembers}
                </div>
                <div style={{ fontSize: 11, color: "#8ea0b8" }}>총 회원</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fdf1e6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e2892e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#1b3a63" }}>
                  {thisWeekCancelledCount}
                </div>
                <div style={{ fontSize: 11, color: "#8ea0b8" }}>휴강</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#f2eefc", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5fd6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#1b3a63" }}>
                  {todayNeedAttendanceCount}
                </div>
                <div style={{ fontSize: 11, color: "#8ea0b8" }}>출석체크 필요</div>
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardTitleRow}>
              <span style={cardTitle}>이번주 수업</span>
            </div>
            <WeekCalendarGrid
              weekSessions={thisWeekSessions}
              selectedDate={selectedDashDate}
              onSelectDate={(d) => setSelectedDashDate(d)}
            />
          </div>

          <div style={cardStyle}>
            <div style={cardTitleRow}>
              <span style={cardTitle}>오늘의 수업</span>
            </div>
            <TodayClassList
              sessions={thisWeekSessions}
              sessionCounts={thisWeekSessionCounts}
              targetDate={selectedDashDate}
              myClassIds={myCoachClassIds}
              role="coach"
              coachNamesByClass={coachNamesByClass}
            />
          </div>
        </div>
      )}

        {/* ───────── 관리자 화면 ───────── */}
        {isAdmin && (
          <>
            <div style={cardStyle}>
              <div style={cardTitleRow}>
                <span style={cardTitle}>운영 현황 ({formatShortDate(toDateStr(nowInGermany()))} 기준)</span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: 8,
                }}
              >
                {[
                  { label: "아카데미 회원수", value: totalActiveMembers },
                  { label: "오늘 수업", value: adminStats.classesToday },
                  { label: "출석", value: adminStats.attended },
                  { label: "결석", value: adminStats.absent },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: "#f3f7fc",
                      borderRadius: 12,
                      padding: "12px 6px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#1b3a63" }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: 11, color: "#8ea0b8", marginTop: 2 }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          <div style={cardStyle}>
            <div style={cardTitleRow}>
              <span style={cardTitle}>이번주 수업</span>
            </div>
            <WeekCalendarGrid
              weekSessions={thisWeekSessions}
              selectedDate={selectedDashDate}
              onSelectDate={(d) => setSelectedDashDate(d)}
            />
          </div>

          <div style={cardStyle}>
            <div style={cardTitleRow}>
              <span style={cardTitle}>오늘의 수업</span>
            </div>
            <TodayClassList
              sessions={thisWeekSessions}
              sessionCounts={thisWeekSessionCounts}
              targetDate={selectedDashDate}
              role="admin"
              coachNamesByClass={coachNamesByClass}
            />
          </div>

            <div style={cardStyle}>
              <div style={cardTitleRow}>
                <span style={cardTitle}>주요 메뉴</span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                }}
              >
                {adminMenu.map((m) => (
                  <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        padding: "12px 4px",
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          background: m.bg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MenuIcon type={m.icon} color={m.color} />
                        {m.label === "결제 관리" && pendingPaymentsCount > 0 && (
                          <span
                            style={{
                              position: "absolute",
                              top: -2,
                              right: -2,
                              minWidth: 18,
                              height: 18,
                              padding: "0 4px",
                              borderRadius: 999,
                              background: "#e53935",
                              color: "white",
                              fontSize: 10,
                              fontWeight: 800,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              lineHeight: 1,
                              boxShadow: "0 0 0 2px white",
                            }}
                          >
                            {pendingPaymentsCount > 99 ? "99+" : pendingPaymentsCount}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          textAlign: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#1b3a63",
                        }}
                      >
                        {m.label}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 공지사항 (공통) */}
        <div style={cardStyle}>
          <div style={cardTitleRow}>
            <span style={cardTitle}>공지사항</span>
            <Link href="/notices" style={seeAllLink}>
              전체 보기 ›
            </Link>
          </div>

          {notices.length === 0 && (
            <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
              등록된 공지사항이 없습니다.
            </p>
          )}

          {notices.map((n) => (
            <Link
              key={n.id}
              href={`/notices/detail?id=${n.id}`}
              style={{
                display: "block",
                padding: "8px 0",
                borderBottom: "1px solid #f0f3f8",
                textDecoration: "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>{n.title}</span>
                <span style={{ fontSize: 12, color: "#aab9cc", flexShrink: 0, marginLeft: 8 }}>
                  {formatNoticeDate(n.created_at)}
                </span>
              </div>
              {n.content && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#8ea0b8",
                    marginTop: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {n.content}
                </div>
              )}
            </Link>
          ))}
        </div>

        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: 14,
            fontSize: 13,
            fontWeight: 700,
            color: "#8ea0b8",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          로그아웃
        </button>
      </div>
    </main>
  );
}

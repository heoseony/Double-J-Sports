"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

const BLUE = "#3B82C4";
const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토"];

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

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoach, setIsCoach] = useState(false);
  const [isAdultMember, setIsAdultMember] = useState(false);
  const [adultMemberName, setAdultMemberName] = useState("");

  const [notices, setNotices] = useState([]);

  // 학부모용
  const [children, setChildren] = useState([]);
  const [weekBookings, setWeekBookings] = useState([]);
  const [membershipByChild, setMembershipByChild] = useState({});

  // 코치용
  const [coachTodaySessions, setCoachTodaySessions] = useState([]);

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

      const { data: selfMember } = await supabase
        .from("members")
        .select("name")
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
        // 학부모 이름 대신, 첫 번째로 등록한 자녀 이름을 우선 표시한다.
        // (자녀가 아직 없으면 학부모 본인 이름으로 대체)
        setDisplayName(guardian.name);
      } else {
        setDisplayName(user.email);
      }

      // 공지사항 최신 2건 (모든 역할 공통)
      const { data: noticeData } = await supabase
        .from("notices")
        .select("id, title, created_at")
        .order("created_at", { ascending: false })
        .limit(2);
      setNotices(noticeData || []);

      const monday = getMonday(new Date());
      const saturday = addDays(monday, 5);
      const mondayStr = toDateStr(monday);
      const saturdayStr = toDateStr(saturday);
      const todayStr = toDateStr(new Date());

      // ── 학부모 데이터 ──────────────────────────
      if (guardian && !admin && !coach) {
        const { data: childList } = await supabase
          .from("members")
          .select("id, name, program")
          .eq("guardian_id", guardian.id)
          .order("created_at", { ascending: true });

        setChildren(childList || []);

        // 첫 번째로 등록한 자녀 이름을 인사말에 우선 표시 (요청사항)
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
            // 자녀당 가장 최근(첫 번째로 걸리는) 활성 회원권 하나만 사용
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
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div style={{ fontSize: 14, color: "#5b7699" }}>불러오는 중...</div>
      </main>
    );
  }

  const roleLabel = isAdmin ? "감독" : isCoach ? "코치" : "학부모";
  const greetingSub = isAdmin
    ? "아카데미 운영을 효율적으로 관리하세요."
    : isCoach
    ? "오늘도 멋진 수업 만들어가요!"
    : "오늘도 즐거운 축구 되세요!";

  const monday = getMonday(new Date());
  const todayStr = toDateStr(new Date());

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
    { label: "결제 관리", href: "/admin/payments" },
    { label: "출석 현황", href: "/admin/attendance" },
    { label: "회원 관리", href: "/admin/members" },
    { label: "수업 관리", href: "/admin/classes" },
    { label: "회원권 배정", href: "/admin/memberships" },
    { label: "상품 관리", href: "/admin/plans" },
    { label: "결제 계좌 설정", href: "/admin/payment-settings" },
    { label: "인보이스 관리", href: "/admin/invoices" },
    { label: "공지사항", href: "/notices" },
    { label: "갤러리", href: "/photos" },
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
          더블제이 축구 아카데미
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
            {roleLabel === "학부모" ? " 학부모님" : ` ${roleLabel}님`}
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
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: BLUE,
                      background: "#e9f1fb",
                      padding: "4px 10px",
                      borderRadius: 999,
                    }}
                  >
                    예약 완료
                  </span>
                </div>
              ))}
            </div>

            <div style={cardStyle}>
              <div style={cardTitleRow}>
                <span style={cardTitle}>출석 체크 (이번 주)</span>
              </div>

              {children.length === 0 && (
                <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
                  등록된 자녀가 없습니다.
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
                  자녀 관리 · 수업 예약
                </button>
              </Link>
            </div>
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

        {/* ───────── 코치 화면 ───────── */}
        {isCoach && (
          <>
            <div style={cardStyle}>
              <div style={cardTitleRow}>
                <span style={cardTitle}>오늘의 수업</span>
                <Link href="/coach" style={seeAllLink}>
                  전체 보기 ›
                </Link>
              </div>

              {coachTodaySessions.length === 0 && (
                <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
                  오늘 담당하는 수업이 없습니다.
                </p>
              )}

              {coachTodaySessions.map((s) => (
                <div
                  key={s.id}
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
                      {s.start_time?.slice(0, 5)}~{s.end_time?.slice(0, 5)}
                    </div>
                    <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 2 }}>
                      {s.classInfo?.class_name}
                    </div>
                  </div>
                  <Link href={`/coach/attendance?sessionId=${s.id}`}>
                    <button
                      style={{
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "white",
                        background: BLUE,
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      출석 체크
                    </button>
                  </Link>
                </div>
              ))}
            </div>

            <div style={cardStyle}>
              <Link href="/coach" style={{ textDecoration: "none" }}>
                <button
                  style={{
                    width: "100%",
                    padding: 14,
                    fontSize: 14,
                    fontWeight: 700,
                    color: "white",
                    background: "#1b3a63",
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                >
                  코치 화면 (주간 수업)
                </button>
              </Link>
            </div>
          </>
        )}

        {/* ───────── 관리자 화면 ───────── */}
        {isAdmin && (
          <>
            <div style={cardStyle}>
              <div style={cardTitleRow}>
                <span style={cardTitle}>운영 현황 (오늘 기준)</span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: 8,
                }}
              >
                {[
                  { label: "오늘 예약", value: adminStats.bookingsToday },
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
                        background: "#f3f7fc",
                        borderRadius: 12,
                        padding: "16px 6px",
                        textAlign: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#1b3a63",
                      }}
                    >
                      {m.label}
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
            <div
              key={n.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid #f0f3f8",
                fontSize: 13,
              }}
            >
              <span style={{ color: "#33455e" }}>{n.title}</span>
              <span style={{ color: "#aab9cc" }}>{formatNoticeDate(n.created_at)}</span>
            </div>
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

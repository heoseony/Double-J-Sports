"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { nowInGermany } from "../../../lib/germanyTime";
import LoadingScreen from "../../components/LoadingScreen";

const BLUE = "#3B82C4";

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function localDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=일 ... 6=토
  const diff = day === 0 ? -6 : 1 - day; // 월요일 시작
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function loadPeriodStats(startDateStr, endDateStrExclusive) {
  // 출석률: 이 기간의 세션에 걸린 bookings 기준
  const { data: sessions } = await supabase
    .from("class_sessions")
    .select("id, session_date")
    .gte("session_date", startDateStr)
    .lt("session_date", endDateStrExclusive);

  const sessionIds = (sessions || []).map((s) => s.id);

  let attended = 0;
  let finalized = 0;
  if (sessionIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("status")
      .in("class_session_id", sessionIds)
      .in("status", ["attended", "absent", "cancelled_same_day"]);
    finalized = (bookings || []).length;
    attended = (bookings || []).filter((b) => b.status === "attended").length;
  }
  const attendanceRate = finalized > 0 ? Math.round((attended / finalized) * 1000) / 10 : null;

  // 신규 등록 회원 수 (키즈, 테스트 제외)
  const { data: newMembers } = await supabase
    .from("members")
    .select("id, is_test")
    .eq("program", "kids")
    .gte("created_at", startDateStr)
    .lt("created_at", endDateStrExclusive);
  const newMemberCount = (newMembers || []).filter((m) => !m.is_test).length;

  // 매출 (결제 승인된 것만)
  const { data: payments } = await supabase
    .from("payments")
    .select("net_amount, total_amount")
    .eq("status", "confirmed")
    .gte("confirmed_at", startDateStr)
    .lt("confirmed_at", endDateStrExclusive);
  const revenue = (payments || []).reduce(
    (sum, p) => sum + Number(p.net_amount ?? p.total_amount ?? 0),
    0
  );

  return {
    attendanceRate,
    attended,
    finalized,
    newMemberCount,
    revenue,
  };
}

function StatCard({ title, periodLabel, stats }) {
  if (!stats) {
    return (
      <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#8a97a8" }}>불러오는 중...</div>
      </div>
    );
  }

  return (
    <div style={{ background: "white", borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#1b3a63" }}>{title}</div>
      <div style={{ fontSize: 12, color: "#8a97a8", marginBottom: 14 }}>{periodLabel}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div style={{ background: "#f3f7fc", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#1b3a63" }}>
            {stats.attendanceRate !== null ? `${stats.attendanceRate}%` : "-"}
          </div>
          <div style={{ fontSize: 11, color: "#8ea0b8", marginTop: 2 }}>
            출석률 ({stats.attended}/{stats.finalized})
          </div>
        </div>
        <div style={{ background: "#f3f7fc", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#1b3a63" }}>{stats.newMemberCount}</div>
          <div style={{ fontSize: 11, color: "#8ea0b8", marginTop: 2 }}>신규 회원</div>
        </div>
        <div style={{ background: "#f3f7fc", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
            €{stats.revenue.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: "#8ea0b8", marginTop: 2 }}>매출</div>
        </div>
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [weekStats, setWeekStats] = useState(null);
  const [monthStats, setMonthStats] = useState(null);
  const [weekLabel, setWeekLabel] = useState("");
  const [monthLabel, setMonthLabel] = useState("");

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

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    const now = nowInGermany();

    // 이번 주 (월요일 ~ 오늘까지, 진행중 집계)
    const monday = getMonday(now);
    const weekStart = localDateStr(monday);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEndExclusive = localDateStr(tomorrow);
    setWeekLabel(`${weekStart} ~ ${localDateStr(now)} (진행중)`);

    // 이번 달 (1일 ~ 오늘까지, 진행중 집계)
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    setMonthLabel(`${monthStart.slice(0, 7)} 1일 ~ ${localDateStr(now)} (진행중)`);

    const [w, m] = await Promise.all([
      loadPeriodStats(weekStart, weekEndExclusive),
      loadPeriodStats(monthStart, weekEndExclusive),
    ]);

    setWeekStats(w);
    setMonthStats(m);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <main style={{ background: "#f3f7fc", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <Link href="/dashboard" style={{ color: "#1b3a63", display: "flex" }}>
          <BackIcon />
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>운영 리포트</div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        {errorMsg && (
          <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
            {errorMsg}
          </div>
        )}

        <StatCard title="이번 주 리포트" periodLabel={weekLabel} stats={weekStats} />
        <StatCard title="이번 달 리포트" periodLabel={monthLabel} stats={monthStats} />

        <div style={{ fontSize: 11, color: "#8a97a8", textAlign: "center", marginBottom: 20 }}>
          매출은 결제 승인 완료된 건 기준이며, 진행중인 기간의 실시간 집계입니다.
        </div>
      </div>
    </main>
  );
}

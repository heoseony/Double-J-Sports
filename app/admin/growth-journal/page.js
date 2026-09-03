"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { getRegionLabel } from "../../../lib/classColors";
import LoadingScreen from "../../components/LoadingScreen";

const BLUE = "#3B82C4";
const GREEN = "#2ea86e";
const ORANGE = "#e2892e";
const GRAY = "#8a97a8";

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa7b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

// 로컬 캘린더 기준 YYYY-MM-DD (toISOString의 타임존 밀림 문제 방지)
function localDateStr(y, monthIndex0, day) {
  const mm = String(monthIndex0 + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function buildMonthOptions() {
  const now = new Date();
  const options = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = localDateStr(d.getFullYear(), d.getMonth(), 1);
    const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    options.push({ value, label });
  }
  return options;
}

function getMonthRange(selectedMonth) {
  const [y, m] = selectedMonth.split("-").map(Number); // m: 1~12
  const monthStart = selectedMonth;
  const nextMonthDate = new Date(y, m, 1);
  const monthEnd = localDateStr(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), nextMonthDate.getDate());
  const lastDay = new Date(y, m, 0);
  return { monthStart, monthEnd, lastDay };
}

function deadlineLabel(lastDay) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((lastDay - today) / 86400000);
  if (diffDays > 0) return `D-${diffDays}`;
  if (diffDays === 0) return "오늘 마감";
  return "마감";
}
function formatDeadlineDate(lastDay) {
  return `${lastDay.getFullYear()}.${String(lastDay.getMonth() + 1).padStart(2, "0")}.${String(
    lastDay.getDate()
  ).padStart(2, "0")}`;
}

function formatBerlinDateTime(isoString) {
  if (!isoString) return null;
  try {
    const d = new Date(isoString);
    const datePart = d.toLocaleDateString("ko-KR", { timeZone: "Europe/Berlin" }).replace(/\s/g, "");
    const timePart = d.toLocaleTimeString("ko-KR", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${datePart} ${timePart}`;
  } catch (e) {
    return null;
  }
}

function statusInfo(status) {
  if (status === "published") return { label: "발행완료", bg: "#e9f8f0", color: GREEN };
  if (status === "draft") return { label: "임시저장", bg: "#fef6e0", color: "#d6a02e" };
  return { label: "작성 대기", bg: "#f3f5f8", color: GRAY };
}

// 작성완료(초록) / 작성대기(주황) 2색 도넛
function StatusDonut({ writtenCount, totalCount }) {
  const size = 84;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = totalCount > 0 ? writtenCount / totalCount : 0;
  const writtenLen = circumference * pct;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#fdeee0"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={GREEN}
        strokeWidth={stroke}
        strokeDasharray={`${writtenLen} ${circumference - writtenLen}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="16"
        fontWeight="800"
        fill="#1b3a63"
      >
        {totalCount > 0 ? `${Math.round(pct * 100)}%` : "-"}
      </text>
    </svg>
  );
}

export default function GrowthJournalAdminPage() {
  const router = useRouter();
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [rows, setRows] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [lastDay, setLastDay] = useState(null);

  const [activeTab, setActiveTab] = useState("all"); // all | written | pending
  const [classFilter, setClassFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  async function loadData(month) {
    setLoading(true);
    setErrorMsg("");
    setSelectedIds(new Set());

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

    const { monthStart, monthEnd, lastDay: monthLastDay } = getMonthRange(month);
    setLastDay(monthLastDay);

    const { data: allMembers } = await supabase
      .from("members")
      .select("id, name, birth_date, profile_image_url, is_test, region")
      .eq("program", "kids")
      .order("name");

    const members = (allMembers || []).filter((m) => !m.is_test);
    const memberIds = members.map((m) => m.id);

    let journals = [];
    if (memberIds.length > 0) {
      const { data: journalData } = await supabase
        .from("growth_journals")
        .select("id, member_id, status, updated_at")
        .eq("year_month", month)
        .in("member_id", memberIds);
      journals = journalData || [];
    }
    const journalByMember = {};
    journals.forEach((j) => {
      journalByMember[j.member_id] = j;
    });

    const { data: sessions } = await supabase
      .from("class_sessions")
      .select("id, classes(class_name)")
      .gte("session_date", monthStart)
      .lt("session_date", monthEnd);
    const sessionIdToClassName = {};
    (sessions || []).forEach((s) => {
      if (s.classes?.class_name) sessionIdToClassName[s.id] = s.classes.class_name;
    });
    const sessionIds = (sessions || []).map((s) => s.id);

    let bookings = [];
    if (sessionIds.length > 0 && memberIds.length > 0) {
      const { data: bookingData } = await supabase
        .from("bookings")
        .select("member_id, class_session_id, status")
        .in("class_session_id", sessionIds)
        .in("member_id", memberIds);
      bookings = bookingData || [];
    }

    const byMember = {};
    memberIds.forEach((id) => {
      byMember[id] = { attended: 0, total: 0, classNames: new Set() };
    });
    bookings.forEach((b) => {
      const entry = byMember[b.member_id];
      if (!entry) return;
      const cn = sessionIdToClassName[b.class_session_id];
      if (cn && ["attended", "absent", "cancelled_same_day", "booked"].includes(b.status)) {
        entry.classNames.add(cn);
      }
      if (["attended", "absent", "cancelled_same_day"].includes(b.status)) {
        entry.total += 1;
        if (b.status === "attended") entry.attended += 1;
      }
    });

    const combined = members.map((m) => ({
      member: m,
      journal: journalByMember[m.id] || null,
      classNames: Array.from(byMember[m.id]?.classNames || []),
      attended: byMember[m.id]?.attended || 0,
      total: byMember[m.id]?.total || 0,
    }));

    setRows(combined);
    setLoading(false);
  }

  useEffect(() => {
    loadData(selectedMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const draftRows = rows.filter((r) => r.journal?.status === "draft");
  const publishedCount = rows.filter((r) => r.journal?.status === "published").length;
  const writtenCount = rows.filter((r) => r.journal).length;
  const notWrittenCount = rows.filter((r) => !r.journal).length;

  const classOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => r.classNames.forEach((cn) => set.add(cn)));
    return Array.from(set);
  }, [rows]);

  const visibleRows = rows.filter((r) => {
    if (activeTab === "written" && !r.journal) return false;
    if (activeTab === "pending" && r.journal) return false;
    if (classFilter !== "all" && !r.classNames.includes(classFilter)) return false;
    if (searchQuery.trim() && !r.member.name.includes(searchQuery.trim())) return false;
    return true;
  });

  const visibleDraftRows = visibleRows.filter((r) => r.journal?.status === "draft");

  function toggleSelect(journalId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(journalId)) next.delete(journalId);
      else next.add(journalId);
      return next;
    });
  }
  function toggleSelectAllDrafts() {
    if (selectedIds.size === visibleDraftRows.length && visibleDraftRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleDraftRows.map((r) => r.journal.id)));
    }
  }

  async function publishIds(ids) {
    if (ids.length === 0) return;
    setPublishing(true);
    setErrorMsg("");
    const { error } = await supabase
      .from("growth_journals")
      .update({ status: "published", published_at: new Date().toISOString() })
      .in("id", ids);
    if (error) {
      setErrorMsg("발행 실패: " + error.message);
      setPublishing(false);
      return;
    }
    await loadData(selectedMonth);
    setPublishing(false);
  }
  function handlePublishSelected() {
    publishIds(Array.from(selectedIds));
  }
  function handlePublishAllDrafts() {
    publishIds(visibleDraftRows.map((r) => r.journal.id));
  }

  if (loading) return <LoadingScreen />;

  const TABS = [
    { key: "all", label: "전체", count: rows.length },
    { key: "written", label: "작성완료", count: writtenCount },
    { key: "pending", label: "작성 대기", count: notWrittenCount },
  ];

  return (
    <main style={{ background: "#f3f7fc", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <Link href="/dashboard" style={{ color: "#1b3a63", display: "flex" }}>
          <BackIcon />
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>월간 성장일지</div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        {errorMsg && (
          <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
            {errorMsg}
          </div>
        )}

        {/* 필터 바: 월 / 반 / 검색 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: 10,
              border: "1px solid #dbe4ee",
              fontSize: 13,
              fontWeight: 700,
              color: "#1b3a63",
              background: "white",
            }}
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: 10,
              border: "1px solid #dbe4ee",
              fontSize: 13,
              fontWeight: 700,
              color: "#1b3a63",
              background: "white",
            }}
          >
            <option value="all">전체 클래스</option>
            {classOptions.map((cn) => (
              <option key={cn} value={cn}>
                {cn}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "white",
            border: "1px solid #dbe4ee",
            borderRadius: 10,
            padding: "9px 12px",
            marginBottom: 14,
          }}
        >
          <SearchIcon />
          <input
            type="text"
            placeholder="선수 이름 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: 13, flex: 1 }}
          />
        </div>

        {/* 요약: 도넛차트 + 마감일 */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div
            style={{
              flex: 1.3,
              background: "white",
              borderRadius: 16,
              padding: 16,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <StatusDonut writtenCount={writtenCount} totalCount={rows.length} />
            <div>
              <div style={{ fontSize: 12, color: "#9aa7b8", fontWeight: 700, marginBottom: 6 }}>전체 작성 현황</div>
              <div style={{ display: "flex", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>{rows.length}</div>
                  <div style={{ fontSize: 10, color: "#9aa7b8" }}>전체 선수</div>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: GREEN }}>{writtenCount}</div>
                  <div style={{ fontSize: 10, color: "#9aa7b8" }}>작성완료</div>
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: ORANGE }}>{notWrittenCount}</div>
                  <div style={{ fontSize: 10, color: "#9aa7b8" }}>작성 대기</div>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              background: "white",
              borderRadius: 16,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 12, color: "#9aa7b8", fontWeight: 700, marginBottom: 6 }}>마감일</div>
            {lastDay && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>{formatDeadlineDate(lastDay)}</div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "#fdecec",
                    color: "#b3261e",
                  }}
                >
                  {deadlineLabel(lastDay)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 탭 필터 */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: activeTab === t.key ? "none" : "1px solid #dbe4ee",
                background: activeTab === t.key ? BLUE : "white",
                color: activeTab === t.key ? "white" : "#4a5c73",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {/* 발행 액션 */}
        {visibleDraftRows.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "white",
              borderRadius: 14,
              padding: "12px 14px",
              marginBottom: 12,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1b3a63" }}>
              <input
                type="checkbox"
                checked={selectedIds.size === visibleDraftRows.length && visibleDraftRows.length > 0}
                onChange={toggleSelectAllDrafts}
              />
              전체 선택 ({selectedIds.size}/{visibleDraftRows.length})
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={selectedIds.size === 0 || publishing}
                onClick={handlePublishSelected}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: `1px solid ${BLUE}`,
                  background: "white",
                  color: BLUE,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: selectedIds.size === 0 || publishing ? "default" : "pointer",
                  opacity: selectedIds.size === 0 ? 0.5 : 1,
                }}
              >
                선택 발행
              </button>
              <button
                type="button"
                disabled={publishing}
                onClick={handlePublishAllDrafts}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: BLUE,
                  color: "white",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: publishing ? "default" : "pointer",
                }}
              >
                전체 발행
              </button>
            </div>
          </div>
        )}

        {/* 회원 목록 (테이블형) */}
        <div style={{ background: "white", borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
          {visibleRows.length === 0 && (
            <div style={{ padding: 20, fontSize: 13, color: "#8a97a8", textAlign: "center" }}>
              조건에 맞는 선수가 없습니다.
            </div>
          )}
          {visibleRows.map(({ member, journal, classNames, attended, total }, idx) => {
            const info = statusInfo(journal?.status);
            const isDraft = journal?.status === "draft";
            const lastModified = formatBerlinDateTime(journal?.updated_at);

            return (
              <div
                key={member.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderBottom: idx === visibleRows.length - 1 ? "none" : "1px solid #f0f4f8",
                }}
              >
                {isDraft ? (
                  <input type="checkbox" checked={selectedIds.has(journal.id)} onChange={() => toggleSelect(journal.id)} />
                ) : (
                  <div style={{ width: 16, flexShrink: 0 }} />
                )}

                {member.profile_image_url ? (
                  <img
                    src={member.profile_image_url}
                    alt={member.name}
                    style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      background: "#eaf3fb",
                      color: BLUE,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {member.name?.[0] || "?"}
                  </div>
                )}

                <div style={{ flex: 1.4, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>{member.name}</div>
                  <div style={{ fontSize: 11, color: "#9aa7b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {classNames.join(" / ") || "배정된 반 없음"}
                  </div>
                </div>

                <div style={{ flex: 0.7, fontSize: 11, color: "#4a5c73", textAlign: "center" }}>
                  {getRegionLabel(member.region) || "-"}
                </div>

                <div style={{ flex: 0.7, fontSize: 12, fontWeight: 700, color: "#1b3a63", textAlign: "center" }}>
                  {attended}/{total}회
                </div>

                <div style={{ flex: 0.9, textAlign: "center" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 9px",
                      borderRadius: 999,
                      background: info.bg,
                      color: info.color,
                    }}
                  >
                    {info.label}
                  </span>
                  {!journal && lastDay && (
                    <div style={{ fontSize: 10, color: "#b3261e", fontWeight: 700, marginTop: 3 }}>
                      {deadlineLabel(lastDay)}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, fontSize: 10, color: "#9aa7b8", textAlign: "center" }}>
                  {lastModified ? (
                    <>
                      {lastModified}
                      <br />
                      (독일시간)
                    </>
                  ) : (
                    "-"
                  )}
                </div>

                <Link
                  href={`/coach/growth-journal?memberId=${member.id}&yearMonth=${selectedMonth}`}
                  style={{
                    flexShrink: 0,
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: `1px solid ${BLUE}`,
                    background: journal ? "white" : BLUE,
                    color: journal ? BLUE : "white",
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {journal ? "보기" : "작성하기"}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

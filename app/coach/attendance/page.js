"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

function AttendanceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionInfo, setSessionInfo] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [remainingByMember, setRemainingByMember] = useState({});
  const [updatingId, setUpdatingId] = useState(null);
  const [editingBookingId, setEditingBookingId] = useState(null);

  async function loadData() {
    setErrorMsg("");

    if (!sessionId) {
      setErrorMsg("세션 정보가 없습니다.");
      setLoading(false);
      return;
    }

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

    if (!profile || (profile.role !== "coach" && profile.role !== "admin")) {
      router.push("/dashboard");
      return;
    }

    const { data: session } = await supabase
      .from("class_sessions")
      .select("id, session_date, start_time, end_time, classes(class_name)")
      .eq("id", sessionId)
      .single();

    setSessionInfo(session);

    const { data: bookingData, error } = await supabase
      .from("bookings")
      .select("id, status, member_id, members(name)")
      .eq("class_session_id", sessionId)
      .neq("status", "cancelled_prior")
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMsg("예약자 목록을 불러오지 못했습니다: " + error.message);
      setLoading(false);
      return;
    }

    setBookings(bookingData || []);

    const memberIds = [...new Set((bookingData || []).map((b) => b.member_id))];

    if (memberIds.length > 0) {
      const { data: membershipData } = await supabase
        .from("memberships")
        .select(
          "member_id, sessions_used, status, start_date, membership_plans(sessions_per_month)"
        )
        .in("member_id", memberIds)
        .eq("status", "active")
        .order("start_date", { ascending: false });

      const map = {};
      (membershipData || []).forEach((m) => {
        if (map[m.member_id] !== undefined) return;
        const total = m.membership_plans?.sessions_per_month || 0;
        map[m.member_id] = total - m.sessions_used;
      });
      setRemainingByMember(map);
    } else {
      setRemainingByMember({});
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleSetStatus(bookingId, status) {
    setUpdatingId(bookingId);
    await supabase.from("bookings").update({ status }).eq("id", bookingId);
    setEditingBookingId(null);
    await loadData();
    setUpdatingId(null);
  }

  if (loading) {
    return (
      <main className="page">
        <div className="subtitle">불러오는 중...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">
        {sessionInfo?.session_date} {sessionInfo?.start_time?.slice(0, 5)} ·{" "}
        {sessionInfo?.classes?.class_name} 출석 체크
      </div>

      <div className="card">
        {errorMsg && <div className="message error">{errorMsg}</div>}

        {bookings.length === 0 && !errorMsg && (
          <p style={{ fontSize: 14, color: "#777" }}>
            이 수업에 출석체크할 회원이 없습니다.
          </p>
        )}

        {bookings.map((b) => {
          const remaining = remainingByMember[b.member_id];
          const isSameDayCancel = b.status === "cancelled_same_day";
          const isDecided = b.status === "attended" || b.status === "absent";
          const showButtons =
            !isSameDayCancel && (!isDecided || editingBookingId === b.id);

          return (
            <div
              key={b.id}
              style={{
                padding: "14px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 700 }}>
                    {b.members?.name || "(알 수 없음)"}
                  </span>

                  {!showButtons && b.status === "attended" && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#0b3d2e",
                      }}
                    >
                      <span style={{ color: "#2e7d32" }}>●</span> 출석
                    </span>
                  )}

                  {!showButtons && b.status === "absent" && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#b3261e",
                      }}
                    >
                      <span>✕</span> 결석
                    </span>
                  )}

                  {isSameDayCancel && (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#999",
                      }}
                    >
                      당일취소
                    </span>
                  )}
                </div>

                {remaining !== undefined && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: remaining > 0 ? "#0b3d2e" : "#b3261e",
                      background: remaining > 0 ? "#e8f5ec" : "#fdecec",
                      padding: "4px 10px",
                      borderRadius: 999,
                      whiteSpace: "nowrap",
                    }}
                  >
                    잔여 {remaining}회
                  </div>
                )}
              </div>

              {showButtons && (
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    disabled={updatingId === b.id}
                    onClick={() => handleSetStatus(b.id, "attended")}
                    style={{
                      flex: 1,
                      padding: "12px 0",
                      fontSize: 14,
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      background:
                        b.status === "attended" ? "#0b3d2e" : "white",
                      color: b.status === "attended" ? "white" : "#0b3d2e",
                    }}
                  >
                    ✓ 출석
                  </button>
                  <button
                    type="button"
                    disabled={updatingId === b.id}
                    onClick={() => handleSetStatus(b.id, "absent")}
                    style={{
                      flex: 1,
                      padding: "12px 0",
                      fontSize: 14,
                      fontWeight: 700,
                      border: "none",
                      borderLeft: "1px solid #ddd",
                      cursor: "pointer",
                      background: b.status === "absent" ? "#b3261e" : "white",
                      color: b.status === "absent" ? "white" : "#b3261e",
                    }}
                  >
                    ✕ 결석
                  </button>
                </div>
              )}

              {!showButtons && isDecided && (
                <button
                  type="button"
                  onClick={() => setEditingBookingId(b.id)}
                  style={{
                    marginTop: 8,
                    padding: "6px 14px",
                    fontSize: 13,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    background: "white",
                    color: "#333",
                    cursor: "pointer",
                  }}
                >
                  수정
                </button>
              )}
            </div>
          );
        })}

        <div className="link-row">
          <Link href="/coach">← 코치 홈으로</Link>
        </div>
      </div>
    </main>
  );
}

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <main className="page">
          <div className="subtitle">불러오는 중...</div>
        </main>
      }
    >
      <AttendanceInner />
    </Suspense>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const STATUS_LABEL = {
  booked: "미체크",
  attended: "출석",
  absent: "결석",
  cancelled_prior: "취소 (전날)",
  cancelled_same_day: "취소 (당일)",
};

function AttendanceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionInfo, setSessionInfo] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);

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
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMsg("예약자 목록을 불러오지 못했습니다: " + error.message);
      setLoading(false);
      return;
    }

    setBookings(bookingData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleSetStatus(bookingId, status) {
    setUpdatingId(bookingId);
    await supabase.from("bookings").update({ status }).eq("id", bookingId);
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
            이 수업에 예약한 회원이 없습니다.
          </p>
        )}

        {bookings.map((b) => (
          <div
            key={b.id}
            style={{
              padding: "14px 0",
              borderBottom: "1px solid #eee",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {b.members?.name || "(알 수 없음)"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#777",
                marginTop: 4,
                marginBottom: 10,
              }}
            >
              현재 상태: {STATUS_LABEL[b.status] || b.status}
            </div>

            {(b.status === "booked" ||
              b.status === "attended" ||
              b.status === "absent") && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  style={{
                    padding: "10px 16px",
                    fontSize: 14,
                    border: "none",
                    borderRadius: 8,
                    background: "#0b3d2e",
                    color: "white",
                    cursor: "pointer",
                  }}
                  disabled={updatingId === b.id}
                  onClick={() => handleSetStatus(b.id, "attended")}
                >
                  출석
                </button>
                <button
                  type="button"
                  style={{
                    padding: "10px 16px",
                    fontSize: 14,
                    border: "1px solid #b3261e",
                    borderRadius: 8,
                    background: "white",
                    color: "#b3261e",
                    cursor: "pointer",
                  }}
                  disabled={updatingId === b.id}
                  onClick={() => handleSetStatus(b.id, "absent")}
                >
                  결석
                </button>
              </div>
            )}
          </div>
        ))}

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

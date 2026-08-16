"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

const STATUS_LABEL = {
  booked: "예약됨",
  attended: "출석 완료",
  absent: "결석",
  cancelled_prior: "취소 (전날 이전)",
  cancelled_same_day: "취소 (당일)",
};

function formatTime(t) {
  if (!t) return "";
  return t.slice(0, 5);
}

export default function MyBookingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function load() {
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

      if (!guardian) {
        setErrorMsg("보호자 정보를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      const { data: myMembers } = await supabase
        .from("members")
        .select("id, name")
        .eq("guardian_id", guardian.id);

      const memberIds = (myMembers || []).map((m) => m.id);
      const memberNameMap = {};
      (myMembers || []).forEach((m) => (memberNameMap[m.id] = m.name));

      if (memberIds.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }

      const { data: bookingData, error } = await supabase
        .from("bookings")
        .select(
          "id, status, member_id, class_sessions(session_date, classes(class_name, age_group, start_time, end_time))"
        )
        .in("member_id", memberIds)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMsg("예약 목록을 불러오지 못했습니다: " + error.message);
        setLoading(false);
        return;
      }

      const withNames = (bookingData || []).map((b) => ({
        ...b,
        memberName: memberNameMap[b.member_id],
      }));

      setBookings(withNames);
      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <main className="page">
        <div className="subtitle">불러오는 중...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">내 예약</div>
      <div className="subtitle">자녀들의 전체 예약 내역입니다.</div>

      <div className="card">
        {errorMsg && <div className="message error">{errorMsg}</div>}

        {bookings.length === 0 && !errorMsg && (
          <p style={{ marginTop: 0, fontSize: 15, color: "#555" }}>
            예약 내역이 없습니다.
          </p>
        )}

        {bookings.map((b) => {
          const cls = b.class_sessions?.classes;
          return (
            <div key={b.id} className="list-row" style={{ display: "block" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {b.memberName} · {cls?.class_name}
                {cls?.age_group ? ` (${cls.age_group})` : ""}
              </div>
              <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
                {b.class_sessions?.session_date} {formatTime(cls?.start_time)}
                ~{formatTime(cls?.end_time)}
              </div>
              <div style={{ fontSize: 13, color: "#0b3d2e", marginTop: 4, fontWeight: 700 }}>
                {STATUS_LABEL[b.status] || b.status}
              </div>
            </div>
          );
        })}

        <div className="link-row">
          <Link href="/members">← 자녀 관리로</Link>
        </div>
      </div>
    </main>
  );
}

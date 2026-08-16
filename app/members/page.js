"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

function formatBirthDate(dateStr) {
  if (!dateStr) return "";
  return dateStr;
}

export default function MembersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
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

      const { data: guardian, error: guardianError } = await supabase
        .from("guardians")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (guardianError || !guardian) {
        setErrorMsg("보호자 정보를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      const { data: memberList, error: memberError } = await supabase
        .from("members")
        .select("id, name, birth_date, gender, status")
        .eq("guardian_id", guardian.id)
        .order("created_at", { ascending: true });

      if (memberError) {
        setErrorMsg("자녀 목록을 불러오지 못했습니다: " + memberError.message);
        setLoading(false);
        return;
      }

      setMembers(memberList || []);
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
      <div className="brand">Double J Sports</div>
      <div className="subtitle">자녀 관리</div>

      <div className="card">
        {errorMsg && <div className="message error">{errorMsg}</div>}

        {members.length === 0 && !errorMsg && (
          <p style={{ marginTop: 0, fontSize: 15, color: "#555" }}>
            아직 등록된 자녀가 없습니다. 아래 버튼으로 자녀를 등록해주세요.
          </p>
        )}

        {members.map((m) => (
          <div
            key={m.id}
            style={{
              padding: "14px 0",
              borderBottom: "1px solid #eee",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700 }}>{m.name}</div>
            <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
              생년월일: {formatBirthDate(m.birth_date) || "미입력"}
            </div>
            <Link href={`/members/${m.id}/book`}>
              <button className="small-btn" style={{ marginTop: 10 }}>
                수업 예약하기
              </button>
            </Link>
          </div>
        ))}

        <Link href="/members/new">
          <button className="primary">+ 자녀 등록</button>
        </Link>

        <div className="link-row">
          <Link href="/bookings">내 예약 보기</Link>
        </div>

        <div className="link-row">
          <Link href="/dashboard">← 홈으로 돌아가기</Link>
        </div>
      </div>
    </main>
  );
}

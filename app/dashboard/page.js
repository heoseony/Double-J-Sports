"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [guardianName, setGuardianName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function loadUser() {
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
        .select("name")
        .eq("user_id", user.id)
        .single();

      if (guardian) {
        setGuardianName(guardian.name);
      }

      setLoading(false);
    }

    loadUser();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
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
      <div className="subtitle">환영합니다, {guardianName || email}님</div>

      <div className="card">
        <p style={{ marginTop: 0, fontSize: 15, lineHeight: 1.6 }}>
          로그인이 정상적으로 완료되었습니다.
          <br />
          이 화면은 앞으로 자녀 등록, 수업 예약, 잔여 횟수 확인 등의 기능이
          채워질 자리입니다.
        </p>

        <button className="primary" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    </main>
  );
}

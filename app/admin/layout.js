"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [status, setStatus] = useState("checking"); // checking | ok | denied

  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || !profile || profile.role !== "admin") {
        setStatus("denied");
        return;
      }

      setStatus("ok");
    }

    check();
  }, [router]);

  if (status === "checking") {
    return (
      <main className="page">
        <div className="subtitle">권한 확인 중...</div>
      </main>
    );
  }

  if (status === "denied") {
    return (
      <main className="page">
        <div className="brand">Double J Sports</div>
        <div className="card">
          <p style={{ marginTop: 0 }}>
            이 페이지는 관리자만 접근할 수 있습니다.
          </p>
          <Link href="/dashboard">
            <button className="primary">홈으로 돌아가기</button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div>
      <div className="admin-nav">
        <Link href="/admin">관리자 홈</Link>
        <Link href="/admin/classes">수업 관리</Link>
        <Link href="/admin/members">회원 관리</Link>
      </div>
      {children}
    </div>
  );
}

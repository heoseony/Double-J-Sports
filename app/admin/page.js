"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function AdminHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function check() {
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

      setIsAdmin(true);
      setLoading(false);
    }

    check();
  }, [router]);

  if (loading || !isAdmin) {
    return (
      <main className="page">
        <div className="subtitle">확인 중...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">관리자 화면</div>

      <div className="card">
        <Link href="/admin/classes">
          <button className="primary">수업 관리 (반복 스케줄)</button>
        </Link>

        <Link href="/admin/memberships">
          <button className="primary" style={{ marginTop: 12 }}>
            회원권 배정
          </button>
        </Link>

        <Link href="/admin/members">
          <button className="primary" style={{ marginTop: 12 }}>
            회원 검색 · 횟수 조정
          </button>
        </Link>

        <div className="link-row">
          <Link href="/dashboard">← 일반 화면으로 돌아가기</Link>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function MorePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoach, setIsCoach] = useState(false);

  useEffect(() => {
    async function load() {
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

      setIsAdmin(profile?.role === "admin");
      setIsCoach(profile?.role === "coach");
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

  const links = isAdmin
    ? [
        { label: "관리자 홈", href: "/admin" },
        { label: "결제 관리", href: "/admin/payments" },
        { label: "인보이스 관리", href: "/admin/invoices" },
        { label: "회원권 상품 관리", href: "/admin/plans" },
      ]
    : isCoach
    ? [{ label: "코치 화면 (주간 수업)", href: "/coach" }]
    : [
        { label: "자녀 관리", href: "/members" },
        { label: "인보이스 조회", href: "/invoices" },
      ];

  return (
    <main style={{ minHeight: "100vh", background: "#f3f7fc", paddingBottom: 90 }}>
      <div style={{ padding: "18px 18px 8px", fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
        더보기
      </div>

      <div style={{ padding: "8px 18px 0" }}>
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 6,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          {links.map((l) => (
            <Link key={l.href} href={l.href} style={{ textDecoration: "none" }}>
              <div
                style={{
                  padding: "14px 12px",
                  borderBottom: "1px solid #f0f3f8",
                  fontSize: 14,
                  color: "#33455e",
                  fontWeight: 600,
                }}
              >
                {l.label}
              </div>
            </Link>
          ))}
          <Link href="/notices" style={{ textDecoration: "none" }}>
            <div style={{ padding: "14px 12px", borderBottom: "1px solid #f0f3f8", fontSize: 14, color: "#33455e", fontWeight: 600 }}>
              공지사항
            </div>
          </Link>
          <Link href="/photos" style={{ textDecoration: "none" }}>
            <div style={{ padding: "14px 12px", fontSize: 14, color: "#33455e", fontWeight: 600 }}>
              갤러리
            </div>
          </Link>
        </div>

        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: 14,
            fontSize: 13,
            fontWeight: 700,
            color: "#b3261e",
            background: "white",
            border: "none",
            borderRadius: 16,
            cursor: "pointer",
            marginTop: 16,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          로그아웃
        </button>
      </div>
    </main>
  );
}

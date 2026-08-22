"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import LoadingScreen from "../components/LoadingScreen";

const BLUE = "#3B82C4";

const MENU_BY_ROLE = {
  guardian: [
    { label: "내 정보 관리", href: null },
    { label: "자녀 관리", href: "/members" },
    { label: "수업권 및 결제 정보", href: "/invoices" },
    { label: "예약 내역", href: null },
    { label: "공지사항", href: "/notices" },
    { label: "갤러리", href: "/photos" },
    { label: "자주 묻는 질문", href: null },
    { label: "문의하기", href: null },
  ],
  coach: [
    { label: "내 정보 관리", href: null },
    { label: "담당 클래스 관리", href: "/coach" },
    { label: "출석 관리 내역", href: null },
    { label: "수업 일정", href: "/coach" },
    { label: "갤러리 (업로드)", href: "/photos" },
    { label: "공지사항", href: "/notices" },
    { label: "문의하기", href: null },
  ],
  admin: [
    { label: "수업 관리", href: "/admin/classes" },
    { label: "예약 관리", href: null },
    { label: "출석 관리", href: "/admin/attendance" },
    { label: "회원 관리", href: "/admin/members" },
    { label: "결제 관리", href: "/admin/payments" },
    { label: "인보이스 관리", href: "/admin/invoices" },
    { label: "회원권 상품 관리", href: "/admin/plans" },
    { label: "공지사항 관리", href: "/notices" },
    { label: "갤러리 관리", href: "/photos" },
    { label: "운영 통계", href: null },
  ],
};

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function MorePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("guardian");
  const [profileName, setProfileName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email);

      const { data: profile } = await supabase
        .from("users")
        .select("role, name")
        .eq("id", user.id)
        .single();

      const r =
        profile?.role === "admin"
          ? "admin"
          : profile?.role === "coach"
          ? "coach"
          : "guardian";
      setRole(r);

      if (r === "admin") {
        setProfileName("관리자 계정");
      } else if (r === "coach") {
        setProfileName(profile?.name || user.email);
      } else {
        const { data: guardian } = await supabase
          .from("guardians")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (guardian) {
          const { data: firstChild } = await supabase
            .from("members")
            .select("name")
            .eq("guardian_id", guardian.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          setProfileName(
            firstChild ? `${firstChild.name} 학부모님` : "학부모님"
          );
        } else {
          setProfileName(user.email);
        }
      }

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
      <LoadingScreen />
    );
  }

  const menu = MENU_BY_ROLE[role] || MENU_BY_ROLE.guardian;

  return (
    <main style={{ background: "#f3f7fc", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ padding: "18px 18px 8px", fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
        더보기
      </div>

      <div style={{ padding: "8px 18px 0" }}>
        {/* 프로필 카드 */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: BLUE,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {profileName?.[0] || "D"}
          </div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>
              {profileName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#8ea0b8",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {email}
            </div>
          </div>
        </div>

        {/* 메뉴 목록 */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 16,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          {menu.map((m, i) => {
            const isLast = i === menu.length - 1;
            const rowStyle = {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "15px 16px",
              borderBottom: isLast ? "none" : "1px solid #f0f3f8",
              fontSize: 14,
            };

            if (!m.href) {
              return (
                <div
                  key={m.label}
                  style={{ ...rowStyle, color: "#c2cbd9", cursor: "not-allowed" }}
                >
                  <span>{m.label}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: "#f0f3f8",
                      color: "#aab9cc",
                      padding: "3px 8px",
                      borderRadius: 999,
                    }}
                  >
                    준비중
                  </span>
                </div>
              );
            }

            return (
              <Link key={m.label} href={m.href} style={{ textDecoration: "none" }}>
                <div style={{ ...rowStyle, color: "#33455e", fontWeight: 600 }}>
                  <span>{m.label}</span>
                  <span style={{ color: "#c2cbd9" }}>
                    <ChevronRight />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 설정 */}
        <div
          style={{
            background: "white",
            borderRadius: 16,
            overflow: "hidden",
            marginBottom: 16,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "15px 16px",
              fontSize: 14,
              color: "#c2cbd9",
              cursor: "not-allowed",
            }}
          >
            <span>알림 설정</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: "#f0f3f8",
                color: "#aab9cc",
                padding: "3px 8px",
                borderRadius: 999,
              }}
            >
              준비중
            </span>
          </div>
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
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          로그아웃
        </button>

        <div
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "#c2cbd9",
            marginTop: 16,
          }}
        >
          버전 1.0.0
        </div>
      </div>
    </main>
  );
}

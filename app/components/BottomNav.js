"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const HIDDEN_PATHS = ["/login", "/signup", "/auth"];
const BLUE = "#3B82C4";

function HomeIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}
function CalendarIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function CheckCircleIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.3 2.3L16 10" />
    </svg>
  );
}
function ImageIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
function PeopleIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="17.2" cy="8.5" r="2.4" />
      <path d="M15 14.2c2.7.3 4.5 2.3 4.5 5.3" />
    </svg>
  );
}
function MenuIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

const NAV_BY_ROLE = {
  guardian: [
    { label: "홈", href: "/dashboard", Icon: HomeIcon },
    { label: "수업예약", href: "/members", Icon: CalendarIcon },
    { label: "갤러리", href: "/photos", Icon: ImageIcon },
    { label: "출석체크", href: "/dashboard", Icon: CheckCircleIcon },
    { label: "더보기", href: "/more", Icon: MenuIcon },
  ],
  coach: [
    { label: "홈", href: "/dashboard", Icon: HomeIcon },
    { label: "출석체크", href: "/coach", Icon: CheckCircleIcon },
    { label: "수업관리", href: "/coach", Icon: CalendarIcon },
    { label: "갤러리", href: "/photos", Icon: ImageIcon },
    { label: "더보기", href: "/more", Icon: MenuIcon },
  ],
  admin: [
    { label: "홈", href: "/dashboard", Icon: HomeIcon },
    { label: "예약관리", href: "/admin/classes", Icon: CalendarIcon },
    { label: "출석관리", href: "/admin/attendance", Icon: CheckCircleIcon },
    { label: "회원관리", href: "/admin/members", Icon: PeopleIcon },
    { label: "더보기", href: "/more", Icon: MenuIcon },
  ],
};

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState("guardian");

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!cancelled && profile?.role) {
        setRole(
          profile.role === "admin"
            ? "admin"
            : profile.role === "coach"
            ? "coach"
            : "guardian"
        );
      }
    }

    loadRole();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (HIDDEN_PATHS.some((p) => pathname?.startsWith(p))) {
    return null;
  }

  const items = NAV_BY_ROLE[role] || NAV_BY_ROLE.guardian;

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        display: "flex",
        alignItems: "center",
        borderTop: "1px solid #e5eaf2",
        background: "white",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2px)",
        paddingTop: 4,
        zIndex: 50,
      }}
    >
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname?.startsWith(item.href);
        const color = active ? BLUE : "#9aa8bc";

        return (
          <button
            key={item.label}
            type="button"
            onClick={() => router.push(item.href)}
            style={{
              flex: 1,
              padding: "4px 0 6px",
              border: "none",
              background: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              color,
            }}
          >
            <item.Icon />
            <span style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

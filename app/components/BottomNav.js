"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../lib/i18n/LanguageContext";

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
function ListIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
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

function getNavByRole(t) {
  return {
  guardian: [
    { label: t("nav.home"), key: "home", href: "/dashboard", Icon: HomeIcon },
    { label: t("nav.bookClass"), key: "bookClass", href: "/members", Icon: CalendarIcon },
    { label: t("nav.gallery"), key: "gallery", href: "/photos", Icon: ImageIcon },
    { label: t("nav.bookings"), key: "bookings", href: "/dashboard", Icon: ListIcon },
    { label: t("nav.more"), key: "more", href: "/more", Icon: MenuIcon },
  ],
  coach: [
    { label: "홈", href: "/dashboard", Icon: HomeIcon },
    { label: "수업관리", href: "/coach", Icon: CalendarIcon },
    { label: "프로필 변경", href: "/coach/select-profile", Icon: PeopleIcon },
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
}

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [role, setRole] = useState("guardian");
  const [firstChildId, setFirstChildId] = useState(null);

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

      if (profile?.role !== "admin" && profile?.role !== "coach") {
        const { data: guardian } = await supabase
          .from("guardians")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (guardian) {
          const { data: child } = await supabase
            .from("members")
            .select("id")
            .eq("guardian_id", guardian.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (!cancelled && child) setFirstChildId(child.id);
        }
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

  const navByRole = getNavByRole(t);
  const items = navByRole[role] || navByRole.guardian;
  const resolvedItems = items.map((item) =>
    item.key === "bookings" && firstChildId
      ? { ...item, href: `/members/${firstChildId}/reservations` }
      : item
  );

  // 여러 탭이 같은 경로를 가리키는 경우(예: 코치의 "출석체크"/"수업관리"가 둘 다 /coach)
  // 동시에 활성화되지 않도록, 정확히 하나의 탭만 활성 상태로 고른다.
  const matchingIndexes = resolvedItems
    .map((item, i) => ({ i, href: item.href }))
    .filter(({ href }) => (href === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(href)));
  matchingIndexes.sort((a, b) => b.href.length - a.href.length);
  const activeIndex = matchingIndexes.length > 0 ? matchingIndexes[0].i : -1;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        alignItems: "center",
        borderTop: "1px solid #e5eaf2",
        background: "white",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
        paddingTop: 10,
        zIndex: 50,
      }}
    >
      {resolvedItems.map((item, i) => {
        const active = i === activeIndex;
        const color = item.disabled ? "#c2cbd9" : active ? BLUE : "#9aa8bc";

        return (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled || !item.href) return;
              router.push(item.href);
            }}
            style={{
              flex: 1,
              padding: "6px 0 8px",
              border: "none",
              background: "none",
              cursor: item.disabled ? "default" : "pointer",
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

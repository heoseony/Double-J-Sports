"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import LoadingScreen from "../../components/LoadingScreen";

const BLUE = "#3B82C4";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function NoticeDetailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const noticeId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notice, setNotice] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [deleting, setDeleting] = useState(false);

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

      if (profile?.role === "admin") {
        setIsAdmin(true);
      }

      if (!noticeId) {
        setErrorMsg("공지사항 정보를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("notices")
        .select("id, title, content, created_at")
        .eq("id", noticeId)
        .single();

      if (error || !data) {
        setErrorMsg("공지사항을 불러오지 못했습니다.");
        setLoading(false);
        return;
      }

      setNotice(data);
      setLoading(false);
    }

    load();
  }, [router, noticeId]);

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("notices").delete().eq("id", noticeId);
    router.push("/notices");
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  return (
    <main
      style={{
        background: "#f3f7fc",
        minHeight: "100vh",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "18px 18px 4px",
        }}
      >
        <Link href="/notices" style={{ color: "#1b3a63", display: "flex" }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          공지사항
        </div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          {errorMsg && (
            <div
              style={{
                background: "#fdecec",
                color: "#b3261e",
                padding: 12,
                borderRadius: 10,
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {errorMsg}
            </div>
          )}

          {notice && (
            <>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#1b3a63" }}>
                {notice.title}
              </div>
              <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 6 }}>
                {formatDate(notice.created_at)}
              </div>

              <p
                style={{
                  fontSize: 15,
                  color: "#33455e",
                  marginTop: 18,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {notice.content}
              </p>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    marginTop: 20,
                    fontSize: 13,
                    fontWeight: 700,
                    border: "1px solid #f3c6c2",
                    color: "#b3261e",
                    background: "white",
                    borderRadius: 10,
                    padding: "10px 16px",
                    cursor: deleting ? "default" : "pointer",
                  }}
                >
                  {deleting ? "삭제 중..." : "삭제"}
                </button>
              )}
            </>
          )}
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/notices" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 공지사항 목록으로
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function NoticeDetailPage() {
  return (
    <Suspense
      fallback={
        <LoadingScreen />
      }
    >
      <NoticeDetailInner />
    </Suspense>
  );
}

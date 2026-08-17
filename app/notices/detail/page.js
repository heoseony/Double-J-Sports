"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

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
      <main className="page">
        <div className="subtitle">불러오는 중...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">공지사항</div>

      <div className="card">
        {errorMsg && <div className="message error">{errorMsg}</div>}

        {notice && (
          <>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {notice.title}
            </div>
            <div style={{ fontSize: 13, color: "#999", marginTop: 6 }}>
              {formatDate(notice.created_at)}
            </div>

            <p
              style={{
                fontSize: 15,
                color: "#333",
                marginTop: 20,
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
                  border: "1px solid #b3261e",
                  color: "#b3261e",
                  background: "white",
                  borderRadius: 8,
                  padding: "8px 14px",
                  cursor: "pointer",
                }}
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            )}
          </>
        )}

        <div className="link-row">
          <Link href="/notices">← 공지사항 목록으로</Link>
        </div>
      </div>
    </main>
  );
}

export default function NoticeDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="page">
          <div className="subtitle">불러오는 중...</div>
        </main>
      }
    >
      <NoticeDetailInner />
    </Suspense>
  );
}

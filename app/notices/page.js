"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function NoticesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notices, setNotices] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadNotices() {
    const { data, error } = await supabase
      .from("notices")
      .select("id, title, content, created_at")
      .order("created_at", { ascending: false });

    if (!error) {
      setNotices(data || []);
    } else {
      setErrorMsg("공지사항을 불러오지 못했습니다: " + error.message);
    }
  }

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

      await loadNotices();
      setLoading(false);
    }

    load();
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title || !content) return;

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("notices").insert({
      title,
      content,
      created_by: user.id,
    });

    setSaving(false);

    if (!error) {
      setTitle("");
      setContent("");
      setShowForm(false);
      await loadNotices();
    }
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

      {isAdmin && (
        <div className="card" style={{ marginBottom: 20 }}>
          {!showForm ? (
            <button className="primary" onClick={() => setShowForm(true)}>
              + 공지 작성
            </button>
          ) : (
            <form onSubmit={handleSubmit}>
              <label>제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="공지 제목"
              />

              <label>내용</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="공지 내용을 입력하세요"
                rows={5}
                style={{
                  width: "100%",
                  padding: 14,
                  fontSize: 15,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  background: "#fafafa",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="primary" type="submit" disabled={saving}>
                  {saving ? "등록 중..." : "등록"}
                </button>
                <button
                  type="button"
                  className="primary"
                  style={{ background: "#999" }}
                  onClick={() => setShowForm(false)}
                >
                  취소
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {errorMsg && <div className="message error">{errorMsg}</div>}

      {notices.length === 0 && !errorMsg && (
        <div className="card">
          <p style={{ fontSize: 14, color: "#777", margin: 0 }}>
            아직 등록된 공지사항이 없습니다.
          </p>
        </div>
      )}

      {notices.map((n) => (
        <Link key={n.id} href={`/notices/detail?id=${n.id}`}>
          <div className="card" style={{ marginBottom: 14, cursor: "pointer" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>
                {n.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#999",
                  whiteSpace: "nowrap",
                  marginLeft: 10,
                }}
              >
                {formatDate(n.created_at)}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </main>
  );
}

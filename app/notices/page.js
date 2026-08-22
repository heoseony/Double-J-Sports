"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

const BLUE = "#3B82C4";

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
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div style={{ fontSize: 14, color: "#5b7699" }}>불러오는 중...</div>
      </main>
    );
  }

  const labelStyle = {
    fontSize: 13,
    fontWeight: 700,
    color: "#1b3a63",
    display: "block",
    marginBottom: 6,
  };

  const inputStyle = {
    width: "100%",
    padding: 14,
    fontSize: 15,
    border: "1px solid #e5eaf2",
    borderRadius: 10,
    background: "#f7fafd",
    boxSizing: "border-box",
    fontFamily: "inherit",
    marginBottom: 12,
  };

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
          justifyContent: "center",
          gap: 10,
          padding: "18px 18px 14px",
        }}
      >
        <img
          src="/logo-main.png"
          alt="로고"
          style={{ width: 28, height: 28, objectFit: "contain" }}
        />
        <div style={{ fontSize: 17, fontWeight: 800, color: "#1b3a63" }}>
          더블제이 축구 아카데미
        </div>
      </div>

      <div style={{ padding: "0 18px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63", marginBottom: 14 }}>
          공지사항
        </div>

        {isAdmin && (
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 18,
              marginBottom: 16,
              boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
            }}
          >
            {!showForm ? (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                style={{
                  width: "100%",
                  padding: 14,
                  fontSize: 15,
                  fontWeight: 700,
                  color: "white",
                  background: BLUE,
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                + 공지 작성
              </button>
            ) : (
              <form onSubmit={handleSubmit}>
                <label style={labelStyle}>제목</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="공지 제목"
                  style={inputStyle}
                />

                <label style={labelStyle}>내용</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="공지 내용을 입력하세요"
                  rows={5}
                  style={{
                    width: "100%",
                    padding: 14,
                    fontSize: 15,
                    border: "1px solid #e5eaf2",
                    borderRadius: 10,
                    background: "#f7fafd",
                    boxSizing: "border-box",
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />

                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: "12px 16px",
                      fontSize: 14,
                      fontWeight: 700,
                      border: "none",
                      borderRadius: 10,
                      background: saving ? "#9db8d6" : BLUE,
                      color: "white",
                      cursor: saving ? "default" : "pointer",
                    }}
                  >
                    {saving ? "등록 중..." : "등록"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    style={{
                      padding: "12px 16px",
                      fontSize: 14,
                      border: "1px solid #e5eaf2",
                      borderRadius: 10,
                      background: "white",
                      color: "#5b7699",
                      cursor: "pointer",
                    }}
                  >
                    취소
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

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

        {notices.length === 0 && !errorMsg && (
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: 18,
              boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
            }}
          >
            <p style={{ fontSize: 13, color: "#8ea0b8", margin: 0 }}>
              아직 등록된 공지사항이 없습니다.
            </p>
          </div>
        )}

        {notices.map((n) => (
          <Link key={n.id} href={`/notices/detail?id=${n.id}`} style={{ textDecoration: "none" }}>
            <div
              style={{
                background: "white",
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>
                  {n.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#8ea0b8",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatDate(n.created_at)}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

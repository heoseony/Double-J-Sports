"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const BLUE = "#3B82C4";

export default function GalleryCategoriesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState([]);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  async function loadCategories() {
    const { data, error } = await supabase
      .from("gallery_categories")
      .select("id, name, sort_order, is_active")
      .order("sort_order", { ascending: true });

    if (!error) {
      setCategories(data || []);
    }
  }

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
      await loadCategories();
      setLoading(false);
    }

    check();
  }, [router]);

  async function handleAdd(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("카테고리 이름을 입력해주세요.");
      return;
    }

    setSaving(true);
    const nextOrder =
      categories.length > 0
        ? Math.max(...categories.map((c) => c.sort_order)) + 1
        : 1;

    const { error } = await supabase.from("gallery_categories").insert({
      name: name.trim(),
      sort_order: nextOrder,
      is_active: true,
    });
    setSaving(false);

    if (error) {
      setErrorMsg("추가 실패: " + error.message);
      return;
    }

    setName("");
    await loadCategories();
  }

  function startEdit(c) {
    setEditingId(c.id);
    setEditName(c.name);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id) {
    setSavingEdit(true);
    const { error } = await supabase
      .from("gallery_categories")
      .update({ name: editName.trim() })
      .eq("id", id);
    setSavingEdit(false);

    if (!error) {
      setEditingId(null);
      await loadCategories();
    }
  }

  async function toggleActive(id, current) {
    setTogglingId(id);
    await supabase
      .from("gallery_categories")
      .update({ is_active: !current })
      .eq("id", id);
    await loadCategories();
    setTogglingId(null);
  }

  async function moveOrder(id, direction) {
    const idx = categories.findIndex((c) => c.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const a = categories[idx];
    const b = categories[swapIdx];

    await supabase
      .from("gallery_categories")
      .update({ sort_order: b.sort_order })
      .eq("id", a.id);
    await supabase
      .from("gallery_categories")
      .update({ sort_order: a.sort_order })
      .eq("id", b.id);

    await loadCategories();
  }

  if (loading || !isAdmin) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div style={{ fontSize: 14, color: "#5b7699" }}>확인 중...</div>
      </main>
    );
  }

  return (
    <main style={{ background: "#f3f7fc", minHeight: "100vh", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 4px" }}>
        <Link href="/admin" style={{ color: "#1b3a63", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>갤러리 카테고리 관리</div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 12 }}>
            새 카테고리 추가
          </div>
          <form onSubmit={handleAdd} style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 유아B"
              style={{ flex: 1, padding: 12, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 10, boxSizing: "border-box" }}
            />
            <button
              type="submit"
              disabled={saving}
              style={{ padding: "12px 18px", fontSize: 14, fontWeight: 700, color: "white", background: BLUE, border: "none", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {saving ? "추가 중..." : "추가"}
            </button>
          </form>
          {errorMsg && (
            <div style={{ fontSize: 13, color: "#b3261e", marginTop: 8 }}>{errorMsg}</div>
          )}
        </div>

        <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
          {categories.length === 0 && (
            <p style={{ fontSize: 14, color: "#8ea0b8", padding: 18, margin: 0 }}>
              등록된 카테고리가 없습니다.
            </p>
          )}

          {categories.map((c, idx) => {
            const isEditing = editingId === c.id;

            if (isEditing) {
              return (
                <div key={c.id} style={{ padding: 16, borderBottom: idx === categories.length - 1 ? "none" : "1px solid #f0f3f8", background: "#f8fafd" }}>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ width: "100%", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 10, boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => saveEdit(c.id)}
                      style={{ padding: "8px 14px", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 8, background: BLUE, color: "white", cursor: "pointer" }}
                    >
                      {savingEdit ? "저장 중..." : "저장"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      style={{ padding: "8px 14px", fontSize: 13, border: "1px solid #e5eaf2", borderRadius: 8, background: "white", cursor: "pointer" }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={c.id}
                style={{
                  padding: "14px 16px",
                  borderBottom: idx === categories.length - 1 ? "none" : "1px solid #f0f3f8",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: c.is_active ? 1 : 0.5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button
                      type="button"
                      onClick={() => moveOrder(c.id, "up")}
                      disabled={idx === 0}
                      style={{ border: "none", background: "none", color: idx === 0 ? "#e5eaf2" : "#8ea0b8", cursor: idx === 0 ? "default" : "pointer", padding: 0, fontSize: 12, lineHeight: "12px" }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveOrder(c.id, "down")}
                      disabled={idx === categories.length - 1}
                      style={{ border: "none", background: "none", color: idx === categories.length - 1 ? "#e5eaf2" : "#8ea0b8", cursor: idx === categories.length - 1 ? "default" : "pointer", padding: 0, fontSize: 12, lineHeight: "12px" }}
                    >
                      ▼
                    </button>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>{c.name}</span>
                  {!c.is_active && (
                    <span style={{ fontSize: 11, color: "#c2cbd9", fontWeight: 700 }}>비활성</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    style={{ padding: "6px 12px", fontSize: 12, border: "1px solid #e5eaf2", borderRadius: 8, background: "white", cursor: "pointer" }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    disabled={togglingId === c.id}
                    onClick={() => toggleActive(c.id, c.is_active)}
                    style={{
                      padding: "6px 12px", fontSize: 12, borderRadius: 8, cursor: "pointer",
                      border: c.is_active ? "1px solid #b3261e" : "1px solid " + BLUE,
                      color: c.is_active ? "#b3261e" : BLUE,
                      background: "white",
                    }}
                  >
                    {togglingId === c.id ? "처리 중..." : c.is_active ? "비활성화" : "활성화"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/admin" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 관리자 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}

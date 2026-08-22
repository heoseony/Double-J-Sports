"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const BLUE = "#3B82C4";

export default function CoachProfilesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profiles, setProfiles] = useState([]);

  const [name, setName] = useState("");
  const [profileType, setProfileType] = useState("coach");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("coach");
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("coach_profiles")
      .select("id, name, profile_type, is_active, created_at")
      .order("created_at", { ascending: true });

    if (!error) {
      setProfiles(data || []);
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
      await loadProfiles();
      setLoading(false);
    }

    check();
  }, [router]);

  async function handleAdd(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("이름을 입력해주세요.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("coach_profiles").insert({
      name: name.trim(),
      profile_type: profileType,
      is_active: true,
    });
    setSaving(false);

    if (error) {
      setErrorMsg("추가 실패: " + error.message);
      return;
    }

    setName("");
    setProfileType("coach");
    await loadProfiles();
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditType(p.profile_type);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id) {
    setSavingEdit(true);
    const { error } = await supabase
      .from("coach_profiles")
      .update({ name: editName.trim(), profile_type: editType })
      .eq("id", id);
    setSavingEdit(false);

    if (!error) {
      setEditingId(null);
      await loadProfiles();
    }
  }

  async function toggleActive(id, current) {
    setTogglingId(id);
    await supabase
      .from("coach_profiles")
      .update({ is_active: !current })
      .eq("id", id);
    await loadProfiles();
    setTogglingId(null);
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
        <Link href="/dashboard" style={{ color: "#1b3a63", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>코치/감독 프로필 관리</div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1b3a63", marginBottom: 12 }}>
            새 프로필 추가
          </div>
          <form onSubmit={handleAdd}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 이지훈, 정연황 감독"
              style={{ width: "100%", padding: 12, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 10, marginBottom: 10, boxSizing: "border-box" }}
            />

            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>구분</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setProfileType("coach")}
                style={{
                  flex: 1, padding: 10, fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: "pointer",
                  border: profileType === "coach" ? "none" : "1px solid #e5eaf2",
                  background: profileType === "coach" ? BLUE : "white",
                  color: profileType === "coach" ? "white" : "#5b7699",
                }}
              >
                코치 (공용계정 로그인 시 선택 가능)
              </button>
              <button
                type="button"
                onClick={() => setProfileType("director")}
                style={{
                  flex: 1, padding: 10, fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: "pointer",
                  border: profileType === "director" ? "none" : "1px solid #e5eaf2",
                  background: profileType === "director" ? BLUE : "white",
                  color: profileType === "director" ? "white" : "#5b7699",
                }}
              >
                감독 (배정 목록에만 표시)
              </button>
            </div>

            {errorMsg && (
              <div style={{ fontSize: 13, color: "#b3261e", marginBottom: 10 }}>{errorMsg}</div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{ width: "100%", padding: 13, fontSize: 14, fontWeight: 700, color: "white", background: BLUE, border: "none", borderRadius: 10, cursor: "pointer" }}
            >
              {saving ? "추가 중..." : "추가"}
            </button>
          </form>
        </div>

        <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
          {profiles.length === 0 && (
            <p style={{ fontSize: 14, color: "#8ea0b8", padding: 18, margin: 0 }}>
              등록된 프로필이 없습니다.
            </p>
          )}

          {profiles.map((p, idx) => {
            const isEditing = editingId === p.id;

            if (isEditing) {
              return (
                <div key={p.id} style={{ padding: 16, borderBottom: idx === profiles.length - 1 ? "none" : "1px solid #f0f3f8", background: "#f8fafd" }}>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ width: "100%", padding: 10, fontSize: 14, border: "1px solid #e5eaf2", borderRadius: 8, marginBottom: 8, boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <button
                      type="button"
                      onClick={() => setEditType("coach")}
                      style={{
                        flex: 1, padding: 8, fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: "pointer",
                        border: editType === "coach" ? "none" : "1px solid #e5eaf2",
                        background: editType === "coach" ? BLUE : "white",
                        color: editType === "coach" ? "white" : "#5b7699",
                      }}
                    >
                      코치
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditType("director")}
                      style={{
                        flex: 1, padding: 8, fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: "pointer",
                        border: editType === "director" ? "none" : "1px solid #e5eaf2",
                        background: editType === "director" ? BLUE : "white",
                        color: editType === "director" ? "white" : "#5b7699",
                      }}
                    >
                      감독
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => saveEdit(p.id)}
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
                key={p.id}
                style={{
                  padding: "14px 16px",
                  borderBottom: idx === profiles.length - 1 ? "none" : "1px solid #f0f3f8",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: p.is_active ? 1 : 0.5,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1b3a63" }}>{p.name}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: p.profile_type === "director" ? "#fff4e5" : "#e9f1fb",
                        color: p.profile_type === "director" ? "#c07a1e" : BLUE,
                      }}
                    >
                      {p.profile_type === "director" ? "감독" : "코치"}
                    </span>
                    {!p.is_active && (
                      <span style={{ fontSize: 11, color: "#c2cbd9", fontWeight: 700 }}>비활성</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    style={{ padding: "6px 12px", fontSize: 12, border: "1px solid #e5eaf2", borderRadius: 8, background: "white", cursor: "pointer" }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    disabled={togglingId === p.id}
                    onClick={() => toggleActive(p.id, p.is_active)}
                    style={{
                      padding: "6px 12px", fontSize: 12, borderRadius: 8, cursor: "pointer",
                      border: p.is_active ? "1px solid #b3261e" : "1px solid " + BLUE,
                      color: p.is_active ? "#b3261e" : BLUE,
                      background: "white",
                    }}
                  >
                    {togglingId === p.id ? "처리 중..." : p.is_active ? "비활성화" : "활성화"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", padding: "16px 18px", fontSize: 13 }}>
          <Link href="/dashboard" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 관리자 홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}

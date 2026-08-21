"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

const BLUE = "#3B82C4";
const ACTIVE_PROFILE_KEY = "double-j-sports-active-coach-profile";

export default function CoachSelectProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("coach_profiles")
      .select("id, name, profile_type, is_active")
      .eq("profile_type", "coach")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      setErrorMsg("프로필 목록을 불러오지 못했습니다: " + error.message);
    } else {
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

      if (!profile || profile.role !== "coach") {
        router.push("/dashboard");
        return;
      }

      await loadProfiles();
      setLoading(false);
    }

    check();
  }, [router]);

  function selectProfile(profile) {
    localStorage.setItem(
      ACTIVE_PROFILE_KEY,
      JSON.stringify({ id: profile.id, name: profile.name })
    );
    router.push("/dashboard");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!newName.trim()) {
      setErrorMsg("이름을 입력해주세요.");
      return;
    }

    setCreating(true);
    const { data, error } = await supabase
      .from("coach_profiles")
      .insert({ name: newName.trim(), profile_type: "coach", is_active: true })
      .select()
      .single();
    setCreating(false);

    if (error) {
      setErrorMsg("프로필 생성 실패: " + error.message);
      return;
    }

    selectProfile(data);
  }

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: 20 }}>
        <div style={{ fontSize: 14, color: "#5b7699" }}>불러오는 중...</div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f3f7fc", padding: "40px 20px" }}>
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1b3a63", marginBottom: 6 }}>
            누구로 접속하시나요?
          </div>
          <div style={{ fontSize: 13, color: "#8ea0b8" }}>
            본인 프로필을 선택해주세요
          </div>
        </div>

        {errorMsg && (
          <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectProfile(p)}
              style={{
                padding: 16,
                fontSize: 16,
                fontWeight: 700,
                color: "#1b3a63",
                background: "white",
                border: "1px solid #e5eaf2",
                borderRadius: 14,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
                textAlign: "left",
              }}
            >
              {p.name}
            </button>
          ))}

          {profiles.length === 0 && !showCreate && (
            <p style={{ fontSize: 13, color: "#8ea0b8", textAlign: "center" }}>
              아직 등록된 프로필이 없습니다. 아래에서 본인 프로필을 만들어주세요.
            </p>
          )}
        </div>

        {!showCreate ? (
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setErrorMsg("");
            }}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 14,
              fontWeight: 700,
              color: BLUE,
              background: "white",
              border: "1px dashed #b7d2ec",
              borderRadius: 14,
              cursor: "pointer",
            }}
          >
            + 내 프로필 새로 만들기
          </button>
        ) : (
          <form
            onSubmit={handleCreate}
            style={{
              background: "white",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
            }}
          >
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              내 이름
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 이지훈"
              style={{
                width: "100%",
                padding: 12,
                fontSize: 14,
                border: "1px solid #e5eaf2",
                borderRadius: 10,
                marginBottom: 10,
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={creating}
                style={{
                  flex: 1,
                  padding: 13,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "white",
                  background: BLUE,
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                {creating ? "만드는 중..." : "만들고 시작하기"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                style={{
                  padding: "13px 16px",
                  fontSize: 14,
                  border: "1px solid #e5eaf2",
                  borderRadius: 10,
                  background: "white",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

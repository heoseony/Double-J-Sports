"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import LoadingScreen from "../components/LoadingScreen";

const BLUE = "#3B82C4";

function formatBirthDate(dateStr) {
  if (!dateStr) return "";
  return dateStr;
}

export default function MembersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");

  const [editingNameEnId, setEditingNameEnId] = useState(null);
  const [nameEnDraft, setNameEnDraft] = useState("");
  const [savingNameEnId, setSavingNameEnId] = useState(null);
  const [nameEnMsg, setNameEnMsg] = useState("");

  async function loadMembers(guardianId) {
    const { data: memberList, error: memberError } = await supabase
      .from("members")
      .select("id, name, name_en, birth_date, gender, status")
      .eq("guardian_id", guardianId)
      .order("created_at", { ascending: true });

    if (memberError) {
      setErrorMsg("자녀 목록을 불러오지 못했습니다: " + memberError.message);
      setLoading(false);
      return;
    }

    setMembers(memberList || []);
    setLoading(false);
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

      const { data: guardian, error: guardianError } = await supabase
        .from("guardians")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (guardianError || !guardian) {
        setErrorMsg("보호자 정보를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      await loadMembers(guardian.id);
    }

    load();
  }, [router]);

  function startEditNameEn(member) {
    setEditingNameEnId(member.id);
    setNameEnDraft(member.name_en || "");
    setNameEnMsg("");
  }

  function cancelEditNameEn() {
    setEditingNameEnId(null);
    setNameEnDraft("");
  }

  async function saveNameEn(memberId) {
    setNameEnMsg("");
    const value = nameEnDraft.trim();
    setSavingNameEnId(memberId);

    const { error } = await supabase
      .from("members")
      .update({ name_en: value || null })
      .eq("id", memberId);

    setSavingNameEnId(null);

    if (error) {
      setNameEnMsg("영문 이름 저장 실패: " + error.message);
      return;
    }

    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, name_en: value || null } : m))
    );
    setEditingNameEnId(null);
    setNameEnDraft("");
  }

  if (loading) {
    return (
      <LoadingScreen />
    );
  }

  return (
    <main style={{ background: "#f3f7fc", minHeight: "100vh", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "18px 18px 4px" }}>
        <img src="/logo-main.png" alt="" style={{ width: 30, height: "auto" }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          더블제이 스포츠 아카데미
        </div>
      </div>
      <div style={{ fontSize: 14, color: "#8ea0b8", marginBottom: 28, textAlign: "center" }}>자녀 관리</div>

      <div style={{ padding: "0 18px" }}>
        {errorMsg && (
          <div style={{ background: "#fdecec", color: "#b3261e", padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            {errorMsg}
          </div>
        )}

        {members.length === 0 && !errorMsg && (
          <div style={{ background: "white", borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: "0 2px 10px rgba(30,60,110,0.06)" }}>
            <p style={{ margin: 0, fontSize: 14, color: "#8ea0b8" }}>
              아직 등록된 자녀가 없습니다. 아래 버튼으로 자녀를 등록해주세요.
            </p>
          </div>
        )}

        {members.map((m) => (
          <div
            key={m.id}
            style={{
              background: "white",
              borderRadius: 16,
              padding: 18,
              marginBottom: 14,
              boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                {m.name?.[0] || "?"}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1b3a63" }}>{m.name}</div>
                <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 2 }}>
                  생년월일: {formatBirthDate(m.birth_date) || "미입력"}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid #f0f3f8",
              }}
            >
              {editingNameEnId === m.id ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={nameEnDraft}
                    onChange={(e) => setNameEnDraft(e.target.value)}
                    placeholder="예: Minsu Kim"
                    style={{
                      flex: 1,
                      padding: 9,
                      fontSize: 13,
                      border: "1px solid #e5eaf2",
                      borderRadius: 8,
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="button"
                    disabled={savingNameEnId === m.id}
                    onClick={() => saveNameEn(m.id)}
                    style={{
                      padding: "9px 14px",
                      fontSize: 13,
                      fontWeight: 700,
                      border: "none",
                      borderRadius: 8,
                      background: BLUE,
                      color: "white",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {savingNameEnId === m.id ? "저장 중..." : "저장"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditNameEn}
                    style={{
                      padding: "9px 14px",
                      fontSize: 13,
                      border: "1px solid #e5eaf2",
                      borderRadius: 8,
                      background: "white",
                      color: "#5b7699",
                      cursor: "pointer",
                    }}
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: m.name_en ? 500 : 700,
                      color: m.name_en ? "#8ea0b8" : "#b3261e",
                    }}
                  >
                    영문 이름: {m.name_en || "미입력 (인보이스 발급 전 등록 필요)"}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEditNameEn(m)}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      border: "1px solid #e5eaf2",
                      color: "#5b7699",
                      background: "white",
                      borderRadius: 999,
                      padding: "3px 10px",
                      cursor: "pointer",
                    }}
                  >
                    수정
                  </button>
                </div>
              )}
              {nameEnMsg && editingNameEnId === null && (
                <div style={{ marginTop: 6, fontSize: 12, color: BLUE, fontWeight: 600 }}>
                  {nameEnMsg}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Link href={`/book?memberId=${m.id}`} style={{ flex: 1, textDecoration: "none" }}>
                <button
                  style={{
                    width: "100%",
                    padding: "11px 0",
                    fontSize: 13,
                    fontWeight: 700,
                    border: "1px solid #3B82C4",
                    borderRadius: 10,
                    background: "white",
                    color: BLUE,
                    cursor: "pointer",
                  }}
                >
                  수업 예약
                </button>
              </Link>
              <Link href={`/members/${m.id}/subscribe`} style={{ flex: 1, textDecoration: "none" }}>
                <button
                  style={{
                    width: "100%",
                    padding: "11px 0",
                    fontSize: 13,
                    fontWeight: 700,
                    border: "none",
                    borderRadius: 10,
                    background: BLUE,
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  회원권 신청
                </button>
              </Link>
            </div>
          </div>
        ))}

        <Link href="/members/new" style={{ textDecoration: "none" }}>
          <button
            style={{
              width: "100%",
              padding: 15,
              fontSize: 15,
              fontWeight: 700,
              color: "white",
              background: BLUE,
              border: "none",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            + 자녀 등록
          </button>
        </Link>

        <div style={{ textAlign: "center", padding: "16px 0", fontSize: 13 }}>
          <Link href="/dashboard" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}

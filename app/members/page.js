"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

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
      <main className="page">
        <div className="subtitle">불러오는 중...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">자녀 관리</div>

      <div className="card">
        {errorMsg && <div className="message error">{errorMsg}</div>}

        {members.length === 0 && !errorMsg && (
          <p style={{ marginTop: 0, fontSize: 15, color: "#555" }}>
            아직 등록된 자녀가 없습니다. 아래 버튼으로 자녀를 등록해주세요.
          </p>
        )}

        {members.map((m) => (
          <div
            key={m.id}
            style={{
              padding: "14px 0",
              borderBottom: "1px solid #eee",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700 }}>{m.name}</div>
            <div style={{ fontSize: 13, color: "#777", marginTop: 4 }}>
              생년월일: {formatBirthDate(m.birth_date) || "미입력"}
            </div>

            {editingNameEnId === m.id ? (
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={nameEnDraft}
                  onChange={(e) => setNameEnDraft(e.target.value)}
                  placeholder="예: Minsu Kim"
                  style={{
                    flex: 1,
                    padding: 8,
                    fontSize: 13,
                    border: "1px solid #ddd",
                    borderRadius: 6,
                  }}
                />
                <button
                  type="button"
                  disabled={savingNameEnId === m.id}
                  onClick={() => saveNameEn(m.id)}
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    border: "none",
                    borderRadius: 6,
                    background: "#0b3d2e",
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
                    padding: "8px 14px",
                    fontSize: 13,
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    background: "white",
                    color: "#555",
                    cursor: "pointer",
                  }}
                >
                  취소
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: m.name_en ? "#777" : "#b3261e",
                  }}
                >
                  영문 이름: {m.name_en || "미입력 (인보이스 발급 전 등록 필요)"}
                </span>
                <button
                  type="button"
                  onClick={() => startEditNameEn(m)}
                  style={{
                    fontSize: 12,
                    border: "1px solid #ccc",
                    color: "#555",
                    background: "white",
                    borderRadius: 6,
                    padding: "2px 8px",
                    cursor: "pointer",
                  }}
                >
                  수정
                </button>
              </div>
            )}
            {nameEnMsg && editingNameEnId === null && (
              <div style={{ marginTop: 4, fontSize: 12, color: "#0b3d2e" }}>
                {nameEnMsg}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <Link href={`/book?memberId=${m.id}`}>
                <button className="primary" style={{ padding: "10px 16px" }}>
                  수업 예약
                </button>
              </Link>
              <Link href={`/members/${m.id}/subscribe`}>
                <button
                  className="primary"
                  style={{ padding: "10px 16px", background: "#0b3d2e" }}
                >
                  회원권 신청
                </button>
              </Link>
            </div>
          </div>
        ))}

        <Link href="/members/new">
          <button className="primary">+ 자녀 등록</button>
        </Link>

        <div className="link-row">
          <Link href="/dashboard">← 홈으로 돌아가기</Link>
        </div>
      </div>
    </main>
  );
}

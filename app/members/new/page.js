"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

const BLUE = "#3B82C4";

export default function NewMemberPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("");
  const [experience, setExperience] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("선수 이름을 입력해주세요.");
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMsg("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    const { data: guardian } = await supabase
      .from("guardians")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!guardian) {
      setErrorMsg("학부모 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("members").insert({
      guardian_id: guardian.id,
      name: name.trim(),
      name_en: nameEn.trim() || null,
      birthdate: birthdate || null,
      gender: gender || null,
      experience: experience || null,
      emergency_contact: emergencyContact || null,
    });

    setLoading(false);

    if (error) {
      setErrorMsg("등록 실패: " + error.message);
      return;
    }

    router.push("/members");
  }

  return (
    <main style={{ background: "#f3f7fc", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "18px 18px 8px",
        }}
      >
        <img src="/logo-main.png" alt="" style={{ width: 30, height: "auto" }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>
          더블제이 축구 아카데미
        </div>
      </div>

      <div style={{ padding: "8px 18px 0" }}>
        <div style={{ fontSize: 13, color: "#8ea0b8", marginBottom: 16, textAlign: "center" }}>
          자녀 등록
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            background: "white",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>선수 이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 김민수"
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              marginBottom: 16,
              fontSize: 14,
              border: "1px solid #e5eaf2",
              borderRadius: 10,
              boxSizing: "border-box",
            }}
          />

          <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>
            영문 이름 (선택, 인보이스 발급 시 사용)
          </label>
          <input
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="예: Minsu Kim"
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              marginBottom: 16,
              fontSize: 14,
              border: "1px solid #e5eaf2",
              borderRadius: 10,
              boxSizing: "border-box",
            }}
          />

          <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>생년월일</label>
          <input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            style={{
              width: "100%",
              padding: "0 12px",
              height: 42,
              marginTop: 6,
              marginBottom: 16,
              fontSize: 14,
              border: "1px solid #e5eaf2",
              borderRadius: 10,
              boxSizing: "border-box",
            }}
          />

          <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>성별 (선택)</label>
          <input
            type="text"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            placeholder="남 / 여"
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              marginBottom: 16,
              fontSize: 14,
              border: "1px solid #e5eaf2",
              borderRadius: 10,
              boxSizing: "border-box",
            }}
          />

          <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>축구 경험 (선택)</label>
          <input
            type="text"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder="예: 처음, 1년, 3년 이상"
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              marginBottom: 16,
              fontSize: 14,
              border: "1px solid #e5eaf2",
              borderRadius: 10,
              boxSizing: "border-box",
            }}
          />

          <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>비상연락처 (선택)</label>
          <input
            type="text"
            value={emergencyContact}
            onChange={(e) => setEmergencyContact(e.target.value)}
            placeholder="+49 1XX XXXXXXX"
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              marginBottom: 20,
              fontSize: 14,
              border: "1px solid #e5eaf2",
              borderRadius: 10,
              boxSizing: "border-box",
            }}
          />

          {errorMsg && (
            <div
              style={{
                background: "#fdecec",
                color: "#b3261e",
                padding: 12,
                borderRadius: 10,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
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
            {loading ? "등록 중..." : "등록하기"}
          </button>
        </form>

        <div style={{ textAlign: "center", padding: "16px 0", fontSize: 13 }}>
          <a href="/members" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 자녀 목록으로
          </a>
        </div>
      </div>
    </main>
  );
}

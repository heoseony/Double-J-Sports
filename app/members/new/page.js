"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

export default function NewMemberPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const canSubmit = name && birthDate;

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!canSubmit) {
      setErrorMsg("이름과 생년월일은 필수입니다.");
      return;
    }

    setLoading(true);

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

    const { error: insertError } = await supabase.from("members").insert({
      guardian_id: guardian.id,
      program: "kids",
      name,
      name_en: nameEn || null,
      birth_date: birthDate,
      gender: gender || null,
      experience_level: experienceLevel || null,
      emergency_contact: emergencyContact || null,
      status: "active",
    });

    setLoading(false);

    if (insertError) {
      setErrorMsg("등록 실패: " + insertError.message);
      return;
    }

    router.push("/members");
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">자녀 등록</div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <label>선수 이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 김민수"
          />

          <label>영문 이름 (선택, 인보이스 발급 시 사용)</label>
          <input
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="예: Minsu Kim"
          />

          <label>생년월일</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />

          <label>성별 (선택)</label>
          <input
            type="text"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            placeholder="남 / 여"
          />

          <label>축구 경험 (선택)</label>
          <input
            type="text"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            placeholder="예: 처음, 1년, 3년 이상"
          />

          <label>비상연락처 (선택)</label>
          <input
            type="tel"
            value={emergencyContact}
            onChange={(e) => setEmergencyContact(e.target.value)}
            placeholder="+49 1XX XXXXXXX"
          />

          {errorMsg && <div className="message error">{errorMsg}</div>}

          <button className="primary" type="submit" disabled={loading}>
            {loading ? "등록 중..." : "등록하기"}
          </button>
        </form>

        <div className="link-row">
          <Link href="/members">← 자녀 목록으로</Link>
        </div>
      </div>
    </main>
  );
}

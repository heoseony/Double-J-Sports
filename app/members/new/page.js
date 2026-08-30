"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

const BLUE = "#3B82C4";

export default function NewMemberPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("");
  const [region, setRegion] = useState("frankfurt");
  const [program, setProgram] = useState("kids");
  const [experience, setExperience] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);


  function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }
  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("선수 이름을 입력해주세요.");
      return;
    }

    if (!nameEn.trim()) {
      setErrorMsg("영문 이름을 입력해주세요. (인보이스 발급에 필요합니다)");
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

    const { data: newMember, error } = await supabase
      .from("members")
      .insert({
        guardian_id: guardian.id,
        name: name.trim(),
        name_en: nameEn.trim() || null,
        birth_date: birthdate || null,
        region,
        program,
        gender: gender || null,
        experience_level: experience || null,
        emergency_contact: emergencyContact || null,
      })
      .select()
      .single();

    if (error) {
      setErrorMsg("등록 실패: " + error.message);
      setLoading(false);
      return;
    }

    if (photoFile && newMember) {
      const ext = photoFile.name.split(".").pop();
      const path = `${newMember.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, photoFile, { upsert: true });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        await supabase
          .from("members")
          .update({ profile_image_url: urlData.publicUrl })
          .eq("id", newMember.id);
      }
    }

    setLoading(false);
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
          더블제이 스포츠 아카데미
        </div>
      </div>

      <div style={{ padding: "8px 18px 0" }}>
        <div style={{ fontSize: 13, color: "#8ea0b8", marginBottom: 16, textAlign: "center" }}>
          선수 등록
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
            <div style={{ position: "relative" }}>
              {photoPreviewUrl ? (
                <img
                  src={photoPreviewUrl}
                  alt="미리보기"
                  style={{ width: 84, height: 84, borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: "50%",
                    background: BLUE,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 30,
                    fontWeight: 800,
                  }}
                >
                  {name?.[0] || "?"}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: BLUE,
                  border: "3px solid white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                style={{ display: "none" }}
              />
            </div>
            <div style={{ fontSize: 12, color: "#8ea0b8", marginTop: 8 }}>
              프로필 사진을 선택할 수 있습니다.
            </div>
          </div>
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
            영문 이름 (필수, 인보이스 발급 시 사용)
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
              lineHeight: "42px",
              WebkitAppearance: "none",
              appearance: "none",
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

          <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>지역</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              marginBottom: 16,
              fontSize: 14,
              border: "1px solid #e5eaf2",
              borderRadius: 10,
              boxSizing: "border-box",
              background: "white",
            }}
          >
            <option value="frankfurt">Frankfurt</option>
            <option value="dusseldorf">Düsseldorf</option>
          </select>

          <label style={{ fontSize: 13, fontWeight: 700, color: "#1b3a63" }}>프로그램</label>
          <select
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginTop: 6,
              marginBottom: 16,
              fontSize: 14,
              border: "1px solid #e5eaf2",
              borderRadius: 10,
              boxSizing: "border-box",
              background: "white",
            }}
          >
            <option value="kids">Kids</option>
            <option value="pro">프로</option>
            <option value="general">일반(취미)</option>
          </select>

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
            ← 선수 목록으로
          </a>
        </div>
      </div>
    </main>
  );
}

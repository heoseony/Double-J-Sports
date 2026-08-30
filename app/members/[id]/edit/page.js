"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabaseClient";
import LoadingScreen from "../../../components/LoadingScreen";

const BLUE = "#3B82C4";

export default function MemberEditPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id;
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState("");
  const [region, setRegion] = useState("frankfurt");
  const [program, setProgram] = useState("kids");
  const [experience, setExperience] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [notes, setNotes] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: memberData, error } = await supabase
        .from("members")
        .select(
          "id, name, name_en, birth_date, gender, region, program, experience_level, emergency_contact, notes, profile_image_url, guardian_id"
        )
        .eq("id", memberId)
        .single();

      if (error || !memberData) {
        setErrorMsg("선수 정보를 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      setName(memberData.name || "");
      setNameEn(memberData.name_en || "");
      setBirthdate(memberData.birth_date || "");
      setGender(memberData.gender || "");
      setRegion(memberData.region || "frankfurt");
      setProgram(memberData.program || "kids");
      setExperience(memberData.experience_level || "");
      setEmergencyContact(memberData.emergency_contact || "");
      setNotes(memberData.notes || "");
      setProfileImageUrl(memberData.profile_image_url || null);

      setLoading(false);
    }

    if (memberId) load();
  }, [memberId, router]);

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setErrorMsg("");

    const ext = file.name.split(".").pop();
    const path = `${memberId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setErrorMsg("사진 업로드 실패: " + uploadError.message);
      setUploadingPhoto(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const { error: updateError } = await supabase
      .from("members")
      .update({ profile_image_url: publicUrl })
      .eq("id", memberId);

    setUploadingPhoto(false);

    if (updateError) {
      setErrorMsg("사진 저장 실패: " + updateError.message);
      return;
    }

    setProfileImageUrl(publicUrl);
  }

  async function handleSave() {
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (!name.trim()) {
      setErrorMsg("선수 이름을 입력해주세요.");
      setSaving(false);
      return;

    if (!nameEn.trim()) {
      setErrorMsg("영문 이름을 입력해주세요. (인보이스 발급에 필요합니다)");
      setSaving(false);
      return;
    }
    }

    const { error } = await supabase
      .from("members")
      .update({
        name: name.trim(),
        name_en: nameEn.trim() || null,
        birth_date: birthdate || null,
        gender: gender || null,
        region,
        program,
        experience_level: experience || null,
        emergency_contact: emergencyContact || null,
        notes: notes || null,
      })
      .eq("id", memberId);

    setSaving(false);

    if (error) {
      setErrorMsg("저장 실패: " + error.message);
      return;
    }

    setSuccessMsg("저장되었습니다.");
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  async function handleDelete() {
    if (!confirm(`"${name}" 선수 정보를 정말 삭제할까요?\n\n예약/결제 기록이 있으면 삭제가 안 될 수 있습니다.`)) {
      return;
    }

    setDeleting(true);
    setErrorMsg("");

    const { error } = await supabase.from("members").delete().eq("id", memberId);

    setDeleting(false);

    if (error) {
      setErrorMsg("삭제 실패: 이미 예약/결제 기록이 있어 삭제할 수 없습니다.");
      return;
    }

    router.push("/members");
  }

  if (loading) {
    return <LoadingScreen />;
  }

  const fieldStyle = {
    width: "100%",
    padding: 12,
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
    border: "1px solid #e5eaf2",
    borderRadius: 10,
    boxSizing: "border-box",
    background: "white",
  };
  const labelStyle = { fontSize: 13, fontWeight: 700, color: "#1b3a63" };

  return (
    <main style={{ background: "#f3f7fc", paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "18px 18px 4px",
        }}
      >
        <Link href="/members" style={{ color: "#1b3a63", display: "flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1b3a63" }}>선수 프로필 설정</div>
      </div>

      <div style={{ padding: "8px 18px 0" }}>
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 20,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
            <div style={{ position: "relative" }}>
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={name}
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
                disabled={uploadingPhoto}
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
              {uploadingPhoto ? "업로드 중..." : "프로필 사진을 변경할 수 있습니다."}
            </div>
          </div>

          <label style={labelStyle}>이름</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />

          <label style={labelStyle}>영문 이름 (필수, 인보이스용)</label>
          <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} style={fieldStyle} />

          <label style={labelStyle}>생년월일</label>
          <input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            style={{ ...fieldStyle, padding: "0 12px", height: 42, lineHeight: "42px", WebkitAppearance: "none", appearance: "none" }}
          />

          <label style={labelStyle}>성별</label>
          <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setGender("남")}
              style={{
                flex: 1,
                padding: "10px 0",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                border: gender === "남" ? "none" : "1px solid #e5eaf2",
                background: gender === "남" ? BLUE : "white",
                color: gender === "남" ? "white" : "#5b7699",
                cursor: "pointer",
              }}
            >
              남
            </button>
            <button
              type="button"
              onClick={() => setGender("여")}
              style={{
                flex: 1,
                padding: "10px 0",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 8,
                border: gender === "여" ? "none" : "1px solid #e5eaf2",
                background: gender === "여" ? BLUE : "white",
                color: gender === "여" ? "white" : "#5b7699",
                cursor: "pointer",
              }}
            >
              여
            </button>
          </div>

          <label style={labelStyle}>지역</label>
          <select value={region} onChange={(e) => setRegion(e.target.value)} style={fieldStyle}>
            <option value="frankfurt">Frankfurt</option>
            <option value="dusseldorf">Düsseldorf</option>
          </select>

          <label style={labelStyle}>프로그램</label>
          <select value={program} onChange={(e) => setProgram(e.target.value)} style={fieldStyle}>
            <option value="kids">Kids</option>
            <option value="pro">프로</option>
            <option value="general">일반/취미</option>
          </select>

          <label style={labelStyle}>축구 경험 (선택)</label>
          <input
            type="text"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder="예: 처음, 1년, 3년 이상"
            style={fieldStyle}
          />

          <label style={labelStyle}>비상연락처 (선택)</label>
          <input
            type="text"
            value={emergencyContact}
            onChange={(e) => setEmergencyContact(e.target.value)}
            placeholder="+49 1XX XXXXXXX"
            style={fieldStyle}
          />

          <label style={labelStyle}>특이사항 (선택)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="알레르기, 건강상 유의사항 등"
            rows={3}
            style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit" }}
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
          {successMsg && (
            <div
              style={{
                background: "#e9f8f0",
                color: "#2ea86e",
                padding: 12,
                borderRadius: 10,
                fontSize: 13,
                marginBottom: 16,
                fontWeight: 700,
              }}
            >
              {successMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
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
              marginBottom: 12,
            }}
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 14,
              fontWeight: 700,
              color: "#b3261e",
              background: "white",
              border: "1px solid #f5c6c2",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            {deleting ? "삭제 중..." : "선수 삭제"}
          </button>
        </div>

        <div style={{ textAlign: "center", padding: "16px 0", fontSize: 13 }}>
          <Link href="/members" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
            ← 선수 목록으로
          </Link>
        </div>
      </div>
    </main>
  );
}

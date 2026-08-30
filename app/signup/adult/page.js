"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

const BLUE = "#3B82C4";

export default function AdultSignupPage() {
  const router = useRouter();

  const [program, setProgram] = useState("general");
  const [name, setName] = useState("");
  const [firstNameEn, setFirstNameEn] = useState("");
  const [lastNameEn, setLastNameEn] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreePhoto, setAgreePhoto] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim() || !email.trim() || !password) {
      setErrorMsg("이름, 이메일, 비밀번호는 필수입니다.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (!agreePrivacy || !agreeTerms) {
      setErrorMsg("필수 약관에 동의해주세요.");
      return;
    }

    setSubmitting(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (authError || !authData.user) {
      setSubmitting(false);
      setErrorMsg("회원가입 실패: " + (authError?.message || "알 수 없는 오류"));
      return;
    }

    const { error: userError } = await supabase.from("users").insert({
      id: authData.user.id,
      email: email.trim(),
      role: "member",
    });

    if (userError) {
      setSubmitting(false);
      setErrorMsg("사용자 정보 저장 실패: " + userError.message);
      return;
    }

    const { error: memberError } = await supabase.from("members").insert({
      user_id: authData.user.id,
      program,
      name: name.trim(),
      first_name_en: firstNameEn.trim() || null,
      last_name_en: lastNameEn.trim() || null,
      status: "active",
      referred_by: referredBy.trim() || null,
    });

    setSubmitting(false);

    if (memberError) {
      setErrorMsg("회원 정보 저장 실패: " + memberError.message);
      return;
    }

    router.push("/dashboard");
  }

  const labelStyle = {
    fontSize: 13,
    fontWeight: 700,
    color: "#1b3a63",
    display: "block",
    marginBottom: 6,
    marginTop: 16,
  };

  const inputStyle = {
    width: "100%",
    padding: 14,
    fontSize: 16,
    border: "1px solid #e5eaf2",
    borderRadius: 10,
    background: "#f7fafd",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  const checkboxRowStyle = {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 14,
    fontSize: 13,
    color: "#33455e",
  };

  return (
    <main
      style={{
        background: "#f3f7fc",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <img
            src="/logo-main.png"
            alt="로고"
            style={{ width: 56, height: 56, objectFit: "contain", marginBottom: 10 }}
          />
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1b3a63" }}>
            더블제이 스포츠 아카데미
          </div>
          <div style={{ fontSize: 13, color: "#8ea0b8", marginTop: 4 }}>
            일반 회원가입
          </div>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 2px 10px rgba(30,60,110,0.06)",
          }}
        >
          <form onSubmit={handleSubmit}>
            <label style={{ ...labelStyle, marginTop: 0 }}>프로그램</label>
            <select
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              style={inputStyle}
            >
              <option value="general">일반/취미</option>
              <option value="pro">프로</option>
            </select>

            <label style={labelStyle}>이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              style={inputStyle}
            />

            <label style={labelStyle}>영문 이름 (인보이스용, 선택)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={firstNameEn}
                onChange={(e) => setFirstNameEn(e.target.value)}
                placeholder="이름 (예: Dongwoo)"
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="text"
                value={lastNameEn}
                onChange={(e) => setLastNameEn(e.target.value)}
                placeholder="성 (예: Kim)"
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
            <p style={{ fontSize: 12, color: "#8ea0b8", margin: "6px 0 0" }}>
              인보이스(영수증)에 "{firstNameEn || "First"} {lastNameEn || "Last"}" 형식으로 표기됩니다.
            </p>

            <label style={labelStyle}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              style={inputStyle}
            />

            <label style={labelStyle}>전화번호</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="전화번호"
              style={inputStyle}
            />

            <label style={labelStyle}>비밀번호 (6자 이상)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>추천인 이름 (선택)</label>
            <input
              type="text"
              value={referredBy}
              onChange={(e) => setReferredBy(e.target.value)}
              placeholder="나를 추천해준 회원 이름"
              style={inputStyle}
            />

            <div style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                style={{ marginTop: 2, width: 18, height: 18 }}
              />
              <span>(필수) 개인정보 수집 및 이용에 동의합니다.</span>
            </div>
            <div style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={agreePhoto}
                onChange={(e) => setAgreePhoto(e.target.checked)}
                style={{ marginTop: 2, width: 18, height: 18 }}
              />
              <span>(선택) 사진/영상 촬영 및 활용에 동의합니다.</span>
            </div>
            <div style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                style={{ marginTop: 2, width: 18, height: 18 }}
              />
              <span>(필수) 서비스 이용약관에 동의합니다.</span>
            </div>

            {errorMsg && (
              <div
                style={{
                  background: "#fdecec",
                  color: "#b3261e",
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 13,
                  marginTop: 16,
                }}
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                marginTop: 20,
                padding: 14,
                fontSize: 15,
                fontWeight: 700,
                color: "white",
                background: submitting ? "#9db8d6" : BLUE,
                border: "none",
                borderRadius: 10,
                cursor: submitting ? "default" : "pointer",
              }}
            >
              {submitting ? "가입 중..." : "가입하기"}
            </button>
          </form>

          <div
            style={{
              textAlign: "center",
              marginTop: 18,
              fontSize: 13,
              color: "#8ea0b8",
            }}
          >
            이미 계정이 있으신가요?{" "}
            <Link href="/login" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
              로그인
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

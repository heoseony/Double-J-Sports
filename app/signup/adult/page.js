"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { useLanguage } from "../../../lib/i18n/LanguageContext";

const BLUE = "#3B82C4";

export default function AdultSignupPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [program, setProgram] = useState("general");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
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

    if (!name.trim() || !email.trim() || !password || !firstNameEn.trim() || !lastNameEn.trim()) {
      setErrorMsg(t("signupAdult.errRequired"));
      return;
    }
    if (password.length < 6) {
      setErrorMsg(t("signupAdult.errPasswordLength"));
      return;
    }
    if (!agreePrivacy || !agreeTerms) {
      setErrorMsg(t("signupAdult.errTermsRequired"));
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
      gender: gender || null,
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
            alt="Logo"
            style={{ width: 56, height: 56, objectFit: "contain", marginBottom: 10 }}
          />
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1b3a63" }}>
            {t("login.title")}
          </div>
          <div style={{ fontSize: 13, color: "#8ea0b8", marginTop: 4 }}>
            {t("signupAdult.title")}
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
            <label style={{ ...labelStyle, marginTop: 0 }}>{t("signupAdult.programLabel")}</label>
            <select
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              style={inputStyle}
            >
              <option value="general">{t("signupAdult.programGeneral")}</option>
              <option value="pro">{t("signupAdult.programPro")}</option>
            </select>

            <label style={labelStyle}>{t("signupAdult.nameLabel")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("signupAdult.namePlaceholder")}
              style={inputStyle}
            />

            <label style={labelStyle}>{t("signupAdult.nameEnLabel")}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={firstNameEn}
                onChange={(e) => setFirstNameEn(e.target.value)}
                placeholder={t("signupAdult.firstNamePlaceholder")}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="text"
                value={lastNameEn}
                onChange={(e) => setLastNameEn(e.target.value)}
                placeholder={t("signupAdult.lastNamePlaceholder")}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
            <p style={{ fontSize: 12, color: "#8ea0b8", margin: "6px 0 0" }}>
              {t("signupAdult.nameEnHint")}
            </p>

            <label style={labelStyle}>{t("memberEdit.genderLabel")}</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
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
                {t("memberEdit.genderMale")}
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
                {t("memberEdit.genderFemale")}
              </button>
            </div>

            <label style={labelStyle}>{t("signupAdult.emailLabel")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              style={inputStyle}
            />

            <label style={labelStyle}>{t("signupAdult.phoneLabel")}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("signupAdult.phonePlaceholder")}
              style={inputStyle}
            />

            <label style={labelStyle}>{t("signupAdult.passwordLabel")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />

            <label style={labelStyle}>{t("signupAdult.referrerLabel")}</label>
            <input
              type="text"
              value={referredBy}
              onChange={(e) => setReferredBy(e.target.value)}
              placeholder={t("signupAdult.referrerPlaceholder")}
              style={inputStyle}
            />

            <div style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
                style={{ marginTop: 2, width: 18, height: 18 }}
              />
              <span>{t("signupAdult.consentPrivacy")}</span>
            </div>
            <div style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={agreePhoto}
                onChange={(e) => setAgreePhoto(e.target.checked)}
                style={{ marginTop: 2, width: 18, height: 18 }}
              />
              <span>{t("signupAdult.consentMedia")}</span>
            </div>
            <div style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                style={{ marginTop: 2, width: 18, height: 18 }}
              />
              <span>{t("signupAdult.consentTerms")}</span>
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
              {submitting ? t("signupAdult.submitting") : t("signupAdult.submit")}
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
            {t("signupAdult.haveAccount")}{" "}
            <Link href="/login" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}>
              {t("signupAdult.login")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

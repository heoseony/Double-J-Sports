"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

export default function AdultSignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [referredBy, setReferredBy] = useState("");
  const [program, setProgram] = useState("women");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [mediaConsent, setMediaConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const canSubmit =
    name && email && phone && password.length >= 6 && privacyConsent && termsConsent;

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!canSubmit) {
      setErrorMsg("필수 항목을 모두 입력하고, 필수 동의 항목에 체크해주세요.");
      return;
    }

    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setErrorMsg("가입 실패: " + authError.message);
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;

    if (!userId) {
      setErrorMsg(
        "가입 이메일로 인증 메일이 발송되었을 수 있습니다. 메일함을 확인해주세요."
      );
      setLoading(false);
      return;
    }

    const { error: userInsertError } = await supabase.from("users").insert({
      id: userId,
      email,
      role: "member",
      phone,
    });

    if (userInsertError) {
      setErrorMsg("프로필 저장 실패: " + userInsertError.message);
      setLoading(false);
      return;
    }

    const newMemberId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const { error: memberInsertError } = await supabase.from("members").insert({
      id: newMemberId,
      user_id: userId,
      program,
      name,
      emergency_contact: phone,
      status: "active",
      referred_by: referredBy || null,
    });

    if (memberInsertError) {
      setErrorMsg("회원 정보 저장 실패: " + memberInsertError.message);
      setLoading(false);
      return;
    }

    await supabase.from("consents").insert({
      member_id: newMemberId,
      privacy_consent: privacyConsent,
      media_consent: mediaConsent,
      terms_consent: termsConsent,
    });

    setLoading(false);
    router.push("/login?justSignedUp=1");
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">Women's / Men's 회원가입</div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <label>프로그램</label>
          <select
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            style={{
              width: "100%",
              padding: 14,
              fontSize: 16,
              border: "1px solid #ddd",
              borderRadius: 10,
              background: "#fafafa",
            }}
          >
            <option value="women">Women's</option>
            <option value="men">Men's</option>
          </select>

          <label>이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
          />

          <label>이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
          />

          <label>전화번호</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+49 1XX XXXXXXX"
          />

          <label>비밀번호 (6자 이상)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
          />

          <label>추천인 이름 (선택)</label>
          <input
            type="text"
            value={referredBy}
            onChange={(e) => setReferredBy(e.target.value)}
            placeholder="나를 추천해준 회원 이름"
          />

          <div className="checkbox-row">
            <input
              type="checkbox"
              checked={privacyConsent}
              onChange={(e) => setPrivacyConsent(e.target.checked)}
            />
            <span>(필수) 개인정보 수집 및 이용에 동의합니다.</span>
          </div>

          <div className="checkbox-row">
            <input
              type="checkbox"
              checked={mediaConsent}
              onChange={(e) => setMediaConsent(e.target.checked)}
            />
            <span>(선택) 사진/영상 촬영 및 활용에 동의합니다.</span>
          </div>

          <div className="checkbox-row">
            <input
              type="checkbox"
              checked={termsConsent}
              onChange={(e) => setTermsConsent(e.target.checked)}
            />
            <span>(필수) 서비스 이용약관에 동의합니다.</span>
          </div>

          {errorMsg && <div className="message error">{errorMsg}</div>}

          <button className="primary" type="submit" disabled={loading}>
            {loading ? "가입 처리 중..." : "가입하기"}
          </button>
        </form>

        <div className="link-row">
          <Link href="/login">이미 계정이 있으신가요? 로그인</Link>
        </div>
      </div>
    </main>
  );
}

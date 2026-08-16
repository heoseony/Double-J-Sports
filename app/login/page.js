"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg("로그인 실패: " + error.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">로그인</div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <label>이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
          />

          <label>비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
          />

          {errorMsg && <div className="message error">{errorMsg}</div>}

          <button className="primary" type="submit" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="link-row">
          아직 계정이 없으신가요? <Link href="/signup">회원가입</Link>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <div className="brand">Double J Sports</div>
      <div className="subtitle">회원관리 및 수업예약 시스템</div>

      <div className="card">
        <p style={{ marginTop: 0, fontSize: 15, lineHeight: 1.5 }}>
          아직 회원가입을 하지 않으셨다면 먼저 가입해주세요.
        </p>
        <Link href="/signup">
          <button className="primary">학부모 회원가입 (Kids)</button>
        </Link>
        <Link href="/signup/adult">
          <button className="primary" style={{ marginTop: 12 }}>
            성인 회원가입 (Women's / Men's)
          </button>
        </Link>
        <div className="link-row">
          이미 계정이 있으신가요? <Link href="/login">로그인</Link>
        </div>
      </div>
    </main>
  );
}

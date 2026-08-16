import Link from "next/link";

export default function AdminHomePage() {
  return (
    <main className="admin-page">
      <div className="brand">관리자</div>
      <div className="subtitle">수업과 회원권을 관리합니다.</div>

      <div className="admin-grid">
        <Link href="/admin/classes" style={{ textDecoration: "none" }}>
          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0b3d2e" }}>
              수업 관리
            </div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
              요일별 수업을 만들고 확인합니다.
            </div>
          </div>
        </Link>

        <Link href="/admin/members" style={{ textDecoration: "none" }}>
          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0b3d2e" }}>
              회원 관리
            </div>
            <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
              회원 목록 확인 및 회원권 배정/조정을 합니다.
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}

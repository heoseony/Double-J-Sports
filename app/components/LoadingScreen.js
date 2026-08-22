"use client";

/**
 * 공통 로딩 화면 컴포넌트
 * 사용 예:
 *   if (loading) return <LoadingScreen />;
 *   if (loading) return <LoadingScreen text="확인 중..." />;
 */
export default function LoadingScreen({ text = "불러오는 중..." }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f7fc",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <style>{`
        @keyframes dj-ball-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes dj-ball-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      <div
        style={{
          animation: "dj-ball-bounce 1s ease-in-out infinite",
        }}
      >
        <img
          src="/soccer-ball.png"
          alt="로딩 중"
          width={56}
          height={56}
          style={{
            display: "block",
            animation: "dj-ball-spin 1.8s linear infinite",
          }}
        />
      </div>

      <div
        style={{
          marginTop: 16,
          fontSize: 14,
          color: "#5b7699",
          fontWeight: 600,
        }}
      >
        {text}
      </div>
    </main>
  );
}

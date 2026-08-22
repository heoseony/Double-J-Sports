"use client";

const BLUE = "#3B82C4";

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
        <svg
          width="56"
          height="56"
          viewBox="0 0 100 100"
          style={{ animation: "dj-ball-spin 1.8s linear infinite" }}
        >
          <circle cx="50" cy="50" r="46" fill="white" stroke={BLUE} strokeWidth="4" />
          <polygon
            points="50,28 63,38 58,54 42,54 37,38"
            fill={BLUE}
          />
          <path
            d="M50 28 L50 8 M63 38 L80 26 M58 54 L70 70 M42 54 L30 70 M37 38 L20 26"
            stroke={BLUE}
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M50 8 A46 46 0 0 1 80 26 M80 26 A46 46 0 0 1 70 70 M70 70 A46 46 0 0 1 30 70 M30 70 A46 46 0 0 1 20 26 M20 26 A46 46 0 0 1 50 8"
            stroke={BLUE}
            strokeWidth="1.5"
            fill="none"
            opacity="0.35"
          />
        </svg>
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

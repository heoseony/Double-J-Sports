/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // 모든 페이지에 적용: 홈 화면에 추가한 앱(PWA)이 예전 버전을 계속
        // 캐싱해서 보여주는 문제를 막기 위해, 페이지 문서 자체는 항상
        // 새로 받아오도록 강제한다. (정적 파일/이미지/JS 청크는 Next.js가
        // 자체적으로 파일명에 해시를 붙여 관리하므로 영향 없음)
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

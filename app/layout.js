import "./globals.css";

export const metadata = {
  title: "Double J Sports",
  description: "Double J Sports 회원관리 및 수업예약 시스템",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

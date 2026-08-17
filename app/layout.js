import "./globals.css";
import BottomNav from "./components/BottomNav";

export const metadata = {
  title: "Double J Sports",
  description: "Double J Sports 회원관리 및 수업예약 시스템",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Double J Sports",
  },
};

export const viewport = {
  themeColor: "#0b3d2e",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <BottomNav />
      </body>
    </html>
  );
}

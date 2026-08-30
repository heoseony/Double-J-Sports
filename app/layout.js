import "./globals.css";
import BottomNav from "./components/BottomNav";
import RefreshButton from "./components/RefreshButton";
import { LanguageProvider } from "../lib/i18n/LanguageContext";

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
  themeColor: "#3B82C4",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <LanguageProvider>
          {children}
          <RefreshButton />
          <BottomNav />
        </LanguageProvider>
      </body>
    </html>
  );
}

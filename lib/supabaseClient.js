import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// "로그인 상태 유지" 체크박스 지원용 플래그 키.
// 이 값이 "0"이면 세션을 sessionStorage(탭/브라우저 닫으면 삭제)에,
// 그 외(기본값 포함)에는 기존처럼 localStorage(계속 유지)에 저장한다.
// 로그인 화면에서 로그인 시도 직전에 이 플래그를 세팅한다.
const REMEMBER_FLAG_KEY = "double-j-sports-remember-me";

function isRemembering() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(REMEMBER_FLAG_KEY) !== "0";
}

// Supabase가 세션을 읽고 쓸 때 항상 이 어댑터를 거치게 해서,
// 그 시점의 "로그인 상태 유지" 여부에 따라 localStorage/sessionStorage를 선택한다.
const dynamicStorage = {
  getItem: (key) => {
    if (typeof window === "undefined") return null;
    return isRemembering()
      ? window.localStorage.getItem(key)
      : window.sessionStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (typeof window === "undefined") return;
    if (isRemembering()) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
      window.localStorage.removeItem(key);
    }
  },
  removeItem: (key) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 로그인 세션을 브라우저에 계속 저장해서, 로그아웃을 직접 누르기 전까지 유지
    persistSession: true,
    // 세션 만료 전에 자동으로 토큰을 갱신
    autoRefreshToken: true,
    // 여러 탭에서 로그인 상태를 동기화
    detectSessionInUrl: true,
    storage: dynamicStorage,
    storageKey: "double-j-sports-auth",
  },
});

// 로그인 화면에서, 실제 로그인 시도 직전에 호출해서
// "로그인 상태 유지" 체크 여부를 반영한다.
export function setRememberMe(remember) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMEMBER_FLAG_KEY, remember ? "1" : "0");
}

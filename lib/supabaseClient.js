import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 로그인 세션을 브라우저에 계속 저장해서, 로그아웃을 직접 누르기 전까지 유지
    persistSession: true,
    // 세션 만료 전에 자동으로 토큰을 갱신
    autoRefreshToken: true,
    // 여러 탭에서 로그인 상태를 동기화
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "double-j-sports-auth",
  },
});

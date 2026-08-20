import { createClient } from "@supabase/supabase-js";

// 서버(API 라우트) 전용 클라이언트 — service role 키를 사용해 RLS를 우회한다.
// ⚠️ 절대 브라우저(클라이언트 컴포넌트) 코드에서 import하지 말 것.
//    이 키는 모든 테이블에 대한 전체 권한을 가지므로 노출되면 안 됨.
//
// 모듈이 로드되는 시점(빌드 시 page data 수집 포함)이 아니라, 실제로 호출되는
// 시점에만 클라이언트를 생성한다 — 로컬처럼 이 환경변수가 없는 곳에서
// `npm run build`가 실패하지 않게 하기 위함 (Vercel엔 이미 등록되어 있어
// 실제 배포/실행에는 영향 없음).
let _client = null;

export function getSupabaseAdmin() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다."
    );
  }

  _client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _client;
}

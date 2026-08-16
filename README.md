# Double J Sports

Double J Sports Frankfurt 회원관리 및 수업예약 시스템 (Phase 1 MVP - 진행 중)

## 현재 포함된 기능
- 보호자 회원가입 (동의서 포함)
- 로그인 / 로그아웃
- 로그인 후 임시 대시보드 (앞으로 기능이 채워질 예정)

## 배포 방법 (Vercel)
1. 이 저장소를 Vercel에 연결합니다.
2. Vercel 프로젝트 설정 > Environment Variables 에 아래 두 값을 추가합니다.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (값은 Supabase 대시보드 > Project Settings > API 에서 확인)
3. Deploy를 누르면 자동으로 빌드/배포됩니다.

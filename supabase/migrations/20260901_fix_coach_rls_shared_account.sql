-- 코치 계정은 하나의 로그인(auth 계정)을 여러 코치가 공유하고,
-- 로그인 후 화면에서만 "코치 프로필"을 선택하는 구조 (public.users에는
-- 프로필 연결 컬럼이 없음). 기존 RLS는 classes.coach_id = auth.uid() 로
-- "메인 코치로 지정된 사람"만 허용했는데, 이 계정 공유 구조상 보조 코치는
-- 물론 실질적으로 모든 코치가 이 조건을 만족시킬 수 없어 접근이 막히는
-- 문제가 있었음 (2026-09-01 발견, 실제 수업 당일 긴급 수정).
--
-- coach role 계정이 단 하나뿐인 것을 확인한 뒤 (Double J Sports는 코치용
-- 로그인 계정을 공유하는 구조이므로), "로그인 계정이 coach role이면 전체
-- 클래스 접근 가능"으로 단순화함.

create or replace function public.is_coach_of_session_member(p_member_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'coach'
  );
$function$;

drop policy if exists "bookings coach select own class" on public.bookings;
create policy "bookings coach select own class"
on public.bookings
for select
to public
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'coach'
  )
);

drop policy if exists "bookings coach update own class" on public.bookings;
create policy "bookings coach update own class"
on public.bookings
for update
to public
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'coach'
  )
);

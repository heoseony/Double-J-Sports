-- 코치/관리자가 매주 출석체크 시 남기는 한 줄 메모.
-- 학부모는 조회 불가. 추후 월간 성장일지 화면에서 이 메모들을 모아
-- 초안 재료로 사용할 예정 (2026-09-02).

alter table public.bookings
add column coach_note text;

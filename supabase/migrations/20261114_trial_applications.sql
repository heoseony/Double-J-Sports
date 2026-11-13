-- 웹사이트 체험수업 신청 (이미 Supabase에 적용됨. 기록용)
create table if not exists public.trial_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 100),
  contact text not null check (char_length(contact) between 3 and 200),
  country text check (country is null or char_length(country) <= 100),
  program text not null check (program in ('pro','academy','women','men','private')),
  message text check (message is null or char_length(message) <= 2000),
  locale text check (locale is null or char_length(locale) <= 10),
  consent_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','contacted','done','cancelled')),
  admin_memo text check (admin_memo is null or char_length(admin_memo) <= 2000),
  handled_at timestamptz
);
create index if not exists trial_applications_status_created_idx on public.trial_applications (status, created_at desc);
alter table public.trial_applications enable row level security;
create policy "trial_applications insert anyone" on public.trial_applications for insert to anon, authenticated
  with check (status = 'new' and admin_memo is null and handled_at is null);
create policy "trial_applications select admin" on public.trial_applications for select using (is_admin());
create policy "trial_applications update admin" on public.trial_applications for update using (is_admin()) with check (is_admin());
create policy "trial_applications delete admin" on public.trial_applications for delete using (is_admin());
revoke all on public.trial_applications from anon;
grant insert on public.trial_applications to anon;

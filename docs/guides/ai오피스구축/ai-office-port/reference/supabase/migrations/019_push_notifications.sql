-- ============================================================
-- 019 — Web Push 알림 인프라
--
-- 가이드(docs/guides/push_notification_guide.md) 의 단일 모임 버전.
--   * push_subscriptions   — 기기별 구독 정보
--   * notification_prefs   — 사용자별 알림 종류 토글 (JSONB)
--   * notification_admin   — 워크스페이스 단위 글로벌 토글 (운영자가 관리)
--   * notification_log     — 중복 발송 방지용 (선택)
-- ============================================================

-- ---------- 1) 구독 ----------
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.user_profiles(user_id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- 2) 사용자별 알림 토글 ----------
-- preferences JSONB 구조 (모두 boolean, 누락 시 true 로 간주):
-- {
--   "join_request":   true,   -- 운영자: 새 가입 신청
--   "join_approved":  true,   -- 본인: 내가 수락됨
--   "member_joined":  true,   -- 멤버: 새 멤버 입장
--   "new_meeting":    true,
--   "new_note":       true,
--   "new_task":       true,   -- 본인 담당으로 새 할일
--   "new_insight":    true,
--   "new_writing":    true,
--   "new_reading":    true,
--   "comment":        true,   -- 내 글에 댓글
--   "like":           true    -- 내 글에 좋아요
-- }
create table public.notification_prefs (
  user_id     uuid primary key references public.user_profiles(user_id) on delete cascade,
  enabled     boolean not null default true,   -- 마스터 스위치
  preferences jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;
create policy notification_prefs_own on public.notification_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 새 사용자 가입 시 기본 prefs row 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  default_workspace_id uuid;
begin
  insert into public.user_profiles (user_id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;

  insert into public.notification_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  select id into default_workspace_id
  from public.workspaces
  order by created_at asc
  limit 1;

  if default_workspace_id is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (default_workspace_id, new.id, 'guest')
    on conflict (workspace_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

-- ---------- 3) 워크스페이스 단위 글로벌 토글 (운영자가 관리) ----------
create table public.notification_admin (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  enabled      jsonb not null default '{
    "join_request":   true,
    "join_approved":  true,
    "member_joined":  true,
    "new_meeting":    true,
    "new_note":       true,
    "new_task":       true,
    "new_insight":    true,
    "new_writing":    true,
    "new_reading":    true,
    "comment":        true,
    "like":           false
  }'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.notification_admin enable row level security;
create policy notification_admin_select on public.notification_admin
  for select to authenticated using (public.is_workspace_member(workspace_id));
create policy notification_admin_update on public.notification_admin
  for all to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- 기존 워크스페이스에 default row 보장
insert into public.notification_admin (workspace_id)
select id from public.workspaces
on conflict (workspace_id) do nothing;

-- ---------- 4) 중복 발송 방지 로그 ----------
create table public.notification_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  type       text not null,
  ref_key    text not null,
  created_at timestamptz not null default now(),
  unique (user_id, type, ref_key)
);
create index notification_log_user_idx on public.notification_log(user_id, created_at desc);

alter table public.notification_log enable row level security;
create policy notification_log_own on public.notification_log
  for select to authenticated using (user_id = auth.uid());

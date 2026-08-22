-- ────────────────────────────────────────────────────────
-- 044: 소셜(좋아요·댓글·답글) polymorphic 통합
-- ────────────────────────────────────────────────────────
-- 배경: 037은 task/content 전용 테이블(task_likes/content_likes …)만 있어
-- 인사이트·기록·회의 등에는 좋아요/댓글을 붙일 수 없었다. 리소스마다 테이블을
-- 늘리는 대신, ref_type+ref_id로 어떤 자원에도 붙는 polymorphic 2테이블로 통합한다.
-- 기존 037 데이터(task/content)는 id를 보존하며 이관(답글 parent_id 유지).
-- idempotent: IF NOT EXISTS / on conflict / DROP POLICY IF EXISTS.

-- ── social_likes ──
create table if not exists social_likes (
  ref_type     text not null,       -- 'task' | 'content' | 'insight' | 'record' | 'meeting' | 'schedule'
  ref_id       text not null,
  user_id      uuid not null,
  workspace_id uuid,
  created_at   timestamptz not null default now(),
  primary key (ref_type, ref_id, user_id)
);
create index if not exists social_likes_ref_idx on social_likes(ref_type, ref_id);

-- ── social_comments ──
create table if not exists social_comments (
  id           uuid primary key default gen_random_uuid(),
  ref_type     text not null,
  ref_id       text not null,
  workspace_id uuid,
  user_id      uuid not null,
  content      text not null,
  parent_id    uuid references social_comments(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists social_comments_ref_idx on social_comments(ref_type, ref_id);

alter table social_likes enable row level security;
alter table social_comments enable row level security;

drop policy if exists social_likes_select on social_likes;
create policy social_likes_select on social_likes for select
  using (workspace_id in (select my_workspace_ids()));
drop policy if exists social_likes_insert on social_likes;
create policy social_likes_insert on social_likes for insert
  with check (user_id = auth.uid() and workspace_id in (select my_workspace_ids()));
drop policy if exists social_likes_delete on social_likes;
create policy social_likes_delete on social_likes for delete
  using (user_id = auth.uid());

drop policy if exists social_comments_select on social_comments;
create policy social_comments_select on social_comments for select
  using (workspace_id in (select my_workspace_ids()));
drop policy if exists social_comments_insert on social_comments;
create policy social_comments_insert on social_comments for insert
  with check (user_id = auth.uid() and workspace_id in (select my_workspace_ids()));
drop policy if exists social_comments_delete on social_comments;
create policy social_comments_delete on social_comments for delete
  using (user_id = auth.uid() or is_workspace_admin(workspace_id));

-- ── 기존 037 데이터 이관 (있을 때만; 없으면 no-op) ──
insert into social_likes (ref_type, ref_id, user_id, workspace_id, created_at)
select 'task', task_id::text, user_id, workspace_id, coalesce(created_at, now())
from task_likes
where to_regclass('public.task_likes') is not null
on conflict do nothing;

insert into social_likes (ref_type, ref_id, user_id, workspace_id, created_at)
select 'content', content_item_id::text, user_id, workspace_id, coalesce(created_at, now())
from content_likes
where to_regclass('public.content_likes') is not null
on conflict do nothing;

insert into social_comments (id, ref_type, ref_id, workspace_id, user_id, content, parent_id, created_at)
select id, 'task', task_id::text, workspace_id, user_id, content, parent_id, created_at
from task_comments
where to_regclass('public.task_comments') is not null
on conflict (id) do nothing;

insert into social_comments (id, ref_type, ref_id, workspace_id, user_id, content, parent_id, created_at)
select id, 'content', content_item_id::text, workspace_id, user_id, content, parent_id, created_at
from content_comments
where to_regclass('public.content_comments') is not null
on conflict (id) do nothing;

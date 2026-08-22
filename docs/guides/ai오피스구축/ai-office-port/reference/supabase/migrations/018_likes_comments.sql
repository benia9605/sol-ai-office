-- ============================================================
-- 018 — writings / readings 에도 likes + comments 붙이기
--
-- 인사이트와 동일한 패턴 — workspace 멤버는 공유된 글에 좋아요와
-- 댓글을 달 수 있다.
-- ============================================================

-- ─── writing_likes ─────────────────────────────────────────────
create table public.writing_likes (
  writing_id uuid not null references public.writings(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (writing_id, user_id)
);
create index writing_likes_user_idx on public.writing_likes(user_id);

-- ─── writing_comments ─────────────────────────────────────────
create table public.writing_comments (
  id         uuid primary key default gen_random_uuid(),
  writing_id uuid not null references public.writings(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index writing_comments_writing_idx
  on public.writing_comments(writing_id, created_at);

-- ─── reading_likes ─────────────────────────────────────────────
create table public.reading_likes (
  reading_id uuid not null references public.readings(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reading_id, user_id)
);
create index reading_likes_user_idx on public.reading_likes(user_id);

-- ─── reading_comments ─────────────────────────────────────────
create table public.reading_comments (
  id         uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.readings(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index reading_comments_reading_idx
  on public.reading_comments(reading_id, created_at);

-- ============================================================
-- RLS
-- ============================================================
alter table public.writing_likes    enable row level security;
alter table public.writing_comments enable row level security;
alter table public.reading_likes    enable row level security;
alter table public.reading_comments enable row level security;

-- ─── writing_likes ─────────────────────────────────────────────
create policy writing_likes_select on public.writing_likes
  for select to authenticated using (
    exists (
      select 1 from public.writings w
      where w.id = writing_id
        and public.is_workspace_member(w.workspace_id)
    )
  );
create policy writing_likes_insert_self on public.writing_likes
  for insert to authenticated with check (user_id = auth.uid());
create policy writing_likes_delete_self on public.writing_likes
  for delete to authenticated using (user_id = auth.uid());

-- ─── writing_comments ─────────────────────────────────────────
create policy writing_comments_select on public.writing_comments
  for select to authenticated using (
    exists (
      select 1 from public.writings w
      where w.id = writing_id
        and public.is_workspace_member(w.workspace_id)
    )
  );
create policy writing_comments_insert on public.writing_comments
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.writings w
      where w.id = writing_id
        and public.is_workspace_member(w.workspace_id)
    )
  );
create policy writing_comments_delete on public.writing_comments
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.writings w
      where w.id = writing_id
        and public.is_workspace_admin(w.workspace_id)
    )
  );

-- ─── reading_likes ─────────────────────────────────────────────
create policy reading_likes_select on public.reading_likes
  for select to authenticated using (
    exists (
      select 1 from public.readings r
      where r.id = reading_id
        and public.is_workspace_member(r.workspace_id)
    )
  );
create policy reading_likes_insert_self on public.reading_likes
  for insert to authenticated with check (user_id = auth.uid());
create policy reading_likes_delete_self on public.reading_likes
  for delete to authenticated using (user_id = auth.uid());

-- ─── reading_comments ─────────────────────────────────────────
create policy reading_comments_select on public.reading_comments
  for select to authenticated using (
    exists (
      select 1 from public.readings r
      where r.id = reading_id
        and public.is_workspace_member(r.workspace_id)
    )
  );
create policy reading_comments_insert on public.reading_comments
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.readings r
      where r.id = reading_id
        and public.is_workspace_member(r.workspace_id)
    )
  );
create policy reading_comments_delete on public.reading_comments
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.readings r
      where r.id = reading_id
        and public.is_workspace_admin(r.workspace_id)
    )
  );

notify pgrst, 'reload schema';

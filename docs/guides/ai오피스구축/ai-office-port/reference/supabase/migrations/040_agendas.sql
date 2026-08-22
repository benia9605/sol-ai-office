-- ============================================================
-- 040 — 안건 + 투표 (Agendas & Polls)
--
-- 그때그때 멤버가 안건을 올리고 마감 시간 정해 투표를 받는다.
-- 모임에 묶이지 않은 독립 자원 (own menu).
--
-- poll_type:
--   - 'single'  : 객관식 단일선택
--   - 'multi'   : 객관식 복수선택
--   - 'text'    : 주관식 (자유 응답)
--
-- 마감 후엔 application-level 로 read-only. 다수결 채택은 client
-- 에서 votes 를 집계해 표시한다 (객관식만).
-- ============================================================

create table public.agendas (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  user_id       uuid not null references public.user_profiles(user_id) on delete cascade,
  title         text not null,
  description   text,
  poll_type     text not null check (poll_type in ('single', 'multi', 'text')),
  -- [{id: string, label: string}] — text 면 빈 배열
  options       jsonb not null default '[]'::jsonb,
  deadline      timestamptz not null,
  -- 작성자가 수동 마감했을 때만 set. 보통은 deadline 으로 판단.
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index agendas_workspace_idx
  on public.agendas(workspace_id, deadline desc);

create trigger agendas_touch
  before update on public.agendas
  for each row execute function public.touch_updated_at();

-- ─── agenda_votes ─────────────────────────────────────────────
-- 한 사용자가 한 안건당 한 행 (upsert). choices = 선택한 option id 들.
-- text answer 는 주관식일 때 사용.
create table public.agenda_votes (
  id          uuid primary key default gen_random_uuid(),
  agenda_id   uuid not null references public.agendas(id) on delete cascade,
  user_id     uuid not null references public.user_profiles(user_id) on delete cascade,
  choices     text[] not null default '{}',
  text_answer text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (agenda_id, user_id)
);

create index agenda_votes_agenda_idx on public.agenda_votes(agenda_id);

create trigger agenda_votes_touch
  before update on public.agenda_votes
  for each row execute function public.touch_updated_at();

-- ─── agenda_comments ──────────────────────────────────────────
create table public.agenda_comments (
  id         uuid primary key default gen_random_uuid(),
  agenda_id  uuid not null references public.agendas(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(user_id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

create index agenda_comments_agenda_idx
  on public.agenda_comments(agenda_id, created_at);

-- ============================================================
-- RLS
-- ============================================================
alter table public.agendas         enable row level security;
alter table public.agenda_votes    enable row level security;
alter table public.agenda_comments enable row level security;

-- agendas
create policy agendas_select on public.agendas
  for select to authenticated using (
    public.is_workspace_member(workspace_id)
  );
create policy agendas_insert_self on public.agendas
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );
create policy agendas_update on public.agendas
  for update to authenticated
  using (
    user_id = auth.uid() or public.is_workspace_admin(workspace_id)
  )
  with check (
    user_id = auth.uid() or public.is_workspace_admin(workspace_id)
  );
create policy agendas_delete on public.agendas
  for delete to authenticated using (
    user_id = auth.uid() or public.is_workspace_admin(workspace_id)
  );

-- agenda_votes
create policy agenda_votes_select on public.agenda_votes
  for select to authenticated using (
    exists (
      select 1 from public.agendas a
      where a.id = agenda_id
        and public.is_workspace_member(a.workspace_id)
    )
  );
create policy agenda_votes_insert_self on public.agenda_votes
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.agendas a
      where a.id = agenda_id
        and public.is_workspace_member(a.workspace_id)
    )
  );
create policy agenda_votes_update_self on public.agenda_votes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy agenda_votes_delete on public.agenda_votes
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.agendas a
      where a.id = agenda_id
        and public.is_workspace_admin(a.workspace_id)
    )
  );

-- agenda_comments
create policy agenda_comments_select on public.agenda_comments
  for select to authenticated using (
    exists (
      select 1 from public.agendas a
      where a.id = agenda_id
        and public.is_workspace_member(a.workspace_id)
    )
  );
create policy agenda_comments_insert_self on public.agenda_comments
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.agendas a
      where a.id = agenda_id
        and public.is_workspace_member(a.workspace_id)
    )
  );
create policy agenda_comments_delete on public.agenda_comments
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (
      select 1 from public.agendas a
      where a.id = agenda_id
        and public.is_workspace_admin(a.workspace_id)
    )
  );

notify pgrst, 'reload schema';

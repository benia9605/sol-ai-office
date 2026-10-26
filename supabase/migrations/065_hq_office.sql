-- ────────────────────────────────────────────────────────
-- 065: 본부(sol-hq) 연동 + 브랜드 오피스 기본 템플릿
-- ────────────────────────────────────────────────────────
-- 배경 (2026-10-27 대표 결정):
--   · 시목 · 쏠닝포인트 · 운명랩 오피스가 같은 템플릿을 쓰고, 워크스페이스마다 브랜드 값만 다르다
--   · 브리핑 · 실적 · 할 일 · 리서치 · 콘텐츠 초안은 본부(대표 맥의 Claude)가 매일 09:00 한 꾸러미로 보낸다
--   · 각 앱은 오피스에 직접 보내지 않는다 (연동은 본부 하나)
--
-- 이 마이그레이션은
--   ① workspaces 에 브랜드 값 칸 (이름 · 로고 · 소개 · 배경 · 포인트 컬러 · 대표 이미지 · 본부 키)
--   ② 본부 표 8개 - 브리핑 · 실적 · 할 일 · 결정 · 리서치 · 콘텐츠 · 프롬프트(용도 · 본문 · 버전)
--   ③ RLS - 워크스페이스 멤버만 읽고 쓴다
--   ④ hq_ingest / hq_pull - 본부 토큰(ingest_credentials, scope 'hq:ingest')으로만 부르는 함수
--      서버 코드 배포 없이 REST rpc 로 부른다. 토큰은 sha256 해시만 DB 에 있다
-- 모든 단계 가산적(additive) · idempotent. 기존 표 · 화면은 건드리지 않는다.

create extension if not exists pgcrypto with schema extensions;

-- ── ① 브랜드 값 ──
alter table workspaces add column if not exists brand_logo       text;   -- 로고 글자 (SIMOK)
alter table workspaces add column if not exists brand_sub        text;   -- 로고 아래 작은 글 (THE PRIVATE OFFICE)
alter table workspaces add column if not exists brand_motto      text;   -- 한 줄 소개
alter table workspaces add column if not exists brand_paper      text;   -- 배경 컬러 #rrggbb
alter table workspaces add column if not exists brand_point      text;   -- 포인트 컬러 #rrggbb
alter table workspaces add column if not exists brand_hero_image text;   -- 대표 이미지 경로 (없으면 글자)
alter table workspaces add column if not exists brand_hero_word  text;   -- 대표 글자 (OZ · 입동)
alter table workspaces add column if not exists hq_brand_key     text;   -- 본부 브랜드 키 simok | solningpoint | unmyunglab
create unique index if not exists workspaces_hq_brand_key_uidx on workspaces(hq_brand_key) where hq_brand_key is not null;

do $$ begin
  alter table workspaces add constraint workspaces_brand_color_chk
    check ((brand_paper is null or brand_paper ~ '^#[0-9A-Fa-f]{6}$') and (brand_point is null or brand_point ~ '^#[0-9A-Fa-f]{6}$'));
exception when duplicate_object then null; end $$;

comment on column workspaces.hq_brand_key is '본부(sol-hq) 브랜드 키. 본부 꾸러미가 어느 워크스페이스로 갈지 정한다';

-- ── ② 본부 표 ──
-- 브리핑: 하루 1행 (본부 브리핑 HTML 을 그대로 - 오피스는 sandbox iframe 으로 보여 준다)
create table if not exists hq_briefings (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  date         date not null,
  title        text not null,
  summary      text,
  html         text,                         -- 그 브랜드 부분만 담은 브리핑 HTML
  meta         jsonb not null default '{}',  -- todo_count · decision_count 등
  source       text not null default 'hq' check (source in ('hq','me')),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists hq_briefings_hq_uidx on hq_briefings(workspace_id, date) where source = 'hq';
create index if not exists hq_briefings_ws_idx on hq_briefings(workspace_id, date desc);

-- 실적: 하루 1행
create table if not exists hq_metrics (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  date         date not null,                -- 실적 날짜 (어제)
  items        jsonb not null default '[]',  -- [{label, value, note}] 화면 4칸
  raw          jsonb not null default '{}',  -- {revenue, sales, visits, signups, byChannel, ...} 원본 숫자
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, date)
);

-- 할 일 (+ 제안 · 이월)
create table if not exists hq_tasks (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  title            text not null,
  why              text,
  source           text not null default 'me' check (source in ('hq','me')),
  source_label     text,                     -- 본부가 뽑은 곳 (대화 · 메모 · git ...)
  status           text not null default 'open' check (status in ('proposed','open','done','held','deleted')),
  due_date         date,                     -- 없으면 오늘 할 일
  assignee_user_id uuid references auth.users(id) on delete set null,
  assignee_shared  boolean not null default false,   -- 「공동」
  memo             text,
  history          jsonb not null default '[]',      -- [{at, text}]
  hq_key           text,                     -- 본부 중복 방지 키
  created_by       uuid references auth.users(id) on delete set null,
  done_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists hq_tasks_key_uidx on hq_tasks(workspace_id, hq_key) where hq_key is not null;
create index if not exists hq_tasks_ws_idx on hq_tasks(workspace_id, status, due_date);

-- 결정 대기
create table if not exists hq_decisions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  date         date not null,
  question     text not null,
  why          text,
  options      jsonb not null default '[]',  -- ["안 1", "안 2"]
  status       text not null default 'open' check (status in ('open','decided','held')),
  picked       text,
  opinion      text,
  make_task    boolean not null default true,
  decided_by   uuid references auth.users(id) on delete set null,
  decided_at   timestamptz,
  hq_key       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists hq_decisions_key_uidx on hq_decisions(workspace_id, hq_key) where hq_key is not null;
create index if not exists hq_decisions_ws_idx on hq_decisions(workspace_id, status, date desc);

-- 리서치 (본부 매일 + 직접 메모)
create table if not exists hq_research (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  date         date not null default current_date,
  kind         text not null,               -- 인기 상품 · 인기 콘텐츠 · 트렌드 · 표현 · 아이디어
  title        text not null,
  summary      text,
  evidence     jsonb not null default '[]',
  judgment     text,
  implications jsonb not null default '[]',  -- 시사점
  sources      jsonb not null default '[]',  -- [{title, url}]
  link         text,
  source       text not null default 'hq' check (source in ('hq','me')),
  hq_key       text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create unique index if not exists hq_research_key_uidx on hq_research(workspace_id, hq_key) where hq_key is not null;
create index if not exists hq_research_ws_idx on hq_research(workspace_id, date desc);

-- 프롬프트 용도 · 프롬프트 · 버전
create table if not exists hq_prompt_categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  position     int not null default 0,
  created_at   timestamptz not null default now(),
  unique (workspace_id, name)
);
create table if not exists hq_prompts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  category_id   uuid references hq_prompt_categories(id) on delete set null,  -- 지우면 미분류
  title         text not null,
  tool          text,
  body          text not null,
  version       int not null default 1,
  source        text not null default 'me' check (source in ('hq','me')),
  last_used_at  timestamptz,
  hq_key        text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists hq_prompts_key_uidx on hq_prompts(workspace_id, hq_key) where hq_key is not null;
create table if not exists hq_prompt_versions (
  id           uuid primary key default gen_random_uuid(),
  prompt_id    uuid not null references hq_prompts(id) on delete cascade,
  version      int not null,
  body         text not null,
  note         text,
  author_label text,                          -- 멤버 이름 · 본부
  created_at   timestamptz not null default now(),
  unique (prompt_id, version)
);

-- 콘텐츠 (기획 · 원고 · 촬영 · 편집 · 게시 완료)
create table if not exists hq_contents (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  title         text not null,
  channel       text,
  stage         text not null default 'plan' check (stage in ('plan','draft','shoot','edit','done')),
  due_date      date,
  draft         text,
  draft_version int not null default 0,
  draft_status  text check (draft_status in ('auto','edited','confirmed')),
  prompt_id     uuid references hq_prompts(id) on delete set null,
  memo          text,
  position      int not null default 0,
  source        text not null default 'me' check (source in ('hq','me')),
  hq_key        text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists hq_contents_key_uidx on hq_contents(workspace_id, hq_key) where hq_key is not null;
create index if not exists hq_contents_ws_idx on hq_contents(workspace_id, stage, position);

-- ── ③ RLS: 워크스페이스 멤버만 ──
do $$
declare t text;
begin
  foreach t in array array['hq_briefings','hq_metrics','hq_tasks','hq_decisions','hq_research','hq_prompt_categories','hq_prompts','hq_contents'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_select', t);
    execute format('create policy %I on %I for select using (workspace_id in (select my_workspace_ids()))', t || '_select', t);
    execute format('drop policy if exists %I on %I', t || '_insert', t);
    execute format('create policy %I on %I for insert with check (workspace_id in (select my_workspace_ids()))', t || '_insert', t);
    execute format('drop policy if exists %I on %I', t || '_update', t);
    execute format('create policy %I on %I for update using (workspace_id in (select my_workspace_ids())) with check (workspace_id in (select my_workspace_ids()))', t || '_update', t);
    execute format('drop policy if exists %I on %I', t || '_delete', t);
    execute format('create policy %I on %I for delete using (workspace_id in (select my_workspace_ids()))', t || '_delete', t);
  end loop;
end $$;

-- 프롬프트 버전은 부모 프롬프트의 워크스페이스로 판단
alter table hq_prompt_versions enable row level security;
drop policy if exists hq_prompt_versions_select on hq_prompt_versions;
create policy hq_prompt_versions_select on hq_prompt_versions for select
  using (prompt_id in (select id from hq_prompts where workspace_id in (select my_workspace_ids())));
drop policy if exists hq_prompt_versions_insert on hq_prompt_versions;
create policy hq_prompt_versions_insert on hq_prompt_versions for insert
  with check (prompt_id in (select id from hq_prompts where workspace_id in (select my_workspace_ids())));

-- ── ④ 본부 함수 ──
-- 토큰 → 워크스페이스 (scope 'hq:ingest' · 활성 · 폐기 아님). 실패하면 예외
create or replace function hq_auth(p_token text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare ws uuid;
begin
  select workspace_id into ws from ingest_credentials
   where token_sha256 = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and is_active and revoked_at is null and 'hq:ingest' = any(scopes)
   limit 1;
  if ws is null then raise exception 'hq_auth: invalid token' using errcode = '28000'; end if;
  update ingest_credentials set last_used_at = now() where token_sha256 = encode(extensions.digest(p_token, 'sha256'), 'hex');
  return ws;
end $$;
revoke all on function hq_auth(text) from public, anon, authenticated;

-- 본부 → 오피스: 하루 꾸러미
--   p_payload = { date, briefing{title,summary,html,meta}, metrics{date,items,raw},
--                 tasks[{key,title,why,source_label,due_date,proposed}], decisions[{key,question,why,options}],
--                 research[{key,kind,title,summary,evidence,judgment,implications,sources,link}],
--                 contents[{key,title,channel,stage,due_date}], drafts[{content_id,draft,prompt_id}],
--                 prompts[{key,category,title,tool,body}] }
create or replace function hq_ingest(p_token text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  ws uuid := hq_auth(p_token);
  d  date := coalesce((p_payload->>'date')::date, current_date);
  x  jsonb;
  n  jsonb := '{}';
  cat uuid;
  c  int;
begin
  -- 브리핑 (하루 1행, 다시 보내면 덮어씀)
  if p_payload ? 'briefing' then
    x := p_payload->'briefing';
    insert into hq_briefings (workspace_id, date, title, summary, html, meta, source)
    values (ws, d, coalesce(x->>'title', d::text), x->>'summary', x->>'html', coalesce(x->'meta', '{}'), 'hq')
    on conflict (workspace_id, date) where source = 'hq'
    do update set title = excluded.title, summary = excluded.summary, html = excluded.html, meta = excluded.meta, updated_at = now();
    n := n || '{"briefing":1}';
  end if;

  -- 실적
  if p_payload ? 'metrics' then
    x := p_payload->'metrics';
    insert into hq_metrics (workspace_id, date, items, raw)
    values (ws, (x->>'date')::date, coalesce(x->'items', '[]'), coalesce(x->'raw', '{}'))
    on conflict (workspace_id, date) do update set items = excluded.items, raw = excluded.raw, updated_at = now();
    n := n || '{"metrics":1}';
  end if;

  -- 할 일 · 제안: 새 것만 넣고, 이미 있으면 설명만 고친다 (상태 · 일정 · 담당은 사람이 정한 그대로)
  c := 0;
  for x in select * from jsonb_array_elements(coalesce(p_payload->'tasks', '[]')) loop
    insert into hq_tasks (workspace_id, title, why, source, source_label, status, due_date, hq_key)
    values (ws, x->>'title', x->>'why', 'hq', x->>'source_label',
            case when (x->>'proposed')::boolean then 'proposed' else 'open' end,
            nullif(x->>'due_date', '')::date, x->>'key')
    on conflict (workspace_id, hq_key) where hq_key is not null
    do update set why = excluded.why, source_label = excluded.source_label, updated_at = now();
    c := c + 1;
  end loop;
  n := n || jsonb_build_object('tasks', c);

  -- 결정 대기: 새 것만 (이미 답한 결정은 건드리지 않는다)
  c := 0;
  for x in select * from jsonb_array_elements(coalesce(p_payload->'decisions', '[]')) loop
    insert into hq_decisions (workspace_id, date, question, why, options, hq_key)
    values (ws, d, x->>'question', x->>'why', coalesce(x->'options', '[]'), x->>'key')
    on conflict (workspace_id, hq_key) where hq_key is not null do nothing;
    c := c + 1;
  end loop;
  n := n || jsonb_build_object('decisions', c);

  -- 리서치
  c := 0;
  for x in select * from jsonb_array_elements(coalesce(p_payload->'research', '[]')) loop
    insert into hq_research (workspace_id, date, kind, title, summary, evidence, judgment, implications, sources, link, source, hq_key)
    values (ws, d, x->>'kind', x->>'title', x->>'summary', coalesce(x->'evidence', '[]'), x->>'judgment',
            coalesce(x->'implications', '[]'), coalesce(x->'sources', '[]'), x->>'link', 'hq', x->>'key')
    on conflict (workspace_id, hq_key) where hq_key is not null do nothing;
    c := c + 1;
  end loop;
  n := n || jsonb_build_object('research', c);

  -- 콘텐츠 (본부 예약): 새 것만
  c := 0;
  for x in select * from jsonb_array_elements(coalesce(p_payload->'contents', '[]')) loop
    insert into hq_contents (workspace_id, title, channel, stage, due_date, source, hq_key)
    values (ws, x->>'title', x->>'channel', coalesce(x->>'stage', 'plan'), nullif(x->>'due_date', '')::date, 'hq', x->>'key')
    on conflict (workspace_id, hq_key) where hq_key is not null do nothing;
    c := c + 1;
  end loop;
  n := n || jsonb_build_object('contents', c);

  -- 원고 초안: 사람이 고치거나 확정한 원고는 덮어쓰지 않는다
  c := 0;
  for x in select * from jsonb_array_elements(coalesce(p_payload->'drafts', '[]')) loop
    update hq_contents
       set draft = x->>'draft', draft_version = draft_version + 1, draft_status = 'auto',
           prompt_id = nullif(x->>'prompt_id', '')::uuid, updated_at = now()
     where id = (x->>'content_id')::uuid and workspace_id = ws
       and coalesce(draft_status, 'auto') = 'auto';
    if found then c := c + 1; end if;
  end loop;
  n := n || jsonb_build_object('drafts', c);

  -- 프롬프트 (본부가 모은 것): 새 것만
  c := 0;
  for x in select * from jsonb_array_elements(coalesce(p_payload->'prompts', '[]')) loop
    cat := null;
    if coalesce(x->>'category', '') <> '' then
      insert into hq_prompt_categories (workspace_id, name, position)
      values (ws, x->>'category', 99) on conflict (workspace_id, name) do nothing;
      select id into cat from hq_prompt_categories where workspace_id = ws and name = x->>'category';
    end if;
    insert into hq_prompts (workspace_id, category_id, title, tool, body, source, hq_key)
    values (ws, cat, x->>'title', x->>'tool', x->>'body', 'hq', x->>'key')
    on conflict (workspace_id, hq_key) where hq_key is not null do nothing;
    c := c + 1;
  end loop;
  n := n || jsonb_build_object('prompts', c);

  return n || jsonb_build_object('workspace_id', ws, 'date', d);
end $$;
revoke all on function hq_ingest(text, jsonb) from public;
grant execute on function hq_ingest(text, jsonb) to anon, authenticated;

-- 오피스 → 본부: 사람이 한 것 (체크 · 결정 · 직접 적은 할 일 · 메모 · 원고 단계 콘텐츠)
create or replace function hq_pull(p_token text, p_since timestamptz default now() - interval '2 days')
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare ws uuid := hq_auth(p_token);
begin
  return jsonb_build_object(
    'workspace_id', ws,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', coalesce(m.nickname, ''), 'role', m.role)), '[]')
                  from workspace_members m where m.workspace_id = ws),
    'tasks', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'key', t.hq_key, 'title', t.title, 'source', t.source, 'status', t.status,
                     'due_date', t.due_date, 'assignee_user_id', t.assignee_user_id, 'shared', t.assignee_shared, 'memo', t.memo, 'done_at', t.done_at,
                     'updated_at', t.updated_at) order by t.updated_at desc), '[]')
                from hq_tasks t where t.workspace_id = ws and (t.status in ('open','proposed') or t.updated_at >= p_since)),
    'decisions', (select coalesce(jsonb_agg(jsonb_build_object('key', x.hq_key, 'question', x.question, 'status', x.status, 'picked', x.picked,
                     'opinion', x.opinion, 'make_task', x.make_task, 'decided_at', x.decided_at)), '[]')
                from hq_decisions x where x.workspace_id = ws and (x.status = 'open' or x.decided_at >= p_since)),
    'research_notes', (select coalesce(jsonb_agg(jsonb_build_object('kind', r.kind, 'title', r.title, 'summary', r.summary, 'link', r.link, 'date', r.date)), '[]')
                from hq_research r where r.workspace_id = ws and r.source = 'me' and r.created_at >= p_since),
    'contents', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'key', c.hq_key, 'title', c.title, 'channel', c.channel, 'stage', c.stage,
                     'due_date', c.due_date, 'draft', c.draft, 'draft_status', c.draft_status, 'memo', c.memo)), '[]')
                from hq_contents c where c.workspace_id = ws and c.stage <> 'done'),
    'prompts', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'category', pc.name, 'tool', p.tool, 'body', p.body, 'version', p.version)), '[]')
                from hq_prompts p left join hq_prompt_categories pc on pc.id = p.category_id where p.workspace_id = ws)
  );
end $$;
revoke all on function hq_pull(text, timestamptz) from public;
grant execute on function hq_pull(text, timestamptz) to anon, authenticated;

comment on function hq_ingest(text, jsonb) is '본부(sol-hq) → 오피스 하루 꾸러미. 토큰(ingest_credentials scope hq:ingest)이 워크스페이스를 정한다';
comment on function hq_pull(text, timestamptz) is '오피스 → 본부. 체크 · 결정 · 직접 할 일 · 메모 · 진행 중 콘텐츠 · 프롬프트';

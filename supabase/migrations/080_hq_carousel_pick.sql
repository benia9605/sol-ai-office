-- ────────────────────────────────────────────────────────
-- 080: 캐러셀 사진 고르기 - 장마다 3안 · 선택 · 수정 요청 · 사진 올리기 (2026-10-31 대표 확정 · 시안 4판)
-- ────────────────────────────────────────────────────────
-- 배경:
--   · 본부가 시목 캐러셀 장마다 SSD 연출샷 후보 3안을 만든다 → 오피스 04 콘텐츠 캐러셀 판에서 대표 · 남편이 장마다 고른다
--   · 「선택 완료」 하면 본부가 몇 분 안에 가져가 확정본(PNG)을 만들고 편집 칸 카드로 바꾼다 (074 hq_carousel)
--   · 수정 요청(장 여러 개 · 글 · 그림 한 장) → 본부가 그 장을 교체하거나(새 3안) 가이드에 반영하고 답글 · 해결
--   · 직접 만든 사진은 「사진 올리기」 → 앨범 → 본부가 그 장 후보로 넣는다
--
-- 이 마이그레이션은
--   ① hq_contents 에 order_md(이미지 주문서) · pick_status(none · picking · done · made)
--   ② 표 4개 (RLS = 그 오피스 멤버): hq_content_alts 장마다 3안 그림 · hq_content_picks 고른 안 ·
--      hq_content_requests 수정 요청 · hq_content_uploads 올린 사진
--   ③ 본부 함수: hq_carousel_alts(토큰, 꾸러미) · hq_carousel_pull(토큰) · hq_carousel_reply(토큰, 요청 id, 답글, 해결)
--      074 hq_carousel · hq_topics 는 그대로 (반환 안 바꿈)
--   ④ 확인
-- 가산적 · 여러 번 돌려도 안전.

-- ── ① 칼럼 ──
alter table hq_contents add column if not exists order_md    text;
alter table hq_contents add column if not exists pick_status text not null default 'none';
do $$ begin
  alter table hq_contents drop constraint if exists hq_contents_pick_status_check;
  alter table hq_contents add constraint hq_contents_pick_status_check check (pick_status in ('none', 'picking', 'done', 'made'));
end $$;

-- ── ② 표 ──
create table if not exists hq_content_alts (
  id            uuid primary key default gen_random_uuid(),
  content_id    uuid not null references hq_contents(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  slide_no      int  not null,                 -- 1부터
  alt           int  not null check (alt between 1 and 3),
  mime          text not null default 'image/jpeg',
  data          bytea not null,                -- 그 안 사진을 넣어 찍은 장 그림
  changed       boolean not null default false, -- 수정 요청으로 바뀐 장 (「바뀜」)
  created_at    timestamptz not null default now(),
  unique (content_id, slide_no, alt)
);
create index if not exists hq_content_alts_content_idx on hq_content_alts(content_id, slide_no, alt);

create table if not exists hq_content_picks (
  content_id    uuid not null references hq_contents(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  slide_no      int  not null,
  alt           int  not null check (alt between 1 and 3),
  picked_by     uuid references auth.users(id) on delete set null,
  picked_at     timestamptz not null default now(),
  primary key (content_id, slide_no)
);

create table if not exists hq_content_requests (
  id            uuid primary key default gen_random_uuid(),
  content_id    uuid not null references hq_contents(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  slide_nos     int[] not null default '{}',   -- 비면 전체
  body          text not null,
  image_mime    text,
  image_data    bytea,                         -- 참고 그림 한 장 (3MB 까지)
  author_id     uuid references auth.users(id) on delete set null,
  hq_reply      text,                          -- 본부 답글
  hq_kind       text check (hq_kind in ('change', 'praise', 'other')),   -- 본부가 읽은 뜻 (교체 · 칭찬 → 가이드)
  replied_at    timestamptz,
  resolved      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists hq_content_requests_content_idx on hq_content_requests(content_id, created_at);

create table if not exists hq_content_uploads (
  id            uuid primary key default gen_random_uuid(),
  content_id    uuid not null references hq_contents(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  slide_no      int,                           -- 어느 장에 쓸 사진 (비면 지정 안 함)
  mime          text not null default 'image/jpeg',
  data          bytea not null,
  uploaded_by   uuid references auth.users(id) on delete set null,
  taken_at      timestamptz,                   -- 본부가 가져간 때
  created_at    timestamptz not null default now()
);
create index if not exists hq_content_uploads_content_idx on hq_content_uploads(content_id, created_at);

do $$ declare t text; begin
  foreach t in array array['hq_content_alts', 'hq_content_picks', 'hq_content_requests', 'hq_content_uploads'] loop
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

-- ── ③ 본부 함수 ──
-- 본부 → 오피스: 장마다 3안 그림 · 이미지 주문서 · 글
--   p_payload = { key, slides: [{ no, alt, mime, b64 }], only: [3, 5] (이 장만 바꿈 · 비면 전부), order_md, caption_ig, caption_threads }
--   바뀐 장은 changed = true · 그 장의 고른 안은 지운다 (다시 고르게) · 카드는 picking
create or replace function hq_carousel_alts(p_token text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  ws uuid := hq_auth(p_token);
  cid uuid; s jsonb; raw bytea; n int := 0;
  only_nos int[] := coalesce((select array_agg(x::int) from jsonb_array_elements_text(coalesce(p_payload->'only', '[]'::jsonb)) x), '{}');
begin
  select id into cid from hq_contents where workspace_id = ws and hq_key = p_payload->>'key';
  if cid is null then raise exception 'hq_carousel_alts: 카드 없음 (먼저 hq_carousel 로 시안 카드)'; end if;
  if cardinality(only_nos) = 0 then
    delete from hq_content_alts where content_id = cid;
    delete from hq_content_picks where content_id = cid;
  else
    delete from hq_content_alts where content_id = cid and slide_no = any(only_nos);
    delete from hq_content_picks where content_id = cid and slide_no = any(only_nos);
  end if;
  for s in select * from jsonb_array_elements(coalesce(p_payload->'slides', '[]'::jsonb)) loop
    raw := decode(s->>'b64', 'base64');
    if octet_length(raw) > 3 * 1024 * 1024 then raise exception 'hq_carousel_alts: 장 그림이 3MB 를 넘음'; end if;
    insert into hq_content_alts (content_id, workspace_id, slide_no, alt, mime, data, changed)
    values (cid, ws, (s->>'no')::int, (s->>'alt')::int, coalesce(nullif(s->>'mime', ''), 'image/jpeg'), raw, cardinality(only_nos) > 0)
    on conflict (content_id, slide_no, alt) do update set mime = excluded.mime, data = excluded.data, changed = excluded.changed, created_at = now();
    n := n + 1;
  end loop;
  update hq_contents set
    order_md = coalesce(p_payload->>'order_md', order_md),
    caption_ig = coalesce(p_payload->>'caption_ig', caption_ig),
    caption_threads = coalesce(p_payload->>'caption_threads', caption_threads),
    pick_status = 'picking', updated_at = now()
  where id = cid;
  return jsonb_build_object('ok', true, 'id', cid, 'alts', n);
end $$;
revoke all on function hq_carousel_alts(text, jsonb) from public;
grant execute on function hq_carousel_alts(text, jsonb) to anon, authenticated, service_role;
comment on function hq_carousel_alts(text, jsonb) is '본부 → 오피스 캐러셀 장마다 3안 · 이미지 주문서 (080)';

-- 오피스 → 본부: 선택 완료된 카드(가져가는 순간 made) · 답 안 한 수정 요청 · 아직 안 가져간 올린 사진(가져가는 순간 taken)
create or replace function hq_carousel_pull(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare ws uuid := hq_auth(p_token); out_done jsonb; out_up jsonb;
begin
  with picked as (
    update hq_contents set pick_status = 'made', updated_at = now()
     where workspace_id = ws and pick_status = 'done'
     returning id, hq_key
  )
  select coalesce(jsonb_agg(jsonb_build_object('key', p.hq_key,
           'picks', (select coalesce(jsonb_agg(jsonb_build_object('slide_no', k.slide_no, 'alt', k.alt) order by k.slide_no), '[]'::jsonb) from hq_content_picks k where k.content_id = p.id))), '[]'::jsonb)
    into out_done from picked p;

  with up as (
    update hq_content_uploads set taken_at = now()
     where workspace_id = ws and taken_at is null
     returning id, content_id, slide_no, mime, data
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'key', c.hq_key, 'slide_no', u.slide_no, 'mime', u.mime, 'b64', encode(u.data, 'base64'))), '[]'::jsonb)
    into out_up from up u join hq_contents c on c.id = u.content_id;

  return jsonb_build_object(
    'done', out_done,
    'requests', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'key', c.hq_key, 'slide_nos', to_jsonb(r.slide_nos), 'body', r.body,
                   'author', coalesce(m.nickname, ''), 'created_at', r.created_at,
                   'image', case when r.image_data is null then null else jsonb_build_object('mime', r.image_mime, 'b64', encode(r.image_data, 'base64')) end) order by r.created_at), '[]'::jsonb)
                   from hq_content_requests r join hq_contents c on c.id = r.content_id
                   left join workspace_members m on m.workspace_id = r.workspace_id and m.user_id = r.author_id
                  where r.workspace_id = ws and r.hq_reply is null and not r.resolved),
    'uploads', out_up
  );
end $$;
revoke all on function hq_carousel_pull(text) from public;
grant execute on function hq_carousel_pull(text) to anon, authenticated, service_role;
comment on function hq_carousel_pull(text) is '오피스 → 본부 캐러셀 선택 완료 · 수정 요청 · 올린 사진 (080)';

-- 본부 → 오피스: 수정 요청 답글 (교체 · 가이드 반영) · 해결 표시
create or replace function hq_carousel_reply(p_token text, p_request_id uuid, p_reply text, p_resolved boolean default true, p_kind text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare ws uuid := hq_auth(p_token); n int;
begin
  update hq_content_requests set hq_reply = p_reply, replied_at = now(), resolved = coalesce(p_resolved, true),
         hq_kind = case when p_kind in ('change', 'praise', 'other') then p_kind else hq_kind end
   where id = p_request_id and workspace_id = ws;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1);
end $$;
revoke all on function hq_carousel_reply(text, uuid, text, boolean, text) from public;
grant execute on function hq_carousel_reply(text, uuid, text, boolean, text) to anon, authenticated, service_role;
comment on function hq_carousel_reply(text, uuid, text, boolean, text) is '본부 → 오피스 캐러셀 수정 요청 답글 · 해결 (080)';

-- ── ④ 확인 ── 표 4 · 함수 3 · 칼럼 2
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename in ('hq_content_alts', 'hq_content_picks', 'hq_content_requests', 'hq_content_uploads')) as tables_4,
  (select count(*) from pg_proc where proname in ('hq_carousel_alts', 'hq_carousel_pull', 'hq_carousel_reply')) as functions_3,
  (select count(*) from information_schema.columns where table_name = 'hq_contents' and column_name in ('order_md', 'pick_status')) as columns_2;

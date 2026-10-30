-- ────────────────────────────────────────────────────────
-- 073: 인사이트 함 - 폰 단축어로 툭 던지는 링크 · 캡처 · 메모 (2026-10-30 대표 결정)
-- ────────────────────────────────────────────────────────
-- 배경:
--   · 인스타 · 스레드 · 유튜브에서 본 것을 공유 버튼 → 「인사이트」 단축어로 오피스에 던진다
--   · 종류 셋 (위에서부터 처음 맞는 칸): ai = AI · 프롬프트 / reference = 레퍼런스 참고 / info = 인사이트 정보
--   · 브랜드 하나: common 공통 · simok 시목 · solningpoint 쏠닝오즈 · unmyunglab 운명랩
--   · 본부(sol-hq)가 매일 아침 읽고 (캡처 속 글까지) 공통/배움 에 정리 → 보고서 「오늘 배운 것」
--
-- 이 마이그레이션은
--   ① hq_insights · hq_insight_images (캡처는 bytea - 장당 3MB · 한 번에 10장까지)
--   ② hq_insight_add(토큰, 꾸러미) - 단축어 전용. 토큰 scope 'insight:add' 는 「넣기」 만 된다 (읽기 · 고치기 · 지우기 없음)
--      브랜드 워크스페이스로 보내고, 공통은 토큰의 워크스페이스(쏠닝포인트)에 brand=common 으로
--   ③ hq_insights(본부 토큰, 며칠) - 본부가 읽기 (그 워크스페이스 것 + 공통) · hq_insight_note(본부 토큰, id, 정리, 상태) - 본부가 읽은 표시 · 정리
--   ④ 단축어 토큰 1개 등록 - 해시만. 평문은 대표 맥 sol-hq/.env OFFICE_INSIGHT_TOKEN
-- 가산적 · 여러 번 돌려도 안전.

-- ── ① 표 ──
create table if not exists hq_insights (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  brand        text not null default 'common' check (brand in ('common', 'simok', 'solningpoint', 'unmyunglab')),
  kind         text not null default 'info' check (kind in ('ai', 'reference', 'info')),
  url          text,
  body         text,                 -- 공유로 넘어온 글 (캡션 · 페이지 제목 등)
  memo         text,                 -- 대표가 적은 한 줄
  title        text,                 -- 본부가 붙인 제목 (처음엔 비어 있음)
  hq_note      text,                 -- 본부가 읽고 남긴 정리
  status       text not null default 'new' check (status in ('new', 'read', 'done', 'held')),
  image_count  int not null default 0,
  source       text not null default 'shortcut' check (source in ('shortcut', 'me')),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index if not exists hq_insights_ws_idx on hq_insights(workspace_id, created_at desc);
create index if not exists hq_insights_common_idx on hq_insights(created_at desc) where brand = 'common';

create table if not exists hq_insight_images (
  id           uuid primary key default gen_random_uuid(),
  insight_id   uuid not null references hq_insights(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  idx          int not null default 0,
  mime         text not null default 'image/jpeg',
  data         bytea not null,
  created_at   timestamptz not null default now()
);
create index if not exists hq_insight_images_ins_idx on hq_insight_images(insight_id, idx);

alter table hq_insights enable row level security;
alter table hq_insight_images enable row level security;
do $$ declare t text; begin
  foreach t in array array['hq_insights', 'hq_insight_images'] loop
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

-- ── ② 단축어 → 오피스 ──
--   p_payload = { brand: '공통'|'시목'|'쏠닝오즈'|'운명랩' (영어 키도 됨), kind: 'AI · 프롬프트'|'레퍼런스 참고'|'인사이트 정보',
--                 url, text, memo, images: ['<base64>' ...]  또는 images_csv: '<base64>,<base64>' (단축어는 쉼표로 이어 보낸다) }
create or replace function hq_insight_add(p_token text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  home uuid; ws uuid; iid uuid; b text; k text; img text; raw bytea; n int := 0;
  imgs jsonb := coalesce(p_payload->'images', to_jsonb(string_to_array(nullif(p_payload->>'images_csv', ''), ',')), '[]'::jsonb);
begin
  select workspace_id into home from ingest_credentials
   where token_sha256 = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and is_active and revoked_at is null and 'insight:add' = any(scopes)
   limit 1;
  if home is null then raise exception 'hq_insight_add: invalid token' using errcode = '28000'; end if;
  update ingest_credentials set last_used_at = now() where token_sha256 = encode(extensions.digest(p_token, 'sha256'), 'hex');

  b := lower(trim(coalesce(p_payload->>'brand', '')));
  b := case when b in ('시목', 'simok') then 'simok'
            when b in ('쏠닝오즈', '쏠닝포인트', 'solningoz', 'solningpoint') then 'solningpoint'
            when b in ('운명랩', 'unmyunglab') then 'unmyunglab'
            else 'common' end;
  k := lower(trim(coalesce(p_payload->>'kind', '')));
  k := case when k like 'ai%' or k like '%프롬프트%' or k like '%프롬포트%' then 'ai'
            when k like '%레퍼런스%' or k = 'reference' then 'reference'
            else 'info' end;
  if b = 'common' then ws := home;
  else select id into ws from workspaces where hq_brand_key = b and type = 'office' limit 1; ws := coalesce(ws, home);
  end if;
  if coalesce(p_payload->>'url', '') = '' and coalesce(p_payload->>'text', '') = '' and coalesce(p_payload->>'memo', '') = ''
     and jsonb_array_length(imgs) = 0 then
    raise exception 'hq_insight_add: 비어 있음' using errcode = '22023';
  end if;

  insert into hq_insights (workspace_id, brand, kind, url, body, memo, source)
  values (ws, b, k, nullif(left(p_payload->>'url', 2000), ''), nullif(left(p_payload->>'text', 20000), ''),
          nullif(left(p_payload->>'memo', 4000), ''), 'shortcut')
  returning id into iid;

  for img in select jsonb_array_elements_text(imgs) loop
    exit when n >= 10;
    raw := decode(regexp_replace(regexp_replace(img, '^data:[^,]*,', ''), '\s', '', 'g'), 'base64');
    if octet_length(raw) > 3 * 1024 * 1024 then continue; end if;
    insert into hq_insight_images (insight_id, workspace_id, idx, mime, data)
    values (iid, ws, n, case when substring(raw from 1 for 4) = '\x89504e47'::bytea then 'image/png' else 'image/jpeg' end, raw);
    n := n + 1;
  end loop;
  update hq_insights set image_count = n where id = iid;
  return jsonb_build_object('ok', true, 'id', iid, 'brand', b, 'kind', k, 'images', n);
end $$;
revoke all on function hq_insight_add(text, jsonb) from public;
grant execute on function hq_insight_add(text, jsonb) to anon, authenticated, service_role;
comment on function hq_insight_add(text, jsonb) is '폰 단축어 → 인사이트 함. 토큰 scope insight:add 는 넣기만 된다 (073)';

-- ── ③ 본부 읽기 · 정리 (본부 토큰 hq:ingest) ──
create or replace function hq_insights(p_token text, p_days int default 3)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare ws uuid := hq_auth(p_token);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id, 'brand', i.brand, 'kind', i.kind, 'url', i.url, 'text', i.body, 'memo', i.memo, 'title', i.title,
      'hq_note', i.hq_note, 'status', i.status, 'created_at', i.created_at,
      'images', coalesce((select jsonb_agg(jsonb_build_object('mime', m.mime, 'b64', encode(m.data, 'base64')) order by m.idx)
                          from hq_insight_images m where m.insight_id = i.id), '[]'::jsonb)
    ) order by i.created_at)
    from hq_insights i
    where i.workspace_id = ws and i.created_at >= now() - make_interval(days => greatest(p_days, 1))
  ), '[]'::jsonb);
end $$;
revoke all on function hq_insights(text, int) from public;
grant execute on function hq_insights(text, int) to anon, authenticated, service_role;

create or replace function hq_insight_note(p_token text, p_id uuid, p_title text, p_note text, p_status text default 'read')
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare ws uuid := hq_auth(p_token); n int;
begin
  update hq_insights set title = coalesce(nullif(p_title, ''), title), hq_note = coalesce(nullif(p_note, ''), hq_note),
         status = case when p_status in ('read', 'done', 'held') then p_status else status end,
         read_at = coalesce(read_at, now()), updated_at = now()
   where id = p_id and workspace_id = ws;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1);
end $$;
revoke all on function hq_insight_note(text, uuid, text, text, text) from public;
grant execute on function hq_insight_note(text, uuid, text, text, text) to anon, authenticated, service_role;

-- ── ④ 단축어 토큰 (해시만 · 평문은 대표 맥 sol-hq/.env OFFICE_INSIGHT_TOKEN) ──
insert into ingest_credentials (workspace_id, name, token_sha256, scopes, environment, usage)
select w.id, 'insight-shortcut', '66072cd361d1d9eb7ef0be1b5af1019d07e1d72e4f9a1001c1187e73baed4ccc', array['insight:add'], 'production', 'operational'
from workspaces w where w.hq_brand_key = 'solningpoint' and w.type = 'office'
on conflict (token_sha256) do nothing;

-- ── 확인 - 표 두 개 · 함수 셋 · 토큰 한 줄이 보이면 끝 ──
select
  (select count(*) from information_schema.tables where table_name in ('hq_insights', 'hq_insight_images')) as tables_2,
  (select count(*) from pg_proc where proname in ('hq_insight_add', 'hq_insights', 'hq_insight_note')) as functions_3,
  (select count(*) from ingest_credentials where 'insight:add' = any(scopes) and is_active) as shortcut_token_1;

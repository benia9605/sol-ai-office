-- 074 · 캐러셀 → 오피스 콘텐츠 (2026-10-30 본부 초안)
-- 매일 본부가 캐러셀 HTML 을 만들고 → 사장님이 확정하면 → 본부가 PNG 6장 + 인스타 · 스레드 글을 오피스 「04 콘텐츠」 카드로 올린다.
--   ① hq_contents 에 칸 넷: format(종류 캐러셀 · 영상 · 게시물) · caption_ig · caption_threads · slide_count
--   ② hq_content_slides - 카드의 장 그림 (bytea · 인사이트 캡처와 같은 방식 · 장당 3MB 안)
--   ③ hq_carousel(p_token, p_payload) - 본부 토큰(hq:ingest)으로만. 같은 key 면 그 카드를 고치고 장 그림을 바꿔 끼운다
--   ④ hq_topics(p_token, p_payload) - 일요일마다 본부가 다음 주 캐러셀 주제 Top 10 을 「기획」 후보 카드로 (key topic:… · 게시일 없음 = 후보)
--      사장님이 오피스에서 고르면 게시일이 잡힌다 → 그날 본부가 그 주제로 캐러셀을 만들고, 확정하면 hq_carousel 이 그 후보 카드를 캐러셀 카드로 바꾼다 (replace_key)
--   ⑤ 확인 줄 - 맨 아래 select 가 `4 · 2 · 0` 이면 끝 (칸 4 · 함수 2 · 장 0)

-- ① 칸
alter table hq_contents add column if not exists format text check (format in ('carousel','video','post'));
-- 지금 있는 카드는 채널로 짐작해 채운다 (릴스 · 유튜브 · 쇼츠 = 영상 · 캐러셀 = 캐러셀 · 나머지 = 게시물 · 피드 · 스레드 · 블로그 모두)
update hq_contents set format = case
  when channel ~* '(릴스|유튜브|쇼츠|영상|reels|youtube|shorts)' then 'video'
  when channel ~* '(캐러셀|carousel)' then 'carousel'
  else 'post' end
where format is null;
alter table hq_contents add column if not exists caption_ig      text;
alter table hq_contents add column if not exists caption_threads text;
alter table hq_contents add column if not exists slide_count     int not null default 0;

-- ② 장 그림
create table if not exists hq_content_slides (
  id            uuid primary key default gen_random_uuid(),
  content_id    uuid not null references hq_contents(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  idx           int  not null,
  mime          text not null default 'image/png',
  data          bytea not null,
  created_at    timestamptz not null default now(),
  unique (content_id, idx)
);
create index if not exists hq_content_slides_content_idx on hq_content_slides(content_id, idx);

alter table hq_content_slides enable row level security;
drop policy if exists hq_content_slides_select on hq_content_slides;
create policy hq_content_slides_select on hq_content_slides for select using (workspace_id in (select my_workspace_ids()));
drop policy if exists hq_content_slides_insert on hq_content_slides;
create policy hq_content_slides_insert on hq_content_slides for insert with check (workspace_id in (select my_workspace_ids()));
drop policy if exists hq_content_slides_delete on hq_content_slides;
create policy hq_content_slides_delete on hq_content_slides for delete using (workspace_id in (select my_workspace_ids()));

-- ③ 본부 → 오피스 캐러셀
--   p_payload = { key, title, format(기본 'carousel'), channel(기본 '인스타 · 스레드'), stage(기본 'edit'), due_date, caption_ig, caption_threads, memo,
--                 slides: [{ mime, b64 }, ...] (최대 10장 · 장당 3MB), replace_key: 'topic:…' (고른 주제 카드가 있으면 그 카드를 이 캐러셀로) }
--   답: { ok, id, slides }
create or replace function hq_carousel(p_token text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  ws uuid := hq_auth(p_token);
  cid uuid; s jsonb; raw bytea; n int := 0;
  k text := nullif(p_payload->>'key', '');
  st text := coalesce(nullif(p_payload->>'stage', ''), 'edit');
begin
  if k is null then raise exception 'hq_carousel: key 필요'; end if;
  if coalesce(nullif(p_payload->>'title', ''), '') = '' then raise exception 'hq_carousel: title 필요'; end if;
  if st not in ('plan','draft','shoot','edit','done') then st := 'edit'; end if;
  if jsonb_array_length(coalesce(p_payload->'slides', '[]'::jsonb)) > 10 then raise exception 'hq_carousel: 장은 10장까지'; end if;

  -- 고른 주제 카드 → 이 캐러셀 카드로 (같은 key 카드가 아직 없을 때만)
  if nullif(p_payload->>'replace_key', '') is not null
     and not exists (select 1 from hq_contents where workspace_id = ws and hq_key = k) then
    update hq_contents set hq_key = k, stage = st, updated_at = now()
     where workspace_id = ws and hq_key = p_payload->>'replace_key';
  end if;

  insert into hq_contents (workspace_id, title, format, channel, stage, due_date, draft, draft_status, caption_ig, caption_threads, memo, source, hq_key)
  values (ws, p_payload->>'title', coalesce(nullif(p_payload->>'format', ''), 'carousel'), coalesce(nullif(p_payload->>'channel', ''), '인스타 · 스레드'), st, nullif(p_payload->>'due_date', '')::date,
          p_payload->>'caption_ig', 'confirmed', p_payload->>'caption_ig', p_payload->>'caption_threads', p_payload->>'memo', 'hq', k)
  on conflict (workspace_id, hq_key) where hq_key is not null do update set
    title = excluded.title, format = excluded.format, channel = excluded.channel, due_date = excluded.due_date,
    draft = excluded.draft, draft_status = 'confirmed', caption_ig = excluded.caption_ig, caption_threads = excluded.caption_threads,
    memo = excluded.memo, updated_at = now()
    -- 단계(stage)는 처음 넣을 때만 정한다. 사람이 「게시 완료」 로 옮긴 뒤 다시 보내도 되돌리지 않는다
  returning id into cid;

  delete from hq_content_slides where content_id = cid;
  for s in select * from jsonb_array_elements(coalesce(p_payload->'slides', '[]'::jsonb)) loop
    raw := decode(s->>'b64', 'base64');
    if octet_length(raw) > 3 * 1024 * 1024 then raise exception 'hq_carousel: % 번째 장이 3MB 를 넘음', n + 1; end if;
    insert into hq_content_slides (content_id, workspace_id, idx, mime, data)
    values (cid, ws, n, coalesce(nullif(s->>'mime', ''), 'image/png'), raw);
    n := n + 1;
  end loop;
  update hq_contents set slide_count = n where id = cid;
  return jsonb_build_object('ok', true, 'id', cid, 'slides', n);
end $$;
revoke all on function hq_carousel(text, jsonb) from public;
grant execute on function hq_carousel(text, jsonb) to anon, authenticated;
comment on function hq_carousel(text, jsonb) is '본부(sol-hq) → 오피스 콘텐츠: 확정한 캐러셀 장 그림 + 인스타 · 스레드 글. 토큰(hq:ingest)이 워크스페이스를 정한다';

-- ④ 다음 주 캐러셀 주제 Top 10
--   p_payload = { items: [{ key: 'topic:2026-11-03:01', title, why, channel }] }
--   안 고른 지난 후보(게시일 없음 · 이번 목록에 없음)는 지운다. 이미 고른 것(게시일 있음)은 건드리지 않는다
create or replace function hq_topics(p_token text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  ws uuid := hq_auth(p_token);
  it jsonb; n int := 0; keys text[] := '{}';
begin
  for it in select * from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) loop
    if coalesce(it->>'key', '') not like 'topic:%' or coalesce(it->>'title', '') = '' then continue; end if;
    keys := keys || (it->>'key');
    insert into hq_contents (workspace_id, title, format, channel, stage, memo, source, hq_key)
    values (ws, it->>'title', 'carousel', coalesce(nullif(it->>'channel', ''), '인스타 · 스레드'), 'plan', it->>'why', 'hq', it->>'key')
    on conflict (workspace_id, hq_key) where hq_key is not null do update set
      title = excluded.title, memo = excluded.memo, updated_at = now()
      where hq_contents.due_date is null and hq_contents.stage = 'plan';
    n := n + 1;
  end loop;
  delete from hq_contents
   where workspace_id = ws and hq_key like 'topic:%' and due_date is null and stage = 'plan' and not (hq_key = any(keys));
  return jsonb_build_object('ok', true, 'topics', n);
end $$;
revoke all on function hq_topics(text, jsonb) from public;
grant execute on function hq_topics(text, jsonb) to anon, authenticated;
comment on function hq_topics(text, jsonb) is '본부(sol-hq) → 오피스 콘텐츠: 다음 주 캐러셀 주제 후보 (기획 · 게시일 없음). 고르면 게시일이 잡힌다';

-- ⑤ 확인
select
  (select count(*) from information_schema.columns where table_name = 'hq_contents' and column_name in ('format','caption_ig','caption_threads','slide_count')) as cols_4,
  (select count(*) from pg_proc where proname in ('hq_carousel','hq_topics')) as func_2,
  (select count(*) from hq_content_slides) as slides_0;

-- ────────────────────────────────────────────────────────
-- 076: 메일 - 10시 정리 · 중요 메일 바로 알림 · 답장 초안 · 템플릿 · 서명 · 구독 취소 + 본부(개인) 오피스 (2026-10-31 대표 결정)
-- ────────────────────────────────────────────────────────
-- 배경:
--   · 메일은 본부(sol-hq) 맥이 계정마다 IMAP · SMTP(앱 비밀번호)로 직접 읽고 보낸다. 비밀번호는 맥 .env 에만 · 이 DB 에는 없다
--   · 오피스에는 본부가 정리한 것만 들어온다: 요약 · 분류 · 개수 · 초안. 메일 본문 전체는 넣지 않는다 (요약 · 한 줄만)
--   · 사람이 오피스에서 「보내기 확정」 · 구독 취소 체크 → 본부가 몇 분 안에 가져가(hq_mail_pull) 보내고 결과를 남긴다(hq_mail_push)
--   · 오피스마다 그 오피스 메일만: 시목 studio@simok.co.kr · 쏠닝오즈 solning@naver.com · 본부 benia9605@naver.com · benia9605@gmail.com · 운명랩은 아직 없음
--
-- 이 마이그레이션은
--   ① 표 7개 (모두 워크스페이스 단위 · RLS = 그 오피스 멤버만)
--      hq_mail_accounts 계정 · hq_mail_messages 메일 요약 · hq_mail_digests 날짜별 10시 정리 · hq_mail_drafts 답장 초안(HTML)
--      hq_mail_templates 답장 템플릿 · hq_mail_signatures 서명(명함 이미지) · hq_mail_unsubs 구독 취소 후보
--   ② hq_mail_push(본부 토큰, 꾸러미) · hq_mail_pull(본부 토큰) - 본부 전용
--   ③ 본부(개인) 오피스 - 없으면 만들고 (주인 = 대표) 본부 토큰 연결
--   ④ 확인
-- 가산적 · 여러 번 돌려도 안전.

-- ── ① 표 ──
create table if not exists hq_mail_accounts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  address       text not null,
  provider      text not null default 'other' check (provider in ('gmail', 'naver', 'daum', 'other')),
  label         text,                       -- 화면 칩 이름 (네이버 · 지메일 등)
  is_active     boolean not null default true,
  last_sync_at  timestamptz,
  last_error    text,
  created_at    timestamptz not null default now(),
  unique (workspace_id, address)
);

create table if not exists hq_mail_messages (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  account_id    uuid references hq_mail_accounts(id) on delete cascade,
  msg_key       text not null,              -- 계정 주소 + Message-ID (본부가 만든다)
  from_name     text,
  from_addr     text,
  subject       text,
  summary       text,                       -- 본부 한 줄 요약
  category      text not null default 'other' check (category in ('important', 'reply', 'order', 'billing', 'ad', 'notice', 'other')),
  status        text not null default 'open' check (status in ('open', 'done', 'trashed', 'archived')),
  is_read       boolean not null default false,
  received_at   timestamptz not null,
  alerted_at    timestamptz,                -- 중요 메일 바로 알림 보낸 때
  done_by       uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, msg_key)
);
create index if not exists hq_mail_messages_ws_idx on hq_mail_messages(workspace_id, received_at desc);
create index if not exists hq_mail_messages_open_idx on hq_mail_messages(workspace_id, category) where status = 'open';

create table if not exists hq_mail_digests (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  day           date not null,              -- 그날 10시 정리
  period_from   timestamptz not null,       -- 어제 10:00
  period_to     timestamptz not null,       -- 오늘 10:00
  counts        jsonb not null default '{}'::jsonb,   -- { important, reply, order, billing, ad, notice, other, total }
  trashed       int not null default 0,
  read_marked   int not null default 0,
  drafted       int not null default 0,
  unsub_found   int not null default 0,
  note          text,                       -- 본부 한 줄
  created_at    timestamptz not null default now(),
  unique (workspace_id, day)
);

create table if not exists hq_mail_templates (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  name          text not null,
  when_to_use   text,
  subject       text,
  html          text not null default '',   -- 빈칸 {손님 이름} {주문 번호} {발송일}
  use_count     int not null default 0,
  proposed      boolean not null default false,   -- 본부 제안 (사람이 「저장」 하면 false)
  sort          int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists hq_mail_signatures (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  account_id    uuid references hq_mail_accounts(id) on delete set null,   -- 비우면 그 오피스 모든 계정
  name          text not null,
  html          text not null default '',   -- 늘 본문 아래 구분선 뒤에 붙는다
  card_mime     text,
  card_data     bytea,                      -- 명함 이미지 (보낼 때 메일 안 그림으로 붙임 · 3MB 까지)
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists hq_mail_drafts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  account_id    uuid references hq_mail_accounts(id) on delete set null,   -- 보내는 주소
  message_id    uuid references hq_mail_messages(id) on delete set null,   -- 답장이면 원래 메일
  hq_key        text,                       -- 본부가 만든 초안 키 (다시 보내면 고침)
  to_addr       text not null default '',
  cc            text,
  subject       text not null default '',
  html          text not null default '',   -- 서식 본문 (서명 빼고)
  signature_id  uuid references hq_mail_signatures(id) on delete set null,
  template_id   uuid references hq_mail_templates(id) on delete set null,
  basis         text,                       -- 본부가 쓴 근거 (어느 템플릿 · 무엇을 보고)
  status        text not null default 'draft' check (status in ('draft', 'confirmed', 'sending', 'sent', 'failed', 'discarded')),
  confirmed_by  uuid references auth.users(id) on delete set null,
  confirmed_at  timestamptz,
  sent_at       timestamptz,
  error         text,
  edited_at     timestamptz,                -- 사람이 오피스에서 고친 때 (있으면 본부가 덮지 않음)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists hq_mail_drafts_key_uidx on hq_mail_drafts(workspace_id, hq_key) where hq_key is not null;
create index if not exists hq_mail_drafts_ws_idx on hq_mail_drafts(workspace_id, status, updated_at desc);

create table if not exists hq_mail_unsubs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  account_id    uuid references hq_mail_accounts(id) on delete cascade,
  sender_name   text,
  sender_addr   text not null,
  count_30d     int not null default 0,
  method        text not null default 'link' check (method in ('oneclick', 'link', 'caution', 'filter')),
  status        text not null default 'candidate' check (status in ('candidate', 'requested', 'done', 'failed', 'kept')),
  note          text,                       -- 본부 메모 (주의 이유 · 실패 이유)
  requested_by  uuid references auth.users(id) on delete set null,
  requested_at  timestamptz,
  done_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, account_id, sender_addr)
);

do $$ declare t text; begin
  foreach t in array array['hq_mail_accounts', 'hq_mail_messages', 'hq_mail_digests', 'hq_mail_templates', 'hq_mail_signatures', 'hq_mail_drafts', 'hq_mail_unsubs'] loop
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

-- ── ② 본부 함수 ──
-- 본부 → 오피스
--   p_payload = {
--     accounts:  [{ address, provider, label, last_error }]
--     messages:  [{ account, msg_key, from_name, from_addr, subject, summary, category, status, is_read, received_at, alerted }]
--     digest:    { day, period_from, period_to, counts, trashed, read_marked, drafted, unsub_found, note }
--     drafts:    [{ hq_key, account, msg_key, to_addr, cc, subject, html, basis, template_name }]   (본부가 쓴 새 초안 · 사람이 고친 뒤면 안 덮음)
--     sent:      [{ id, ok, error }]       (보낸 결과)
--     unsubs:    [{ account, sender_name, sender_addr, count_30d, method, note }]
--     unsub_done:[{ id, ok, note }]
--     templates: [{ name, when_to_use, subject, html }]   (본부 제안 · proposed)
--   }   account = 계정 주소
create or replace function hq_mail_push(p_token text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  ws uuid := hq_auth(p_token);
  x jsonb;
  acc uuid;
  n_msg int := 0; n_draft int := 0;
begin
  for x in select * from jsonb_array_elements(coalesce(p_payload->'accounts', '[]'::jsonb)) loop
    insert into hq_mail_accounts (workspace_id, address, provider, label, last_sync_at, last_error)
    values (ws, x->>'address', coalesce(x->>'provider', 'other'), x->>'label', now(), x->>'last_error')
    on conflict (workspace_id, address) do update
      set provider = excluded.provider, label = coalesce(excluded.label, hq_mail_accounts.label),
          last_sync_at = now(), last_error = excluded.last_error;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_payload->'messages', '[]'::jsonb)) loop
    select id into acc from hq_mail_accounts where workspace_id = ws and address = x->>'account';
    insert into hq_mail_messages (workspace_id, account_id, msg_key, from_name, from_addr, subject, summary, category, status, is_read, received_at, alerted_at)
    values (ws, acc, x->>'msg_key', x->>'from_name', x->>'from_addr', x->>'subject', x->>'summary',
            coalesce(x->>'category', 'other'), coalesce(x->>'status', 'open'), coalesce((x->>'is_read')::boolean, false),
            (x->>'received_at')::timestamptz, case when (x->>'alerted')::boolean then now() end)
    on conflict (workspace_id, msg_key) do update
      set summary = coalesce(excluded.summary, hq_mail_messages.summary),
          category = excluded.category,
          -- 사람이 끝냄 표시한 것은 본부가 다시 열지 않는다
          status = case when hq_mail_messages.status = 'done' then 'done' else excluded.status end,
          is_read = excluded.is_read or hq_mail_messages.is_read,
          alerted_at = coalesce(hq_mail_messages.alerted_at, excluded.alerted_at),
          updated_at = now();
    n_msg := n_msg + 1;
  end loop;

  if p_payload ? 'digest' then
    x := p_payload->'digest';
    insert into hq_mail_digests (workspace_id, day, period_from, period_to, counts, trashed, read_marked, drafted, unsub_found, note)
    values (ws, (x->>'day')::date, (x->>'period_from')::timestamptz, (x->>'period_to')::timestamptz, coalesce(x->'counts', '{}'::jsonb),
            coalesce((x->>'trashed')::int, 0), coalesce((x->>'read_marked')::int, 0), coalesce((x->>'drafted')::int, 0),
            coalesce((x->>'unsub_found')::int, 0), x->>'note')
    on conflict (workspace_id, day) do update
      set period_from = excluded.period_from, period_to = excluded.period_to, counts = excluded.counts,
          trashed = excluded.trashed, read_marked = excluded.read_marked, drafted = excluded.drafted,
          unsub_found = excluded.unsub_found, note = excluded.note;
  end if;

  for x in select * from jsonb_array_elements(coalesce(p_payload->'drafts', '[]'::jsonb)) loop
    select id into acc from hq_mail_accounts where workspace_id = ws and address = x->>'account';
    insert into hq_mail_drafts (workspace_id, account_id, message_id, hq_key, to_addr, cc, subject, html, basis, template_id, signature_id)
    values (ws, acc,
            (select id from hq_mail_messages where workspace_id = ws and msg_key = x->>'msg_key'),
            x->>'hq_key', coalesce(x->>'to_addr', ''), x->>'cc', coalesce(x->>'subject', ''), coalesce(x->>'html', ''), x->>'basis',
            (select id from hq_mail_templates where workspace_id = ws and name = x->>'template_name' limit 1),
            (select id from hq_mail_signatures where workspace_id = ws and is_default and (account_id is null or account_id = acc) order by account_id nulls last limit 1))
    on conflict (workspace_id, hq_key) where hq_key is not null do update
      set to_addr = excluded.to_addr, cc = excluded.cc, subject = excluded.subject, html = excluded.html, basis = excluded.basis, updated_at = now()
      where hq_mail_drafts.status = 'draft' and hq_mail_drafts.edited_at is null;   -- 사람이 고친 초안은 안 덮음
    n_draft := n_draft + 1;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_payload->'sent', '[]'::jsonb)) loop
    update hq_mail_drafts
       set status = case when (x->>'ok')::boolean then 'sent' else 'failed' end,
           sent_at = case when (x->>'ok')::boolean then now() end, error = x->>'error', updated_at = now()
     where workspace_id = ws and id = (x->>'id')::uuid;
    -- 답장을 보낸 원래 메일은 끝냄
    update hq_mail_messages m set status = 'done', updated_at = now()
      from hq_mail_drafts d
     where (x->>'ok')::boolean and d.id = (x->>'id')::uuid and d.workspace_id = ws and m.id = d.message_id;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_payload->'unsubs', '[]'::jsonb)) loop
    select id into acc from hq_mail_accounts where workspace_id = ws and address = x->>'account';
    insert into hq_mail_unsubs (workspace_id, account_id, sender_name, sender_addr, count_30d, method, note)
    values (ws, acc, x->>'sender_name', x->>'sender_addr', coalesce((x->>'count_30d')::int, 0), coalesce(x->>'method', 'link'), x->>'note')
    on conflict (workspace_id, account_id, sender_addr) do update
      set sender_name = excluded.sender_name, count_30d = excluded.count_30d, method = excluded.method,
          note = coalesce(excluded.note, hq_mail_unsubs.note), updated_at = now();
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_payload->'unsub_done', '[]'::jsonb)) loop
    update hq_mail_unsubs
       set status = case when (x->>'ok')::boolean then 'done' else 'failed' end,
           done_at = case when (x->>'ok')::boolean then now() end, note = coalesce(x->>'note', note), updated_at = now()
     where workspace_id = ws and id = (x->>'id')::uuid;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_payload->'templates', '[]'::jsonb)) loop
    if not exists (select 1 from hq_mail_templates where workspace_id = ws and name = x->>'name') then
      insert into hq_mail_templates (workspace_id, name, when_to_use, subject, html, proposed)
      values (ws, x->>'name', x->>'when_to_use', x->>'subject', coalesce(x->>'html', ''), true);
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'workspace_id', ws, 'messages', n_msg, 'drafts', n_draft);
end $$;
revoke all on function hq_mail_push(text, jsonb) from public;
grant execute on function hq_mail_push(text, jsonb) to anon, authenticated, service_role;
comment on function hq_mail_push(text, jsonb) is '본부 → 오피스 메일 정리 · 초안 · 보낸 결과 (076)';

-- 오피스 → 본부: 보낼 초안(확정) · 구독 취소 요청 · 초안 쓸 때 볼 템플릿 · 서명 · 사람이 끝낸 메일
--   확정 초안은 가져가는 순간 sending 으로 바꾼다 (두 번 보내지 않게)
create or replace function hq_mail_pull(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare ws uuid := hq_auth(p_token); out_drafts jsonb;
begin
  with picked as (
    update hq_mail_drafts set status = 'sending', updated_at = now()
     where workspace_id = ws and status = 'confirmed'
     returning *
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'account', a.address, 'to_addr', p.to_addr, 'cc', p.cc, 'subject', p.subject, 'html', p.html,
           'reply_to_key', m.msg_key,
           'signature', case when s.id is null then null else jsonb_build_object('html', s.html, 'card_mime', s.card_mime,
                          'card_b64', case when s.card_data is null then null else encode(s.card_data, 'base64') end) end)), '[]'::jsonb)
    into out_drafts
    from picked p
    left join hq_mail_accounts a on a.id = p.account_id
    left join hq_mail_messages m on m.id = p.message_id
    left join hq_mail_signatures s on s.id = p.signature_id;

  return jsonb_build_object(
    'drafts', out_drafts,
    'unsubs', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'account', a.address, 'sender_addr', u.sender_addr, 'method', u.method)), '[]'::jsonb)
                 from hq_mail_unsubs u left join hq_mail_accounts a on a.id = u.account_id
                where u.workspace_id = ws and u.status = 'requested'),
    'templates', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'when_to_use', when_to_use, 'subject', subject, 'html', html) order by sort, name), '[]'::jsonb)
                    from hq_mail_templates where workspace_id = ws and not proposed),
    'done', (select coalesce(jsonb_agg(msg_key), '[]'::jsonb) from hq_mail_messages
              where workspace_id = ws and status = 'done' and updated_at > now() - interval '2 days')
  );
end $$;
revoke all on function hq_mail_pull(text) from public;
grant execute on function hq_mail_pull(text) to anon, authenticated, service_role;
comment on function hq_mail_pull(text) is '오피스 → 본부 보낼 초안 · 구독 취소 요청 · 템플릿 (076)';

-- ── ③ 본부(개인) 오피스 만들기 · 연결 ──
--   「본부」 오피스가 없으면 여기서 만든다 (쏠닝포인트 오피스를 만든 사람 = 대표가 주인) · 대표 한 명만 멤버
--   (오피스 화면의 「새로 만들기」 가 시목으로 튕기는 버그가 있어 SQL 로 만든다 · 2026-10-31)
--   그 오피스에 본부 키 hq · 브랜드 값 · 본부 토큰(해시). 평문은 대표 맥 sol-hq/.env OFFICE_HQ_TOKEN_HQ
insert into workspaces (name, emoji, type, created_by)
select '본부', '🏠', 'office', w.created_by
from workspaces w
where w.hq_brand_key = 'solningpoint'
  and not exists (select 1 from workspaces where hq_brand_key = 'hq' or (type = 'office' and name ilike '%본부%'));

insert into workspace_members (workspace_id, user_id, role)
select w.id, w.created_by, 'owner' from workspaces w
where w.type = 'office' and w.name ilike '%본부%'
on conflict (workspace_id, user_id) do nothing;

update workspaces set hq_brand_key = 'hq',
  brand_logo = coalesce(brand_logo, 'SOL HQ'), brand_sub = coalesce(brand_sub, 'PERSONAL OFFICE'),
  brand_motto = coalesce(brand_motto, '세 브랜드 본부'),
  brand_paper = coalesce(brand_paper, '#f5f4f1'), brand_point = coalesce(brand_point, '#2b2f3a')
where type = 'office' and name ilike '%본부%' and hq_brand_key is null
  and not exists (select 1 from workspaces where hq_brand_key = 'hq');

insert into ingest_credentials (workspace_id, name, token_sha256, scopes, environment, usage)
select w.id, 'sol-hq', '03a05cad786eacc8fc6eeb1255d0ff8c1cb0ea114d06d2105b72407dc7a808ab', array['hq:ingest'], 'production', 'operational'
from workspaces w where w.hq_brand_key = 'hq'
on conflict (token_sha256) do nothing;

-- ── ④ 확인 ── 표 7 · 함수 2 · 본부 오피스 1
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename like 'hq_mail_%') as tables_7,
  (select count(*) from pg_proc where proname in ('hq_mail_push', 'hq_mail_pull')) as functions_2,
  (select count(*) from workspaces w join ingest_credentials c on c.workspace_id = w.id and c.is_active
    where w.hq_brand_key = 'hq') as hq_office_1;

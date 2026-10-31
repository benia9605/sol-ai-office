-- ────────────────────────────────────────────────────────
-- 077: 메일함 정리 - 오래된 메일함을 보낸 곳별로 한 번에 (2026-10-31 대표 요청)
-- ────────────────────────────────────────────────────────
-- 배경:
--   · 본부(sol-hq) 가 계정 받은편지함 전체를 머리만 읽어(본문 안 읽음) 보낸 곳별로 나눈다 (scripts/mail.mjs audit)
--   · 오피스 「10 메일 → 메일함 정리」 탭에서 대표가 줄마다 체크 · 행동을 바꾸고 「체크한 대로 정리 요청」
--   · 본부가 3분 안에 가져가(hq_mail_cleanup_pull) 실행하고 결과를 남긴다(hq_mail_cleanup_push)
--   · 행동: trash 휴지통(30일 넘은 것만 · 30일 안에 되살림) · unsub_trash 구독 취소 + 휴지통 · label 라벨로 옮김(label 칸 · 청구서 · 보안 · 계정 · 약관 변경 · 금융 · 신청한 구독 · 지우지 않음) · keep 그대로
--   · 무리는 메일 제목으로 정한다 (2026-10-31 대표 「모든 기준은 메일명」) · 한 보낸 곳이 여러 무리면 무리마다 한 줄 (part = 무리 키)
--   · 사람 · 보안 · 세금 · 금융 · 결제는 본부가 늘 keep 으로 낸다 (사람이 바꿔도 본부가 실행 때 한 번 더 거른다)
--
-- 이 마이그레이션은
--   ① hq_mail_cleanup 표 (워크스페이스 단위 · RLS = 그 오피스 멤버만 · 076 과 같은 방식)
--   ② hq_mail_cleanup_push(본부 토큰, 꾸러미) · hq_mail_cleanup_pull(본부 토큰) - 본부 전용
--   ③ 구독 취소 그동안 온 메일 hq_mail_unsubs.examples · hq_mail_unsub_examples() · hq_mail_pull 다시 쓰기 (반환 키 그대로 + kept = 「유지」 한 곳)
--   ④ 확인 (끝 줄 1 · 4 · 1)
-- 가산적 · 여러 번 돌려도 안전.

-- ── ① 표 ──
create table if not exists hq_mail_cleanup (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  account_id    uuid references hq_mail_accounts(id) on delete cascade,
  sender_addr   text not null,
  part          text not null default 'all',      -- 무리 키 (ad · bill · sec · terms · fin · sub · pub · order · notice · person · other) - 한 보낸 곳이 여러 무리면 여러 줄
  sender_name   text,
  kind          text not null default '기타',     -- 화면 이름 (광고 · 뉴스레터 · 청구서 · 고지서 · 보안 · 계정 · 약관 · 정책 변경 · 금융 · 신청한 구독 · 공공 · 세금 · 주문 · 배송 · 알림 · 소식 · 사람 · 기타)
  action        text not null default 'keep' check (action in ('trash', 'unsub_trash', 'label', 'keep', 'ask')),   -- 본부 제안 (ask = 확인 필요)
  label         text,                               -- action / chosen 이 label 일 때 라벨 이름
  chosen        text check (chosen in ('trash', 'unsub_trash', 'label', 'keep')),                                    -- 사람이 고른 것 (비면 제안대로)
  checked       boolean not null default true,      -- 줄 체크 (확인 필요 · 그대로는 처음에 false)
  count         int not null default 0,
  unseen        int not null default 0,
  unsub         text check (unsub in ('oneclick', 'link', 'caution')),   -- 구독 취소 방법 (머리에 있을 때)
  gone_months   int,                                -- 마지막 메일이 몇 달 전 (2 이상이면 「이미 안 옴」 · 구독 취소 필요 없음)
  oldest        timestamptz,
  newest        timestamptz,
  examples      jsonb not null default '[]'::jsonb, -- 그동안 온 메일 [{date, subject}] (최근 것부터 20개까지 · 줄을 누르면 펼침)
  note          text,                               -- 본부 메모 (왜 이 행동인지 · 주의 이유)
  status        text not null default 'proposed' check (status in ('proposed', 'requested', 'done', 'failed')),
  moved         int not null default 0,             -- 실행 결과: 옮긴 수 (휴지통 · 라벨)
  unsub_ok      boolean,                            -- 실행 결과: 구독 취소 됨?
  error         text,
  requested_by  uuid references auth.users(id) on delete set null,
  requested_at  timestamptz,
  done_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, account_id, sender_addr, part)
);
create index if not exists hq_mail_cleanup_ws_idx on hq_mail_cleanup(workspace_id, account_id, action, count desc);

do $$ declare t text := 'hq_mail_cleanup'; begin
  execute format('alter table %I enable row level security', t);
  execute format('drop policy if exists %I on %I', t || '_select', t);
  execute format('create policy %I on %I for select using (workspace_id in (select my_workspace_ids()))', t || '_select', t);
  execute format('drop policy if exists %I on %I', t || '_insert', t);
  execute format('create policy %I on %I for insert with check (workspace_id in (select my_workspace_ids()))', t || '_insert', t);
  execute format('drop policy if exists %I on %I', t || '_update', t);
  execute format('create policy %I on %I for update using (workspace_id in (select my_workspace_ids())) with check (workspace_id in (select my_workspace_ids()))', t || '_update', t);
  execute format('drop policy if exists %I on %I', t || '_delete', t);
  execute format('create policy %I on %I for delete using (workspace_id in (select my_workspace_ids()))', t || '_delete', t);
end $$;

-- ── ② 본부 함수 ──
-- 본부 → 오피스
--   p_payload = {
--     cleanup:      [{ account, sender_addr, part, sender_name, kind, action, count, unseen, unsub, gone_months, oldest, newest, examples, note }]
--                   (같은 보낸 곳은 숫자 · 제안만 고침 · 사람이 고른 chosen · checked 와 요청 중 · 끝난 것은 안 덮음)
--     cleanup_done: [{ id, ok, moved, unsub_ok, error }]
--   }   account = 계정 주소
create or replace function hq_mail_cleanup_push(p_token text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  ws uuid := hq_auth(p_token);
  x jsonb;
  acc uuid;
  n int := 0; d int := 0;
begin
  for x in select * from jsonb_array_elements(coalesce(p_payload->'cleanup', '[]'::jsonb)) loop
    select id into acc from hq_mail_accounts where workspace_id = ws and address = x->>'account';
    insert into hq_mail_cleanup (workspace_id, account_id, sender_addr, part, sender_name, kind, action, label, checked, count, unseen, unsub, gone_months, oldest, newest, examples, note)
    values (ws, acc, lower(x->>'sender_addr'), coalesce(x->>'part', 'all'), x->>'sender_name', coalesce(x->>'kind', '기타'), coalesce(x->>'action', 'keep'), x->>'label',
            coalesce(x->>'action', 'keep') in ('trash', 'unsub_trash', 'label'),
            coalesce((x->>'count')::int, 0), coalesce((x->>'unseen')::int, 0), x->>'unsub', (x->>'gone_months')::int,
            (x->>'oldest')::timestamptz, (x->>'newest')::timestamptz, coalesce(x->'examples', '[]'::jsonb), x->>'note')
    on conflict (workspace_id, account_id, sender_addr, part) do update
      set sender_name = excluded.sender_name, kind = excluded.kind, action = excluded.action, label = excluded.label,
          count = excluded.count, unseen = excluded.unseen, unsub = excluded.unsub, gone_months = excluded.gone_months,
          oldest = excluded.oldest, newest = excluded.newest, examples = excluded.examples, note = excluded.note,
          -- 끝난 줄에 새 메일이 쌓였으면 다시 제안으로 (사람이 고른 것은 그대로)
          status = case when hq_mail_cleanup.status = 'done' and excluded.count > 0 then 'proposed' else hq_mail_cleanup.status end,
          updated_at = now()
      where hq_mail_cleanup.status <> 'requested';
    n := n + 1;
  end loop;

  for x in select * from jsonb_array_elements(coalesce(p_payload->'cleanup_done', '[]'::jsonb)) loop
    update hq_mail_cleanup
       set status = case when (x->>'ok')::boolean then 'done' else 'failed' end,
           moved = coalesce((x->>'moved')::int, 0), unsub_ok = (x->>'unsub_ok')::boolean, error = x->>'error',
           done_at = case when (x->>'ok')::boolean then now() end, updated_at = now()
     where workspace_id = ws and id = (x->>'id')::uuid;
    d := d + 1;
  end loop;

  return jsonb_build_object('ok', true, 'workspace_id', ws, 'cleanup', n, 'done', d);
end $$;
revoke all on function hq_mail_cleanup_push(text, jsonb) from public;
grant execute on function hq_mail_cleanup_push(text, jsonb) to anon, authenticated, service_role;
comment on function hq_mail_cleanup_push(text, jsonb) is '본부 → 오피스 메일함 정리안 · 실행 결과 (077)';

-- 오피스 → 본부: 정리 요청된 줄 (가져가는 순간 그대로 requested · 실행 뒤 push 로 done/failed)
--   행동 = chosen 이 있으면 그것, 없으면 action (ask 는 실행 안 함)
create or replace function hq_mail_cleanup_pull(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare ws uuid := hq_auth(p_token);
begin
  return jsonb_build_object('cleanup', (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', c.id, 'account', a.address, 'sender_addr', c.sender_addr, 'part', c.part, 'do', coalesce(c.chosen, c.action), 'label', c.label,
             'unsub', c.unsub, 'kind', c.kind) order by c.count desc), '[]'::jsonb)
      from hq_mail_cleanup c left join hq_mail_accounts a on a.id = c.account_id
     where c.workspace_id = ws and c.status = 'requested' and c.checked and coalesce(c.chosen, c.action) <> 'ask'));
end $$;
revoke all on function hq_mail_cleanup_pull(text) from public;
grant execute on function hq_mail_cleanup_pull(text) to anon, authenticated, service_role;
comment on function hq_mail_cleanup_pull(text) is '오피스 → 본부 메일함 정리 요청 (077)';

-- ── ③ 구독 취소 · 그동안 온 메일 (날짜 · 제목) · 유지 (2026-10-31 대표) ──
--   구독 취소 줄을 누르면 그동안 온 메일 제목이 날짜와 함께 펼쳐진다 → hq_mail_unsubs.examples [{date, subject}]
--   (메일함 정리 hq_mail_cleanup.examples 도 같은 모양 [{date, subject}])
alter table hq_mail_unsubs add column if not exists examples jsonb not null default '[]'::jsonb;

-- 본부 → 오피스: 구독 취소 대상의 그동안 온 메일 (076 hq_mail_push 는 그대로 두고 따로)
--   p_payload = { unsubs: [{ account, sender_addr, examples: [{date, subject}] }] }   (최근 것부터 20개까지)
create or replace function hq_mail_unsub_examples(p_token text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare ws uuid := hq_auth(p_token); x jsonb; n int := 0;
begin
  for x in select * from jsonb_array_elements(coalesce(p_payload->'unsubs', '[]'::jsonb)) loop
    update hq_mail_unsubs u set examples = coalesce(x->'examples', '[]'::jsonb), updated_at = now()
      from hq_mail_accounts a
     where u.workspace_id = ws and a.id = u.account_id and a.address = x->>'account' and u.sender_addr = lower(x->>'sender_addr');
    if found then n := n + 1; end if;
  end loop;
  return jsonb_build_object('ok', true, 'updated', n);
end $$;
revoke all on function hq_mail_unsub_examples(text, jsonb) from public;
grant execute on function hq_mail_unsub_examples(text, jsonb) to anon, authenticated, service_role;
comment on function hq_mail_unsub_examples(text, jsonb) is '본부 → 오피스 구독 취소 대상의 그동안 온 메일 (077)';

-- 오피스 → 본부 (076 hq_mail_pull 다시 쓰기 · 반환 키는 그대로 + kept)
--   kept = 오피스에서 「유지」 한 곳 (구독 취소 유지 + 메일함 정리 chosen keep) → 본부가 다음 정리 때 공통/메일-규칙.md 「지키기」 에 넣는다
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
              where workspace_id = ws and status = 'done' and updated_at > now() - interval '2 days'),
    'kept', (select coalesce(jsonb_agg(k), '[]'::jsonb) from (
               select jsonb_build_object('account', a.address, 'sender_addr', u.sender_addr, 'sender_name', u.sender_name) as k
                 from hq_mail_unsubs u left join hq_mail_accounts a on a.id = u.account_id
                where u.workspace_id = ws and u.status = 'kept'
               union
               select jsonb_build_object('account', a.address, 'sender_addr', c.sender_addr, 'sender_name', c.sender_name)
                 from hq_mail_cleanup c left join hq_mail_accounts a on a.id = c.account_id
                where c.workspace_id = ws and c.chosen = 'keep') kk)
  );
end $$;
revoke all on function hq_mail_pull(text) from public;
grant execute on function hq_mail_pull(text) to anon, authenticated, service_role;
comment on function hq_mail_pull(text) is '오피스 → 본부 보낼 초안 · 구독 취소 요청 · 템플릿 · 유지한 곳 (076 · 077 kept)';

-- ── ④ 확인 ── 표 1 · 함수 4 · 구독 취소 examples 칸 1
select
  (select count(*) from pg_tables where schemaname = 'public' and tablename = 'hq_mail_cleanup') as table_1,
  (select count(*) from pg_proc where proname in ('hq_mail_cleanup_push', 'hq_mail_cleanup_pull', 'hq_mail_unsub_examples', 'hq_mail_pull')) as functions_4,
  (select count(*) from information_schema.columns where table_name = 'hq_mail_unsubs' and column_name = 'examples') as unsub_examples_1;

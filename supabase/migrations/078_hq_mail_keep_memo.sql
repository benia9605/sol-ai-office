-- ────────────────────────────────────────────────────────
-- 078: 메일 「유지」 메모 + 메일함 정리 표 맞추기 (2026-10-31 대표 결정 · 최종본)
-- ────────────────────────────────────────────────────────
-- 배경:
--   · 구독 취소 · 메일함 정리에서 「유지」 할 때 한 줄 메모를 남긴다 (예: 「즐겨 보는 뉴스레터 · 배움으로 분류」)
--   · 본부는 다음 정리 때 그 메모를 읽는다 - 메모에 「배움」 이 있으면 라벨 「배움」(본부 매일 공부), 없으면 라벨 「뉴스레터」
--
--   · 077 을 처음 돌릴 때 앞선 판이 먼저 들어가 hq_mail_cleanup 에 label 칸이 없고 옛 검사(part · kind · action)가 남았다 → 여기서 최종 모양으로 맞춘다
--
-- 이 마이그레이션은
--   ⓪ hq_mail_cleanup 을 077 최종 모양으로 (label 칸 · 옛 검사 지우고 새 검사 · 보낸 곳 + 무리 하나에 한 줄)
--   ① hq_mail_unsubs · hq_mail_cleanup 에 keep_memo 칸
--   ② hq_mail_pull 다시 쓰기 (076 · 077 반환 키 그대로 · kept 에 memo 추가)
--   ③ 확인
-- 가산적 · 여러 번 돌려도 안전.

-- ── ⓪ 메일함 정리 표 맞추기 ──
alter table hq_mail_cleanup add column if not exists label text;
alter table hq_mail_cleanup add column if not exists part text not null default 'all';
alter table hq_mail_cleanup alter column kind set default '기타';
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'hq_mail_cleanup'::regclass and contype = 'c' loop
    execute format('alter table hq_mail_cleanup drop constraint %I', c.conname);
  end loop;
end $$;
alter table hq_mail_cleanup add constraint hq_mail_cleanup_action_check check (action in ('trash', 'unsub_trash', 'label', 'keep', 'ask'));
alter table hq_mail_cleanup add constraint hq_mail_cleanup_chosen_check check (chosen is null or chosen in ('trash', 'unsub_trash', 'label', 'keep'));
alter table hq_mail_cleanup add constraint hq_mail_cleanup_unsub_check check (unsub is null or unsub in ('oneclick', 'link', 'caution'));
alter table hq_mail_cleanup add constraint hq_mail_cleanup_status_check check (status in ('proposed', 'requested', 'done', 'failed'));
create unique index if not exists hq_mail_cleanup_sender_part_uidx on hq_mail_cleanup(workspace_id, account_id, sender_addr, part);

-- ── ① 칸 ──
alter table hq_mail_unsubs add column if not exists keep_memo text;
alter table hq_mail_cleanup add column if not exists keep_memo text;

-- ── ② 오피스 → 본부 (kept 에 memo) ──
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
               select jsonb_build_object('account', a.address, 'sender_addr', u.sender_addr, 'sender_name', u.sender_name, 'memo', u.keep_memo, 'from', 'unsub') as k
                 from hq_mail_unsubs u left join hq_mail_accounts a on a.id = u.account_id
                where u.workspace_id = ws and u.status = 'kept'
               union
               select jsonb_build_object('account', a.address, 'sender_addr', c.sender_addr, 'sender_name', c.sender_name, 'memo', c.keep_memo, 'from', 'cleanup', 'part', c.part)
                 from hq_mail_cleanup c left join hq_mail_accounts a on a.id = c.account_id
                where c.workspace_id = ws and c.chosen = 'keep') kk)
  );
end $$;
revoke all on function hq_mail_pull(text) from public;
grant execute on function hq_mail_pull(text) to anon, authenticated, service_role;
comment on function hq_mail_pull(text) is '오피스 → 본부 보낼 초안 · 구독 취소 요청 · 템플릿 · 유지한 곳과 메모 (076 · 077 · 078)';

-- ── ③ 확인 ── 메모 칸 2 · 라벨 칸 1 · 검사 4
select
  (select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'keep_memo'
     and table_name in ('hq_mail_unsubs', 'hq_mail_cleanup')) as memo_columns_2,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'hq_mail_cleanup' and column_name = 'label') as label_1,
  (select count(*) from pg_constraint where conrelid = 'hq_mail_cleanup'::regclass and contype = 'c') as checks_4;

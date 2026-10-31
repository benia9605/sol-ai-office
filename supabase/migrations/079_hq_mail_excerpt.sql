-- ────────────────────────────────────────────────────────
-- 079: 메일 「본문 미리보기」 - 요약보다 조금 더 (2026-10-31 대표 요청)
-- ────────────────────────────────────────────────────────
-- 배경:
--   · 오피스 메일 열기 판에 요약만 있어서 내용을 더 보고 싶다는 요청
--   · 본부(sol-hq)가 본문 앞부분만 넣는다: 인용 · 이전 메일 · 서명 · 수신 거부 문구를 자른 글자판 · 최대 1500자
--   · 중요 · 답장 필요 · 주문 · 청구서 · 사람(기타)만 넣는다. 광고 · 알림 메일은 넣지 않는다
--
-- 이 마이그레이션은
--   ① hq_mail_messages.excerpt 칼럼
--   ② hq_mail_excerpts(본부 토큰, { items: [{ msg_key, excerpt }] }) - 076 hq_mail_push 는 그대로 두고 따로 받는다
--   ③ 확인
-- 가산적 · 여러 번 돌려도 안전.

-- ── ① 칼럼 ──
alter table hq_mail_messages add column if not exists excerpt text;
comment on column hq_mail_messages.excerpt is '본문 앞부분 (본부가 넣음 · 인용 · 서명 자름 · 1500자까지 · 079)';

-- ── ② 본부 함수 ──
create or replace function hq_mail_excerpts(p_token text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  ws uuid := hq_auth(p_token);
  x jsonb;
  n int := 0;
  k int;
begin
  for x in select * from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) loop
    update hq_mail_messages
       set excerpt = left(x->>'excerpt', 1500), updated_at = now()
     where workspace_id = ws and msg_key = x->>'msg_key';
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return jsonb_build_object('ok', true, 'updated', n);
end $$;
revoke all on function hq_mail_excerpts(text, jsonb) from public;
grant execute on function hq_mail_excerpts(text, jsonb) to anon, authenticated, service_role;
comment on function hq_mail_excerpts(text, jsonb) is '본부 → 오피스 메일 본문 앞부분 (079)';

-- ── ③ 확인 ── 칼럼 1 · 함수 1
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'hq_mail_messages' and column_name = 'excerpt') as column_1,
  (select count(*) from pg_proc where proname = 'hq_mail_excerpts') as function_1;

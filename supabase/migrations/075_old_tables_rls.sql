-- 075 옛 개인 표 16개 RLS 켜기 (2026-10-31)
-- 왜: Supabase 보안 메일 (10-25 · rls_disabled_in_public · Critical). 아래 표들은 RLS 가 꺼져 있어
--     공개 키만 있으면 누구나 읽기 · 고치기 · 지우기가 됐다 (할 일 150 · 메시지 62 · 기록 9 · 프로필 2 …).
-- 어떻게: 표마다 칸을 보고 정책을 붙인다
--   user_id + workspace_id → 내 것 이거나 내 워크스페이스 것
--   user_id 만             → 내 것만
--   둘 다 없음             → 건너뛰고 알림 (그 표는 본부가 따로 본다)
-- 서버 · 엣지 함수(service role)는 RLS 를 안 받으니 그대로 돈다. 로그인한 화면은 그대로 보인다.
-- 끝의 확인 표에서 「RLS」 가 전부 true · 「정책 수」 가 4 이면 끝.

do $$
declare
  t text;
  has_user boolean;
  has_ws boolean;
  cond text;
begin
  foreach t in array array[
    'conversation_summaries','conversations','daily_completions','goals','insights','journals',
    'kpi_logs','kpis','messages','options','projects','reading_logs','readings','schedules',
    'tasks','user_profiles']
  loop
    if to_regclass('public.' || t) is null then
      raise notice '% : 표 없음 · 건너뜀', t; continue;
    end if;
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='user_id') into has_user;
    select exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='workspace_id') into has_ws;

    if has_user and has_ws then
      cond := '(user_id::text = auth.uid()::text or workspace_id in (select my_workspace_ids()))';
    elsif has_user then
      cond := '(user_id::text = auth.uid()::text)';
    else
      raise notice '% : user_id 칸 없음 · 건너뜀 (RLS 그대로 꺼짐)', t; continue;
    end if;

    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_own_select', t);
    execute format('create policy %I on %I for select using %s', t || '_own_select', t, cond);
    execute format('drop policy if exists %I on %I', t || '_own_insert', t);
    execute format('create policy %I on %I for insert with check %s', t || '_own_insert', t, cond);
    execute format('drop policy if exists %I on %I', t || '_own_update', t);
    execute format('create policy %I on %I for update using %s with check %s', t || '_own_update', t, cond, cond);
    execute format('drop policy if exists %I on %I', t || '_own_delete', t);
    execute format('create policy %I on %I for delete using %s', t || '_own_delete', t, cond);
  end loop;
end $$;

-- 확인
select c.relname as "표",
       c.relrowsecurity as "RLS",
       (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname and p.policyname like c.relname || '_own_%') as "정책 수"
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('conversation_summaries','conversations','daily_completions','goals','insights','journals',
    'kpi_logs','kpis','messages','options','projects','reading_logs','readings','schedules','tasks','user_profiles')
order by 1;

-- ────────────────────────────────────────────────────────
-- 057: insights.category 컬럼 (누락 보정)
-- ────────────────────────────────────────────────────────
-- 배경: 앱은 insights에 category(공용 카테고리 id, options scope=task)를 저장/조회하는데
-- (InsightRow.category, addInsight insert, InsightsPage CategorySelect), 이 컬럼을 추가한 마이그레이션이 없었다.
-- 실 DB에 category가 없으면 개인 인사이트 저장 시 insert 실패(42703). idempotent하게 보정.
-- (insights는 base 테이블 — 존재 가드.)

do $$
begin
  if to_regclass('public.insights') is null then
    raise notice 'insights 테이블이 없어 스킵';
    return;
  end if;
  alter table public.insights add column if not exists category text;
end $$;

comment on column public.insights.category is '공용 카테고리(options scope=task) id. 개인 인사이트 분류. 마이그 057';

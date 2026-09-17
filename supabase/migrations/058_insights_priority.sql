-- ────────────────────────────────────────────────────────
-- 058: insights.priority 컬럼 (누락 보정)
-- ────────────────────────────────────────────────────────
-- 배경: 인사이트 폼/필터에 '중요도(priority)'가 있는데 insights 테이블에 컬럼이 없어
-- 저장 경로에서 조용히 유실되고 있었다(로컬 mock엔 값이 살아 로컬↔프로덕션 불일치).
-- idempotent하게 컬럼 추가. 값: 'high' | 'medium' | 'low'.

do $$
begin
  if to_regclass('public.insights') is null then
    raise notice 'insights 테이블이 없어 스킵';
    return;
  end if;
  alter table public.insights add column if not exists priority text;
end $$;

comment on column public.insights.priority is '중요도: high|medium|low. 마이그 058';

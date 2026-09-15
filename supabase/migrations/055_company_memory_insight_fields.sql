-- ────────────────────────────────────────────────────────
-- 055: company_memory — 인사이트 통합용 필드 (source·link·category)
-- ────────────────────────────────────────────────────────
-- 배경: 인사이트+기억을 '인사이트' 하나로 통합(docs/CONTENT_HUB_REDESIGN.md §3, CATEGORY_SYSTEM).
-- company_memory가 상위집합. insights의 source/link/category를 무손실 보존하려 컬럼 추가.
-- 이후 056에서 insights → company_memory(kind='insight') 복사. 모두 nullable + 무중단.

alter table public.company_memory add column if not exists source   text;
alter table public.company_memory add column if not exists link     text;
alter table public.company_memory add column if not exists category text;

comment on column public.company_memory.source   is '인사이트 통합: 출처(레거시 insights.source).';
comment on column public.company_memory.link     is '인사이트 통합: 참고 링크(레거시 insights.link).';
comment on column public.company_memory.category is '공용 카테고리(options scope=insight) id. 마이그 055';

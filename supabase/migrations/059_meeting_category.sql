-- ────────────────────────────────────────────────────────
-- 059: 회의 카테고리
-- ────────────────────────────────────────────────────────
-- 배경: 오피스 '회의' 메뉴에도 다른 메뉴(할일·인사이트·콘텐츠…)처럼
--       공용 카테고리(options scope='meeting') 를 붙여 정기/기획/회고/1:1 등으로
--       분류·색배지 표시할 수 있게 한다.
-- 무엇: meetings 테이블에 category 컬럼(options.id 참조 문자열) 추가.
--       nullable + default 없음(무중단). 기존 회의는 category = NULL.
-- 카테고리 세트 자체는 앱이 options 테이블에 lazy-seed 하므로 별도 시드 SQL 없음.

alter table if exists public.meetings
  add column if not exists category text;

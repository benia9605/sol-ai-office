-- ────────────────────────────────────────────────────────
-- 025: tasks 추적 컬럼 — source 추가
-- ────────────────────────────────────────────────────────
-- 어떤 기능에서 생성된 할일인지 추적(향후 리드타임/생성원천 분석용).
-- category, completed_at 은 이미 존재(과거 base 스키마) → 여기선 source만 추가.
-- 적용일: 2026-08-04. idempotent. (수동 SQL 에디터 적용)
-- ────────────────────────────────────────────────────────

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT;  -- manual | content | decision | memory | campaign | ai

COMMENT ON COLUMN tasks.source IS '할일 생성 원천: manual|content|decision|memory|campaign|ai. 기본 manual.';

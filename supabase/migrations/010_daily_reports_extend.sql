-- ────────────────────────────────────────────────────────
-- daily_reports 확장 — 정밀 로직(실행 원장 + 산출물 통합)
-- 설계: docs/guides/ai오피스구축/_회사오피스_최종플랜.md §1-4
-- 적용일: 2026-06-16 · 대시보드 SQL 에디터에서 검토 후 적용. idempotent.
-- 기존 daily_reports를 "한 번의 실행(run)+산출물(output)" 단위로 확장한다.
-- ────────────────────────────────────────────────────────

ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS trigger      TEXT DEFAULT 'auto';  -- 'auto'(cron/일과) | 'manual'(지금 시키기)
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS output_kind  TEXT;                 -- sourcing_brief / ticket_list / ... (직원 타입별)
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS content_json JSONB;                -- 구조화 출력(있으면). 없으면 body(마크다운) 사용
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS input        JSONB;                -- 수동 실행 시 사장이 넣은 입력
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'done';  -- 'done' | 'failed'
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS error        TEXT;                 -- 실패 시 메시지

COMMENT ON COLUMN daily_reports.trigger IS 'auto(일과/cron) | manual(지금 시키기)';
COMMENT ON COLUMN daily_reports.content_json IS '구조화 출력(outputKind별 스키마). UI 카드·차트용';

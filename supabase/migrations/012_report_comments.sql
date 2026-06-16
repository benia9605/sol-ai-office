-- ────────────────────────────────────────────────────────
-- 일일 리포트 코멘트 — 사장이 리포트마다 의견을 남김
-- 적용일: 2026-06-16 · daily_reports에 comments(JSONB 배열) 추가. idempotent.
-- 형식: [{ "text": "...", "at": "ISO" }]
-- ────────────────────────────────────────────────────────

ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN daily_reports.comments IS '사장 코멘트 배열 [{text, at}]';

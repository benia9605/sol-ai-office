-- ────────────────────────────────────────────────────────
-- insights.starred 컬럼 추가
-- - 즐겨찾기 표시 (true면 모던 인사이트 페이지에서 최상단 고정)
-- - 적용일: 2026-05-21
-- ────────────────────────────────────────────────────────

ALTER TABLE insights
  ADD COLUMN IF NOT EXISTS starred BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS insights_starred_idx
  ON insights(user_id, starred)
  WHERE starred = TRUE;

COMMENT ON COLUMN insights.starred IS '즐겨찾기 (상단 고정용)';

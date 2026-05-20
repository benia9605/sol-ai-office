-- ────────────────────────────────────────────────────────
-- user_profiles.active_theme 컬럼 추가
-- - 'modi'(기본, 보라/파스텔) | 'modern'(MUJI톤, 진초록 액센트)
-- - 변경 가이드: docs/THEME_SYSTEM_PLAN.md
-- - 적용일: 2026-05-20
-- ────────────────────────────────────────────────────────

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS active_theme TEXT
  NOT NULL DEFAULT 'modi'
  CHECK (active_theme IN ('modi', 'modern'));

COMMENT ON COLUMN user_profiles.active_theme IS
  '유저가 선택한 UI 테마: modi(기본) 또는 modern(MUJI톤)';

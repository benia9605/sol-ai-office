-- ────────────────────────────────────────────────────────
-- 오피스/개인 데이터 분리 — insights·journals·youtube에 workspace_id 추가
-- workspace_id NULL = 개인(레거시 데이터), 값 있으면 해당 워크스페이스(오피스)
-- RLS는 기존 user_id 기반 유지. 개인↔오피스 분리는 앱 레벨 workspace_id 필터로 처리.
-- 적용일: 2026-06-16 · idempotent. base 테이블 부재 대비 to_regclass 가드.
-- ────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.insights') IS NOT NULL THEN
    ALTER TABLE insights ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS insights_ws_idx ON insights(workspace_id);
  END IF;

  IF to_regclass('public.journals') IS NOT NULL THEN
    ALTER TABLE journals ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS journals_ws_idx ON journals(workspace_id);
  END IF;

  IF to_regclass('public.youtube_channels') IS NOT NULL THEN
    ALTER TABLE youtube_channels ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS yt_channels_ws_idx ON youtube_channels(workspace_id);
  END IF;

  IF to_regclass('public.youtube_videos') IS NOT NULL THEN
    ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.youtube_comments') IS NOT NULL THEN
    ALTER TABLE youtube_comments ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON COLUMN insights.workspace_id IS 'NULL=개인, 값=해당 워크스페이스(오피스). 개인↔오피스 분리.';

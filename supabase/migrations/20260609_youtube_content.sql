-- ────────────────────────────────────────────────────────
-- 콘텐츠(유튜브) 기능 테이블
-- - youtube_channels: 연결된 채널
-- - youtube_videos:   채널별 영상 (주간 추이/시트용)
-- - youtube_comments: 영상별 댓글 + 답글 초안/발행 상태
-- - 모두 user_id 격리 + RLS
-- - 적용일: 2026-06-09
-- ────────────────────────────────────────────────────────

-- ── 채널 ──
CREATE TABLE IF NOT EXISTS youtube_channels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id       TEXT NOT NULL,
  title            TEXT NOT NULL,
  thumbnail        TEXT,
  subscriber_count INTEGER,
  video_count      INTEGER,
  connected_at     TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, channel_id)
);

-- ── 영상 ──
CREATE TABLE IF NOT EXISTS youtube_videos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id    TEXT NOT NULL,
  video_id      TEXT NOT NULL,
  title         TEXT NOT NULL,
  thumbnail     TEXT,
  published_at  TIMESTAMPTZ NOT NULL,
  view_count    INTEGER,
  like_count    INTEGER,
  comment_count INTEGER,
  script        TEXT,          -- 영상 자막/스크립트 (답글 생성 맥락용)
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, video_id)
);

-- ── 댓글 ──
CREATE TABLE IF NOT EXISTS youtube_comments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id       TEXT NOT NULL,
  video_id         TEXT NOT NULL,
  channel_id       TEXT NOT NULL,
  author           TEXT NOT NULL,
  author_thumbnail TEXT,
  text             TEXT NOT NULL,
  published_at     TIMESTAMPTZ NOT NULL,
  like_count       INTEGER,
  reply_status     TEXT NOT NULL DEFAULT 'none',  -- none | draft | published
  reply_draft      TEXT,
  replied_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS youtube_videos_channel_idx   ON youtube_videos(user_id, channel_id);
CREATE INDEX IF NOT EXISTS youtube_comments_video_idx   ON youtube_comments(user_id, video_id);
CREATE INDEX IF NOT EXISTS youtube_comments_status_idx  ON youtube_comments(user_id, reply_status);

-- ── RLS ──
ALTER TABLE youtube_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_videos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own youtube_channels" ON youtube_channels
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own youtube_videos" ON youtube_videos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own youtube_comments" ON youtube_comments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────
-- 037: 소셜 — 할일·콘텐츠 좋아요 + 댓글(+답글)
-- ────────────────────────────────────────────────────────
-- 배경(알림 Phase 2): 할일/콘텐츠에 좋아요·댓글·답글을 달고, 관련자에게 푸시(notify).
--   댓글 → 작성자(+할일은 담당자) / 답글 → 부모 댓글 작성자 / 좋아요 → 작성자.
-- 설계: 밋업 가이드 3.1 템플릿. 단, 조인 RLS 대신 workspace_id 컬럼 + my_workspace_ids()로 단순화
--   (우리 앱의 다른 오피스 테이블과 동일 패턴).
-- 좋아요 토글은 mock 호환 위해 앱에서 '조회 후 insert/delete'(PK 중복 트릭 미사용).
-- 적용일: 2026-08-17. idempotent.
-- ────────────────────────────────────────────────────────

-- ── 할일 좋아요 ──
CREATE TABLE IF NOT EXISTS task_likes (
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS task_likes_ws_idx ON task_likes(workspace_id);

-- ── 할일 댓글(+답글) ──
CREATE TABLE IF NOT EXISTS task_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  content      TEXT NOT NULL,
  parent_id    UUID REFERENCES task_comments(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_comments_task_idx ON task_comments(task_id, created_at);

-- ── 콘텐츠 좋아요 ──
CREATE TABLE IF NOT EXISTS content_likes (
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (content_item_id, user_id)
);
CREATE INDEX IF NOT EXISTS content_likes_ws_idx ON content_likes(workspace_id);

-- ── 콘텐츠 댓글(+답글) ──
CREATE TABLE IF NOT EXISTS content_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  content         TEXT NOT NULL,
  parent_id       UUID REFERENCES content_comments(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_comments_item_idx ON content_comments(content_item_id, created_at);

-- ── RLS (오피스 공용 · my_workspace_ids) ──
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['task_likes','task_comments','content_likes','content_comments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I;', t, t);
    EXECUTE format('CREATE POLICY %I_select ON %I FOR SELECT USING (workspace_id IN (SELECT my_workspace_ids()));', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON %I;', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON %I FOR INSERT WITH CHECK (user_id = auth.uid() AND workspace_id IN (SELECT my_workspace_ids()));', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON %I;', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON %I FOR DELETE USING (user_id = auth.uid());', t, t);
  END LOOP;
END $$;

COMMENT ON TABLE task_likes IS '할일 좋아요(확인·응원). 1인 1좋아요(PK).';
COMMENT ON TABLE task_comments IS '할일 댓글(+parent_id 답글).';
COMMENT ON TABLE content_likes IS '콘텐츠 좋아요.';
COMMENT ON TABLE content_comments IS '콘텐츠 댓글(+parent_id 답글).';

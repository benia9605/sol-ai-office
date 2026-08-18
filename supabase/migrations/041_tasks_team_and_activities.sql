-- ────────────────────────────────────────────────────────
-- 041: 팀 할일 가시성(RLS) + 워크스페이스 활동 로그
-- ────────────────────────────────────────────────────────
-- 배경: 회의→할일 배정 가이드의 팀 기능(받은 할일·팀 진행률·멤버 담당·활동 피드)을 붙인다.
--   기존 tasks RLS는 user_id=본인만 조회/수정 → 남이 나에게 배정한 공유 할일이 안 보였다.
-- 이 마이그레이션은 (1) 워크스페이스 멤버가 서로의 '공유' 할일을 조회하고 담당자가 완료
--   체크할 수 있게 정책을 '추가'만 한다(기존 user_id 정책 유지 = OR 결합, 최소 노출).
--   (2) workspace_activities(활동 로그) 테이블을 만든다.
-- 적용일: 2026-08-18. idempotent. 대시보드 SQL 에디터 수동 적용.
-- ────────────────────────────────────────────────────────

-- (1) tasks — 팀 가시성/수정 정책 '추가' (기존 정책은 건드리지 않음)
--     공유 할일(is_shared)을 같은 워크스페이스 멤버가 조회
DROP POLICY IF EXISTS tasks_ws_shared_select ON tasks;
CREATE POLICY tasks_ws_shared_select ON tasks
  FOR SELECT
  USING (is_shared IS TRUE AND workspace_id IN (SELECT my_workspace_ids()));

--     담당자 본인은 배정받은 할일을 수정(완료 체크 등) 가능
DROP POLICY IF EXISTS tasks_assignee_update ON tasks;
CREATE POLICY tasks_assignee_update ON tasks
  FOR UPDATE
  USING (assignee_id = auth.uid())
  WITH CHECK (assignee_id = auth.uid());

-- (2) workspace_activities — 팀 활동 로그
CREATE TABLE IF NOT EXISTS workspace_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,               -- completed_task | created_meeting | created_task ...
  resource_type TEXT,                         -- task | meeting ...
  resource_id   UUID,
  metadata      JSONB,                        -- { title, ... }
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workspace_activities_ws_idx ON workspace_activities(workspace_id, created_at DESC);

ALTER TABLE workspace_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workspace_activities_select ON workspace_activities;
CREATE POLICY workspace_activities_select ON workspace_activities
  FOR SELECT USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS workspace_activities_insert ON workspace_activities;
CREATE POLICY workspace_activities_insert ON workspace_activities
  FOR INSERT WITH CHECK (workspace_id IN (SELECT my_workspace_ids()) AND (actor_id = auth.uid() OR actor_id IS NULL));

COMMENT ON TABLE workspace_activities IS '팀 활동 로그(할일 완료·회의 생성 등). notify와 별개로 영구 보관.';

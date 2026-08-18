-- ────────────────────────────────────────────────────────
-- 040: 회의 전용 메뉴 — meetings(회의 + 회의록) + tasks.meeting_id(액션아이템 연결)
-- ────────────────────────────────────────────────────────
-- 배경: 오피스에 회의 전용 메뉴. 회의 등록 → 회의록 작성 → 회의록에서 할일 배정(담당자 알림).
--   참석자/투표는 제외(요청). 회의록 본문은 content(text). 회의에서 나온 할일은 tasks.meeting_id로 연결.
-- 알림: 회의 등록·회의록 → 멤버(notify_schedule 토글 재사용) / 할일 배정 → 담당자(notify_task_assigned).
-- 적용일: 2026-08-18. idempotent.
-- ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meetings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  meeting_date  DATE,
  meeting_time  TEXT,
  content       TEXT,                 -- 회의록 본문
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meetings_ws_idx ON meetings(workspace_id, meeting_date DESC NULLS LAST, created_at DESC);

-- 회의에서 나온 할일(액션 아이템) 연결 — 회의록 지워져도 할일은 유지
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;

-- 회의를 일정(캘린더)에 '회의'로 연동 — 회의 삭제 시 일정도 함께 삭제(CASCADE)
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE;

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meetings_select ON meetings;
CREATE POLICY meetings_select ON meetings FOR SELECT USING (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS meetings_insert ON meetings;
CREATE POLICY meetings_insert ON meetings FOR INSERT WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS meetings_update ON meetings;
CREATE POLICY meetings_update ON meetings FOR UPDATE USING (workspace_id IN (SELECT my_workspace_ids())) WITH CHECK (workspace_id IN (SELECT my_workspace_ids()));
DROP POLICY IF EXISTS meetings_delete ON meetings;
CREATE POLICY meetings_delete ON meetings FOR DELETE USING (workspace_id IN (SELECT my_workspace_ids()));

COMMENT ON TABLE meetings IS '회의 + 회의록(content). 액션아이템은 tasks.meeting_id로 연결. 참석자/투표 없음.';

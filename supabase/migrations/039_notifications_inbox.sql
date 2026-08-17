-- ────────────────────────────────────────────────────────
-- 039: 인앱 알림센터 — notifications(수신자별 인박스)
-- ────────────────────────────────────────────────────────
-- 배경: 푸시를 꺼두거나 못 받은 사람도 앱에서 놓친 알림을 확인(읽음/안읽음).
--   notify Edge Function 이 발송 대상마다 이 테이블에 1행씩 기록(service_role) → 벨 아이콘이 렌더.
-- 원칙: 본인 것만 조회/읽음처리. 삽입은 서버(notify)만.
-- 적용일: 2026-08-17. idempotent.
-- ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,           -- 수신자
  actor_id     UUID,                    -- 발생시킨 사람
  type         TEXT NOT NULL,           -- notify_task_assigned 등
  title        TEXT NOT NULL,
  body         TEXT,
  url          TEXT,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 본인 것만 조회
DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications FOR SELECT USING (user_id = auth.uid());
-- 읽음 처리(본인)
DROP POLICY IF EXISTS notifications_update ON notifications;
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- 삭제(본인) — 인박스 비우기
DROP POLICY IF EXISTS notifications_delete ON notifications;
CREATE POLICY notifications_delete ON notifications FOR DELETE USING (user_id = auth.uid());
-- 삽입은 service_role(notify 함수)만 → 클라 insert 정책 없음(RLS로 차단)

COMMENT ON TABLE notifications IS '인앱 알림센터 인박스(수신자별). notify 함수가 발송 대상마다 기록. 본인만 조회/읽음.';

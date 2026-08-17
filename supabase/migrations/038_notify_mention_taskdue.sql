-- ────────────────────────────────────────────────────────
-- 038: 알림 확장 — @멘션 + 할일 마감 임박(담당자) 토글
-- ────────────────────────────────────────────────────────
-- 배경: (1) 댓글/답글에서 @닉네임 멘션 시 그 사람에게 알림.
--       (2) 오피스 할일이 오늘/내일 마감이면 담당자(assignee)에게 아침 크론 알림.
--   기존 task_deadline(개인 user_id)과 별개 — office-task-due 함수가 assignee 기준으로 발송.
-- 적용일: 2026-08-17. idempotent.
-- ────────────────────────────────────────────────────────

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS notify_mention  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_task_due BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN notification_preferences.notify_mention IS '댓글/답글에서 @멘션 당하면 알림';
COMMENT ON COLUMN notification_preferences.notify_task_due IS '내가 담당인 할일이 오늘/내일 마감이면 알림(office-task-due 크론)';

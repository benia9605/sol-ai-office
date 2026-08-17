-- ────────────────────────────────────────────────────────
-- 036: 이벤트 알림 종류 토글 — notification_preferences 컬럼 추가
-- ────────────────────────────────────────────────────────
-- 배경: 기존 notification_preferences 는 개인 크론 리마인더(마감·일정·아침브리핑) 토글.
--   여기에 팀/오피스용 '이벤트 알림'(할일 배정·완료·일정 등록·콘텐츠 발행·댓글·좋아요) 토글을 추가.
-- notify Edge Function 이 수신자별로 이 컬럼을 checkPreference 로 확인해 필터한다.
-- 원칙: 컬럼 없으면 checkPreference 가 기본 true 로 처리하므로, 좋아요만 기본 false(소음 큼).
-- 적용일: 2026-08-17. idempotent.
-- ────────────────────────────────────────────────────────

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS notify_task_assigned  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_task_completed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_schedule       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_content        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_comment        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_like           BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN notification_preferences.notify_task_assigned IS '할일 배정/재배정 시 담당자 알림';
COMMENT ON COLUMN notification_preferences.notify_task_completed IS '할일 완료 시 멤버 알림';
COMMENT ON COLUMN notification_preferences.notify_schedule IS '일정(회의) 등록 시 멤버 알림';
COMMENT ON COLUMN notification_preferences.notify_content IS '콘텐츠 발행 시 멤버 알림';
COMMENT ON COLUMN notification_preferences.notify_comment IS '댓글/답글 알림 (Phase 2)';
COMMENT ON COLUMN notification_preferences.notify_like IS '좋아요 알림 (Phase 2, 기본 OFF)';

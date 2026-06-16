-- ────────────────────────────────────────────────────────
-- staff_routines 스케줄 확장 (일/주간/월간 + 요일/날짜)
-- 적용일: 2026-06-15 · 005 이후 실행.
-- ────────────────────────────────────────────────────────
ALTER TABLE staff_routines ADD COLUMN IF NOT EXISTS day_of_week  INT;  -- 0(일)~6(토) · weekly용
ALTER TABLE staff_routines ADD COLUMN IF NOT EXISTS day_of_month INT;  -- 1~31 · monthly용
ALTER TABLE staff_routines ADD COLUMN IF NOT EXISTS last_run_at  TIMESTAMPTZ;  -- 마지막 실행 시각(중복 실행 방지)

-- schedule에 'monthly' 허용
ALTER TABLE staff_routines DROP CONSTRAINT IF EXISTS staff_routines_schedule_check;
ALTER TABLE staff_routines ADD CONSTRAINT staff_routines_schedule_check
  CHECK (schedule IN ('realtime','daily','weekly','monthly'));

COMMENT ON COLUMN staff_routines.day_of_week  IS 'weekly: 0(일)~6(토)';
COMMENT ON COLUMN staff_routines.day_of_month IS 'monthly: 1~31';
COMMENT ON COLUMN staff_routines.last_run_at  IS 'cron 마지막 실행(중복 방지)';

-- =============================================
-- Sol AI Office (Teamie) — 푸시 알림 DB 스키마
-- Supabase SQL Editor에서 실행
-- =============================================

-- =============================================
-- 1. push_subscriptions: 기기별 푸시 구독 정보
-- =============================================
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_own" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- 2. notification_preferences: 유저별 알림 설정
-- =============================================
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  -- 할일 알림
  task_deadline BOOLEAN DEFAULT true,        -- D-1, D-Day 마감 알림
  task_overdue BOOLEAN DEFAULT true,         -- 미완료 할일 자정 알림
  morning_routine BOOLEAN DEFAULT true,      -- 매일 9시 루틴 체크
  -- 일정 알림
  schedule_reminder BOOLEAN DEFAULT true,    -- 일정 시작 N분전
  morning_briefing BOOLEAN DEFAULT true,     -- 매일 8시 오늘 일정
  -- 스터디
  pomodoro_done BOOLEAN DEFAULT true,        -- 뽀모도로 종료 (클라이언트)
  -- 기록
  morning_journal BOOLEAN DEFAULT true,      -- 아침 일기 리마인더
  evening_journal BOOLEAN DEFAULT true,      -- 저녁 기록 리마인더
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences_own" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- =============================================
-- 3. notification_log: 발송 로그 (중복 방지)
-- =============================================
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,         -- 'morning_briefing', 'task_deadline' 등
  ref_key TEXT NOT NULL,      -- '2026-03-20' 또는 'schedule-uuid' 등
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, type, ref_key)
);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_log_select_own" ON notification_log
  FOR SELECT USING (user_id = auth.uid());
-- Edge Functions는 service_role 키로 INSERT하므로 별도 INSERT 정책 불필요

-- =============================================
-- 4. user_profiles에 마지막 접속 시간 추가
-- =============================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;


-- =============================================
-- Vault 시크릿 등록 (최초 1회)
-- pg_cron에서 URL/키를 안전하게 참조하기 위해 사용
-- =============================================
-- SELECT vault.create_secret('<SUPABASE_ANON_KEY>', 'supabase_anon_key');
-- SELECT vault.create_secret('<SUPABASE_FUNCTIONS_URL>', 'supabase_functions_url');

-- =============================================
-- pg_cron 스케줄 등록
-- Vault에서 URL/키를 읽어서 Edge Function 호출
-- =============================================

-- 아침 브리핑: 매일 8시 KST (23:00 UTC 전날)
SELECT cron.schedule(
  'morning-briefing',
  '0 23 * * *',
  $cmd$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_functions_url') || '/morning-briefing',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key')
    ),
    body := '{}'::jsonb
  )$cmd$
);

-- 아침 루틴: 매일 9시 KST (0:00 UTC)
SELECT cron.schedule(
  'morning-routine',
  '0 0 * * *',
  $cmd$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_functions_url') || '/morning-routine',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key')
    ),
    body := '{}'::jsonb
  )$cmd$
);

-- 아침 일기: 매일 9:05 KST (0:05 UTC)
SELECT cron.schedule(
  'morning-journal',
  '5 0 * * *',
  $cmd$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_functions_url') || '/morning-journal',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key')
    ),
    body := '{}'::jsonb
  )$cmd$
);

-- 일정 리마인더: 5분마다
SELECT cron.schedule(
  'schedule-reminder',
  '*/5 * * * *',
  $cmd$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_functions_url') || '/schedule-reminder',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key')
    ),
    body := '{}'::jsonb
  )$cmd$
);

-- 할일 마감: 매일 10:01 KST (1:01 UTC)
SELECT cron.schedule(
  'task-deadline',
  '1 1 * * *',
  $cmd$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_functions_url') || '/task-deadline',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key')
    ),
    body := '{}'::jsonb
  )$cmd$
);

-- 저녁 기록: 매일 21시 KST (12:00 UTC)
SELECT cron.schedule(
  'evening-journal',
  '0 12 * * *',
  $cmd$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_functions_url') || '/evening-journal',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key')
    ),
    body := '{}'::jsonb
  )$cmd$
);

-- 미완료 할일: 매일 22:05 KST (13:05 UTC)
SELECT cron.schedule(
  'overdue-tasks',
  '5 13 * * *',
  $cmd$SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_functions_url') || '/overdue-tasks',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key')
    ),
    body := '{}'::jsonb
  )$cmd$
);

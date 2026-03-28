# 푸시 알림 디버깅 기록

## 프로젝트 환경
- Supabase (PostgreSQL + Edge Functions)
- Project Ref: `eadhobeluoivppoaxzbh`
- Edge Functions: Deno 런타임
- 시크릿 관리: `supabase secrets set` → Edge Function에서 `Deno.env.get()`

---

## 구조

### 알림 흐름
```
pg_cron (PostgreSQL 내장 스케줄러)
  → net.http_post() 로 Edge Function 호출
  → Edge Function 내부에서 getSupabaseAdmin() (service_role_key 사용)
  → sendPushToUser() → Web Push Protocol → 브라우저
```

### Edge Functions (8개)
| Function | Cron (UTC) | KST |
|----------|-----------|-----|
| morning-briefing | `0 23 * * *` | 8:00 |
| morning-routine | `0 0 * * *` | 9:00 |
| morning-journal | `5 0 * * *` | 9:05 |
| task-deadline | `1 1 * * *` | 10:01 |
| schedule-reminder | `*/5 * * * *` | 5분 간격 |
| evening-journal | `0 12 * * *` | 21:00 |
| overdue-tasks | `5 13 * * *` | 22:05 |
| test-push | 수동 | - |

### Supabase Secrets (supabase secrets set으로 등록됨)
```
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT (mailto:...)
SUPABASE_URL          ← 자동 제공
SUPABASE_SERVICE_ROLE_KEY  ← 자동 제공
SUPABASE_ANON_KEY     ← 자동 제공
```

Edge Function 내부에서는 `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` 등으로 정상 접근 가능.

---

## 발생한 에러

### 증상
- 모든 스케줄 알림이 매일 실패 (아침 브리핑, 루틴 체크 등 7개 중 6개)
- morning-journal 1개만 성공

### 에러 메시지 (cron.job_run_details)
```
ERROR: unrecognized configuration parameter "supabase_functions_endpoint"
ERROR: unrecognized configuration parameter "supabase.service_role_key"
```

### 원인: pg_cron에서 current_setting() 사용

실패한 cron job 코드:
```sql
SELECT cron.schedule(
  'morning-routine',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('supabase_functions_endpoint') || '/morning-routine',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**문제**: `current_setting()`은 PostgreSQL GUC 파라미터만 읽을 수 있음.
`supabase_functions_endpoint`와 `supabase.service_role_key`는 PostgreSQL 설정이 아니라 Supabase 플랫폼 레벨 값이므로 pg_cron 컨텍스트에서 접근 불가.

> 참고: Edge Function 내부의 `Deno.env.get()`과는 완전히 다른 환경.
> Edge Function = Deno 런타임 (supabase secrets set으로 주입)
> pg_cron = PostgreSQL 프로세스 (PostgreSQL GUC만 접근 가능)

### 성공한 cron job (morning-journal)
```sql
SELECT net.http_post(
    url := 'https://eadhobeluoivppoaxzbh.supabase.co/functions/v1/morning-journal',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer eyJhbG...(anon key 직접 입력)'
    ),
    body := '{}'::jsonb
  )
```
→ URL과 인증키를 직접 넣어서 성공.

---

## 보완 조치

### 1. pg_cron 수정 (cron.alter_job)
6개 실패 cron job 모두 하드코딩 방식으로 변경:
```sql
SELECT cron.alter_job(
  {jobid},
  command := $$SELECT net.http_post(
    url := 'https://eadhobeluoivppoaxzbh.supabase.co/functions/v1/{function-name}',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer {anon_key}'
    ),
    body := '{}'::jsonb
  )$$
);
```
→ 수정 직후 schedule-reminder가 succeeded로 전환 확인.

### 2. test-push Edge Function에 CORS 추가
브라우저에서 `supabase.functions.invoke()`로 호출 시 OPTIONS preflight 실패하던 문제 수정.

### 3. 프론트엔드 서버 푸시 테스트 버튼 추가
- 진단 도구에 "서버 푸시 테스트 (Edge Function)" 버튼 추가
- Edge Function → Push Service → 브라우저 전체 경로 테스트 가능

---

## 최종 해결: Supabase Vault 적용

하드코딩 대신 Vault에 시크릿 저장 후 cron에서 참조하는 방식으로 개선 완료.

```sql
-- Vault에 저장 (최초 1회)
SELECT vault.create_secret('<ANON_KEY>', 'supabase_anon_key');
SELECT vault.create_secret('<FUNCTIONS_URL>', 'supabase_functions_url');

-- cron에서 참조
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_functions_url') || '/morning-routine',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key')
  ),
  body := '{}'::jsonb
)
```

Vault 적용 후 schedule-reminder succeeded 확인 완료.

---

## 검증된 사실
- Edge Function 자체는 정상 동작 (curl로 test-push 호출 → sent: 2 성공)
- 브라우저 로컬 알림 정상 (SW, Push 구독, VAPID 키 일치 확인)
- pg_cron 스케줄 타이밍 정상 (UTC 시간 맞음)
- **유일한 문제는 pg_cron → Edge Function 호출 시 인증 정보 전달 방식이었음**

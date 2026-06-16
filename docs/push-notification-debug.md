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

## 검증된 사실 (pg_cron 문제)
- Edge Function 자체는 정상 동작 (curl로 test-push 호출 → sent: 2 성공)
- pg_cron 스케줄 타이밍 정상 (UTC 시간 맞음)
- **pg_cron → Edge Function 호출 시 인증 정보 전달 방식 문제 → Vault로 해결**

---

## 2차 문제: 푸시 알림이 기기에 도달하지 않음 (2026-03-29)

### 증상
- pg_cron 정상 실행 (succeeded), notification_log에 기록도 남음
- Apple Push Service (web.push.apple.com) → HTTP 201 반환
- FCM (fcm.googleapis.com) → HTTP 201 반환
- **그런데 폰에 알림이 하나도 안 옴**

### 진단 과정
1. pg_cron 잡 목록 확인 → 7개 모두 `active` ✓
2. Vault 시크릿 확인 → 등록됨 ✓
3. push_subscriptions 확인 → Apple + FCM 2기기 등록됨 ✓
4. notification_preferences → 8개 항목 모두 `true` ✓
5. notification_log → evening-journal 등 정상 기록됨 ✓
6. test-push 디버그 버전 배포 → Apple 201, FCM 201 확인
7. VAPID 키 일치 확인 → Replit `VITE_VAPID_PUBLIC_KEY` = Supabase Secrets `VAPID_PUBLIC_KEY` ✓

**결론**: 서버 → 푸시 서비스 전달은 성공, 문제는 **암호화 페이로드가 깨져서 기기에서 복호화 실패**

### 원인: `_shared/push.ts` 암호화 버그 2개

#### 버그 1: aes128gcm 패딩 바이트 위치 (RFC 8188 위반)

```typescript
// 잘못된 코드 (패딩 구분자가 앞에)
const padded = new Uint8Array([2, ...new TextEncoder().encode(payloadStr)]);

// 수정 (패딩 구분자가 뒤에 — RFC 8188 규격)
const padded = new Uint8Array([...new TextEncoder().encode(payloadStr), 2]);
```

RFC 8188: 마지막 레코드 형식 = `content || 0x02 || zeros`
- 브라우저가 복호화 후 뒤에서부터 구분자(0x02)를 찾아 content를 분리
- 구분자가 앞에 있으면 파싱 실패 → push 이벤트에서 data.json() 에러

#### 버그 2: HKDF IKM/salt 뒤바뀜 (RFC 8291 위반)

```typescript
// 잘못된 코드 (IKM과 salt가 반대)
const authHkdfKey = await crypto.subtle.importKey(
  'raw', clientAuth, { name: 'HKDF' }, false, ['deriveBits'],    // ← clientAuth를 IKM으로
);
const prk = await crypto.subtle.deriveBits(
  { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(sharedSecret), info: authInfo },
  authHkdfKey, 256,                                                // ← sharedSecret을 salt로
);

// 수정 (RFC 8291: IKM=ecdh_secret, salt=auth_secret)
const sharedHkdfKey = await crypto.subtle.importKey(
  'raw', new Uint8Array(sharedSecret), { name: 'HKDF' }, false, ['deriveBits'],  // ← sharedSecret이 IKM
);
const prk = await crypto.subtle.deriveBits(
  { name: 'HKDF', hash: 'SHA-256', salt: clientAuth, info: authInfo },           // ← clientAuth가 salt
  sharedHkdfKey, 256,
);
```

RFC 8291: `IKM = HKDF(salt=auth_secret, ikm=ecdh_secret, info=key_info, 32)`
- HMAC은 비대칭: HMAC(key, msg) ≠ HMAC(msg, key)
- IKM/salt가 뒤바뀌면 완전히 다른 키가 유도 → 암호화 결과를 브라우저가 복호화 불가

### 왜 201이 반환됐나?
- Apple/FCM 푸시 서비스는 **암호화된 blob을 그대로 전달만** 함
- 푸시 서비스는 복호화 키가 없으므로 payload 유효성을 검증할 수 없음
- HTTP 201 = "메시지를 수락했다"는 의미일 뿐, 기기에서 복호화 성공을 보장하지 않음

### 수정 내용
1. `supabase/functions/_shared/push.ts` — 패딩 바이트 + HKDF 파라미터 수정
2. `public/sw.js` — push 이벤트에 try/catch 추가 (복호화 실패 시 fallback 알림)
3. 8개 Edge Function 전부 재배포
4. notification_log 오늘자 정리 (잘못된 "발송 완료" 기록 삭제)

### 교훈
- Web Push 암호화(aes128gcm + VAPID)는 RFC 규격대로 정확히 구현해야 함
- 푸시 서비스의 201 응답은 기기 전달 성공을 의미하지 않음
- 암호화 문제 디버깅 시 push 서비스 응답만으로는 판단 불가 → SW에 에러 핸들링 필수

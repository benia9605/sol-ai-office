# 🔔 AI Office 알림 — 구현 설계 (밋업 가이드 → 우리 앱 적용)

> **출처:** `docs/guides/comment/social-notifications-guide.md`(밋업 앱 프로덕션 이식 가이드)를
> **우리 앱(Sol AI Office)에 이미 있는 인프라에 맞춰** 재설계한 문서.
> **작성:** Claude Code(CTO), 2026-08-17.
> **원하는 것:** 할일 배정·완료 / 회의(일정) 등록 / 콘텐츠 발행 / 댓글 / 좋아요 시 멤버 폰으로 푸시.

---

## 0. 결론 — 우리 앱은 인프라의 70%가 이미 있다

가이드는 "0부터" 기준이지만, 우리 앱엔 **개인 크론 리마인더**(마감·일정·아침브리핑)용으로 이미:

| 이미 있는 것 | 위치 |
|---|---|
| Web Push 발송(VAPID JWT + aes128gcm) | `supabase/functions/_shared/push.ts` — `sendPushToUser/Users/**Workspace**` |
| 종류별 토글 확인 · 중복방지 | 같은 파일 — `checkPreference`, `isAlreadySent`, `logNotification` |
| 구독 CRUD · 권한 · SW | `push_subscriptions` 테이블, `pushNotification.service.ts`, `public/sw.js`, `manifest.json` |
| 개인 알림 설정 화면 | `NotificationSettings.tsx`, `useNotification.ts` |
| VAPID 키 | Replit `VITE_VAPID_PUBLIC_KEY` + Supabase Secret `VAPID_*` |
| 크론 알림 함수들 | `task-deadline`, `schedule-reminder`, `overdue-tasks`, `morning-briefing` … (배포됨) |

> **핵심:** `sendPushToWorkspace(client, wsId, payload, excludeActorId)` 가 **멤버 팬아웃 + 액터 제외**를 이미 해준다.
> 가이드의 무거운 부분(웹푸시 암호화·구독·SW·VAPID)은 **전부 재활용**한다. 새로 만들 건 "이벤트 → 알림" 연결뿐.

---

## 1. 가이드 대비 — 무엇을 그대로 쓰고 무엇만 추가하나

| 가이드 5장 (푸시 인프라) | ✅ 이미 있음 — 재활용 |
| 가이드 6장 (SW·구독·설정) | ✅ 이미 있음 — 종류 토글만 추가 |
| 가이드 5.1 `notify` 단일 진입점 | ⬜ **신규** — 우리 발송모듈 위에 얇게 |
| 가이드 6.5 클라이언트 `notify()` | ⬜ **신규** — best-effort 래퍼 |
| 가이드 7~9장 (도메인 연결) | ⬜ **신규** — 우리 tasks/schedules/content 훅에 삽입 |
| 가이드 3장 (좋아요·댓글 테이블) | ⬜ **Phase 2** — 신규 테이블 + UI |
| 가이드 8장 (meetings 테이블) | ⚠️ 우리는 **일정(schedules)** 을 회의로 씀 — 새 테이블 안 만듦 |

---

## 2. 우리 앱 이벤트 → 알림 매핑 (매트릭스)

| type(pref 키) | 트리거(우리 코드) | 수신자 | 문구 예시 |
|---|---|---|---|
| `notify_task_assigned` | `useTasks.add`/`updateTask` 에서 assigneeId 지정·변경 | **담당자** | 📝 「제목」을 배정했어요 |
| `notify_task_completed` | `updateTask` status→completed | 전체 멤버(본인 제외) | ✅ 「제목」을 완료했어요 |
| `notify_schedule` | 일정 추가(오피스 `useSchedules.add`, workspace_id 있을 때) | 전체 멤버 | 📅 「제목」 일정을 등록했어요 |
| `notify_content` | 콘텐츠 status→published (`updateContentItem`) | 전체 멤버 | 🎬 「제목」을 발행했어요 |
| `notify_comment` | (Phase 2) 댓글/답글 | 글쓴이 / 부모댓글 작성자 | 💬 새 댓글 |
| `notify_like` | (Phase 2) 좋아요 | 글쓴이 | 👏 좋아요 (기본 OFF) |

> **개인 워크스페이스(멤버=나 1명)에선 아무에게도 안 감**(액터 제외) → 소음 0. 팀 오피스에서만 의미.

---

## 3. Phase 1 — 이벤트 알림 (신규 소셜 테이블 없음)

### 3.1 마이그레이션 036 — 알림 종류 컬럼 추가
`notification_preferences` 에 이벤트 토글 컬럼을 **idempotent 추가**(기존 크론 토글은 그대로).
```sql
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS notify_task_assigned  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_task_completed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_schedule       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_content         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_comment         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_like            BOOLEAN NOT NULL DEFAULT false;
```

### 3.2 Edge Function `notify` (신규) — 이벤트 단일 진입점
- 입력: `{ type, workspace_id, actor_id, title, body, url, tag, target_user_ids? }`
- 로직: 수신자 결정(target 또는 워크스페이스 멤버) → 액터 제외 → **각자 `checkPreference(uid, type)`** → `sendPushToUsers`
- 우리 `_shared/push.ts` 를 그대로 import → **CLI 배포 필수**(`supabase functions deploy notify`).

### 3.3 클라이언트 `notify()` 래퍼 (신규)
- `src/services/notify.service.ts` — `supabase.functions.invoke('notify', { body })`, **try/catch로 절대 throw 안 함**(가이드 원칙 1).
- 액터 이름 헬퍼(`getActorName`)는 `workspace_members.nickname` 사용.

### 3.4 도메인 연결 (기존 훅에 한 줄씩)
- **할일**: `useTasks.add`(assigneeId 있으면 담당자에게), `updateTask`(재배정→담당자, 완료→멤버)
- **일정**: `useSchedules.add`(workspaceId 있을 때 멤버에게)
- **콘텐츠**: `updateContentItem`(published 전환 시 멤버에게)

### 3.5 설정 화면 토글 추가
`NotificationSettings.tsx` 에 위 6종 토글 행 추가(기존 크론 토글과 같은 UI).

---

## 4. Phase 2 — 소셜(댓글·좋아요) [다음]
- 마이그: `task_comments/likes`, `content_comments/likes`(+`parent_id`) — 가이드 3.1 템플릿, RLS `my_workspace_ids()`.
- 서비스: `getLikeState/toggleLike`, `getComments/addComment(+parentId)/deleteComment` + `notify()` 호출.
- UI: `LikeCommentBlock`(가이드 10.3) — 무지톤으로. 할일·콘텐츠·회의록 상세에 부착.

---

## 5. 배포 체크리스트 (대표님 · Phase 1)
- [ ] 1. **마이그 036** SQL 에디터 실행 (컬럼 추가)
- [ ] 2. VAPID Secret 확인 — 이미 있음(`VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT`). 없으면 `supabase secrets set`
- [ ] 3. **`supabase functions deploy notify --project-ref <ref>`** (대시보드 배포 불가 — `_shared` import)
- [ ] 4. 앱에서 알림 켜기 → 다른 멤버 계정으로 할일 배정/일정 등록 → 푸시 확인
- [ ] 5. 안 오면: `supabase functions logs notify` → `sent:0`이면 prefs, `[push] failed`면 VAPID subject(mailto:)

## 6. 원칙 (가이드에서 가져옴)
1. `notify()`는 best-effort — 실패해도 글 저장 롤백 X
2. 액터 본인 항상 제외 · 좋아요는 켤 때만
3. 정책은 서버(prefs/멤버)에, 호출은 클라이언트 한 줄
4. `tag`로 같은 대상 알림 묶기(잠금화면 스택 방지)
5. 개인 워크스페이스(1인)면 자동으로 아무 알림 안 감

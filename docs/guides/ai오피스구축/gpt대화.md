현재 개발 중인 AI Office를 ChatGPT와 함께 재설계하려고 한다.

이 앱의 목표는 단순한 AI 채팅앱이 아니라, 여러 사업을 운영하는 대표가 사용하는 AI 기반 회사 운영체제다.

우선 코드를 수정하지 말고 현재 구현 상태를 전수 조사해서 아래 형식으로 보고해줘.

1. 기술 스택
- 프론트엔드
- 백엔드
- 데이터베이스
- 인증
- 배포 환경
- AI API 및 모델
- 외부 연동

2. 현재 정보 구조
- 전체 메뉴
- 각 화면의 목적
- 화면 간 연결 관계
- 브랜드/워크스페이스 구분 방식

3. 현재 데이터 구조
- 전체 테이블 또는 스키마
- 각 테이블의 역할
- 주요 관계
- KPI, 콘텐츠, 업무, 매출, 제품, 회의록, AI 대화가 저장되는 위치
- 임시 데이터나 하드코딩된 데이터

4. 현재 동작하는 기능
- 실제로 완전히 동작하는 기능
- 부분적으로 동작하는 기능
- UI만 존재하는 기능
- 오류가 있거나 사용하기 어려운 기능

5. AI 기능 구조
- AI에게 전달되는 시스템 프롬프트
- 사용자 입력과 회사 데이터가 조합되는 방식
- 대화 기록 저장 방식
- AI가 데이터베이스를 읽고 쓰는 방식
- 에이전트 또는 직원별 역할 구조
- 모델 교체 가능 여부

6. 현재 구조의 문제
- 기술 부채
- 중복 구조
- 확장이 어려운 부분
- 데이터가 단절되는 부분
- 실제 운영 시 사용자가 반복 입력해야 하는 부분
- 보안 또는 비용 위험

7. 재사용 가능성
- 그대로 유지할 부분
- 리팩터링할 부분
- 폐기하고 다시 만들 부분

8. 핵심 파일 목록
- 위 판단의 근거가 되는 파일 경로
- 각 파일의 역할
- 이후 ChatGPT가 검토할 때 우선 확인해야 할 파일

추측하지 말고 현재 코드에 있는 사실만 보고해줘.
각 결론에는 관련 파일 경로와 코드 근거를 함께 적어줘.
답변이 길면 여러 메시지로 나누되 생략하지 말아줘.

---

# 📋 AI Office 전수조사 보고 (Claude Code, 2026-08-03)

> 코드/마이그레이션/문서에 실재하는 사실만 정리. 각 항목에 `파일:라인` 근거 표기.
> ⚠️ 중요 전제: `.env`에 `VITE_SUPABASE_*`가 비어 있으면 앱은 **인메모리 Mock**으로 동작(`src/services/supabase.ts:15,21-23`). 즉 "동작함"의 상당수는 **Mock 기준**이며, AI 호출은 Mock과 무관하게 실제 API 키+프록시가 있어야 진짜로 동작.

## 1. 기술 스택

- **프론트엔드:** React 18 + TypeScript + Vite + Tailwind. 진입 `src/main.tsx:15-30`(ThemeProvider + 서비스워커 등록), 라우팅 `src/App.tsx:42-118`. 에디터 Tiptap(`src/components/tiptap/`).
- **백엔드:** 별도 서버 없음. Supabase(PostgreSQL)를 직접 호출 + **Supabase Edge Function 1개**(`supabase/functions/office-staff-run/index.ts`, Deno, AI 직원 자동실행용). AI 호출은 개발 시 **Vite 프록시**(`vite.config.ts:23-42`, `/api/claude`·`/api/openai`·`/api/perplexity`)를 경유.
- **데이터베이스:** Supabase PostgreSQL. 스키마 백업 `docs/DATA_SCHEMA.md`, 마이그레이션 `supabase/migrations/001~022`. ⚠️ **기초 테이블(tasks/schedules/insights/journals/projects/goals/kpis/conversations/messages 등)은 리포지토리에 DDL이 없음** — 과거 Supabase에서 직접 생성, `docs/DATA_SCHEMA.md`에만 문서화(`DATA_SCHEMA.md:39-83`).
- **인증:** Google OAuth (Supabase Auth). `src/services/auth.ts`, `src/hooks/useAuth.ts`. 미로그인 시 `LoginPage`(`App.tsx:60-63`). Mock에서는 항상 `dev` 유저(`mockSupabase.ts:401-402`).
- **배포 환경:** Replit(프론트, `VITE_` 키는 Replit Secrets) + Supabase(Edge Function은 `VITE_` 없는 시크릿). CLAUDE.md 환경변수 표 참조. ⚠️ 프로덕션에서 `/api/*` 프록시를 재현하지 않으면 AI 호출이 404(`vite.config.ts:23-42`는 dev 프록시).
- **AI API·모델:** 두 경로에 각각 모델 레지스트리 존재.
  - 채팅방(고정): `src/services/chatApi.ts:24-33` — strategy/meeting/secretary→`claude-sonnet-4-6`, dev→`claude-opus-4-8`, marketing→`gpt-4o`, research→`sonar-pro`.
  - AI 직원(교체 가능): `src/services/staffRun.service.ts:115-121` — sonnet/haiku/opus/gpt/research → 실제 모델 매핑, research는 Perplexity 검색→Claude 구조화 2단계(`staffRun.service.ts:495-508`).
  - ⚠️ 모델 ID 불일치: `conversations.service.ts:29-35`·`claudeApi.ts:91,181`은 구버전 ID(`claude-sonnet-4-20250514`)를 아직 씀 → 저장되는 `messages.ai_model` 라벨이 실제 호출 모델과 다름.
- **외부 연동:** YouTube Data API v3(읽기, `src/services/youtubeApi.ts`), YouTube OAuth(답글 발행, `youtubeOAuth.ts`), 알라딘/YES24(도서, `aladinApi.ts`·`claudeApi.ts`), 웹푸시(VAPID, `pushNotification.service.ts`), 외부앱 KPI 푸시(`external_kpis`, `020_external_kpis.sql`).

## 2. 현재 정보 구조

**셸 분기(핵심):** `src/App.tsx:78-118` `AppShell`이 `activeWorkspace.type`로 갈림 —
- `type==='office'` → `<MemoryRouter><OfficeShell/></MemoryRouter>`(`App.tsx:89-98`, URL 라우팅 대신 상태 기반).
- `personal`/`null` → `<BrowserRouter><Layout/>`(`App.tsx:100-117`).
- 결정 필드 `WorkspaceRow.type='personal'|'office'`(`workspaces.service.ts:19`), 활성 해석 `useWorkspace.ts:49-60`.

**개인 셸 메뉴**(`src/data.ts:137-146`, `NewSidebar.tsx`+`BottomNav.tsx`):
| 경로 | 메뉴 | 페이지 | 목적 |
|---|---|---|---|
| `/` | 홈 | HomePage | 위젯+브리핑+오피스룸 카드 |
| `/schedules` | 일정 | SchedulesPage | 일정 리스트/추가/반복·알람 |
| `/tasks` | 할일 | TasksPage | 할일 리스트/추가/상세 |
| `/insights` | 인사이트 | InsightsPage | 인사이트 카드/태그/출처 |
| `/readings` | 스터디 | ReadingsPage | 독서·학습 진행/스터디노트 |
| `/records` | 기록 | RecordsPage | 아침/저녁/주간/메모 |
| `/content` | 콘텐츠 | ContentPage | 유튜브 채널·영상·댓글 답글 |
| `/summaries` | 대화 요약 | SummariesPage | 방별 대화 요약 |
| `/settings` | (메뉴 외) | SettingsPage | 프로필·프로젝트 관리 |
| `/project/:id` | (사이드바 섹션) | ProjectDetailPage | 프로젝트·목표·KPI·할일 |

채팅은 개인 셸 전용: `Layout.tsx`의 리사이즈 사이드 `ChatModal` + `ModiFAB`(`Layout.tsx:88-103,182-183`). **오피스 셸엔 상시 채팅 패널이 없음**.

**오피스 셸 메뉴**(`OfficeShell.tsx:27-38`, 본문 스위치 `:204-214`): 대시보드`DashboardView` / 오늘의 브리핑`BriefingView` / AI 직원`StaffView` / 할일`TodosView` / 일정`ScheduleView`(→`SchedulesPageModern embedded`) / 인사이트`InsightsView` / 콘텐츠`ContentPage embedded` / 기록`LogView` / 활동 로그`ActivityView` / 멤버`MembersView` + 레일 하단 ⚙️→회사 브레인`BrandView`(`OfficeShell.tsx:177-179`). 대시보드 위젯→각 뷰 이동은 `onNavigate=setView`(`views.tsx` DashboardView).

**브랜드/워크스페이스 구분:** `workspaces`+`workspace_members`+`workspace_invites`(`workspaces.service.ts`). 개인=`type:personal`(항상 1명), 회사=`type:office`(초대코드 6자, `:36-41`). 전환 UI: 개인 셸 `WorkspaceSwitcher`(사이드바), 오피스 셸 레일 상단 프로필 토글(`OfficeShell.tsx:128-163`). 시목 공유는 **Mock 시드엔 소유자 1명만**(`mockSupabase.ts:28-29`) — 실제 2인 공유는 라이브 초대로만.

**화면 중복(중요):** `X.tsx`가 테마로 분기해 `X.modern.tsx`(모던) 또는 모디판을 렌더. 기본 테마='modern'(`ThemeContext.tsx:55`)이라 **`.modern`이 실사용**. App.tsx는 래퍼만 import(`App.tsx:15-24`), 오피스 셸은 `SchedulesPageModern`을 직접 사용(`views.tsx:14`).

## 3. 현재 데이터 구조

**마이그레이션에 DDL 있는 테이블:** `youtube_channels/videos/comments`(003,022), `workspaces`·`workspace_members`·`workspace_invites`·`workspace_activities`(004), `staff`·`staff_routines`(005,008,019), `daily_reports`(006,010,012), `brand_contexts`(009,017), `staff_output_actions`(011), `staff_usage`+`workspaces.credits`(013), `staff_saved_items`(016), `external_kpis`(020), `schedule_plans`(021).
**문서로만 존재(기초 테이블, DDL 없음):** `projects/goals/kpis/kpi_logs/tasks/schedules/insights/readings/reading_logs/journals/conversations/messages/conversation_summaries/daily_briefings/user_profiles/push_subscriptions/notification_*/daily_completions/custom_options`(`DATA_SCHEMA.md:42-81`).

**주요 관계(FK):** `goals.project_id→projects`, `kpis.goal_id→goals`, `kpi_logs.kpi_id→kpis`, `tasks.goal_id→goals`·`tasks.assignee_id→auth.users`(`004:202`), `messages.conversation_id→conversations`, `staff_routines.staff_id→staff`, `daily_reports.workspace_id/staff_id→…`(`006:7-9`), `brand_contexts.workspace_id UNIQUE`(`009:11`), `schedules.plan_id→schedule_plans`(`021:53`).

**각 개념 저장 위치(질문 항목별):**
- **KPI** — 내부 목표형 `kpis`+`kpi_logs`(`DATA_SCHEMA.md:44-45`) / 외부앱 푸시형 `external_kpis`(revenue·orders·visitors·conversion·inquiries, `020:8-21`). **두 시스템이 분리됨.**
- **콘텐츠** — 유튜브만 1급 테이블(`youtube_*`, 003). 생성된 SNS 콘텐츠는 **전용 테이블 없음** → `daily_reports.content_json`(outputKind `sns_queue`) + `staff_saved_items.payload`에 저장(`010:10`,`016:13-15`).
- **업무/할일** — `tasks`(status todo/in_progress/done, goal_id, assignee_id, workspace_id, is_shared).
- **매출** — **전용 테이블 없음.** `external_kpis.revenue`/`orders` 컬럼으로만 존재(`020:13-14`). (그 외 목표 자유문구 "월 매출…" `mockSupabase.ts:76`.)
- **제품** — **테이블 없음.** `brand_contexts.main_products`/`price_range` 자유텍스트(`009:24-25`) + 소싱 산출물(`staff_saved_items` item_type 'product', `016:14`).
- **회의록** — **전용 테이블 없음.** 회의실은 오케스트레이션만(`meeting.service.ts`), 내용은 일반 채팅 `conversations`+`messages`(room_id) → `conversation_summaries` 요약. 수기 회의메모는 `journals record_type='memo'`.
- **AI 대화** — `conversations`(room_id, title) + `messages`(role, content, ai_name).
- **임시/하드코딩:** `src/data.ts`(더미 projects/schedules/tasks/insights/readings/records/youtube + `getDummyResponse` 인사말), `mockSupabase.ts`(시목 워크스페이스·brand_contexts·staff·reports 시드 `:23-61`), `staffRun.service.ts:315-460` `DEMO_SAMPLE`(키 없을 때 가짜 리포트).

**workspace_id 스코핑:** 완전 오피스 전용(NOT NULL)= staff/staff_routines/daily_reports/brand_contexts/staff_output_actions/staff_usage/staff_saved_items/external_kpis. Nullable(NULL=개인)= projects/tasks/schedules/insights/readings/reading_logs/journals/youtube_*(004,014). **미스코핑= goals/kpis/kpi_logs/conversations/messages** — workspace_id 없음(`DATA_SCHEMA.md`) → 브랜드 분리 안 됨(6번 참조).

## 4. 현재 동작하는 기능

**(A) 완전 동작**(키+프록시 전제): 방별 채팅(`useChat.ts:267`→`chatApi.ts:170-187`), 회의실 멀티AI(`useChat.ts:141-212`,`meeting.service.ts`), 프로젝트/목표/KPI CRUD(`useProjects/useGoals/kpis.service`), **개인** 할일·일정·인사이트·기록·독서 CRUD, 대시보드/브리핑(`briefing.service.ts:237-266`, AI실패시 하드코딩 폴백), 코인 차감(`credits.service.ts`), 유튜브 답글 초안(`youtube.service.ts:268-320`).

**(B) 부분 동작:**
- **AI 직원 "지금 실행"** — 실제 호출되나 **키/프록시 실패 시 조용히 가짜 `DEMO_SAMPLE` 반환**(`staffRun.service.ts:525-538`, `_demo:true`). 키 없어도 "동작한 것처럼" 보임.
- **유튜브 읽기/발행** — 코드는 완성이나 `VITE_YOUTUBE_API_KEY`(`youtubeApi.ts:21` throw)·`VITE_GOOGLE_CLIENT_ID`(발행)가 `.env`에 없음 → 현재 Mock/UI. 발행은 OAuth 없으면 DB 상태만 바꿈(`youtube.service.ts:194-200`).

**(C) UI만/미배선:**
- **오피스 할일(TodosView)** — 읽기 전용, 추가/편집 UI 없음(`views.tsx` TodosView, `cycleStatus`만). ← *2026-08-03 세션에서 담당자/스코핑 백엔드는 확인, 추가 UI는 Phase 9 예정.*
- **AI 직원 자동 루틴(24h 크론)** — 엣지 함수 `office-staff-run/index.ts`는 실재·정상(`isDue :160-169`)이나 **리포지토리에 스케줄러(pg_cron 등) 없음**(`index.ts:9-11` 주석뿐) → **자동 실행은 실제로 안 돎.**

**(D) 오류/최근 수정:** 2026-08-03 세션에서 다음 확정 버그 수정 — 오피스 **메모 본문 열람 불가**(카드 클릭·상세 없음→`RecordDetailView` 재사용으로 수정), **브리핑/활동 리포트 본문 열람 불가**(→`ReportCard` 재사용), **인사이트/메모 저장 실패 무음**(폼 비우고 저장된 척→실패 시 폼 유지+알림), **`useTasks.add`가 workspace_id/assignee_id 누락**(→전달하도록 수정). 빌드/타입체크 통과.

## 5. AI 기능 구조

**두 AI 서브시스템:** (A) 채팅방(`context.ts`+`useChat.ts`+`chatApi.ts`), (B) AI 직원(`staffRun.service.ts`+엣지 함수).

**시스템 프롬프트(채팅):** `context.ts:108` `buildSystemPrompt(roomId, opts?)`가 계층 조립 — ①베이스 `public/prompts/{plani|maki|devi|searchi|modi|meeting}.md`(`context.ts:16-46`) ②유저 프로필/톤 ③프로젝트·목표·KPI(진행률 `:89-92`) ④7일 내 일정 ⑤진행중 할일 ⑥해당 방 최근 요약 ⑦[secretary/meeting만] 전체 방 요약(`:215-243`). ⚠️ **`useChat.ts:258`은 `buildSystemPrompt(roomId)`를 workspaceId 없이 호출** → 채팅에선 워크스페이스 스코핑 미적용(모든 워크스페이스 데이터 주입).

**입력+회사데이터 조합:** 회사데이터는 시스템 프롬프트에, 유저 입력은 마지막 user 메시지. 채팅은 최근 20개 슬라이딩(`useChat.ts:260-265`). 직원은 지시문을 **시스템 프롬프트에** 주입(`staffRun.service.ts:152-154`), user 메시지는 고정.

**대화 저장:** `conversations`+`messages`(`conversations.service.ts:38-73`). 새 대화 시작 시 백그라운드 자동 요약(`summary.service.ts:147-168`, ≥2메시지)→`conversation_summaries` upsert→다음 프롬프트에 환류.

**AI의 DB 읽고/쓰기(HITL):** 직원 실행이 `daily_reports` 실제 기록(`staffRun.service.ts:543-557`) + 제안 액션을 `staff_output_actions`에 **status:'suggested'로만** 적재. **실제 tasks/schedules/insights 반영은 사람이 승인해야**(`staffOutputActions.service.ts:71-100` `approveAction`→`addTask/addSchedule/addInsight`). = 사람 승인 게이트.

**직원별 역할(10종):** `src/data/staffCatalog.ts:14-145` — sourcing/detail_page/cs/sns/ad/monitor/analyst/visual/scheduler/ops, 각 `outputKind`+`defaultModel` 지정. SOP는 `staffRun.service.ts:25-112`(+엣지 중복).

**모델 교체:** 가능. `staff.model` 컬럼을 UI에서 변경(`StaffView.tsx`→`updateStaff(model)`, `HireStaffModal.tsx:14-19` 5옵션). 라우팅 `staffRun.service.ts:115-121`. 채팅방 모델은 방 고정(교체 불가).

## 6. 현재 구조의 문제

- **기술 부채:** 기초 테이블 DDL 부재(문서로만, `DATA_SCHEMA.md:39`) → 재현·검증 어려움. SOP/OUTPUT_SCHEMA가 프론트(`staffRun.service.ts`)와 엣지(`office-staff-run/index.ts`)에 **중복·드리프트**(detail_page SOP 버전 차이). 모델 ID가 파일마다 상이(구/신 혼재).
- **중복 구조:** `X.tsx`/`X.modern.tsx` 이중 유지(8쌍) — 모디 테마는 사실상 비사용인데 코드 유지. AI 파이프라인 코드 2벌(프론트/엣지).
- **확장 난제:** 콘텐츠·제품·매출·회의록에 **1급 테이블이 없음** → 성과 축적/구조화 불가(전부 리포트 JSON/자유텍스트에 묻힘). 오피스 셸에 프로젝트/로드맵 화면 부재.
- **데이터 단절:** `goals/kpis/conversations/messages`에 workspace_id 없음 → 브랜드별 KPI/대화 분리 불가. 채팅이 workspaceId 미전달(`useChat.ts:258`)로 브랜드 격리 안 됨. 내부 KPI(`kpis`)와 외부 KPI(`external_kpis`)가 별세계.
- **반복 입력:** 브랜드 정보가 `brand_contexts` 자유텍스트라 제품/가격을 매번 문맥에 수기. 오피스 할일은 추가 UI가 없어 개인 셸로 우회.
- **보안/비용:** AI 키가 **프론트(`VITE_`)에 노출**되는 구조(브라우저 번들) — dev 프록시 전제. "지금 실행" 데모 폴백이 실패를 감춰 **가짜 데이터를 진짜처럼** 표기(`staffRun.service.ts:525-538`). 코인/크레딧은 있으나 자동 크론 미배선이라 비용 통제 로직이 실사용 안 됨.

## 7. 재사용 가능성

- **그대로 유지:** 워크스페이스/RLS 기반(004~), AI 직원 데이터모델(staff/routines/daily_reports/output_actions/usage/saved_items), 채팅·요약 파이프라인(context/useChat/summary), HITL 승인 게이트, 코인 시스템, `.modern` UI·모던 테마.
- **리팩터:** SOP/스키마 프론트·엣지 단일화(중복 제거), 모델 ID 상수 일원화, `useChat`에 workspaceId 주입(브랜드 격리), 오피스 TodosView에 CRUD 연결(백엔드 이미 존재), goals/kpis/conversations에 workspace_id 추가.
- **폐기/재작성 검토:** 미사용 모디 테마 분기(비용 대비), 데모 폴백을 "명시적 데모 배지+실패 노출"로 교체, 기초 테이블 DDL을 마이그레이션으로 정식화.

## 8. 핵심 파일 목록 (ChatGPT 우선 확인 순)

1. `src/App.tsx` — 셸 분기(개인/오피스)·라우팅의 뿌리.
2. `src/services/context.ts` — 채팅 시스템 프롬프트 조립(회사데이터 주입).
3. `src/services/staffRun.service.ts` — AI 직원 실행·모델 라우팅·데모 폴백·액션 제안.
4. `supabase/functions/office-staff-run/index.ts` — 24h 자동 실행 엣지 함수(스케줄러 미배선).
5. `src/data/staffCatalog.ts` — 직원 10종 역할·모델·outputKind 카탈로그.
6. `src/services/staffOutputActions.service.ts` — HITL 승인→실 테이블 반영.
7. `src/components/office/OfficeShell.tsx` + `views.tsx` + `StaffView.tsx` + `BrandView.tsx` — 오피스 UI 전체.
8. `src/services/chatApi.ts` — 채팅 모델 매핑·프로바이더 호출.
9. `src/hooks/useChat.ts` — 채팅/회의 흐름·슬라이딩윈도우·요약 트리거.
10. `docs/DATA_SCHEMA.md` + `supabase/migrations/001~022` — 데이터 구조 단일 근거.
11. `src/services/mockSupabase.ts` + `src/data.ts` — Mock/더미 데이터(로컬 동작 기준).
12. `src/services/brandContexts.service.ts` — 회사 브레인(전 직원 프롬프트 최상단 주입).

> 참고: 위 4·6·7의 "동작함"은 대부분 실제 Supabase+AI 키+프록시 전제. 키 부재 시 Mock/데모로 대체되어 실사용과 괴리가 생기는 지점을 6장에 정리함.

# GPT 추가 질문
전수조사 내용 확인했다. 현재 코드를 폐기하지 않고, 기존 구조를 살려 AI Office를 회사 운영 OS로 발전시키려고 한다.

다음 단계에서는 아직 코드를 수정하지 말고, 아래 요구사항을 기준으로 “재설계안”을 작성해줘.

핵심 원칙:
1. 기능 추가보다 데이터 흐름과 워크스페이스 격리를 우선한다.
2. AI Office는 회사 데이터의 원본 저장소다.
3. AI는 제안하고, 사람의 승인 후 실제 업무로 반영한다.
4. AI 결과와 실제 확정된 결정은 분리해서 저장한다.
5. 제품·콘텐츠·성과·매출·회의·고객 반응을 자유텍스트가 아니라 정식 데이터로 관리한다.
6. 특정 AI 모델에 종속되지 않게 한다.
7. 시목을 먼저 적용하되 운명랩·쏠닝포인트 등 다른 워크스페이스도 같은 구조를 쓸 수 있어야 한다.

다음 항목을 설계해줘.

## 1. Phase 0 안정화 설계

아래 문제를 해결하는 구체적 방안을 제시해줘.

- goals, kpis, kpi_logs, conversations, messages에 workspace_id 추가
- 기존 데이터 마이그레이션 방법
- useChat/buildSystemPrompt에 현재 workspaceId 전달
- 워크스페이스 간 대화·KPI·목표 데이터 완전 격리
- 문서로만 존재하는 기초 테이블 DDL을 정식 마이그레이션으로 복구
- AI 모델 ID와 모델 레지스트리 일원화
- staffRun 프론트/엣지 SOP 및 OUTPUT_SCHEMA 단일화
- DEMO_SAMPLE을 실제 결과와 명확히 구분
- AI API 키가 브라우저에 노출되지 않도록 모든 호출을 서버 측으로 이전
- 프로덕션 배포에서 프록시 없이 AI 호출이 동작하는 구조

각 항목마다:
- 변경 대상 파일
- DB 변경
- 코드 변경
- 데이터 마이그레이션 위험
- 테스트 방법
- 롤백 방법
을 작성해줘.

## 2. 신규 핵심 데이터 모델

아래 개념을 정식 테이블로 설계해줘.

- products
- content_items
- content_metrics
- sales_daily
- sales_items
- campaigns
- decisions
- customer_signals

각 테이블에 대해:
- 컬럼명
- 타입
- 필수 여부
- FK
- 인덱스
- workspace_id
- created_by
- created_at / updated_at
- 상태값 enum
- RLS 정책
을 포함해줘.

추가로 기존 테이블과의 관계를 설명해줘.

- projects
- goals
- kpis
- tasks
- schedules
- staff
- daily_reports
- staff_output_actions
- staff_saved_items
- external_kpis

기존 external_kpis는 폐기/통합/유지 중 무엇이 좋은지 판단하고 근거를 제시해줘.

## 3. 콘텐츠 운영 워크플로

다음 과정을 데이터와 화면 흐름으로 설계해줘.

아이디어 등록
→ AI가 훅·대본·촬영 컷 생성
→ 대표 승인
→ 촬영 할 일 생성
→ 편집 상태 관리
→ 업로드 완료
→ 콘텐츠 URL 등록
→ 24시간 성과 입력
→ 72시간 성과 입력
→ 7일 성과 확정
→ AI 성과 분석
→ 다음 콘텐츠 액션 제안
→ 승인 시 새 콘텐츠 또는 할 일 생성

각 단계에서:
- 어느 테이블이 변경되는지
- 누가 실행하는지
- AI 자동 실행인지 사람 승인인지
- 실패 시 어떻게 복구하는지
를 명시해줘.

## 4. 제품-콘텐츠-매출 연결

다음 질문에 답할 수 있는 구조를 설계해줘.

- 어떤 제품이 어떤 콘텐츠에 노출됐는가?
- 어떤 콘텐츠가 상품 클릭과 매출을 만들었는가?
- 저장률이 높은 콘텐츠가 실제 구매로 이어졌는가?
- 제품별 콘텐츠 성과는 어떠한가?
- 마진이 높은 제품 중 콘텐츠 노출이 부족한 것은 무엇인가?
- 재고가 많은데 판매가 느린 제품은 무엇인가?

필요하다면 중간 연결 테이블을 추가해줘.

## 5. 의사결정 기록 구조

AI 분석, 회의, 대표의 최종 결정을 구분해 저장하도록 설계해줘.

반드시 아래 필드를 포함해줘.

- 결정 내용
- 배경
- 근거 데이터
- 가설
- 실행 항목
- 담당자
- 마감일
- 성공 기준
- 중단 기준
- 다음 검토일
- 상태
- AI 제안 원문
- 최종 수정 내용

AI 직원이나 회의실 결과를 decision 초안으로 만들고, 사람 승인 후 확정되는 흐름도 설계해줘.

## 6. CEO 브리핑 데이터 계약

CEO 브리핑 화면을 아직 구현하지 말고, 어떤 데이터가 어떤 형식으로 제공돼야 하는지 JSON 계약부터 설계해줘.

포함 항목:
- 어제/이번 주/이번 달 매출
- 목표 대비 달성률
- 주문 수와 객단가
- 제품별 판매
- 재고 위험
- 콘텐츠 성과
- 팔로워 증가
- 오늘의 우선 업무
- 지연 업무
- 결정 대기
- KPI 이상 징후
- AI 추천 액션
- 추천 근거와 신뢰도

## 7. 구현 우선순위

전체를 다음 기준으로 나눠줘.

- 반드시 오픈 전 해야 할 것
- 오픈 직후 2주 내
- 1개월 내
- 나중에 해도 되는 것

현재 시목 오픈 목표일은 2026-08-08이다.
지금은 완벽한 시스템보다 실제 운영에 사용할 수 있는 최소 구조가 중요하다.

마지막에는:
1. 추천 구현 순서
2. 예상 수정 파일
3. 신규 마이그레이션 목록
4. 예상 위험
5. 내가 승인해야 할 선택지
를 별도 요약해줘.

추측하지 말고 현재 코드 구조를 기준으로 설계해줘.
코드는 아직 수정하지 말고 설계안만 작성해줘.

---

# 🏗️ 재설계안 (Claude Code, 2026-08-04 · 설계 전용, 코드 미변경)

> 전제: 현행 구조(워크스페이스+RLS `my_workspace_ids()` 004, AI 직원 HITL 004~016, `external_kpis` 020)를 **살려서 확장**. 신규 테이블은 전부 기존 RLS 패턴을 그대로 승계.
> 공통 규약(모든 신규 테이블에 적용, 이하 반복 생략):
> - `id uuid PK default gen_random_uuid()` · `workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE` · `created_by uuid REFERENCES auth.users(id) default auth.uid()` · `created_at timestamptz default now()` · `updated_at timestamptz default now()`(트리거로 갱신).
> - **RLS(4정책 공통):** `USING (workspace_id IN (SELECT my_workspace_ids()))`, INSERT는 `WITH CHECK` 동일. (근거 패턴 `supabase/migrations/005_office_staff.sql:41-42`.)
> - **인덱스 공통:** `(workspace_id)` + 시간축 필요한 곳 `(workspace_id, date)` 복합.
> - 상태 enum은 Postgres `enum type`이 아니라 **`text + CHECK`**로 둔다(마이그레이션 idempotent·확장 용이, 현행 `staff.model` CHECK 방식 `019`와 동일).

---

## 1. Phase 0 안정화 설계

| # | 항목 | 변경 대상 파일 | DB 변경 | 코드 변경 | 마이그레이션 위험 | 테스트 | 롤백 |
|---|---|---|---|---|---|---|---|
| 1-1 | `goals/kpis/kpi_logs/conversations/messages`에 `workspace_id` | `023_core_workspace_id.sql` / `goals.service.ts`·`kpis.service.ts`·`conversations.service.ts` + mock 3곳 | `ADD COLUMN workspace_id uuid NULL REFERENCES workspaces(id)` (nullable=무중단) | 각 서비스 fetch/insert에 ws 필터·주입 | 백필 전 NULL=개인. 잘못 백필 시 교차노출 | ws 지정/미지정 각각 목록 격리 확인 | 컬럼 유지·코드만 이전 커밋으로 revert (컬럼 drop 불필요) |
| 1-2 | 기존 데이터 백필 | `023`(2단계 스크립트) | `UPDATE … SET workspace_id = (개인 ws)` where NULL; 회의/브랜드 대화는 room 기준 수동 매핑 | — | messages 대량 UPDATE 락 → **배치(1만행)·off-peak** | 백필 후 `COUNT(*) WHERE workspace_id IS NULL`=0 확인 후에만 `NOT NULL` 승격(별도 `024`) | UPDATE는 되돌리기 어려움 → **백필 전 `pg_dump` 스냅샷 필수** |
| 1-3 | `useChat`/`buildSystemPrompt`에 현재 workspaceId 전달 | `src/hooks/useChat.ts:258` · `src/services/context.ts:108` | 없음 | `buildSystemPrompt(roomId,{workspaceId:activeWorkspaceId})`로 호출(현재 미전달) | 낮음(읽기 경로) | 시목에서 채팅 시 운명랩 KPI/할일 미주입 확인 | 1줄 revert |
| 1-4 | 워크스페이스 간 완전 격리 | 위 1-1~1-3 합 | 위 | conversations/messages 조회에도 ws 필터 | 격리 누락 시 개인정보 노출 → **민석 초대 전 필수** | 두 계정 교차 스모크(빌드 B 스코핑 재검증) | 코드 revert |
| 1-5 | 문서로만 있던 기초 테이블 DDL 정식화 | `024_base_tables_ddl.sql` | `CREATE TABLE IF NOT EXISTS`(projects/goals/kpis/kpi_logs/tasks/schedules/insights/readings/reading_logs/journals/conversations/messages/… `docs/DATA_SCHEMA.md:42-81` 기준) | 없음(스키마 추인) | **운영 DB엔 이미 존재** → 반드시 `IF NOT EXISTS`+컬럼 `ADD IF NOT EXISTS`로 무해하게 | 스테이징 빈 DB에 전체 마이그 재생 성공 여부 | 파일 미적용(운영엔 영향 없음) |
| 1-6 | 모델 ID·레지스트리 일원화 | 신규 `src/config/models.ts` ← `chatApi.ts:24-33`·`staffRun.service.ts:115-121`·`conversations.service.ts:29-35`·`claudeApi.ts:91,181` | 없음 | 단일 상수(`MODELS.sonnet='claude-sonnet-4-6'` 등) import로 교체, 구 ID(`claude-sonnet-4-20250514`) 제거 | 낮음 | 채팅/직원 실행 후 `messages.ai_model`이 실제 호출 모델과 일치 | import 되돌림 |
| 1-7 | staffRun 프론트/엣지 SOP·OUTPUT_SCHEMA 단일화 | `staffRun.service.ts:25-139` ↔ `supabase/functions/office-staff-run/index.ts:46-148` | 없음 | 공유 소스(예: `supabase/functions/_shared/sop.ts`)로 추출, 프론트는 동일 소스 import(빌드 시 번들) | 중(런타임 2곳 동작 동일성 깨질 수 있음) | 같은 입력→프론트 "지금 실행" vs 엣지 결과 구조 동일 확인(특히 drift난 `detail_page`) | 공유파일 삭제·원복 |
| 1-8 | `DEMO_SAMPLE`을 실제와 명확 구분 | `staffRun.service.ts:315-460,525-538` · `StaffOutputView.tsx` | (선택) `daily_reports`에 `is_demo bool default false` | 데모 폴백 시 리포트에 `is_demo=true` + UI **"⚠️ 데모(키 없음)" 배지 상시**, 저장은 막거나 별도표시 | 낮음 | 키 제거 상태로 실행→데모 배지·저장 차단 확인 | 컬럼 nullable이라 무해, UI revert |
| 1-9 | AI 키 브라우저 노출 제거(서버 이전) | 신규 서버 프록시(Edge Function `ai-proxy` 또는 Replit 서버 라우트) · `chatApi.ts`·`claudeApi.ts`·`youtube*.ts` | 없음(시크릿은 서버로) | 프론트는 `/api/*` 상대경로만 호출, 키는 서버에서 주입. `VITE_*_API_KEY` 제거 | **높음** — 전 AI 경로 재배선, 스트리밍/에러 처리 재현 | 채팅/직원/유튜브 전부 서버 경유로 정상 응답 | 서버 라우트 유지한 채 프론트 폴백 플래그 |
| 1-10 | 프록시 없는 프로덕션에서 AI 동작 | 위 1-9와 동일(서버 라우트가 곧 프로덕션 프록시) | 없음 | Replit에 `/api/claude|openai|perplexity` 서버 핸들러 상주(현재 `vite.config.ts:23-42`는 dev 전용) | 높음(1-9와 묶음) | 프로덕션 빌드에서 채팅 성공 | dev 프록시로 임시 회귀 |

> **권고:** 1-1~1-4(격리)·1-6·1-8은 저위험 → 먼저. 1-9/1-10(키 서버 이전)은 고위험·오픈 후로. 1-5는 무해하니 아무 때나.

---

## 2. 신규 핵심 데이터 모델

> 상태값은 `text + CHECK`. 모든 표에서 공통 컬럼(id/workspace_id/created_by/created_at/updated_at/RLS)은 위 규약대로 존재한다고 보고 **고유 컬럼만** 기재.

### products (`025_products.sql`)
| 컬럼 | 타입 | 필수 | FK/제약 | 인덱스 |
|---|---|---|---|---|
| name | text | ✔ | | |
| sku | text | | `UNIQUE(workspace_id, sku)` | ✔ |
| category | text | | | |
| status | text | ✔ | CHECK in ('active','draft','discontinued') default 'active' | |
| price | numeric | | 판매가 | |
| cost | numeric | | 원가 | |
| margin_rate | numeric | | (price-cost)/price 저장 또는 뷰 | |
| stock | int | | default 0 | |
| image_url | text | | | |
| description | text | | | |
| tags | text[] | | | GIN(선택) |
- **역할:** 제품 카탈로그(현재 `brand_contexts.main_products` 자유텍스트 대체). RLS 공통.

### content_items (`026_content_items.sql`) — 콘텐츠 1건의 아이디어→발행 수명주기
| 컬럼 | 타입 | 필수 | FK/제약 | 인덱스 |
|---|---|---|---|---|
| title | text | ✔ | | |
| platform | text | | CHECK in ('reels','shorts','youtube','instagram','tiktok','blog') | |
| content_type | text | | CHECK in ('desire','info','worldview','behind') = 욕망/정보/세계관/비하인드 | |
| status | text | ✔ | CHECK in ('idea','approved','scripted','shooting','editing','scheduled','published','archived') default 'idea' | ✔(ws,status) |
| hook | text | | | |
| script | jsonb | | 대본(Tiptap/구조화) | |
| shot_list | jsonb | | 촬영 컷 | |
| url | text | | 업로드 후 | |
| published_at | timestamptz | | | |
| campaign_id | uuid | | → campaigns(id) ON DELETE SET NULL | ✔ |
| goal_id | uuid | | → goals(id) | |
| source_report_id | uuid | | → daily_reports(id) (AI 생성분) | |
| task_id | uuid | | → tasks(id) (촬영 할일 연결) | |
- **역할:** 콘텐츠 운영의 중심 엔티티(§3 워크플로의 주 테이블).

### content_metrics (`027_content_metrics.sql`) — 시점별 성과 스냅샷
| 컬럼 | 타입 | 필수 | FK/제약 | 인덱스 |
|---|---|---|---|---|
| content_item_id | uuid | ✔ | → content_items(id) ON DELETE CASCADE | ✔ |
| checkpoint | text | ✔ | CHECK in ('h24','h72','d7') · `UNIQUE(content_item_id, checkpoint)` | ✔ |
| views/likes/saves/shares/comments | int | | default 0 | |
| follower_delta | int | | | |
| watch_through_rate | numeric | | 완주율 % | |
| is_final | bool | | default false (d7 확정 시 true) | |
| measured_at | date | | | |
- **역할:** 24h/72h/7d 성과 축적 → "시목 공식" 분석 원천(analyst 직원 입력).

### content_products (`028_content_products.sql`) — 콘텐츠↔제품 M:N (§4 연결)
| 컬럼 | 타입 | 필수 | FK/제약 |
|---|---|---|---|
| content_item_id | uuid | ✔ | → content_items(id) ON DELETE CASCADE |
| product_id | uuid | ✔ | → products(id) ON DELETE CASCADE, `UNIQUE(content_item_id, product_id)` |
- **역할:** "어떤 제품이 어떤 콘텐츠에 노출됐나".

### sales_daily (`029_sales_daily.sql`) — external_kpis **통합** 대상
| 컬럼 | 타입 | 필수 | FK/제약 | 인덱스 |
|---|---|---|---|---|
| date | date | ✔ | | ✔(ws,date) |
| source | text | ✔ | CHECK in ('smartstore','coupang','ohouse','self','instagram','total','external') · `UNIQUE(workspace_id, source, date)` | ✔ |
| revenue | numeric | | | |
| orders | int | | | |
| visitors | int | | | |
| conversion_rate | numeric | | | |
| aov | numeric | | 객단가(신규) | |
| extra | jsonb | | | |
- **역할:** 채널별 일 매출 집계. external_kpis(`020`: revenue/orders/visitors/conversion + extra + UNIQUE(ws,source,date))의 상위집합 → 아래 통합 판단 참조.

### sales_items (`030_sales_items.sql`) — 제품별 일 판매(제품↔매출↔콘텐츠 어트리뷰션)
| 컬럼 | 타입 | 필수 | FK/제약 | 인덱스 |
|---|---|---|---|---|
| date | date | ✔ | | ✔(ws,date) |
| product_id | uuid | ✔ | → products(id) · `UNIQUE(workspace_id, product_id, source, date)` | ✔ |
| source | text | ✔ | (동일 CHECK) | |
| qty | int | | | |
| revenue | numeric | | | |
| content_item_id | uuid | | → content_items(id) (매출 유발 콘텐츠 추정) | ✔ |
- **역할:** "어떤 콘텐츠가 매출을 만들었나"·"제품별 성과".

### campaigns (`031_campaigns.sql`)
| 컬럼 | 타입 | 필수 | FK/제약 |
|---|---|---|---|
| name | text | ✔ | |
| goal | text | | |
| start_date / target_date | date | | |
| status | text | ✔ | CHECK in ('planning','active','paused','done') default 'planning' |
| phases | jsonb | | (기존 `schedule_plans.phases` 021과 개념 중복 → 통합 검토) |
- **역할:** "8월 오픈 캠페인" 같은 상위 묶음. content_items·decisions·schedule_plans를 캠페인으로 그룹.

### decisions (`032_decisions.sql`) — §5 상세
| 컬럼 | 타입 | 필수 | FK/제약 | 인덱스 |
|---|---|---|---|---|
| title | text | ✔ | 결정 내용 | |
| background | text | | 배경 | |
| evidence | jsonb | | 근거 데이터(지표·링크·리포트id 배열) | |
| hypothesis | text | | 가설 | |
| action_items | jsonb | | 실행 항목(승인 시 tasks로 승격) | |
| owner_id | uuid | | → auth.users(id) 담당자 | |
| due_date | date | | 마감일 | |
| success_criteria | text | | 성공 기준 | |
| stop_criteria | text | | 중단 기준 | |
| review_date | date | | 다음 검토일 | ✔ |
| status | text | ✔ | CHECK in ('draft','approved','active','reviewing','done','dropped') default 'draft' | ✔ |
| source | text | ✔ | CHECK in ('ai','meeting','ceo') = AI분석/회의/대표 | |
| ai_source | text | | AI 제안 원문 | |
| final_edit | text | | 대표 최종 수정 내용 | |
| source_report_id | uuid | | → daily_reports(id) | |
| source_conversation_id | uuid | | → conversations(id) (회의) | |
| campaign_id | uuid | | → campaigns(id) | |
- **역할:** AI 분석·회의·대표 최종결정을 **한 테이블에서 source로 구분**해 저장.

### customer_signals (`033_customer_signals.sql`)
| 컬럼 | 타입 | 필수 | FK/제약 | 인덱스 |
|---|---|---|---|---|
| source | text | ✔ | CHECK in ('comment','review','inquiry','dm','cs') | |
| platform | text | | | |
| product_id | uuid | | → products(id) | |
| content_item_id | uuid | | → content_items(id) | |
| sentiment | text | | CHECK in ('positive','neutral','negative') | |
| category | text | | 유형(배송/품질/가격…) | |
| text | text | ✔ | 원문 | |
| action_needed | bool | | default false | ✔ |
| linked_task_id | uuid | | → tasks(id) | |
- **역할:** CS/후기/댓글/문의를 정형화(현재 유튜브 댓글·CS는 산발). action_needed → 할일/결정으로 연결.

### 기존 테이블과의 관계
- **projects/goals/kpis** ← `content_items.goal_id`, `decisions.campaign_id`, `campaigns`가 목표를 실행 단위로 연결. KPI는 sales_daily/content_metrics 집계를 **원천**으로 삼아 자동 갱신 가능.
- **tasks** ← `content_items.task_id`(촬영 할일), `decisions.action_items`→승인 시 tasks 생성, `customer_signals.linked_task_id`.
- **schedules** ← content_items.status='scheduled' 시 발행 일정 생성. campaigns.phases ↔ schedule_plans(021) 통합.
- **staff / daily_reports** ← 직원 산출물이 content_items(초안)·decisions(초안)·metrics 분석을 **생성**. `content_items.source_report_id`·`decisions.source_report_id`로 추적.
- **staff_output_actions(011)** ← HITL 게이트를 **재사용·확장**: `type`에 `'content'`,`'decision'` 추가(`034_staff_output_actions_extend.sql`) → 승인 시 각각 content_items·decisions·tasks로 승격(현행 `approveAction` 패턴 `staffOutputActions.service.ts:71-100` 확장).
- **staff_saved_items(016)** ← 즐겨찾기는 유지. 단, 성과·매출은 saved_items가 아니라 위 정식 테이블에 저장(자유텍스트 탈피).

### external_kpis 판단 → **통합(유지 아님, 폐기 아님)**
- **근거:** `external_kpis(020)` 컬럼(revenue/orders/visitors/conversion_rate + extra + `UNIQUE(ws,source,date)`)이 `sales_daily`의 부분집합. 두 테이블 병존은 매출 이원화(현행 6장 "내부/외부 KPI 별세계") 재현.
- **방안:** `sales_daily`를 **external_kpis의 상위집합으로 승격**(+`aov`). 외부앱 푸시 엔드포인트는 유지하되 **적재 대상만 sales_daily로 변경**(source='external' 또는 채널명). 마이그레이션 `029`에서 `INSERT INTO sales_daily SELECT … FROM external_kpis` 후 external_kpis는 **읽기전용 보관(1개월) → 드롭**.
- **주의:** 외부앱(브랜드앱) 쪽 push 계약이 있으므로, 컬럼명 호환(revenue/orders/visitors/conversion_rate 동일 유지) → 푸시 코드 무변경으로 흡수.

---

## 3. 콘텐츠 운영 워크플로 (데이터·화면 흐름)

> 주 테이블 `content_items`, 성과 `content_metrics`, 승인 게이트 `staff_output_actions`(type='content'). 표기: 🤖=AI 자동 / 👤=사람.

| 단계 | 변경 테이블 | 실행 | AI/사람 | 실패 복구 |
|---|---|---|---|---|
| 아이디어 등록 | `content_items` INSERT (status='idea') | 대표 or 트렌드레이더 직원 | 👤 or 🤖(제안은 staff_output_actions) | 재입력, 초안은 draft로 남음 |
| AI 훅·대본·촬영컷 생성 | `content_items` UPDATE (hook/script/shot_list), `daily_reports` 기록 | SNS/트렌드 직원 | 🤖 → 제안 | LLM 실패 시 데모 배지·재시도(§1-8), 기존 필드 보존 |
| 대표 승인 | `content_items` status→'approved', `staff_output_actions` status→approved | 대표 | 👤 (HITL) | 반려 시 status 유지=idea/scripted |
| 촬영 할 일 생성 | `tasks` INSERT + `content_items.task_id` 링크 | 승인 액션 | 🤖 자동(승인 후) | 태스크 생성 실패 시 재큐(액션 approved 유지) |
| 편집 상태 관리 | `content_items` status: shooting→editing | 대표/멤버 | 👤 | 상태 되돌리기 허용(자유 전이) |
| 업로드 완료 | `content_items` status→'published', published_at | 대표 | 👤 | — |
| 콘텐츠 URL 등록 | `content_items.url` | 대표 | 👤 | URL 검증 실패 경고, 저장은 허용 |
| 24h 성과 입력 | `content_metrics` INSERT(checkpoint='h24') | 대표 or 유튜브 수집 | 👤(수기)/🤖(YT API) | UNIQUE 충돌 시 UPSERT |
| 72h 성과 입력 | `content_metrics`(h72) | 동일 | 동일 | 동일 |
| 7일 성과 확정 | `content_metrics`(d7, is_final=true) | 동일 | 동일 | 확정 후 수정은 별도 감사로그(선택) |
| AI 성과 분석 | `daily_reports`(metric/content 분석) 기록 | analyst 직원 | 🤖 | 표본부족 시 "n부족" 표기(단정 금지) |
| 다음 콘텐츠 액션 제안 | `staff_output_actions`(type='content'/'task', suggested) | analyst/트렌드 직원 | 🤖 → 제안 | 제안 실패 무해(빈 큐) |
| 승인 시 새 콘텐츠/할일 생성 | `content_items` 또는 `tasks` INSERT | 대표 | 👤 승인 → 🤖 반영 | 반려 시 dismissed |

- **화면 흐름(오피스 셸 콘텐츠 메뉴 확장):** 칸반(idea→…→published) + 카드 클릭 상세(대본/촬영컷/성과 3스냅샷/연결 제품) + "성과 입력" 폼(h24/h72/d7). 승인 큐는 대시보드 "결정 대기"와 공유.
- **복구 원칙:** 모든 AI 산출은 **제안(staff_output_actions.suggested)**으로만 들어오고 실 테이블은 승인 후 변경 → 실패해도 원본 훼손 없음(현행 HITL 011 계승).

---

## 4. 제품–콘텐츠–매출 연결 (질의 응답 구조)

핵심 연결: `content_products`(콘텐츠↔제품 M:N) + `sales_items.content_item_id`(매출↔콘텐츠) + `sales_items.product_id`(매출↔제품) + `content_metrics`(콘텐츠 성과).

| 질문 | 답을 만드는 조인 |
|---|---|
| 어떤 제품이 어떤 콘텐츠에 노출됐나 | `content_products` JOIN products/content_items |
| 어떤 콘텐츠가 클릭·매출을 만들었나 | `sales_items` GROUP BY content_item_id → revenue/qty |
| 저장률 높은 콘텐츠가 구매로 이어졌나 | `content_metrics.saves` ↔ 같은 content_item의 `sales_items.revenue` 상관 |
| 제품별 콘텐츠 성과 | products → content_products → content_metrics 집계 |
| 마진 높은데 콘텐츠 노출 부족한 제품 | products(margin_rate 상위) LEFT JOIN content_products = NULL/소수 |
| 재고 많은데 판매 느린 제품 | products.stock 상위 ↔ sales_items 최근 qty 하위 |

→ **추가 연결 테이블은 `content_products` 하나면 충분**(나머지는 sales_items의 FK로 해결). 필요 시 `product_id`를 sales 어트리뷰션에 이미 보유.

---

## 5. 의사결정 기록 구조

- 테이블 `decisions`(§2, 요청 12필드 전부 포함: 결정내용=title/content, 배경, 근거=evidence, 가설, 실행항목=action_items, 담당자=owner_id, 마감=due_date, 성공기준, 중단기준, 다음검토=review_date, 상태, AI제안원문=ai_source, 최종수정=final_edit).
- **AI/회의 → 결정 초안 → 승인 흐름:**
  1. 직원 실행 또는 회의실 종료 시, 결과를 `staff_output_actions`(type='decision', status='suggested', payload=결정 초안 JSON)로 큐잉. `source`='ai' 또는 'meeting', `source_report_id`/`source_conversation_id` 채움.
  2. 대표가 "결정 대기"에서 검토 → 수정(final_edit) → **승인** 시 `decisions` INSERT(status='approved', source='ceo'로 확정 가능) + action_items를 tasks로 승격.
  3. 이후 status 흐름 active→reviewing(review_date 도래)→done/dropped. dropped 시 stop_criteria 근거 기록.
- **분리 원칙 준수:** AI 원문(ai_source)과 대표 확정(final_edit/status)이 **한 행에 병존하되 필드로 구분** → "AI 결과 vs 확정 결정" 요구(핵심원칙 4) 충족.

---

## 6. CEO 브리핑 데이터 계약 (JSON, 구현 X)

> 화면 미구현. 아래 계약을 백엔드(집계 뷰/Edge Function)가 채워 반환. 모든 수치는 `workspace_id` 스코프. 출처 테이블 주석 표기.

```json
{
  "workspace_id": "uuid",
  "as_of": "2026-08-08T08:00:00+09:00",
  "sales": {
    "yesterday":  { "revenue": 0, "orders": 0, "aov": 0 },          // sales_daily(date=어제)
    "this_week":  { "revenue": 0, "target": 0, "attainment": 0.0 }, // sales_daily 합 ÷ goals/kpis 목표
    "this_month": { "revenue": 0, "target": 0, "attainment": 0.0 }
  },
  "orders": { "count": 0, "aov": 0 },                                // sales_daily
  "products_top": [ { "product_id": "uuid", "name": "", "qty": 0, "revenue": 0 } ], // sales_items GROUP BY product
  "inventory_risk": [ { "product_id": "uuid", "name": "", "stock": 0, "days_to_sellout": 0, "level": "high|mid" } ], // products.stock ↔ sales_items 속도
  "content": {
    "published_7d": 0,
    "top": [ { "content_item_id": "uuid", "title": "", "type": "desire", "views": 0, "saves": 0, "save_rate": 0.0 } ], // content_metrics
    "mix_actual": { "desire": 0.0, "info": 0.0, "worldview": 0.0, "behind": 0.0 },  // content_items.content_type 비율
    "mix_target": { "desire": 0.4, "info": 0.25, "worldview": 0.2, "behind": 0.15 }
  },
  "followers": { "delta_7d": 0 },                                    // content_metrics.follower_delta 합
  "tasks": {
    "today":   [ { "id": "uuid", "title": "", "assignee_id": "uuid", "due": "date" } ], // tasks
    "overdue": [ { "id": "uuid", "title": "", "due": "date" } ]
  },
  "decisions_pending": [ { "id": "uuid", "title": "", "source": "ai|meeting", "due": "date" } ], // staff_output_actions(type=decision) + decisions(status=draft)
  "kpi_anomalies": [ { "kpi": "conversion_rate", "value": 0.0, "baseline": 0.0, "delta": -0.0, "note": "" } ], // sales_daily/kpis 이상치
  "recommended_actions": [
    {
      "action": "",              // AI 추천 액션
      "rationale": "",           // 추천 근거(어떤 지표에서 왔는지)
      "evidence_refs": [ "content_metrics:uuid", "sales_daily:date" ],
      "confidence": 0.0,         // 0~1 신뢰도
      "source_report_id": "uuid"
    }
  ]
}
```
- 생성 주체: `ops`/`analyst` 직원 또는 전용 집계 함수. `recommended_actions`는 승인 시 §3/§5 흐름으로 연결.

---

## 7. 구현 우선순위 (시목 오픈 2026-08-08 기준, 현재 D-4)

> 원칙: "완벽 < 실제 운영 가능한 최소". 오픈 전엔 **저위험·수기 입력 위주**, 고위험 인프라(키 서버 이전·핵심테이블 NOT NULL 승격)는 뒤로.

- **① 반드시 오픈 전 (D-4, 저위험만):**
  - 오피스 **할일 수동 CRUD + 담당자**(백엔드 존재, UI만 — 별도 Phase 9 설계).
  - `products` + `content_items`(수기) + `content_metrics`(수기 h24/h72/d7) + `sales_daily`(수기 일매출) — **테이블 생성 + 최소 입력 폼**. 분석·자동화 없이 "적을 곳" 확보.
  - `DEMO_SAMPLE` 데모 배지(1-8) — 오픈 중 가짜 리포트 오인 방지.
- **② 오픈 직후 2주 내:**
  - workspace_id 격리(1-1~1-4) — 민석 실사용 시작 전 필수. 백필+검증.
  - `decisions` + 회의/AI 초안→승인 흐름(§5). `staff_output_actions`에 content/decision 타입 확장.
  - 콘텐츠 워크플로 칸반(§3) + analyst "시목 공식" 리포트.
- **③ 1개월 내:**
  - `sales_items`·`content_products`·campaigns → 제품-콘텐츠-매출 연결(§4), external_kpis→sales_daily 통합.
  - CEO 브리핑 집계(§6) 실제 구현. 모델 레지스트리 일원화(1-6), SOP 단일화(1-7).
- **④ 나중:**
  - AI 키 서버 이전(1-9/1-10, 고위험), 기초 테이블 DDL 정식화(1-5), 24h 자동 크론 배선(office-staff-run 스케줄), customer_signals 자동수집.

### 최종 요약
1. **추천 구현 순서:** 오피스 할일 CRUD → products/content_items/content_metrics/sales_daily(수기) → 데모 배지 → (오픈) → ws 격리+백필 → decisions/승인흐름 → 콘텐츠 칸반+분석 → sales_items/연결+external 통합 → CEO 브리핑 → 키 서버화.
2. **예상 수정 파일:** `src/hooks/useTasks.ts`·`components/office/views.tsx`(할일), 신규 `services/{products,contentItems,contentMetrics,salesDaily,decisions}.service.ts` + mock 3곳, `contexts`/`useChat.ts`·`context.ts`(격리), 신규 `config/models.ts`, `supabase/functions/_shared/sop.ts`, `staffOutputActions.service.ts`(타입 확장), `mockSupabase.ts`·`types.ts`.
3. **신규 마이그레이션:** `023_core_workspace_id` · `024_base_tables_ddl` · `025_products` · `026_content_items` · `027_content_metrics` · `028_content_products` · `029_sales_daily`(+external 통합) · `030_sales_items` · `031_campaigns` · `032_decisions` · `033_customer_signals` · `034_staff_output_actions_extend`.
4. **예상 위험:** (a) messages/core 백필 대량 UPDATE 락·비가역 → 스냅샷 필수. (b) 키 서버 이전 시 전 AI 경로 회귀. (c) external_kpis 통합 시 외부앱 push 계약 깨짐(컬럼 호환으로 완화). (d) 오픈 4일 전 과욕 = 미완성 UI 노출 → 수기 최소로 제한.
5. **대표 승인 필요 선택지:**
   - external_kpis → **통합(권장)** vs 유지?
   - content_type 4분류(욕망/정보/세계관/비하인드) **고정** vs 커스텀?
   - 오픈 전 범위: 위 ①만 vs decisions까지?
   - AI 키 서버 이전 시점: 오픈 후 2주 vs 1개월?
   - campaigns와 기존 schedule_plans(021) **통합** vs 병존?

# GPT 추가질문
AI Office를 ERP가 아니라 '회사의 두 번째 뇌(Second Brain)'로 발전시키고 싶다.

현재 설계에는 products, content, sales, decisions가 잘 정의되어 있다.

여기에 추가로 "company_memory" 계층을 설계해줘.

목표는 회사에서 발생하는 모든 비정형 지식(아이디어, 깨달음, 브랜드 철학, 실패, 실험, 레퍼런스, 경쟁사 인사이트, 대표 메모)을 AI가 장기적으로 학습하고 전략에 활용할 수 있도록 하는 것이다.

또한 모든 AI 응답 전에 필요한 데이터만 자동으로 수집하는 Context Engine 개념을 설계해줘.

원칙은:
- AI는 먼저 조사하고, 그 다음 답한다.
- AI는 전체 DB를 매번 읽지 않는다.
- 질문 유형에 따라 필요한 데이터만 Context Engine이 조립한다.
- 조사 결과와 최종 답변을 구분한다.

---

# 🧠 재설계안 · 회사의 두 번째 뇌 (company_memory + Context Engine) — Claude Code, 2026-08-04 · 설계 전용

> 전제: 앞선 재설계안(products/content/sales/decisions, 마이그 023~034)과 현행 구조(`context.ts:108` buildSystemPrompt, HITL `staff_output_actions`, RLS `my_workspace_ids()`) 위에 얹는다. 공통 규약(id/workspace_id NOT NULL/created_by/created_at/updated_at/RLS)은 이전 절과 동일하게 승계, 이하 반복 생략.

## A. company_memory 계층 (비정형 장기 지식)

### A-1. 기존과의 관계 — 무엇을 흡수하고 무엇과 구분하나
- **`insights`(기존)** = 대화 중 저장한 단편 인사이트 → company_memory의 **부분집합**. `kind='insight'`로 흡수(마이그레이션에서 `INSERT … SELECT`), 이후 insights는 읽기전용 보관 후 뷰로 대체.
- **`brand_contexts`(009)** = 회사 정체성/톤/USP의 **고정 헌법**(1행, 대표가 직접) → 유지. company_memory는 그 위에 쌓이는 **가변 경험/지식**.
- **`decisions`(신규 032)** = 확정된 결정 → company_memory는 그 **배경·가설·실패**를 지식으로 축적(결정과 링크).
- **`daily_reports`(006)** = 직원 산출 원본(로그) → 그중 "전략적으로 오래 쓸 것"만 company_memory로 **승격**(전량 아님).
- 즉 company_memory = **"오래 두고 다시 꺼내 쓸 비정형 지식"의 단일 창구**. 로그(daily_reports)·정형 데이터(sales/content)와 분리.

### A-2. 테이블 `company_memory` (`035_company_memory.sql`)
| 컬럼 | 타입 | 필수 | 제약/FK | 인덱스 |
|---|---|---|---|---|
| kind | text | ✔ | CHECK in ('idea','insight','philosophy','failure','experiment','reference','competitor','ceo_memo') | ✔(ws,kind) |
| title | text | ✔ | | |
| body | text | ✔ | 비정형 원문 | |
| summary | text | | AI 1~3줄 요약(**주입·인출용 — 원문 대신 이걸 넣어 토큰 절감**) | |
| tags | text[] | | | GIN |
| salience | int | | 0~100 중요도(기본 50) | |
| pinned | bool | | default false (**항상 주입되는 헌법급**) | ✔(ws,pinned) |
| status | text | ✔ | CHECK in ('active','archived','superseded') default 'active' | |
| source | text | ✔ | CHECK in ('manual','report','conversation','decision','content','signal') | |
| source_report_id | uuid | | → daily_reports(id) | |
| source_conversation_id | uuid | | → conversations(id) | |
| decision_id | uuid | | → decisions(id) | |
| product_id / content_item_id / campaign_id | uuid | | 선택 연결 | |
| embedding | vector(1536) | | pgvector(035에서 `create extension if not exists vector`) | ivfflat/hnsw |
| last_used_at | timestamptz | | decay 계산 | |
| use_count | int | | default 0 | |
- **역할:** 회사에서 발생하는 모든 "다시 쓸 지식"의 원장. RLS 공통.
- **(선택) `company_memory_links`(`036`)** — 지식↔임의 엔티티 M:N이 필요할 때만: `memory_id, entity_type, entity_id`. 초기엔 위 nullable FK로 충분 → 보류 가능.

### A-3. 수집(capture) 파이프라인 — 대표가 매번 정리 안 해도 쌓임
| 소스 | 트리거 | 방식 | 게이트 |
|---|---|---|---|
| 대표 메모(ceo_memo) | 오피스 "기록/메모" 또는 채팅 중 "기억해" | 즉시 INSERT | 👤 직접 |
| 직원 리포트(report) | daily_report 생성 후 | 직원이 "장기 지식 후보" 필드 제안 → `staff_output_actions(type='memory', suggested)` | 👤 승인 시 승격 |
| 대화(conversation) | 요약 시(`summary.service.ts:147`) | 요약에서 "깨달음/실패/레퍼런스" 추출 제안 | 👤 승인(또는 salience 낮게 자동) |
| 결정(decision) | 결정 확정 시 | 배경/가설/중단근거를 kind='failure'/'experiment'로 링크 저장 | 자동(결정에 종속) |
| 경쟁사(competitor) | monitor 직원 | 경쟁사 인사이트를 kind='competitor'로 제안 | 👤 승인 |
- **원칙:** 자동은 **제안(suggested)까지만**(HITL 011 계승). 실제 memory 확정은 승인 또는 대표 직접. → 노이즈 누적 방지.
- 저장 시 백그라운드로 `summary`·`embedding` 생성(임베딩 모델은 승인 선택지, A-6).

### A-4. 인출(retrieval) — Context Engine이 쓰는 API
`recallMemory(workspaceId, query, { kinds?, k=6 })`:
1. `pinned=true AND status='active'` 는 **무조건 포함**(헌법급, 소량 유지 권장).
2. 나머지는 **하이브리드 랭크** = `임베딩 유사도(query↔embedding)` × `salience` × `recency(last_used_at decay)` → top-K.
3. 반환은 **summary(원문 아님)** + id + kind. 사용된 항목은 `use_count++`, `last_used_at=now`.
- 임베딩 미도입(MVP)이면 **태그/키워드 + salience** 폴백으로 동일 인터페이스 유지(엔진은 무변경).

### A-5. 라이프사이클(큐레이션)
- **병합/승격:** 유사 지식 누적 시 ops/analyst 직원이 "병합 제안" → 승인 시 대표 항목만 남기고 나머지 `status='superseded'`.
- **감쇠(decay):** 오래 안 쓰인 항목은 랭크에서 자연 하락(안 지움). 대표가 `archived`로 수동 정리.
- **핀:** 브랜드 철학/절대 원칙은 `pinned=true`(항상 주입). 개수 상한(예: 12) 권고 — 안 그러면 컨텍스트 낭비.

---

## B. Context Engine (먼저 조사, 그다음 답변)

### B-1. 현재 문제 (근거)
`context.ts:108` `buildSystemPrompt`는 프로젝트·목표·KPI·일정·할일·요약을 **질문과 무관하게 전량** 주입(§전수조사 5장). `useChat.ts:258`은 workspaceId도 안 넘김. → 토큰 낭비 + 브랜드 누수 + 질문과 무관한 정보. Context Engine이 이걸 **"질문 유형별 필요한 조각만 조립"**으로 대체.

### B-2. 아키텍처 (요청 4원칙 매핑)
```
사용자 질문/직원 태스크
  → ① Intent 분류(cheap)          [원칙: 전체 DB 안 읽음]
  → ② Context Recipe 선택          [원칙: 유형별 필요 데이터만]
  → ③ 병렬 인출(정형 fetch + recallMemory 임베딩)  [원칙: 먼저 조사]
  → ④ 토큰예산 내로 압축 → Context Bundle 조립
  → ⑤ (조사 단계) 조사노트 생성·저장  [원칙: 조사/답변 분리]
  → ⑥ (답변 단계) 최종 답변 생성·저장
```

### B-3. Intent 분류 & Context Recipe (선언적 설정)
분류기: 규칙(키워드) 우선 + 애매하면 haiku 1콜. Recipe = "이 유형엔 이 소스만" 선언 테이블(코드 상수 `src/config/contextRecipes.ts`).

| intent | 인출 소스(필터) | memory kinds(top-K) | 제외 |
|---|---|---|---|
| sales/매출 | sales_daily(30d), kpis(목표), sales_items top | pinned + insight | content 상세 |
| content/콘텐츠 | content_metrics(최근), content mix, content_items(recent) | philosophy·reference·competitor | sales 상세 |
| sourcing/소싱 | products(margin/stock), competitor | failure·experiment·competitor | 대화요약 |
| strategy/전략 | brand_contexts, kpis(요약), decisions(recent) | philosophy·insight·failure(top) | 일정/할일 |
| cs/고객 | customer_signals(open), brand_contexts.cs_* | 유사 signal 메모 | 매출/콘텐츠 |
| ops/브리핑 | 오늘 할일·지연·승인대기·KPI 이상치 | pinned | 원문 대화 |
| general/잡담 | user_profile, 브랜드 core, 해당 방 최근 요약 | query 임베딩 top-K | 나머지 |

### B-4. 2-phase: 조사노트 ↔ 최종답변 분리 저장
- **Phase 1 (조사):** Context Engine이 Bundle 조립 후, (무거운 질문만) "조사노트" 생성 — *무엇이 관련 있고, 빠진 데이터는 무엇인지*. `messages.role='research'`(또는 신규 `context_runs`)에 저장. 사용자에겐 접힌 형태로 노출 가능("근거 보기").
- **Phase 2 (답변):** 최종 답변은 Bundle + 조사노트를 근거로 생성, `messages.role='assistant'`. → **조사 결과와 답변이 물리적으로 분리**(요청 원칙 4).
- **`context_runs`(`037`, 선택·권장):** id, workspace_id, room_id/staff_id, query, intent, used_memory_ids uuid[], bundle jsonb(요약), token_count, created_at. 용도: 감사(왜 이 답이 나왔나), 캐시, memory `use_count` 집계.

### B-5. 토큰 예산·캐싱·폴백
- **예산:** Context Bundle 상한(예 3k 토큰). 초과 시 summary만·top-K 축소·pinned 우선.
- **캐싱:** `(workspace, intent, 날짜)` 해시로 Bundle 캐시 → 같은 유형 반복 질문은 재인출 스킵. 관련 테이블 write 시 무효화.
- **폴백:** 임베딩/분류 실패 시 general recipe로 강등(항상 답은 나옴). 데이터 0건이면 "데이터 없음" 명시(추정 금지).

### B-6. Context Bundle JSON 계약 (엔진 출력 = 시스템 프롬프트 재료)
```json
{
  "workspace_id": "uuid",
  "intent": "content",
  "as_of": "2026-08-08T08:00:00+09:00",
  "brand_core": { "identity": "", "tone": "", "anti_direction": "" },   // brand_contexts (요약)
  "structured": {
    "content_metrics_recent": [ /* 최근 성과 요약 */ ],
    "content_mix": { "desire": 0.0 }
  },
  "memory": [                                                            // recallMemory 결과(summary만)
    { "id": "uuid", "kind": "philosophy", "summary": "좋은 것은 시간을 담는다…", "pinned": true },
    { "id": "uuid", "kind": "failure", "summary": "부부 콘텐츠는 전환 낮았음(n=…)", "salience": 80 }
  ],
  "token_estimate": 1840,
  "gaps": [ "7일 성과 미확정 콘텐츠 3건" ]                                // 조사 단계가 채움
}
```

### B-7. 현행 코드 접목 지점
- `context.ts` `buildSystemPrompt(roomId)` → `buildContext(query, {roomId, workspaceId, staffType?})`로 확장. 내부에서 분류→recipe→인출→Bundle. **기존 "전량 주입"은 general recipe로 보존**(하위호환).
- `useChat.ts:258` → 마지막 사용자 메시지를 query로 넘기고 workspaceId 전달(Phase 0 1-3과 동일 변경).
- `staffRun.service.ts` → 각 직원 `type_key`를 intent에 매핑(sourcing→sourcing recipe 등). 직원은 이미 brand block을 받으니, Context Engine이 그 자리에 **정밀 슬라이스**를 공급.
- `recallMemory`/임베딩은 신규 `src/services/companyMemory.service.ts` + (임베딩) Edge Function 또는 서버 라우트(키 서버화 1-9와 함께).

---

## C. 통합 요약

1. **추천 순서:** (앞 재설계안 오픈 전 항목 먼저) → company_memory 테이블+수기/승인 캡처(035) → recallMemory 태그 폴백으로 Context Engine general/strategy recipe 도입 → 임베딩(pgvector) 추가 → 2-phase 조사/답변 분리(context_runs 037) → 전 intent recipe 확장.
2. **예상 수정 파일:** 신규 `src/services/companyMemory.service.ts`, `src/config/contextRecipes.ts`, `src/config/models.ts`(임베딩 모델), `src/services/context.ts`(buildContext), `src/hooks/useChat.ts`, `src/services/staffRun.service.ts`(intent 매핑), `staffOutputActions.service.ts`(type='memory'), mock 3곳(`types.ts`/`*.service.ts`/`mockSupabase.ts`).
3. **신규 마이그레이션:** `035_company_memory`(+pgvector, insights 흡수) · `036_company_memory_links`(선택) · `037_context_runs`(선택) · `034_staff_output_actions_extend`에 `'memory'` 타입 추가.
4. **예상 위험:** (a) pgvector 도입 = Supabase 확장 활성화 필요(관리형 지원되나 인덱스 튜닝 필요). (b) 임베딩 생성 비용/지연 → 백그라운드+캐시. (c) 자동 캡처 과다 = 지식 노이즈 → 반드시 승인 게이트+salience. (d) Context Engine 오분류 시 관련 데이터 누락 → general 폴백·gaps 표기로 완화. (e) 임베딩 서버 호출은 키 서버화(1-9)와 묶어야 브라우저 키 노출 안 됨.
5. **대표 승인 필요 선택지:**
   - 인출 방식: **임베딩(pgvector) 도입** vs 태그/키워드 MVP 먼저?
   - `insights` → company_memory **흡수(권장)** vs 병존?
   - 자동 캡처 범위: 대표 메모만 vs 리포트/대화까지 제안?
   - 2-phase 조사노트를 사용자에게 **노출(근거 보기)** vs 내부 저장만?
   - `context_runs` 감사 로그 도입 vs 생략(캐시만)?

이 기능을 현재 AI Office 구조와 자연스럽게 통합하는 설계안을 작성해줘.

# 추가 내용
추가 원칙입니다.

앞으로 AI Office는 기능이 아니라 '대표의 사용 빈도'를 최우선으로 설계합니다.

모든 기능은 아래 질문을 통과해야 합니다.

1.
대표가 일주일에 최소 3번 이상 사용할 기능인가?

2.
이 기능이 이번 달 매출이나 실행 속도를 높이는가?

3.
수동 입력이 30초 이상 걸리지는 않는가?

4.
나중에 자동화할 수 있는가?

5.
이 기능이 다른 기능의 기반 데이터가 되는가?

위 질문에서 3개 이상 YES가 아니면 구현 우선순위를 뒤로 미룹니다.

또한 앞으로 모든 기능은 아래 5단계 중 어디에 속하는지 명시해주세요.

INPUT
(데이터 입력)

↓

MEMORY
(회사 기억)

↓

THINK
(AI 분석)

↓

DECISION
(대표 결정)

↓

ACTION
(실행)

↓

RESULT
(성과)

↓

LEARNING
(학습)

새 기능은 반드시 이 흐름 중 어디에 위치하는지 설명해주세요.

그리고 구현을 시작하기 전에 항상

'이 기능을 오픈 전에 만드는 것이 맞는가?'

를 먼저 판단해주세요.
여기까지의 설계를 기준으로 이제 구현 단계로 전환합니다.

앞으로는 새로운 기능을 계속 설계하기보다 실제 사용할 수 있는 AI Office를 만드는 것이 목표입니다.

원칙은 다음과 같습니다.

1. 설계보다 구현을 우선합니다.
2. 오픈(2026-08-08)에 필요한 기능만 먼저 구현합니다.
3. 모든 구현은 실제 운영 가능한 수준이어야 합니다.
4. 구현 중 새로운 아이디어가 생기면 바로 만들지 말고 Backlog에 기록합니다.
5. 기능 구현이 끝난 후에만 다음 기능 설계를 진행합니다.

당신은 이제 CTO 역할입니다.

나는 대표이고,
ChatGPT는 CMO/전략 책임자입니다.

앞으로는 구현 단위로 진행해주세요.

각 작업마다 아래 형식으로 답변해주세요.

──────────────────

작업명

왜 필요한가

변경되는 DB

변경되는 파일

예상 작업시간

위험도

완료 조건

──────────────────

그리고 한 번에 하나의 기능만 구현합니다.

완료되면 제가 테스트하고 승인한 뒤 다음 단계로 넘어갑니다.

우선순위는 아래와 같습니다.

1.
오피스 할일 CRUD

2.
Products

3.
Content Items

4.
Content Metrics

5.
Sales Daily

6.
Company Memory(MVP)

7.
Context Engine(MVP)

이 순서로 진행해주세요.

새로운 설계보다 실제 동작을 우선합니다.
# 밋업 (Meet-up) - 사업가 모임 공유 앱 개발 명세서

> **용도:** Claude Code 초기 개발 가이드
> **기반:** Sol AI Office (1인용 AI 오피스 앱)을 멀티유저/그룹 협업용으로 재설계
> **작성일:** 2026-05-16

---

## 1. 프로젝트 개요

### 한 줄 설명
**사업가들이 정기적으로 모여 비전·인사이트·진척도를 공유하고, 모임 사이사이의 협업까지 이어가는 그룹 협업 앱.**

### 누가, 왜 쓰는가
- **타깃:** 3~20명 규모의 사업가/창업가 정기 모임 (마스터마인드, 독서모임, 스터디 그룹 등)
- **문제:**
  - 카톡으로 회의록·할일을 흘려보내고 다음 모임에서 다시 처음부터 시작
  - 멤버 각자의 비전·목표가 흩어져서 서로 어디까지 왔는지 모름
  - 회의에서 정한 액션 아이템이 실행 추적 안 됨
  - 인사이트/독서가 개인에 머무르고 모임 자산화 안 됨
- **해결:**
  - 모임 단위로 비전보드/프로젝트/회의록/할일/독서/글쓰기를 묶어서 관리
  - 회의록 → 액션 아이템 → 담당자 지정 → 추적까지 한 흐름
  - 멤버 간 진척도·인사이트·독서가 자연스럽게 공유됨

### Sol AI Office와의 차이
| 항목 | Sol AI Office | 밋업 |
|------|---------------|------|
| 사용자 | 1인 | 다인 (모임 단위) |
| 핵심 단위 | 개인 워크스페이스 | 모임(workspace) + 개인 영역 |
| AI 비중 | 매우 높음 (5명의 AI 팀) | 낮음 (선택적 AI 어시스턴트 1명) |
| 권한 | 본인만 | 운영자/멤버/게스트 |
| 알림 | 개인 리마인더 | 멤버 활동, 할일 할당 등 협업 알림 |

---

## 2. 핵심 기능 목록

### 2.1 필수 기능 (사용자 요청)
1. **프로필 + 비전보드** — 멤버 개인 프로필 + 비전을 이미지·텍스트로 시각화
2. **회의록** — 모임 회의 기록, 액션 아이템 자동 추출, 담당자 지정
3. **독서 기록** — 개인 독서 + 모임 공유 추천 도서
4. **글쓰기** — 템플릿 기반 글쓰기 (회고, 비즈니스 플랜 등)
5. **프로젝트** — 개인/공동 프로젝트, 진행률 추적
6. **할일 (멤버별 권한)** — 담당자 지정, 본인만 자기 할일 완료 처리 가능

### 2.2 보완 제안 기능
7. **모임 관리** — 모임 생성/초대, 멤버 역할 관리
8. **인사이트 공유** — 학습/경험을 멤버끼리 피드 형태로 공유
9. **일정 / 캘린더 (통합 뷰)** — 정기 모임 일정 + 개인 일정 + **회의록을 한 캘린더에 함께 표시**. 캘린더에서 회의록 클릭 시 회의 상세로 바로 이동
10. **대시보드** — 내 할일·일정 + 모임 활동 피드
11. **알림 시스템** — 푸시 알림 (할일 할당, 회의 시작, 새 인사이트 등)
12. **활동 피드** — 멤버들의 최근 활동 타임라인
13. **태그 / 검색** — 통합 검색, 카테고리/태그 시스템
14. **출석 체크** — 회의별 참석/불참 기록
15. **파일/이미지 첨부** — 회의록·인사이트·글쓰기에 자료 첨부
16. **모디 (AI 어시스턴트)** — 회의록 요약, 액션 아이템 추출, 주간 회고 초안 (선택 기능)
17. **통계 리포트** — 멤버별 활동량, 모임별 진척도 월간 리포트

---

## 3. 기술 스택 (Sol AI Office 기반 권장)

```
Frontend: React 18 + TypeScript + Tailwind CSS + Vite
Backend:  Supabase (PostgreSQL + Auth + Storage + Realtime + Edge Functions)
Auth:     Google OAuth + 이메일 (Supabase Auth)
Editor:   Tiptap (회의록/글쓰기/스터디 노트)
Push:     Web Push (VAPID) + Supabase Edge Function
AI (선택): Claude Sonnet 4 (회의록 요약, 액션 아이템 추출용)
Hosting:  Replit 또는 Vercel
VCS:      GitHub
```

### 추가 권장 사항
- **Supabase Realtime 적극 활용** — 회의록 동시 편집, 할일 상태 즉시 반영, 활동 피드
- **모바일 우선 디자인** — 모임 멤버들은 주로 모바일에서 접근
- **PWA** — 푸시 알림, 설치 가능한 앱 형태
- **RLS 정책 철저히** — 멀티테넌트(워크스페이스) 격리의 핵심

---

## 4. 데이터 모델 (Supabase 스키마)

> 모든 테이블은 `workspace_id`(모임 ID) + `user_id`(작성자) 로 격리.
> RLS 정책으로 워크스페이스 멤버만 접근 가능.

### 4.1 워크스페이스 / 멤버

```sql
-- 모임
workspaces (
  id, name, description, emoji, color,
  invite_code,            -- 초대 코드
  created_by,             -- 운영자
  created_at, updated_at
)

-- 모임 멤버 (다대다)
workspace_members (
  workspace_id, user_id,
  role,                   -- 'owner' | 'admin' | 'member' | 'guest'
  joined_at,
  nickname                -- 모임 내 별칭
)

-- 유저 프로필
user_profiles (
  user_id, name, avatar_url,
  bio,                    -- 한줄소개
  business_field,         -- 사업분야
  contact,                -- 연락처 (이메일/카톡 등)
  created_at
)

-- 비전보드
vision_boards (
  id, user_id,
  title,                  -- 예: "2026년 비전"
  items,                  -- JSONB: [{type: 'image'|'text'|'goal', content, position}]
  is_public,              -- 모임 멤버에게 공개 여부
  updated_at
)
```

### 4.2 회의록

```sql
meetings (
  id, workspace_id, title,
  date, start_time, end_time,
  location,               -- 장소 (온라인 링크 또는 오프라인)
  agenda,                 -- 의제 (텍스트)
  content,                -- 본문 (Tiptap JSON)
  summary,                -- AI 요약 (선택)
  created_by, created_at
)

meeting_attendees (
  meeting_id, user_id,
  status                  -- 'attending' | 'absent' | 'late'
)
```

### 4.3 프로젝트 / 목표 / KPI

```sql
projects (
  id, workspace_id,
  name, emoji, color, description,
  status,                 -- 'active' | 'paused' | 'done'
  is_shared,              -- true: 모임 공동 / false: 개인
  owner_id,               -- 주 담당자
  created_at
)

project_members (         -- 공동 프로젝트일 때만
  project_id, user_id, role
)

goals (
  id, project_id, title, type,
  progress, status,
  owner_id                -- 목표 담당자
)

kpis (
  id, goal_id, name,
  current_value, target_value, unit
)
```

### 4.4 할일 (핵심: 멤버별 할당)

```sql
tasks (
  id, workspace_id,
  title, description,
  status,                 -- 'todo' | 'in_progress' | 'done'
  priority,               -- 'low' | 'medium' | 'high'
  due_date,
  assignee_id,            -- ★ 담당자 (멤버 중 1명)
  created_by,             -- 작성자
  project_id,             -- 연결된 프로젝트 (선택)
  meeting_id,             -- 회의에서 생성된 경우 (선택)
  category,
  created_at, completed_at
)

-- 권한 규칙 (RLS):
-- - 워크스페이스 멤버 누구나 할일 생성/조회 가능
-- - 담당자(assignee) 또는 작성자(created_by) 또는 운영자(owner/admin)만 수정/삭제
-- - 상태 변경(완료 체크)은 담당자 + 운영자만 가능
```

### 4.5 독서 기록

```sql
readings (
  id, user_id, workspace_id,
  title, author, cover_url,
  category, status,       -- 'reading' | 'done' | 'wishlist'
  current_page, total_pages,
  is_shared,              -- 모임에 공유 여부
  recommended_by,         -- 추천한 멤버 (선택)
  created_at
)

reading_notes (
  id, reading_id, user_id,
  chapter, content,       -- Tiptap JSON
  is_shared,
  created_at
)
```

### 4.6 글쓰기 (템플릿 기반)

```sql
writing_templates (       -- 시스템 제공 템플릿
  id, name, description, structure  -- JSONB
)
-- 기본 템플릿 예시:
--   "주간 회고", "월간 회고", "비즈니스 플랜 1페이지",
--   "아이디어 정리", "고객 인터뷰 노트", "강점 분석" 등

writings (
  id, user_id, workspace_id,
  template_id,            -- 사용한 템플릿
  title, content,         -- Tiptap JSON
  is_shared,
  created_at, updated_at
)

writing_comments (        -- 멤버 피드백
  id, writing_id, user_id, content, created_at
)
```

### 4.7 인사이트

```sql
insights (
  id, user_id, workspace_id,
  title, content,
  source,                 -- 출처 (책, 강의, 경험 등)
  tags, project_id,
  is_shared,
  created_at
)

insight_likes (
  insight_id, user_id, created_at
)

insight_comments (
  id, insight_id, user_id, content, created_at
)
```

### 4.8 일정

```sql
schedules (
  id, user_id, workspace_id,
  title, date, time, end_time,
  repeat,                 -- 'none' | 'daily' | 'weekly' | 'monthly'
  reminder,               -- 알림 시간 (분 전)
  is_workspace_event,     -- 모임 공식 일정 여부
  attendee_ids,           -- 참석자 (모임 일정일 때)
  color                   -- 캘린더 표시용 색상 (선택)
)

-- ★ 캘린더 통합 뷰 (Postgres View로 구현)
-- meetings 테이블과 schedules 테이블을 UNION ALL 로 묶어
-- {id, type: 'schedule'|'meeting', title, date, time, ...} 형태로 반환
-- → 프론트에서 한 번에 fetch 가능 (Supabase 클라이언트로 뷰 직접 조회)
CREATE VIEW calendar_events AS
  SELECT id, workspace_id, user_id,
         'schedule' AS type, title, date, time, end_time,
         NULL AS meeting_id
  FROM schedules
  UNION ALL
  SELECT id, workspace_id, created_by AS user_id,
         'meeting' AS type, title, date, start_time AS time, end_time,
         id AS meeting_id
  FROM meetings;

-- 뷰에도 RLS 적용 (security_invoker 옵션 또는 base table RLS 상속)
```

### 4.9 알림 / 활동 피드

```sql
notifications (
  id, user_id,            -- 수신자
  type,                   -- 'task_assigned' | 'meeting_soon' | 'insight_liked' | ...
  title, body,
  resource_type, resource_id,
  is_read, created_at
)

activities (              -- 활동 피드 (워크스페이스별)
  id, workspace_id, user_id,
  action,                 -- 'created_task' | 'completed_task' | 'shared_insight' | ...
  resource_type, resource_id,
  metadata,               -- JSONB
  created_at
)

push_subscriptions (
  user_id, endpoint, p256dh, auth, device_label, created_at
)
```

---

## 5. 권한 시스템 (RLS 핵심)

### 역할
| 역할 | 권한 |
|------|------|
| `owner` | 모임 생성자. 모든 권한 + 모임 삭제 가능 |
| `admin` | 멤버 관리, 모든 컨텐츠 편집 가능 |
| `member` | 컨텐츠 생성, 자기 것 + 본인 담당 할일 편집 |
| `guest` | 읽기 전용 (선택) |

### RLS 헬퍼 함수 (필수)
```sql
-- 워크스페이스 멤버인지 체크
CREATE FUNCTION is_workspace_member(ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$;

-- 워크스페이스 운영자(owner/admin)인지 체크
CREATE FUNCTION is_workspace_admin(ws_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$;
```

### 핵심 RLS 정책 예시
```sql
-- tasks 테이블 RLS
-- 조회: 워크스페이스 멤버
CREATE POLICY tasks_select ON tasks FOR SELECT
  USING (is_workspace_member(workspace_id));

-- 생성: 워크스페이스 멤버
CREATE POLICY tasks_insert ON tasks FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id) AND created_by = auth.uid());

-- 수정: 담당자 + 작성자 + 운영자만
CREATE POLICY tasks_update ON tasks FOR UPDATE
  USING (
    is_workspace_admin(workspace_id)
    OR assignee_id = auth.uid()
    OR created_by = auth.uid()
  );
```

### 핵심 RLS 규칙
1. **모든 조회**: 워크스페이스 멤버여야 함 (`is_workspace_member`)
2. **본인 컨텐츠**: 작성자(`user_id = auth.uid()`)는 항상 편집 가능
3. **할일 상태 변경**: 담당자(`assignee_id`) + 작성자 + 운영자만 가능
4. **공유 토글(`is_shared`)**: 작성자만 가능
5. **모임 설정**: owner/admin만 가능 (`is_workspace_admin`)
6. **개인 영역(비전보드, 개인 글쓰기 등)**: `is_public=false`일 때 본인만 조회 가능

---

## 6. 화면 구조

### 6.1 레이아웃
```
PC (lg, 1024px+):
┌─────────┬────────────────────┬──────────────┐
│ Sidebar │   Main Content     │ Activity     │
│ (w-64)  │   (flex-1)         │ Feed/Notif   │
│ 메뉴    │   페이지           │ (w-360px)    │
└─────────┴────────────────────┴──────────────┘

모바일 (< 1024px):
┌──────────────────────────────┐
│  상단: 워크스페이스 선택       │
│  Main Content                 │
├──────────────────────────────┤
│  BottomNav (홈/할일/회의/멤버) │
└──────────────────────────────┘
```

### 6.2 주요 페이지
| 페이지 | 경로 | 내용 |
|--------|------|------|
| 대시보드 | `/` | 내 할일·일정 + 모임 활동 피드 + 다음 회의 |
| 멤버 | `/members` | 멤버 목록, 프로필 카드, 비전보드 미리보기 |
| 멤버 상세 | `/members/:id` | 프로필 + 비전보드 + 공개 인사이트/독서 |
| 회의록 | `/meetings` | 회의 목록 (일정순) |
| 회의록 상세 | `/meetings/:id` | 회의록 본문 + 액션 아이템 + 참석자 |
| 프로젝트 | `/projects` | 개인/공동 프로젝트 카드 |
| 프로젝트 상세 | `/projects/:id` | 목표/KPI/할일/회의록 통합 |
| 할일 | `/tasks` | 리스트/칸반/내것/전체 필터 |
| 독서 | `/readings` | 개인 독서 + 모임 추천 도서 탭 |
| 글쓰기 | `/writings` | 내 글 + 공유 글 + 템플릿 선택 |
| 인사이트 | `/insights` | 피드 형태 (카드) + 좋아요/댓글 |
| 일정 | `/calendar` | 월간/주간 캘린더 — **일정 + 회의록 통합 표시** (필터 토글) |
| 설정 | `/settings` | 프로필, 알림, 워크스페이스 관리 |

### 6.3 핵심 UX 흐름

#### 회의록 → 할일 자동 생성
```
회의 종료 → 회의록 작성
  → [AI 모디 사용 시] 액션 아이템 자동 추출
  → 각 액션 아이템에 담당자 지정 UI
  → "할일로 추가" 버튼 → tasks 테이블에 일괄 생성 (meeting_id 연결)
  → 담당자에게 푸시 알림 발송
```

#### 비전보드
```
멤버가 자기 비전보드 편집
  → 드래그&드롭으로 이미지/텍스트/목표 카드 배치
  → 공개 여부 토글
  → 다른 멤버가 멤버 페이지에서 미리보기 가능
```

#### 캘린더 통합 뷰 (★ 필수)
```
캘린더 페이지에서 일정(schedules)과 회의록(meetings)을 한 화면에 표시
  → 데이터 소스 2개를 날짜 기준으로 머지해서 렌더링
  → 시각적 구분: 일정 = 보통 색상 / 회의 = 강조 색상 + 회의 아이콘
  → 필터 토글: [전체] [일정만] [회의만] [내 일정만]
  → 일정 클릭 → 일정 상세/편집 모달
  → 회의 클릭 → /meetings/:id 페이지로 이동
  → 모바일에서는 리스트 뷰 기본, "오늘/이번주/이번달" 탭
```

#### 할일 권한
```
A 멤버가 B 멤버에게 할일 할당
  → B에게 푸시 알림
  → B는 자기 화면에 "내 할일"로 표시
  → B만 완료 체크 가능 (A는 못 함, 단 운영자는 가능)
  → 완료 시 활동 피드에 기록
```

---

## 7. 폴더 구조 (Sol AI Office 기반)

```
meetup-app/
├── CLAUDE.md                    # 이 명세서 정리본
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DESIGN.md
│   └── ROADMAP.md
├── public/
│   ├── images/                  # 로고, 빈 상태 이미지
│   ├── templates/               # 글쓰기 템플릿 (md)
│   └── prompts/                 # AI 프롬프트 (선택)
├── src/
│   ├── main.tsx / App.tsx
│   ├── types.ts                 # 전역 타입 (User, Workspace, Member, Task 등)
│   ├── components/
│   │   ├── workspace/           # 워크스페이스 관련
│   │   ├── members/             # 멤버 카드, 비전보드
│   │   ├── meetings/            # 회의록 컴포넌트
│   │   ├── projects/
│   │   ├── tasks/               # 할일 (리스트/칸반/멤버 필터)
│   │   ├── readings/
│   │   ├── writings/            # 템플릿 선택, 에디터
│   │   ├── insights/
│   │   ├── calendar/
│   │   ├── activity/            # 활동 피드
│   │   └── common/              # 공통 (Avatar, Modal, ...)
│   ├── hooks/
│   │   ├── useWorkspace.ts      # 현재 워크스페이스 + 멤버
│   │   ├── usePermission.ts     # 권한 체크
│   │   ├── useRealtime.ts       # Supabase Realtime 구독
│   │   ├── useTasks.ts
│   │   ├── useMeetings.ts
│   │   ├── useNotifications.ts
│   │   └── ...
│   ├── services/
│   │   ├── supabase.ts
│   │   ├── mockSupabase.ts      # 로컬 mock (개발용)
│   │   ├── workspaces.service.ts
│   │   ├── members.service.ts
│   │   ├── tasks.service.ts
│   │   ├── meetings.service.ts
│   │   ├── push.service.ts
│   │   └── ...
│   ├── pages/
│   ├── utils/
│   │   ├── permission.ts        # 권한 헬퍼
│   │   ├── dateCalc.ts
│   │   └── ...
│   └── styles/
├── supabase/
│   ├── migrations/              # SQL 마이그레이션 (스키마 + RLS)
│   └── functions/               # Edge Function (푸시 발송, AI 요약 등)
├── package.json / vite.config.ts / tailwind.config.js / tsconfig.json
```

---

## 8. 디자인 가이드

### 컬러 톤
- **메인 컬러:** 신뢰감 있는 차분한 톤 추천 — `Indigo`(`#6366f1`) 또는 `Teal`(`#14b8a6`)
- **포인트:** 따뜻한 오렌지/앰버 (액션 버튼, 알림 뱃지)
- Sol AI Office의 보라(`#a855f7`)와 차별화

### 컴포넌트 스타일
- 카드: `rounded-3xl`, 부드러운 shadow
- 버튼: `rounded-2xl`
- 아바타: 원형, 멤버별 컬러 링 표시
- 모바일 우선: 폰트 16px+ 기본, 터치 영역 44px+

### 반응형
- 모바일 1열 / sm 2열 / lg 3열 (카드 그리드)
- 모바일에서 사이드바는 햄버거 메뉴

---

## 9. 환경 변수

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
VITE_ANTHROPIC_API_KEY=    # AI 어시스턴트 사용 시
```

### Supabase Edge Function 시크릿 (`supabase secrets set`)
```
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
ANTHROPIC_API_KEY=
```

**보안 주의:**
- `.env`, `.env.*`는 `.gitignore`에 등록
- Supabase Service Role Key는 Edge Function 시크릿으로만 관리 (프론트엔드에 절대 노출 금지)
- 푸시용 VAPID Private Key는 코드에 절대 하드코딩 금지
- 클라이언트는 Anon Key만 사용 — RLS가 보안의 핵심 방어선

---

## 10. 개발 우선순위 (MVP → 확장)

### Phase 1 — MVP (2~3주)
1. 인증 + 워크스페이스 생성/초대 (코드 방식)
2. 멤버 프로필 + 멤버 목록
3. 회의록 (간단한 에디터 + 참석자)
4. 할일 (담당자 지정, 기본 권한 — RLS)
5. 대시보드 (내 할일 + 다음 회의)

### Phase 2 — 핵심 협업 (2~3주)
6. 비전보드
7. 프로젝트 + 목표/KPI
8. 인사이트 공유 (피드)
9. 활동 피드 + 푸시 알림
10. 회의록에서 액션 아이템 → 할일 일괄 생성

### Phase 3 — 콘텐츠/AI (2주)
11. 독서 기록 + 모임 추천 도서
12. 글쓰기 (템플릿 5종)
13. 일정/캘린더 (일정 + 회의록 통합 뷰)
14. AI 모디 (회의록 요약, 액션 아이템 추출)

### Phase 4 — 확장
15. 통계 리포트, 출석 체크
16. 파일/이미지 첨부 (Supabase Storage)
17. 검색 통합
18. 모바일 PWA 최적화

---

## 11. 코딩 컨벤션 (Sol AI Office와 동일)

### 파일 상단 주석 (필수)
```typescript
/**
 * @file src/components/meetings/MeetingCard.tsx
 * @description 회의록 카드 컴포넌트
 */
```

### 네이밍
- 컴포넌트: `PascalCase`
- 훅: `camelCase` + `use` prefix
- 서비스: `camelCase` + `.service.ts`
- DB 컬럼: `snake_case` / 프론트 필드: `camelCase` + 변환 함수

### Mock 모드 (로컬 개발)
로컬은 `.env.local`(빈 Supabase 값) → `mockSupabase.ts`(인메모리 mock)으로 동작.
새 필드/테이블 추가 시 3곳 동시 수정:
1. `src/types.ts` (프론트 타입, camelCase)
2. `src/services/*.service.ts` (DB Row 타입, snake_case + 변환)
3. `src/services/mockSupabase.ts` (mock 매핑)

### MockQueryBuilder 주의
- `insert` / `update` / `delete` / `upsert`는 절대 `async`로 만들지 말 것
- Supabase는 `.update(payload).eq('id', id)` 체이닝 패턴 → `async`면 Promise에 `.eq()` 호출하게 되어 깨짐
- `this`를 반환해 체이닝 유지, 실행은 `_resolve()`에서 `await` 시점에 처리

---

## 12. AI 어시스턴트 (선택 기능 — "모디")

> 처음부터 만들지 않아도 됨. Phase 3에서 추가.

### 역할
- 회의록 본문에서 액션 아이템 자동 추출 (담당자/마감일 추론)
- 회의록 요약 (3줄 요약)
- 주간 모임 회고 초안 (한 주간 활동 기반)
- 모임 멤버에게 "이번 주 추천 액션" 제안

### 모델
- Claude Sonnet 4 (`claude-sonnet-4-20250514`) 1개만 사용
- 시스템 프롬프트는 `public/prompts/modi.md`로 분리

### 트리거
- 회의록 저장 시 백그라운드로 자동 실행 (사용자 선택)
- "AI 요약" 버튼으로 수동 호출
- 매주 일요일 자동 회고 초안 (스케줄러)

---

## 13. 명세서에 없지만 고려할 것

### 데이터 프라이버시
- 멤버가 모임 탈퇴 시 본인 컨텐츠를 가져갈 수 있는 export 기능 (Phase 4)
- 모임 삭제 시 컨텐츠 처리 정책 (소프트 삭제 + 30일 보관)

### 온보딩
- 초대 코드로 가입 → 짧은 프로필 작성 강제 → 비전보드 1개 작성 안내
- 모임 만들 때 운영자가 첫 회의록 템플릿 선택

### 정량 지표 (운영자가 보고 싶을 만한 것)
- 멤버별 월간 활동량 (회의 참석, 할일 완료, 인사이트 공유 수)
- 모임 전체 진행률 (열린 할일 vs 닫힌 할일)
- 다음 모임 전 미완료 액션 아이템 알림

---

## 14. 시작 체크리스트 (Claude Code에게)

1. ✅ Vite + React + TS + Tailwind 프로젝트 초기화
2. ✅ Supabase 프로젝트 생성, 스키마 마이그레이션 작성 (`supabase/migrations/`)
3. ✅ RLS 헬퍼 함수 + 정책 작성 (테이블별)
4. ✅ Google OAuth + 이메일 로그인 셋업
5. ✅ MockSupabase 셋업 (로컬 개발용)
6. ✅ 워크스페이스 생성/초대 플로우
7. ✅ 멤버 + 프로필 + 비전보드
8. ✅ 회의록 CRUD (Tiptap 에디터) + 참석자
9. ✅ 할일 (담당자 지정 + 권한 RLS)
10. ✅ 대시보드 (내 할일 + 다음 회의)
11. ✅ 캘린더 통합 뷰 (일정 + 회의록)
12. ✅ Supabase Realtime 구독 (할일 상태/활동 피드)
13. ✅ 푸시 알림 (Edge Function + VAPID)
14. ✅ MVP 배포 (Replit 또는 Vercel)

---

## 15. 참고

- **Sol AI Office 소스:** 동일한 폴더 구조/컨벤션/MockSupabase 패턴/Tiptap 에디터 그대로 재활용
- **모든 소통은 한글로** (변수명/함수명은 영어, UI 문구·대화는 한글)
- **모바일 우선** — 모임 멤버 대부분이 모바일에서 접근

---

*이 문서를 받은 Claude Code는 위 순서대로 MVP부터 만들면 됩니다. 각 단계에서 막히면 사용자에게 확인 받고 진행하세요.*

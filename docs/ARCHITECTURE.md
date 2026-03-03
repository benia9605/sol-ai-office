# Sol AI Office - 폴더 구조 & 아키텍처

> 각 폴더와 파일의 역할을 설명합니다. 최종 업데이트: 2026-03-03

---

## 프로젝트 루트

```
sol-ai-office/
├── CLAUDE.md                    # Claude Code 지침서 (루트 고정)
├── NOTION.md                    # 노션 워크스페이스 구조 (연동 참고)
├── docs/
│   ├── ARCHITECTURE.md          # 이 파일
│   ├── DESIGN.md                # 디자인 가이드
│   └── FEATURE_ROADMAP.md       # 기능 구현 가이드 + 로드맵
├── public/
│   ├── images/                  # AI 캐릭터 이미지
│   └── prompts/                 # AI 시스템 프롬프트 (방별 .md)
├── src/                         # 소스 코드
├── package.json / vite.config.ts / tailwind.config.js / tsconfig.json
```

---

## `src/` 구조

### 진입점

| 파일 | 역할 |
|------|------|
| `main.tsx` | React DOM 렌더, 라우터 설정 |
| `App.tsx` | 루트 라우터 (로그인/메인 분기) |
| `index.css` | 글로벌 스타일 (Tailwind directives + 커스텀) |
| `types.ts` | 전역 타입 정의 (Room, ChatMessage, TaskItem, RecordItem 등) |
| `data.ts` | 정적 데이터 (방 목록, AI 설정, 비서실 Room 객체) |

### `pages/` — 페이지 컴포넌트

| 파일 | 경로 | 역할 |
|------|------|------|
| `HomePage.tsx` | `/` | 대시보드 (브리핑 카드 + 위젯 + 방 카드) |
| `TasksPage.tsx` | `/tasks` | 할일 관리 (리스트/칸반, 멀티 선택 일괄 편집) |
| `SchedulesPage.tsx` | `/schedules` | 일정 캘린더 |
| `InsightsPage.tsx` | `/insights` | 인사이트 목록 |
| `ReadingsPage.tsx` | `/readings` | 독서/학습 관리 |
| `RecordsPage.tsx` | `/records` | 기록 (아침/저녁/주간/메모) |
| `SummariesPage.tsx` | `/summaries` | 오늘 요약 |
| `ProjectDetailPage.tsx` | `/projects/:id` | 프로젝트 상세 (목표/KPI) |
| `SettingsPage.tsx` | `/settings` | 설정 (내 정보, 프로젝트 관리) |
| `LoginPage.tsx` | `/login` | Google OAuth 로그인 |

### `components/` — UI 컴포넌트

| 파일 | 역할 |
|------|------|
| `Layout.tsx` | **앱 레이아웃 허브** — Header + Sidebar + Main + ChatPanel + BottomNav + ModiFAB |
| `ChatModal.tsx` | AI 채팅 (PC: 사이드 패널 420px, 모바일: 풀스크린 오버레이) |
| `MessageBubble.tsx` | 채팅 말풍선 (마크다운 렌더, 액션 칩, ⋯ 메뉴) |
| `SaveModal.tsx` | 메시지 → 할일/인사이트 저장 모달 |
| `Header.tsx` | 상단 헤더 (사이드바 토글, 유저 이름, 로그아웃) |
| `NewSidebar.tsx` | 좌측 사이드바 (메뉴 + 대화 히스토리) |
| `BottomNav.tsx` | 모바일 하단 네비게이션 (뽀모도로 미니 타이머 포함) |
| `RoomCard.tsx` | 홈 방 카드 |
| `DashboardWidgets.tsx` | 대시보드 위젯 (일정/할일/인사이트/스터디) |
| `BriefingCard.tsx` | 모디 아침 브리핑 카드 (접기/펼치기) |
| `ModiFAB.tsx` | 모디 플로팅 액션 버튼 |
| `PomodoroTimer.tsx` | 뽀모도로 타이머 (PC: 플로팅, 모바일: BottomNav 인라인) |
| `GoalSelect.tsx` | 목표 선택 드롭다운 |
| `ProjectSelect.tsx` | 프로젝트 선택 드롭다운 |
| `ItemDetailPopup.tsx` | 할일/일정 상세 팝업 |

| 하위 폴더 | 파일 | 역할 |
|-----------|------|------|
| `tasks/` | `TaskListView.tsx` | 할일 리스트 뷰 |
| | `TaskListItem.tsx` | 할일 리스트 아이템 (선택 모드 체크박스 지원) |
| | `TaskKanbanView.tsx` | 할일 칸반 뷰 |
| | `DailyRoutineSection.tsx` | 일일 루틴 섹션 |
| `records/` | `RecordForm.tsx` | 기록 폼 (타입별 동적 렌더, AI 초안 생성 버튼) |
| | `RecordCalendar.tsx` | 기록 캘린더 |
| | `RecordDetailView.tsx` | 기록 상세 뷰 |
| | `RecordTypeSelector.tsx` | 기록 유형 선택 |
| | `ListFieldEditor.tsx` | 리스트 필드 에디터 |
| | `EnergySelector.tsx` | 에너지 게이지 선택 |
| | `RecordIcons.tsx` | 기록 아이콘 SVG 모음 |
| `readings/` | `ReadingDetailView.tsx` | 독서 상세 |
| | `StudyNoteEditor.tsx` | 스터디 노트 에디터 (Tiptap) |
| | `StudyNoteCard.tsx` | 스터디 노트 카드 |
| | `StarRating.tsx` | 별점 컴포넌트 |
| `tiptap/` | `TiptapEditor.tsx` | Tiptap 리치 에디터 |
| | `TiptapReadOnly.tsx` | Tiptap 읽기 전용 |

### `hooks/` — 커스텀 훅

| 파일 | 역할 |
|------|------|
| `useAuth.ts` | Supabase Auth 상태 관리 |
| `useUserProfile.ts` | 유저 프로필 (이름, 소개, 대화 스타일) |
| `useChat.ts` | **AI 채팅 핵심** — 메시지 전송, 회의 흐름, 새 대화, 히스토리 로드 |
| `useBriefing.ts` | 모디 아침 브리핑 데이터 로드 |
| `useProjects.ts` | 프로젝트 CRUD |
| `useGoals.ts` | 목표 CRUD + 진행률 |
| `useTasks.ts` | 할일 CRUD + 상태 변환 |
| `useSchedules.ts` | 일정 CRUD |
| `useInsights.ts` | 인사이트 CRUD |
| `useInsightSources.ts` | 인사이트 출처 관리 |
| `useReadings.ts` | 독서/학습 CRUD |
| `useRecords.ts` | 기록 CRUD (journals 테이블) |
| `useDailyCompletions.ts` | 일일 완료 집계 |

### `services/` — API/DB 연동

| 파일 | 역할 |
|------|------|
| `supabase.ts` | Supabase 클라이언트 싱글턴 |
| `auth.ts` | 인증 (Google OAuth, getCurrentUserId) |
| `chatApi.ts` | **AI API 라우터** — roomId별 Claude/GPT/Perplexity 자동 분기 |
| `context.ts` | **시스템 프롬프트 빌더** — 기본 프롬프트 + 동적 컨텍스트 조합 |
| `meeting.service.ts` | 회의실 프롬프트 (시작/참가자/정리/라우터/후속) + 참가자 파싱 |
| `summary.service.ts` | 대화 요약 (전체 방 요약 + 단일 대화 자동 요약) |
| `briefing.service.ts` | 모디 아침 브리핑 (데이터 수집 + AI 한마디 생성/캐싱) |
| `weeklyReview.service.ts` | 주간 회고 AI 초안 (이번 주 데이터 수집 + Claude 초안 생성) |
| `conversations.service.ts` | conversations/messages 테이블 CRUD |
| `projects.service.ts` | projects 테이블 CRUD |
| `goals.service.ts` | goals 테이블 CRUD |
| `kpis.service.ts` | kpis/kpi_logs 테이블 CRUD |
| `tasks.service.ts` | tasks 테이블 CRUD + status 변환 (todo↔pending, done↔completed) |
| `schedules.service.ts` | schedules 테이블 CRUD |
| `insights.service.ts` | insights 테이블 CRUD |
| `readings.service.ts` | readings 테이블 CRUD |
| `studyNotes.service.ts` | study_notes 테이블 CRUD |
| `records.service.ts` | journals 테이블 CRUD |
| `dailyCompletions.service.ts` | daily_completions 테이블 |
| `userProfile.service.ts` | user_profiles 테이블 CRUD |
| `options.service.ts` | custom_options 테이블 (카테고리 등) |
| `storage.service.ts` | Supabase Storage (이미지 업로드) |
| `aladinApi.ts` | 알라딘 도서 검색 API |

### `utils/` — 유틸 함수

| 파일 | 역할 |
|------|------|
| `actionExtractor.ts` | AI 응답에서 액션 아이템 자동 추출 (정규식 기반) |
| `dateCalc.ts` | 날짜 계산 유틸 |
| `urgentTasks.ts` | 긴급 할일 필터링 |
| `recordTemplates.ts` | 기록 빈 템플릿 + 유형별 설정 (색상, 라벨) |
| `readingProgress.ts` | 독서 진행률 계산 |
| `icsExport.ts` | 일정 ICS 파일 내보내기 |

### `public/prompts/` — AI 시스템 프롬프트

| 파일 | 대상 |
|------|------|
| `plani.md` | 플래니 (전략실) |
| `maki.md` | 마키 (마케팅룸) |
| `devi.md` | 데비 (개발실) |
| `searchi.md` | 서치 (리서치랩) |
| `modi.md` | 모디 (비서실) |
| `meeting.md` | 회의실 |

---

## 데이터 흐름

```
유저 입력
  → pages/ (UI 이벤트)
    → hooks/ (비즈니스 로직, 상태 관리)
      → services/ (Supabase DB / AI API 호출)
        → Supabase PostgreSQL / Claude / GPT / Perplexity
```

---

*이 문서는 프로젝트가 성장하면서 업데이트됩니다.*

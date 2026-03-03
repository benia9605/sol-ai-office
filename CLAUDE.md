# Sol AI Office - 개발 지침서

**용도:** Claude Code / Cursor (코딩/실행용)
**최종 업데이트:** 2026-03-03

---

## 프로젝트 개요

**Sol AI Office** - 1인 사업가를 위한 AI 팀 가상 오피스

### 핵심 기능
1. **방별 AI 채팅** - 5개 방 + 비서실 (전략실/마케팅룸/개발실/리서치랩/회의실/비서실)
2. **회의실 (멀티 AI)** - 4명 AI 순차 답변, 모디 라우터 후속 대화
3. **프로젝트/목표/KPI** - 프로젝트별 목표, KPI 수치 추적, AI 시스템프롬프트에 자동 주입
4. **할일 관리** - 리스트/칸반뷰, 멀티 선택 일괄 편집, 뽀모도로 타이머
5. **일정 관리** - 캘린더, 반복 일정, ICS 내보내기
6. **인사이트** - AI 대화에서 저장, 출처별 관리
7. **독서/스터디** - 독서 진행률, 스터디 노트 (Tiptap 에디터)
8. **기록** - 아침 일기/저녁 일기/주간 회고/메모, AI 주간 회고 초안 생성
9. **대시보드** - 모디 아침 브리핑, 위젯 (일정/할일/인사이트/스터디)
10. **오늘 요약** - 전체 방 대화 요약, 새 대화 시 자동 요약 저장
11. **액션 아이템 자동 추출** - AI 응답에서 할일 자동 감지, 전체 추가
12. **PC 사이드 패널 채팅** - 채팅하면서 다른 페이지 탐색 가능

### 설계 방향
- **긴 대화는 Claude 앱에서, AI 오피스는 "내 현상황 파악한 비서들"**
- 슬라이딩 윈도우(최근 20개 메시지) + 자동 요약으로 맥락 유지 + 비용 최소화
- 시스템 프롬프트에 유저 정보/프로젝트/목표/KPI/일정/할일/요약 자동 주입

---

## 기술 스택

```
Frontend: React 18 + TypeScript + Tailwind CSS + Vite
Backend:  Supabase (PostgreSQL + Auth + Storage)
AI APIs:
  - Claude Sonnet 4 (플래니/모디) — claude-sonnet-4-20250514
  - Claude Opus 4 (데비) — claude-opus-4-20250514
  - GPT-4o (마키)
  - Perplexity Sonar Pro (서치)
Auth:     Google OAuth (Supabase Auth)
Editor:   Tiptap (스터디 노트/메모)
Hosting:  Replit
VCS:      GitHub (benia9605/sol-ai-office)
```

---

## 폴더 구조

> 상세: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

```
sol-ai-office/
├── CLAUDE.md                    # 이 파일 (Claude Code 지침서, 루트 고정)
├── docs/
│   ├── ARCHITECTURE.md          # 폴더 구조 + 각 파일 역할
│   ├── DESIGN.md                # 디자인 가이드 (컬러, 폰트, 스타일)
│   └── FEATURE_ROADMAP.md       # 기능 구현 가이드 + 로드맵 (가장 상세)
├── public/
│   ├── images/                  # AI 캐릭터 이미지 (plani/maki/devi/searchi/modi.png)
│   └── prompts/                 # AI 시스템 프롬프트 (plani/maki/devi/searchi/modi/meeting.md)
├── src/
│   ├── main.tsx / App.tsx       # 진입점 + 라우터
│   ├── types.ts                 # 전역 타입 (Room, ChatMessage, TaskItem, RecordItem 등)
│   ├── data.ts                  # 정적 데이터 (방 목록, AI 설정)
│   ├── components/              # UI 컴포넌트 (20+개)
│   ├── hooks/                   # 커스텀 훅 (15개)
│   ├── services/                # Supabase/API 연동 (20개)
│   ├── pages/                   # 페이지 컴포넌트 (9개)
│   └── utils/                   # 유틸 함수 (5개)
├── package.json / vite.config.ts / tailwind.config.js / tsconfig.json
```

---

## DB 스키마 (Supabase)

모든 테이블은 `user_id` 컬럼으로 유저별 격리. RLS 정책 적용.

| 테이블 | 역할 | 주요 컬럼 |
|--------|------|-----------|
| `conversations` | 대화 세션 | room_id, title |
| `messages` | 개별 메시지 | conversation_id, role, content, ai_name |
| `conversation_summaries` | 대화 요약 (AI 컨텍스트용) | room_id, date, summary |
| `daily_briefings` | 모디 아침 브리핑 캐시 | date, ai_comment |
| `projects` | 프로젝트 | name, emoji, color, description, status |
| `goals` | 목표 (프로젝트 하위) | project_id, title, type, progress, status |
| `kpis` | KPI (목표 하위) | goal_id, name, current_value, target_value, unit |
| `kpi_logs` | KPI 변경 기록 | kpi_id, value, date, note |
| `tasks` | 할일 | title, status(todo/in_progress/done), priority, due_date, goal_id, category |
| `schedules` | 일정 | title, date, time, repeat, reminder |
| `insights` | 인사이트 | title, content, source, tags, project |
| `readings` | 독서/학습 | title, author, category, status, currentPage/Lesson |
| `study_notes` | 스터디 노트 | reading_id, chapter, content(Tiptap JSON) |
| `journals` | 기록 (아침/저녁/주간/메모) | type, title, date, weekly_data(JSONB) |
| `user_profiles` | 유저 프로필 | name, bio, tone, response_length, emoji_usage |
| `daily_completions` | 일일 완료 집계 | date, count |
| `custom_options` | 커스텀 카테고리 등 | option_type, value |

---

## AI 팀 설정

| 방 | AI 이름 | 모델 | room_id | 역할 |
|-----|---------|------|---------|------|
| 전략실 | 플래니 💜 | Claude Sonnet 4 | `strategy` | 전략 총괄, 의사결정, 우선순위 |
| 마케팅룸 | 마키 💗 | GPT-4o | `marketing` | 마케팅, 콘텐츠, 카피라이팅 |
| 개발실 | 데비 🤎 | Claude Opus 4 | `dev` | 개발, 기술 구현, 코드 리뷰 |
| 리서치랩 | 서치 💚 | Perplexity Sonar Pro | `research` | 시장조사, 경쟁사 분석, 실시간 검색 |
| 회의실 | 모디 💛 | Claude Sonnet 4 | `meeting` | 회의 진행 & 정리 (멀티 AI) |
| 비서실 | 모디 💛 | Claude Sonnet 4 | `secretary` | 1:1 비서, 오늘 요약 |

### 시스템 프롬프트 구조

```
기본 프롬프트 (public/prompts/{roomId}.md)
  + 유저 정보 (이름, 소개, 대화 스타일)
  + 프로젝트 & 목표 & KPI (진행률)
  + 다가오는 일정 (7일 이내)
  + 진행 중 할일 (우선순위, 마감일)
  + 최근 대화 요약 (해당 방)
  + [모디만] 전체 방 요약
→ context.ts의 buildSystemPrompt(roomId)에서 조합
```

---

## 레이아웃 구조

```
PC (lg, 1024px+):
┌─────────┬────────────────────┬──────────────┐
│ Sidebar │   Main Content     │  Chat Panel  │
│ (w-64)  │   (flex-1)         │  (w-420px)   │
│ 메뉴    │   페이지           │  AI 채팅     │
└─────────┴────────────────────┴──────────────┘

모바일 (< 1024px):
┌──────────────────────────────┐
│  Main Content                │
│  Chat = 풀스크린 오버레이     │
│  Sidebar = 슬라이드 오버레이  │
├──────────────────────────────┤
│  BottomNav (하단 네비)        │
└──────────────────────────────┘
```

핵심 파일: `Layout.tsx` (상태 허브) → `ChatModal.tsx` (채팅) → `useChat.ts` (채팅 로직)

---

## 핵심 데이터 흐름

```
유저 입력 → useChat.sendMessage()
  → ensureConversation() (DB 세션 생성)
  → addMessage() (유저 메시지 DB 저장)
  → [일반방] buildSystemPrompt() + sendChatMessage() → AI 응답
  → [회의실] 모디 시작 → AI 순차 발언 → 모디 정리
  → extractActionItems() (액션 아이템 자동 추출)
  → addMessage() (AI 메시지 DB 저장)

새 대화 → startNewChat()
  → summarizeConversation() (백그라운드 요약 저장)
  → conversationId 리셋
  → 다음 대화 시 시스템프롬프트에 요약 자동 주입
```

---

## 환경 변수 (.env)

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ANTHROPIC_API_KEY=
VITE_OPENAI_API_KEY=
VITE_PERPLEXITY_API_KEY=
```

---

## 코딩 컨벤션

### 파일 상단 주석 (필수)
```typescript
/**
 * @file src/components/RoomCard.tsx
 * @description 오피스 방 카드 컴포넌트
 * - 각 방을 카드 형태로 표시
 * - 클릭 시 ChatModal 열기
 */
```

### 네이밍
- 컴포넌트: PascalCase (`RoomCard.tsx`)
- 훅: camelCase + use (`useChat.ts`)
- 서비스: camelCase + .service (`tasks.service.ts`)
- 유틸: camelCase (`dateCalc.ts`)

### DB status 매핑
```
프론트 'pending' ↔ DB 'todo'
프론트 'in_progress' ↔ DB 'in_progress'
프론트 'completed' ↔ DB 'done'
→ tasks.service.ts의 toDbStatus() / fromDbStatus() 사용
```

---

## 디자인 가이드

> 상세: [docs/DESIGN.md](docs/DESIGN.md)

- **메인 컬러**: 보라 계열 (`#a855f7` primary-500)
- **방별 컬러**: 전략실(연보라) / 마케팅(연핑크) / 개발(연라임) / 리서치(연브라운) / 회의실(연노랑)
- **border-radius**: 카드 `rounded-3xl` / 버튼 `rounded-2xl`
- **반응형**: 모바일 1열 / sm 2열 / lg 3열

---

## 문서 안내

| 문서 | 내용 |
|------|------|
| `CLAUDE.md` (이 파일) | 프로젝트 전체 개요, 기술 스택, DB 스키마, 컨벤션 |
| `docs/ARCHITECTURE.md` | 폴더 구조 + 각 파일 역할 상세 |
| `docs/DESIGN.md` | 디자인 가이드 (컬러, 폰트, 스타일) |
| `docs/FEATURE_ROADMAP.md` | **기능 구현 상세 가이드** — 완료된 기능 + 미구현 로드맵 |
| `NOTION.md` | 노션 워크스페이스 구조 (연동 참고용) |

---

## 소통 규칙

- **모든 대화는 한글로** — 질문, 확인, 설명 등 모든 소통을 한글로
- 코드 내 변수명/함수명은 영어, 사용자와의 대화는 항상 한글

---

*Claude Code가 이 파일을 참고해서 코딩합니다.*

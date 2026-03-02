# Sol AI Office — 신규 기능 구현 가이드

> **최종 업데이트:** 2026-03-02
> **용도:** Claude Code / Cursor에서 기능 구현 시 참고 문서
> **전제:** 현재 핵심 기능(AI 채팅, 할일, 일정, 인사이트, 스터디, 기록, 프로젝트/목표/KPI, 대시보드, 요약) 개발 완료 상태

---

## 목차

| # | 기능 | 난이도 | 예상 수정 파일 수 |
|---|------|--------|------------------|
| 1 | [회의실 멀티 AI 토론](#1-회의실-멀티-ai-토론) | ★★★ | 6~8개 |
| 2 | [AI 대화 → 액션 아이템 자동 추출](#2-ai-대화--액션-아이템-자동-추출) | ★★☆ | 4~5개 |
| 3 | [모디의 아침 브리핑](#3-모디의-아침-브리핑) | ★★☆ | 5~6개 |
| 4 | [주간 회고 자동화](#4-주간-회고-자동화) | ★★☆ | 4~5개 |
| 5 | [콘텐츠 캘린더 (마케팅용)](#5-콘텐츠-캘린더-마케팅용) | ★☆☆ | 2~3개 |
| 6 | [AI 장기 기억 (Context Memory)](#6-ai-장기-기억-context-memory) | ★★★ | 5~6개 |
| 7 | [알림/리마인더 (Push)](#7-알림리마인더-push) | ★★★ | 7~10개 |

---

## 1. 회의실 멀티 AI 토론 ✅ 완료

### 구현 완료 상태

| 항목 | 상태 |
|------|------|
| 멀티 AI 순차 API 호출 (모디→플래니→마키→데비→서치→모디) | ✅ 완료 |
| 참가자 선택 UI (체크박스로 AI 선택/해제) | ✅ 완료 |
| 각 AI별 프로필 이미지 + 이름 + accent color 표시 | ✅ 완료 |
| 모디 시작 멘트 (1-2문장, maxTokens: 100) | ✅ 완료 |
| 모디 정리 (회의 요약 포맷, maxTokens: 2048) | ✅ 완료 |
| 후속 대화 (모디 라우터 → 적절한 AI 1명 호출) | ✅ 완료 |
| "새 회의 시작" 버튼 + 💛 구분선 (DB 저장) | ✅ 완료 |
| 인사말 제거 (시작/마무리는 친근한 대화체, 중간은 깔끔) | ✅ 완료 |
| Perplexity API 메시지 교대 규칙 준수 | ✅ 완료 |
| Perplexity [n] 출처 → 하단 링크 변환 | ✅ 완료 |
| 마크다운 링크 새 탭 열기 | ✅ 완료 |
| 채팅 시간 표시 (오전/오후) + 날짜 구분선 | ✅ 완료 |
| 이전 대화 DB 복원 (AI 프로필 이미지 매핑) | ✅ 완료 |
| 회의록 자동 저장 (meeting_notes 테이블) | ❌ 미구현 (Phase 2) |

### 구현된 파일

| 파일 | 역할 |
|------|------|
| `src/services/meeting.service.ts` | 회의 프롬프트 빌드 (시작/참가자/정리/라우터/후속) + 참가자 파싱 |
| `src/hooks/useChat.ts` | 회의 흐름 제어 (`sendMeetingMessage`, `sendMeetingFollowUp`, `startNewMeeting`) |
| `src/components/ChatModal.tsx` | 참가자 선택 UI, 날짜/회의 구분선, 로딩 인디케이터 |
| `src/components/MessageBubble.tsx` | AI별 아바타/이름/color, 시간 표시, 마크다운 링크 새 탭 |
| `src/services/chatApi.ts` | roomId별 API 자동 분기 + Perplexity 출처 처리 |
| `public/prompts/meeting.md` | 회의실 시스템 프롬프트 |

### 회의 흐름

```
[첫 번째 메시지] 풀 사이클
  → 모디 시작 (100토큰) → 선택된 AI 순차 발언 (각 600토큰) → 모디 정리 (2048토큰)

[후속 메시지] 모디 라우터
  → 모디가 가장 적절한 AI 1명 선정 (150토큰) → 해당 AI만 답변 (600토큰)

[새 회의 시작 버튼]
  → 💛 구분선 삽입 (DB 저장) → 다음 메시지부터 다시 풀 사이클

[재입장 시]
  → DB에서 이전 대화 복원 (AI_IMAGE_MAP으로 프로필 매핑)
  → meetingRoundDone=true → 후속 모드로 자동 전환
```

### Perplexity API 주의사항 (서치)

- user/assistant 메시지가 반드시 교대해야 함
- 마지막 메시지는 반드시 user 역할
- 이전 발언들은 하나의 assistant 메시지로 합쳐서 전송
- 응답의 `citations` 배열을 파싱하여 `[n]` 마커 제거 → 하단 출처 링크로 변환

---

## 2. AI 대화 → 액션 아이템 자동 추출

### 왜 필요한가

AI와 대화하면서 "이거 해야지" 하는 내용이 나오는데, 지금은 수동으로 SaveModal에서 저장해야 한다. AI가 답변할 때 **할일/일정을 자동 감지**해서 "이거 추가할까요?" 하면, 대화의 인사이트가 실제 행동으로 전환되는 비율이 크게 올라간다.

### 현재 상태

| 항목 | 상태 |
|------|------|
| SaveModal (수동 저장: 할일/인사이트) | ✅ `src/components/SaveModal.tsx` |
| MessageBubble ⋯ 메뉴 → 할일 추가 / 인사이트 저장 | ✅ `src/components/MessageBubble.tsx` |
| ChatModal에서 SaveModal 연동 + DB 저장 | ✅ `src/components/ChatModal.tsx` |
| 대화 컨텍스트 자동 저장 (`saveConversationContext`) | ✅ `src/components/ChatModal.tsx` |
| AI 응답 자동 파싱 | ❌ 없음 |
| 자동 추출 UI (인라인 제안 칩) | ❌ 없음 |

### 구현 방법

#### 2-1. 추출 흐름

```
AI 응답 수신 (useChat의 sendNormalMessage / sendMeetingMessage)
  → extractActionItems(response) 로컬 파싱 (정규식 기반)
  → ChatMessage에 extractedActions 필드로 저장
  → MessageBubble 하단에 제안 칩 표시
  → 유저가 칩 클릭 → ChatModal의 handleSaveRequest 호출
  → SaveModal 열림 (type + title pre-fill)
  → 저장 or 무시
```

#### 2-2. 추출 로직

**`src/utils/actionExtractor.ts`** — 신규 파일

```typescript
export interface ExtractedAction {
  type: 'task' | 'schedule' | 'insight';
  title: string;
  date?: string;
  priority?: 'high' | 'medium' | 'low';
  originalText: string;
}

export function extractActionItems(text: string): ExtractedAction[] {
  const actions: ExtractedAction[] = [];

  // 1. 회의 액션 아이템 패턴 (모디 정리에서 추출)
  //    "- [ ] 담당: 플래니 — 사주궁합 프롬프트 마무리 — 기한: 3월 5일"
  const meetingActionRegex = /[-•]\s*\[?\s*\]?\s*담당:\s*\S+\s*[—-]\s*(.+?)\s*[—-]\s*기한:\s*(.+)/gm;

  // 2. 일반 할일 패턴
  //    "~하기", "~완료", "~작성", "~확인" 등으로 끝나는 항목
  const taskPatterns = [
    /[-•]\s*\[?\s*\]?\s*(.+(?:하기|완료|작성|제출|확인|준비|마무리|시작))/gm,
    /(?:→|▶)\s*(.+(?:하기|필요|해야|하세요|해보세요))/gm,
  ];

  // 3. 날짜 감지 (추출된 할일에 날짜 매칭)
  const datePattern = /(\d{1,2}월\s*\d{1,2}일|\d{1,2}\/\d{1,2}|이번\s*주|다음\s*주|내일|모레|오늘)/;

  // 4. 긴급도 감지
  const highPriorityPattern = /긴급|급|ASAP|즉시|당장|시급/;

  // 패턴 매칭 → 중복 제거 → 최대 5개 반환
  return actions.slice(0, 5);
}
```

#### 2-3. 타입 확장

```typescript
// src/types.ts — ChatMessage에 추가
export interface ChatMessage {
  // ... 기존 필드
  extractedActions?: ExtractedAction[];  // 자동 추출된 액션 아이템
}
```

#### 2-4. UI 구현

**`src/components/MessageBubble.tsx`** — 액션 제안 칩 추가

```
AI 메시지 하단 (markdown-body 아래):
┌──────────────────────────────────────────┐
│  [AI 메시지 내용]                         │
│                                          │
│  [✅ 할일: 사주궁합 프롬프트 마무리]        │
│  [✅ 할일: 3/5 와디즈 검수]               │
└──────────────────────────────────────────┘

- 칩은 작고 연한 스타일 (bg-primary-50, text-primary-600)
- 클릭 시 onSave('task', message) 호출 + title pre-fill
- 이미 저장된 항목은 체크 표시 (✅)
```

**`src/components/ChatModal.tsx`** — 칩 클릭 핸들러

```typescript
// handleSaveRequest에 title pre-fill 파라미터 추가
const handleSaveRequest = (type: SaveType, message: ChatMessage, prefilledTitle?: string) => {
  setSaveModal({ type, message, room, prefilledTitle });
};
```

#### 2-5. 수정할 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/utils/actionExtractor.ts` | **신규** — 정규식 기반 추출 로직 |
| `src/types.ts` | ChatMessage에 `extractedActions` 필드 추가 |
| `src/hooks/useChat.ts` | AI 응답 후 `extractActionItems()` 호출하여 메시지에 첨부 |
| `src/components/MessageBubble.tsx` | 액션 칩 UI 렌더링 + 클릭 핸들러 |
| `src/components/ChatModal.tsx` | 칩 클릭 → SaveModal 연결 (title pre-fill) |
| `src/components/SaveModal.tsx` | `prefilledTitle` prop 지원 |

#### 2-6. 의존성

- 없음 (독립적으로 구현 가능)
- 회의 모디 정리 포맷의 "액션 아이템" 섹션과 정규식 매칭 연계

---

## 3. 모디의 아침 브리핑

### 왜 필요한가

매일 앱을 열게 만드는 **킬러 기능**. "오늘 뭘 해야 하지?"를 고민하는 시간을 줄여주고, 모디가 비서처럼 하루를 정리해주면 실행력이 올라간다. 구독 앱에서 DAU(일일 활성 사용자)를 올리는 핵심 장치가 된다.

### 현재 상태

| 항목 | 상태 |
|------|------|
| 대시보드 위젯 (일정/긴급업무/인사이트/스터디) | ✅ 있음 |
| 모디 비서 채팅 (ModiFAB) | ✅ 있음 |
| 오늘 요약 기능 (비서방에서 수동 실행) | ✅ 있음 |
| 자동 아침 브리핑 | ❌ 없음 |

### 구현 방법

#### 3-1. 브리핑 카드 UI

홈페이지(`/`) 대시보드 최상단, 기존 4개 위젯 위에 풀와이드로 배치:

```
┌─────────────────────────────────────────────────────────────┐
│  💛 모디의 오늘 브리핑                    3월 2일 (일)       │
│                                                             │
│  📅 오늘 일정 2개                                           │
│     • 14:00 운명랩 디자인 미팅                               │
│     • 18:00 PTE 콘텐츠 촬영                                 │
│                                                             │
│  🔥 긴급 할일 3개                                           │
│     • 사주궁합 프롬프트 완성 (D-2)                           │
│     • 와디즈 리워드 구성안 (D-5)                             │
│     • 인스타 릴스 편집 (오늘 마감)                            │
│                                                             │
│  📊 프로젝트 진행률                                         │
│     • 🔮 운명랩 70% ████████░░ — 와디즈 펀딩                │
│     • ✨ 쏠닝포인트 42% ████░░░░░░ — 인스타 팔로워          │
│                                                             │
│  💡 오늘의 한마디                                            │
│  "사주궁합 프롬프트부터 마무리하면 와디즈 준비가 빨라질 거예요!" │
│                                                             │
│           [접기]  [모디에게 물어보기]                          │
└─────────────────────────────────────────────────────────────┘
```

#### 3-2. DB 스키마

```sql
CREATE TABLE daily_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  ai_comment TEXT NOT NULL,            -- 모디의 오늘의 한마디
  briefing_data JSONB,                 -- 생성 시점의 스냅샷 (선택)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE daily_briefings DISABLE ROW LEVEL SECURITY;
```

#### 3-3. 데이터 흐름

```
홈페이지 진입
  → useBriefing() 훅 실행
  → 1. 오늘 일정 로드 (useSchedules 재활용)
  → 2. 긴급 할일 로드 (useTasks + getUrgentTasks 재활용)
  → 3. 프로젝트 진행률 로드 (useProjects + useGoals로 계산)
  → 4. 모디 한마디 로드 (daily_briefings 테이블 조회)
     → 캐시 있음 → 바로 표시
     → 캐시 없음 → Claude API 호출 → DB 저장 → 표시
```

#### 3-4. 브리핑 서비스

**`src/services/briefing.service.ts`** — 신규 파일

```typescript
export interface BriefingData {
  schedules: { title: string; time: string; project?: string }[];
  urgentTasks: { title: string; daysLeft: number; urgencyType: string }[];
  projectProgress: { name: string; emoji: string; percent: number; goalTitle: string }[];
  aiComment: string;
}

// DB에서 오늘 AI 한마디 조회
async function fetchTodayComment(userId: string): Promise<string | null>

// 모디에게 한마디 생성 요청 (secretary 모델, maxTokens: 200)
async function generateModiComment(briefingContext: string): Promise<string>

// AI 한마디 DB 저장 (upsert - 하루 1회)
async function saveComment(userId: string, comment: string): Promise<void>

// 전체 브리핑 로드 (일정/할일/목표는 기존 서비스 재활용)
export async function loadBriefing(): Promise<BriefingData>
```

모디 한마디 프롬프트:
```
당신은 모디입니다. 아래 데이터를 보고 오늘 하루를 위한
격려+우선순위 제안을 1-2문장으로 해주세요.
따뜻하고 실용적으로, 가장 급한 것 1개를 콕 집어서 추천.

오늘 일정: ...
긴급 할일: ...
프로젝트 진행률: ...
어제 대화 요약: ...
```

#### 3-5. 브리핑 훅

**`src/hooks/useBriefing.ts`** — 신규 파일

```typescript
export function useBriefing() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBriefing().then(setBriefing).finally(() => setLoading(false));
  }, []);

  const refresh = async () => {
    setLoading(true);
    // forceRefresh: true → AI 한마디 재생성
    const data = await loadBriefing(true);
    setBriefing(data);
    setLoading(false);
  };

  return { briefing, loading, refresh };
}
```

#### 3-6. 브리핑 카드 컴포넌트

**`src/components/BriefingCard.tsx`** — 신규 파일

```
구성:
- 노란 파스텔 배경 (bg-amber-50 border-amber-100)
- 모디 아바타 + "오늘 브리핑" 헤더 + 날짜
- 3개 섹션: 일정 / 긴급 할일 / 프로젝트 진행률
- 모디 한마디 (로딩 중이면 스켈레톤)
- [접기] 토글 + [모디에게 물어보기] 버튼
- 접힌 상태에서는 모디 한마디만 1줄 표시
- 접기 상태는 localStorage에 저장
```

#### 3-7. DashboardWidgets 통합

```typescript
// src/components/DashboardWidgets.tsx
// 기존 4개 위젯 위에 BriefingCard 추가

export function DashboardWidgets() {
  return (
    <div className="space-y-4">
      <BriefingCard />           {/* 풀와이드 브리핑 카드 */}
      <div className="grid ..."> {/* 기존 4개 위젯 */}
        ...
      </div>
    </div>
  );
}
```

#### 3-8. 수정할 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/services/briefing.service.ts` | **신규** — AI 한마디 생성/조회/캐싱 + 데이터 수집 |
| `src/hooks/useBriefing.ts` | **신규** — 브리핑 데이터 로드 훅 |
| `src/components/BriefingCard.tsx` | **신규** — 브리핑 카드 UI (접기/펼치기) |
| `src/components/DashboardWidgets.tsx` | BriefingCard import + 기존 위젯 위 배치 |

#### 3-6. 의존성

- 기존 `context.ts`의 데이터 수집 패턴 재활용
- 기존 `summary.service.ts`의 Claude 호출 패턴 재활용

---

## 4. 주간 회고 자동화

### 왜 필요한가

기록(Records)에 주간 회고 템플릿이 이미 있지만, **빈 칸을 채우는 게 귀찮아서 안 하게 된다**. AI가 한 주 데이터를 모아 초안을 써주면, 수정만 하면 되니까 실제로 회고를 하게 된다. 주간 회고는 성장의 복리 효과를 만드는 핵심 습관이다.

### 현재 상태

| 항목 | 상태 |
|------|------|
| Records 페이지 → 주간 회고 템플릿 | ✅ 있음 |
| 주간 회고 폼 (achievements, regrets, nextGoals, lessons) | ✅ 있음 |
| AI 자동 초안 생성 | ❌ 없음 |

### 구현 방법

#### 4-1. 회고 흐름

```
매주 일요일 (또는 유저가 원할 때)
  → "AI 회고 초안 생성" 버튼 클릭
  → 이번 주 데이터 수집:
    - 완료한 할일 목록
    - 달성한 KPI 변화
    - 모든 방 대화 요약
    - 이번 주 일정 내역
    - 작성한 기록/인사이트
  → Claude API로 초안 생성
  → 주간 회고 폼에 pre-fill
  → 유저가 수정 후 저장
```

#### 4-2. 데이터 수집 범위

```typescript
// src/services/weeklyReview.service.ts — 신규 파일

interface WeeklyData {
  completedTasks: { title: string; project: string; completedAt: string }[];
  kpiChanges: { name: string; before: number; after: number; unit: string }[];
  conversationSummaries: { room: string; summary: string }[];
  schedules: { title: string; date: string }[];
  insights: { title: string; content: string }[];
  records: { type: string; preview: string }[];
}

async function collectWeeklyData(weekStart: Date, weekEnd: Date): Promise<WeeklyData> {
  const userId = await getCurrentUserId();

  const [tasks, kpiLogs, summaries, schedules, insights, records] = await Promise.all([
    // 이번 주 완료된 할일
    supabase.from('tasks')
      .select('title, project, updated_at')
      .eq('user_id', userId)
      .eq('status', 'done')
      .gte('updated_at', weekStart.toISOString())
      .lte('updated_at', weekEnd.toISOString()),

    // KPI 로그 (이번 주)
    supabase.from('kpi_logs')
      .select('*, kpis(name, unit)')
      .eq('user_id', userId)
      .gte('date', weekStart.toISOString().split('T')[0])
      .lte('date', weekEnd.toISOString().split('T')[0]),

    // 대화 요약
    supabase.from('conversation_summaries')
      .select('room_id, summary, date')
      .eq('user_id', userId)
      .gte('date', weekStart.toISOString().split('T')[0])
      .lte('date', weekEnd.toISOString().split('T')[0]),

    // 일정
    supabase.from('schedules')
      .select('title, date')
      .eq('user_id', userId)
      .gte('date', weekStart.toISOString().split('T')[0])
      .lte('date', weekEnd.toISOString().split('T')[0]),

    // 인사이트
    supabase.from('insights')
      .select('title, content')
      .eq('user_id', userId)
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString()),

    // 기록
    supabase.from('journals')
      .select('type, title, created_at')
      .eq('user_id', userId)
      .gte('created_at', weekStart.toISOString())
      .lte('created_at', weekEnd.toISOString()),
  ]);

  // ... 데이터 가공 후 반환
}
```

#### 4-3. AI 초안 생성

```typescript
async function generateWeeklyReview(data: WeeklyData): Promise<WeeklyReviewDraft> {
  const prompt = `
당신은 모디입니다. Sol님의 이번 주 데이터를 바탕으로 주간 회고 초안을 작성해주세요.

## 이번 주 데이터
- 완료한 할일: ${JSON.stringify(data.completedTasks)}
- KPI 변화: ${JSON.stringify(data.kpiChanges)}
- AI 대화 요약: ${JSON.stringify(data.conversationSummaries)}
- 주요 일정: ${JSON.stringify(data.schedules)}
- 새 인사이트: ${JSON.stringify(data.insights)}

## 출력 형식 (JSON)
{
  "achievements": ["이번 주 잘한 점 3-5개"],
  "regrets": ["아쉬운 점 2-3개"],
  "nextGoals": ["다음 주 집중할 것 3-5개"],
  "lessons": ["배운 점/깨달은 점 2-3개"],
  "energyLevel": 1~5,
  "mood": "이모지"
}
`;

  const response = await sendChatMessage(prompt, [], 'secretary', 1000);
  return JSON.parse(response);
}
```

#### 4-4. UI 연동

```
RecordsPage에서 "주간 회고" 탭 선택 시:
  → 기존 빈 폼 대신 "🤖 AI 초안 생성" 버튼 추가
  → 클릭 → 로딩 → 폼에 pre-fill
  → 유저가 수정 가능
  → 저장은 기존 useRecords.add() 그대로 사용
```

#### 4-5. 수정할 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/services/weeklyReview.service.ts` | **신규** — 데이터 수집 + AI 초안 생성 |
| `src/pages/RecordsPage.tsx` | "AI 초안 생성" 버튼 추가 |
| `src/components/RecordForm.tsx` | AI 초안 pre-fill 지원 |
| `public/prompts/modi.md` | 주간 회고 생성 가이드 추가 |

#### 4-6. 의존성

- 대화 요약 기능 (`conversation_summaries` 테이블)이 활성화되어 있어야 AI 초안 품질이 좋음
- KPI 로그가 쌓여 있어야 진행률 비교 가능

---

## 5. 콘텐츠 캘린더 (마케팅용)

### 왜 필요한가

쏠닝포인트 인스타 관리, 운명랩 블로그/릴스 등 **콘텐츠 발행 일정**을 체계적으로 관리해야 한다. 별도 페이지를 만들기보다, **기존 할일 시스템에 "콘텐츠" 카테고리를 추가**하고 전용 필터/뷰를 제공하는 것이 효율적이다.

### 현재 상태

| 항목 | 상태 |
|------|------|
| TasksPage — 카테고리 필터 | ✅ 있음 (커스텀 카테고리 지원) |
| TasksPage — 프로젝트 필터 | ✅ 있음 |
| TasksPage — 칸반 뷰 | ✅ 있음 |
| 콘텐츠 전용 필터/뷰 | ❌ 없음 |
| 플랫폼별 구분 | ❌ 없음 |
| 마키 연동 (콘텐츠 아이디어 자동 생성) | ❌ 없음 |

### 구현 방법

#### 5-1. 기존 할일 시스템 확장 (별도 테이블 X)

```
기존 tasks 테이블의 category 필드를 활용:
  - category: '콘텐츠' (새 기본 카테고리로 추가)
  - tags: ['인스타', '릴스'] 또는 ['블로그', 'SEO'] 등으로 플랫폼 구분
  - notes: 콘텐츠 기획 내용
```

#### 5-2. TasksPage에 "콘텐츠" 뷰 모드 추가

```
현재 뷰 모드: list | kanban
추가 뷰 모드: list | kanban | content

"콘텐츠" 뷰 선택 시:
  - 자동으로 category === '콘텐츠' 필터 적용
  - 캘린더 형태로 표시 (주간/월간 그리드)
  - 각 셀에 해당 날짜의 콘텐츠 할일 카드 표시
  - 플랫폼별 아이콘: 📸 인스타 / 📝 블로그 / 🎬 유튜브 / 🎵 틱톡
```

#### 5-3. 마키 연동 (콘텐츠 아이디어 생성)

```
콘텐츠 뷰에서 "🤖 마키에게 아이디어 받기" 버튼:
  → 마키 API 호출 (GPT-4o)
  → 프롬프트: "이번 주 콘텐츠 3개 제안해줘. 프로젝트: 쏠닝포인트, 플랫폼: 인스타"
  → 결과를 할일로 바로 추가 가능
```

#### 5-4. 수정할 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/pages/TasksPage.tsx` | viewMode에 'content' 추가, 콘텐츠 캘린더 그리드 |
| `src/components/ContentCalendarView.tsx` | **신규** — 주간/월간 캘린더 그리드 컴포넌트 |
| `src/data.ts` | 기본 카테고리에 '콘텐츠' 추가 |

#### 5-5. 의존성

- 없음 (기존 tasks 시스템 위에 뷰만 추가)

---

## 6. AI 장기 기억 (Context Memory)

### 왜 필요한가

지금은 매 대화가 독립적이다. 플래니에게 "와디즈 리워드 3안으로 정했잖아"라고 해도 모른다. **프로젝트별 핵심 결정사항/맥락을 AI가 기억**하면 대화 품질이 완전히 달라진다. 이건 다른 AI 챗봇과의 결정적 차별점이 될 수 있다.

### 현재 상태

| 항목 | 상태 |
|------|------|
| 시스템 프롬프트에 목표/KPI 주입 (`context.ts`) | ✅ 있음 |
| 최근 7일 대화 요약 주입 (`context.ts`) | ✅ 있음 |
| 프로젝트별 핵심 메모/결정사항 | ❌ 없음 |
| 유저가 직접 "이거 기억해" 명령 | ❌ 없음 |

### 구현 방법

#### 6-1. 기억 저장 방식 (2가지 트리거)

```
A. 자동 저장 — AI 대화 중 중요 결정이 나오면 자동 감지
B. 수동 저장 — 유저가 "이거 기억해" 또는 📌 버튼 클릭
```

#### 6-2. DB 스키마

```sql
CREATE TABLE ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  room_id TEXT,              -- 어떤 방에서 생성됐는지 (null = 전체)
  project TEXT,              -- 관련 프로젝트 (null = 전체)
  category TEXT NOT NULL,    -- 'decision', 'preference', 'context', 'fact'
  content TEXT NOT NULL,     -- 기억할 내용 (1-2문장)
  source_message_id UUID,    -- 원본 메시지 참조
  is_active BOOLEAN DEFAULT TRUE,  -- 비활성화 가능 (삭제 대신)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스: 방별/프로젝트별 빠른 조회
CREATE INDEX idx_memories_room ON ai_memories(user_id, room_id, is_active);
CREATE INDEX idx_memories_project ON ai_memories(user_id, project, is_active);
```

#### 6-3. 기억 주입 (context.ts 수정)

```typescript
// src/services/context.ts — buildSystemPrompt() 수정

// 기존 context 빌딩 과정에 추가:
// 7. AI 장기 기억 주입
const memories = await fetchActiveMemories(userId, roomId);

if (memories.length > 0) {
  context += `\n## 📌 기억해야 할 것들\n`;
  context += `아래는 Sol님이 기억해달라고 한 내용 또는 이전 대화에서 나온 중요한 결정사항입니다.\n`;
  context += `이 내용을 항상 인지하고 대화해주세요.\n\n`;

  // 프로젝트별 그룹핑
  const grouped = groupByProject(memories);
  for (const [project, mems] of Object.entries(grouped)) {
    context += `### ${project || '전체'}\n`;
    mems.forEach(m => {
      context += `- [${m.category}] ${m.content}\n`;
    });
  }
}

async function fetchActiveMemories(userId: string, roomId: string) {
  const { data } = await supabase
    .from('ai_memories')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or(`room_id.eq.${roomId},room_id.is.null`)  // 해당 방 + 전체 메모리
    .order('created_at', { ascending: false })
    .limit(30);  // 토큰 절약을 위해 최근 30개

  return data ?? [];
}
```

#### 6-4. 자동 감지 (선택적)

```typescript
// AI 응답 후, 결정사항이 포함되어 있으면 자동으로 기억 후보 생성
// 유저에게 "이 결정을 기억할까요?" 확인 후 저장

// 감지 키워드: "결정", "확정", "이걸로 가자", "이 방향으로", "합의"
```

#### 6-5. 관리 UI

```
설정 페이지 또는 사이드바에 "AI 기억 관리" 섹션:
  - 저장된 기억 목록 (프로젝트별 그룹)
  - 각 기억 수정/삭제/비활성화
  - 새 기억 수동 추가
```

#### 6-6. 수정할 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/services/memory.service.ts` | **신규** — 기억 CRUD |
| `src/hooks/useMemories.ts` | **신규** — 기억 관리 훅 |
| `src/services/context.ts` | buildSystemPrompt()에 기억 주입 추가 |
| `src/components/MessageBubble.tsx` | 📌 "기억해" 버튼 추가 |
| `src/components/MemoryManager.tsx` | **신규** — 기억 관리 UI |
| `src/pages/SettingsPage.tsx` | AI 기억 관리 섹션 연결 |

#### 6-7. 주의사항

- 기억이 너무 많으면 시스템 프롬프트 토큰이 초과됨 → 최근 30개 + 프로젝트 관련만 필터
- 오래된 기억은 자동 비활성화 고려 (90일 이상)
- 기억 내용은 1-2문장으로 요약된 형태로 저장 (긴 원문 X)

#### 6-8. 의존성

- 없음 (독립적으로 구현 가능)
- 다만 [기능 2: 액션 아이템 추출]과 연계하면 시너지 (결정사항 자동 감지 → 기억 저장)

---

## 7. 알림/리마인더 (Push)

### 왜 필요한가

일정에 알림 옵션이 있지만 실제 알림이 안 온다. 사업 미팅을 놓치거나 마감을 잊는 건 실질적인 매출 손실이다. 특히 한국 유저에게는 **카카오톡 알림**이 가장 자연스러운 채널이다.

### 현재 상태

| 항목 | 상태 |
|------|------|
| schedules.reminder 필드 (10min, 30min, 1hour) | ✅ DB에 있음 |
| 실제 알림 전송 | ❌ 없음 |
| PWA Service Worker | ❌ 없음 |
| 카카오톡 연동 | ❌ 없음 |

### 알림 채널 비교

| 채널 | 장점 | 단점 | 비용 |
|------|------|------|------|
| **PWA Push** | 무료, 웹 표준 | iOS 지원 제한적, 허용 필요 | 무료 |
| **카카오톡 알림톡** | 한국인 도달률 최고, 신뢰감 | 사업자 등록 필요, 유료 | 건당 ~8원 |
| **카카오톡 나에게 보내기** | 무료, 간편 | 본인만 가능, API 제한 | 무료 |
| **슬랙 웹훅** | 무료, 쉬운 구현 | 슬랙 안 쓰는 사람 많음 | 무료 |
| **이메일** | 무료, 보편적 | 확인 안 함, 느림 | 무료 |

### 구현 방법 (단계별)

#### Phase 1: PWA Push (즉시 구현 가능, 무료)

```
장점: 별도 인증 없이 바로 구현 가능
단점: iOS Safari 제한, 유저가 "허용" 해야 함
```

**Step 1: PWA 기본 설정**

```json
// public/manifest.json — 신규 파일
{
  "name": "Sol AI Office",
  "short_name": "AI Office",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#faf5ff",
  "theme_color": "#a855f7",
  "icons": [
    { "src": "/images/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/images/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

```typescript
// public/sw.js — Service Worker (신규)
self.addEventListener('push', function(event) {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/images/modi.png',
      badge: '/images/icon-192.png',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

**Step 2: 알림 스케줄러 (Supabase Edge Function)**

```typescript
// supabase/functions/send-reminders/index.ts — 신규

// Cron으로 1분마다 실행
// 1. 현재 시간 기준으로 알림 시간이 된 일정 조회
// 2. 해당 유저의 push subscription 조회
// 3. web-push로 알림 전송

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

Deno.serve(async () => {
  const now = new Date();

  // reminder가 설정된 일정 중 알림 시간이 된 것 조회
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*, user_id')
    .not('reminder', 'eq', 'none')
    .eq('reminder_sent', false)
    .lte('reminder_at', now.toISOString());  // reminder_at = date - reminder 시간

  for (const schedule of schedules) {
    // push subscription 조회 후 전송
    await sendPushNotification(schedule.user_id, {
      title: `📅 ${schedule.title}`,
      body: `${schedule.reminder} 후 시작`,
      url: '/schedules',
    });

    // 중복 방지
    await supabase
      .from('schedules')
      .update({ reminder_sent: true })
      .eq('id', schedule.id);
  }
});
```

**Step 3: DB 추가 필드**

```sql
-- schedules 테이블에 추가
ALTER TABLE schedules ADD COLUMN reminder_at TIMESTAMPTZ;  -- 알림 발송 시각
ALTER TABLE schedules ADD COLUMN reminder_sent BOOLEAN DEFAULT FALSE;

-- push subscription 저장
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subscription JSONB NOT NULL,  -- { endpoint, keys: { p256dh, auth } }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subscription->>'endpoint')
);
```

#### Phase 2: 카카오톡 나에게 보내기 (권장 추가 채널)

```
사업자 등록 없이 가능한 방법:
  1. 카카오 로그인 연동 (OAuth)
  2. 카카오톡 "나에게 보내기" API 사용
  3. 유저 본인에게만 메시지 전송 (1인 사업자에게 충분)
```

```typescript
// 카카오 나에게 보내기 API
const sendKakaoReminder = async (accessToken: string, message: string) => {
  await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      template_object: JSON.stringify({
        object_type: 'text',
        text: message,
        link: { web_url: 'https://sol-ai-office.replit.app' },
        button_title: '앱에서 보기',
      }),
    }),
  });
};
```

**필요한 것:**
- 카카오 개발자 앱 등록
- 카카오 로그인 연동 (기존 Google OAuth와 병행)
- `talk_message` 동의 항목 추가

#### Phase 3: 카카오 알림톡 (상용화 시)

```
사업자 등록 + 카카오 비즈니스 채널 필요
장점: 유저가 카카오 로그인 안 해도 전화번호로 발송
비용: 건당 약 8원
상용화 이후 구독 유저에게 제공하는 프리미엄 기능으로 적합
```

#### 7-4. 알림 종류

```
1. 일정 리마인더: "14:00 운명랩 디자인 미팅 30분 전"
2. 할일 마감 알림: "사주궁합 프롬프트 완성 마감 D-1"
3. 아침 브리핑 알림: "☀️ 오늘의 브리핑이 준비됐어요" (모디 브리핑과 연계)
4. 주간 회고 리마인더: "이번 주 회고 작성할 시간이에요" (일요일 저녁)
5. 목표 체크: "이번 주 운명랩 목표 진행률: 70%" (주 1회)
```

#### 7-5. 수정할 파일

| 파일 | 변경 내용 |
|------|----------|
| `public/manifest.json` | **신규** — PWA 매니페스트 |
| `public/sw.js` | **신규** — Service Worker |
| `src/main.tsx` | SW 등록 + push 구독 로직 |
| `src/services/notification.service.ts` | **신규** — 알림 구독/발송 |
| `src/hooks/useNotification.ts` | **신규** — 알림 권한 관리 훅 |
| `src/pages/SettingsPage.tsx` | 알림 설정 UI (PWA/카카오 선택) |
| `src/hooks/useSchedules.ts` | reminder_at 자동 계산 로직 추가 |
| `supabase/functions/send-reminders/` | **신규** — Edge Function (cron) |

#### 7-6. 구현 순서 권장

```
1단계: PWA Push 기본 (무료, 2-3일)
  → manifest.json + sw.js + 알림 권한 요청 + push subscription 저장

2단계: Supabase Edge Function (1-2일)
  → 1분 간격 cron으로 알림 시간 체크 + push 발송

3단계: 카카오 나에게 보내기 (2-3일)
  → 카카오 OAuth 추가 + 나에게 보내기 API 연동

4단계: 카카오 알림톡 (상용화 후)
  → 사업자 등록 + 비즈니스 채널 + 알림톡 템플릿 승인
```

#### 7-7. 의존성

- [기능 3: 모디 아침 브리핑]과 연계 (브리핑 알림)
- [기능 4: 주간 회고]와 연계 (회고 리마인더)
- Supabase Edge Function 또는 외부 cron 서비스 필요

---

## 구현 우선순위 종합

```
Phase A (핵심 가치, 먼저 구현)
  ├── 1. 회의실 멀티 AI 토론  ← 앱의 핵심 차별점
  ├── 3. 모디 아침 브리핑     ← DAU 핵심 동력
  └── 2. 액션 아이템 추출     ← 대화→행동 전환율

Phase B (실행력 강화)
  ├── 4. 주간 회고 자동화     ← 성장의 복리 효과
  ├── 5. 콘텐츠 캘린더        ← 마케팅 실행력 (가장 쉬움)
  └── 6. AI 장기 기억         ← 대화 품질 차별화

Phase C (상용화 인프라)
  └── 7. 알림/리마인더        ← 리텐션 핵심 (PWA 먼저, 카톡은 나중에)
```

---

## 상용화 플랜 구조 (참고)

```
무료 플랜:
  - AI 대화 일 5회
  - 기본 할일/일정
  - 아침 브리핑 (텍스트만)

프로 플랜 (월 9,900원):
  - AI 대화 무제한
  - 멀티 AI 회의실
  - 액션 아이템 자동 추출
  - 아침 브리핑 + 주간 회고
  - 콘텐츠 캘린더
  - AI 장기 기억
  - PWA 알림

비즈니스 플랜 (월 19,900원, 추후):
  - 프로 전체 +
  - 매출/지출 관리
  - 고객/거래처 관리
  - 제품/판매 관리
  - 견적서/문서
  - 카카오톡 알림
  - 차트/리포트
```

---

*이 문서는 Claude Code / Cursor에서 각 기능 구현 시 참고합니다.*
*각 기능 구현 시작 전 이 문서의 해당 섹션을 읽고 진행하세요.*

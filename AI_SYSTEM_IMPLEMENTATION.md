# AI 대화 시스템 + 프로젝트 목표 메뉴 구현

## 현재 상황
- 프론트엔드 UI 완성
- Supabase 테이블 연동 중
- AI 프롬프트 파일: `docs/prompts/` (plani.md, maki.md, devi.md, searchi.md, modi.md, meeting.md)
- AI API 연동 및 프롬프트 적용 로직 아직 없음

---

## Part 1: 설정 메뉴 + 프로젝트 & 목표

### 1-1. 설정 메뉴 추가

**위치:** 상단 네비게이션 바 오른쪽 ⚙️ 아이콘 클릭

```
⚙️ 설정 아이콘 클릭 →

┌─────────────────────────────────────┐
│ ⚙️ 설정                             │
├─────────────────────────────────────┤
│ 📁 프로젝트 관리                    │
│ 🏷️ 카테고리/태그 관리               │
│ 🤖 AI 설정 (나중에)                 │
│ 🔔 알림 설정 (나중에)               │
│ 👤 계정 (나중에)                    │
└─────────────────────────────────────┘
```

### 1-2. 설정 > 프로젝트 관리

```
┌─────────────────────────────────────────────────────────────┐
│ 프로젝트 관리                                   [+ 추가]    │
├─────────────────────────────────────────────────────────────┤
│ ≡ 🔮 운명랩              우선순위 1    [편집] [삭제]       │
│ ≡ 📚 PTE                 우선순위 2    [편집] [삭제]       │
│ ≡ ✨ 쏠닝포인트           우선순위 3    [편집] [삭제]       │
│                                                             │
│ (드래그로 순서 변경)                                        │
└─────────────────────────────────────────────────────────────┘
```

**기능:**
- 프로젝트 추가/편집/삭제
- 드래그로 우선순위(순서) 변경
- 이모지, 이름, 설명 편집

### 1-3. 사이드바 프로젝트 클릭 → 프로젝트 상세

```
운명랩 클릭 →

┌─────────────────────────────────────────────────────────────┐
│ 🔮 운명랩                                          [편집]   │
│ 사주 리포트 자동화 서비스                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🎯 목표                                         [+ 목표]    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 와디즈 펀딩 1,000만원                    D-3 | 70%      │ │
│ │ ├── ✅ 신년운세 자동화                                  │ │
│ │ ├── 🔄 커플 궁합 프롬프트                               │ │
│ │ └── ⬜ 와디즈 오픈                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 📅 관련 일정                                                │
│ 📋 관련 할일                                                │
│ 💡 관련 인사이트                                            │
│ 💬 관련 대화                                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**기능:**
- 해당 프로젝트의 목표 + 마일스톤 표시
- 프로젝트와 연결된 일정/할일/인사이트/대화 필터링해서 표시
- 목표 추가/편집/삭제
- 마일스톤 추가/편집/삭제/완료 체크

### 1-4. (선택) 사이드바에 🎯 목표 현황 메뉴

```
사이드바:
├── 🎯 목표 현황  ← 새 메뉴 (전체 프로젝트 목표 한눈에)
├── 📅 일정
├── ✅ 할일
...
```

전체 프로젝트의 목표를 한 화면에서 볼 수 있는 대시보드 (선택사항)

### 1-5. 정리

| 위치 | 기능 |
|------|------|
| 사이드바 프로젝트 클릭 | 해당 프로젝트 상세 (목표, 관련 일정/할일/인사이트) |
| 설정 > 프로젝트 관리 | 프로젝트 추가/삭제/순서 변경 |
| (선택) 🎯 목표 현황 메뉴 | 전체 프로젝트 목표 한눈에 |

### 1-6. DB 테이블 추가 ✅ (Supabase에 추가 완료)

```sql
-- 1. goals 테이블 (프로젝트별 목표)
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  deadline DATE,
  status TEXT DEFAULT 'pending',  -- pending / in_progress / completed
  progress INTEGER DEFAULT 0,     -- 0-100
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. milestones 테이블 (목표별 마일스톤)
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending / in_progress / completed
  deadline DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. projects 테이블에 컬럼 추가
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- 4. 인덱스
CREATE INDEX idx_goals_project ON goals(project_id);
CREATE INDEX idx_milestones_goal ON milestones(goal_id);

-- 5. RLS 끄기 (개발 중)
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE milestones DISABLE ROW LEVEL SECURITY;
```

### 현재 Supabase 테이블 현황

**기존 테이블:**
- conversations, messages, conversation_summaries
- schedules, tasks, insights
- readings, reading_logs
- journals
- projects, options, daily_completions

**새로 추가됨:**
- goals ✅
- milestones ✅
- projects에 status, priority 컬럼 ✅

### 화면 레이아웃

```
┌─────────────────────────────────────────────────────────────┐
│ 🎯 프로젝트 & 목표                              [+ 프로젝트] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 🔮 운명랩                            우선순위 1 | 진행중     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 사주 리포트 자동화 서비스                               │ │
│ │                                                         │ │
│ │ 🎯 와디즈 펀딩 1,000만원              D-3 | 70%         │ │
│ │ ├── ✅ 신년운세 자동화                                  │ │
│ │ ├── 🔄 커플 궁합 프롬프트 (80%)                        │ │
│ │ └── ⬜ 와디즈 오픈                                      │ │
│ │                                          [+ 목표 추가]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 📚 PTE                               우선순위 2 | 진행중     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ PTE 한국어 학습 플랫폼                                  │ │
│ │                                                         │ │
│ │ 🎯 구독제 런칭                        5-6월 | 20%       │ │
│ │ ├── ⬜ 결제 시스템 연동                                 │ │
│ │ └── ⬜ 베타 테스트                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 기능
- 프로젝트 CRUD (이름, 이모지, 설명, 상태, 우선순위)
- 목표 CRUD (프로젝트 하위, 제목, 마감일, 상태, 진행률)
- 마일스톤 CRUD (목표 하위, 제목, 상태, 마감일)
- 마일스톤 완료시 목표 진행률 자동 계산

---

## Part 2: AI 대화 시스템 구현

### API 설정

```env
# .env에 추가
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_OPENAI_API_KEY=sk-...  # 마키용 (선택)
```

### AI별 모델/API

| AI | 모델 | API |
|----|------|-----|
| 플래니 | claude-sonnet-4-20250514 | Anthropic |
| 데비 | claude-sonnet-4-20250514 | Anthropic |
| 모디 | claude-sonnet-4-20250514 | Anthropic |
| 서치 | claude-sonnet-4-20250514 | Anthropic (웹검색은 나중에) |
| 마키 | claude-sonnet-4-20250514 | Anthropic (일단 통일) |

### 시스템 프롬프트 구조

각 AI 호출 시 시스템 프롬프트 구성:

```
[1. 기본 프롬프트]
docs/prompts/{ai_name}.md 파일 내용

[2. Sol님 현재 상황 - 동적 주입]
## Sol님 현재 상황

### 🎯 프로젝트 & 목표
{projects + goals + milestones 데이터}

### 📅 다가오는 일정 (7일 이내)
{schedules 데이터}

### ✅ 진행 중인 할일 (긴급/오늘)
{tasks 데이터}

### 📋 최근 대화 요약
{conversation_summaries 데이터 - 해당 AI방 최근 7일}

[3. 모디 전용 추가 (모디만)]
### 📋 전체 AI방 최근 요약
💜 플래니: {plani 요약}
💗 마키: {maki 요약}
🤎 데비: {devi 요약}
💚 서치: {searchi 요약}
```

### 구현 파일 구조

```
src/
├── services/
│   ├── ai/
│   │   ├── anthropic.ts      # Claude API 클라이언트
│   │   ├── prompts.ts        # 프롬프트 로더 (md 파일 읽기)
│   │   └── context.ts        # 동적 컨텍스트 생성
│   └── ...
├── hooks/
│   └── useChat.ts            # AI 대화 훅 (메시지 전송/수신)
└── ...
```

### anthropic.ts 예시

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
});

export const sendMessage = async (
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
) => {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });
  
  return response.content[0].type === 'text' 
    ? response.content[0].text 
    : '';
};
```

### context.ts 예시

```typescript
import { supabase } from '../supabase';

export const buildContext = async (aiName: string) => {
  // 1. 프로젝트 & 목표
  const { data: projects } = await supabase
    .from('projects')
    .select('*, goals(*, milestones(*))')
    .order('priority');

  // 2. 다가오는 일정 (7일)
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .gte('date', new Date().toISOString().split('T')[0])
    .lte('date', addDays(new Date(), 7).toISOString().split('T')[0])
    .order('date');

  // 3. 긴급 할일
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .in('status', ['todo', 'in_progress'])
    .order('due_date');

  // 4. 대화 요약 (해당 AI방, 최근 7일)
  const { data: summaries } = await supabase
    .from('conversation_summaries')
    .select('*')
    .eq('room_id', aiName)
    .gte('date', addDays(new Date(), -7).toISOString().split('T')[0])
    .order('date', { ascending: false });

  // 5. 모디면 전체 요약 추가
  let allSummaries = null;
  if (aiName === 'modi') {
    const { data } = await supabase
      .from('conversation_summaries')
      .select('*')
      .gte('date', addDays(new Date(), -7).toISOString().split('T')[0])
      .order('date', { ascending: false });
    allSummaries = data;
  }

  return formatContext(projects, schedules, tasks, summaries, allSummaries);
};
```

### useChat.ts 훅

```typescript
export const useChat = (roomId: string, aiName: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async (content: string) => {
    setLoading(true);
    
    // 1. 유저 메시지 추가
    const userMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    
    // 2. DB에 저장
    await saveMessage(conversationId, 'user', content);
    
    // 3. 시스템 프롬프트 구성
    const basePrompt = await loadPrompt(aiName); // md 파일 로드
    const context = await buildContext(aiName);
    const systemPrompt = basePrompt + '\n\n' + context;
    
    // 4. AI 호출
    const response = await sendToAI(systemPrompt, messages);
    
    // 5. AI 응답 추가
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    await saveMessage(conversationId, 'assistant', response, aiName);
    
    setLoading(false);
  };

  return { messages, sendMessage, loading };
};
```

---

## Part 3: 회의실 구현

### 회의 진행 순서

1. 모디가 회의 시작 (최근 상황 정리)
2. 주제 입력
3. 플래니 → 마키 → 데비 → 서치 순서로 발언
4. 모디가 정리 (결정사항, 액션아이템)
5. 회의록 저장

### 회의실 로직

```typescript
const runMeeting = async (topic: string) => {
  const context = await buildContext('modi');
  
  // 1. 모디 시작
  const modiStart = await sendToAI(modiPrompt, [
    { role: 'user', content: `회의 주제: ${topic}. 최근 상황 정리하고 시작해줘.` }
  ]);
  
  // 2. 각 AI 순차 발언
  const aiOrder = ['plani', 'maki', 'devi', 'searchi'];
  const responses = [];
  
  for (const ai of aiOrder) {
    const prompt = await loadPrompt(ai);
    const response = await sendToAI(prompt + context, [
      { role: 'user', content: `회의 주제: ${topic}. 네 관점에서 의견 줘.` }
    ]);
    responses.push({ ai, response });
  }
  
  // 3. 모디 정리
  const summary = await sendToAI(modiPrompt, [
    { role: 'user', content: `회의 정리해줘. 발언 내용: ${JSON.stringify(responses)}` }
  ]);
  
  // 4. 회의록 저장
  await saveMeetingNote(topic, responses, summary);
};
```

---

## 우선순위

1. **프로젝트 & 목표 메뉴** (DB + UI)
2. **AI API 연동** (anthropic.ts + useChat.ts)
3. **프롬프트 로딩 + 컨텍스트 주입**
4. **회의실 로직**
5. **요약 저장 버튼**

---

## 참고: 현재 Supabase 테이블

**기존 테이블:**
- conversations, messages, conversation_summaries
- schedules, tasks, insights
- readings, reading_logs
- journals
- projects, options, daily_completions

**새로 추가됨:** ✅
- goals (프로젝트 하위 목표)
- milestones (목표 하위 마일스톤)
- projects에 status, priority 컬럼

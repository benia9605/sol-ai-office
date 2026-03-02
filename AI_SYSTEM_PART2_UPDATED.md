# AI 대화 시스템 구현 - Part 2 (보완)

## 현재 상황
- Part 1 완료 (설정 메뉴, 프로젝트 & 목표, KPI)
- Supabase 연동 완료
- AI 프롬프트 파일: docs/prompts/ (수정 필요)
- API 키 .env에 추가됨

---

## Part 2-1: 설정 > 내 정보 추가

### UI 위치
설정 > 👤 내 정보

### 화면

```
┌─────────────────────────────────────────────────────────────┐
│ 👤 내 정보                                          [저장]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 이름 *                                                      │
│ [Sol                                                      ] │
│                                                             │
│ 나에 대해 (AI가 참고할 내용)                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 1인 사업가, 3개 프로젝트 운영 중                        │ │
│ │ 남편 민석이랑 같이 일함                                 │ │
│ │ 피드백은 솔직하게 해줘도 OK                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 선호하는 대화 스타일                                        │
│                                                             │
│ 톤:        ○ 친근하게  ● 존댓말  ○ 격식있게                │
│ 답변 길이: ● 짧게      ○ 적당히  ○ 자세히                  │
│ 이모지:    ○ 많이      ● 적당히  ○ 거의 안씀               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### DB 테이블 추가

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  bio TEXT,
  tone TEXT DEFAULT 'polite',
  response_length TEXT DEFAULT 'short',
  emoji_usage TEXT DEFAULT 'moderate',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 기본 프로필 생성
INSERT INTO user_profiles (name, bio, tone, response_length, emoji_usage)
VALUES ('Sol', '1인 사업가, 3개 프로젝트 운영 중', 'polite', 'short', 'moderate');
```

---

## Part 2-2: 프롬프트 파일 수정

### 변경 사항
- 기존 프롬프트에서 "Sol님" 관련 하드코딩 제거
- 유저 정보는 동적으로 주입

### 프롬프트 파일 구조 (공통)

```markdown
# [AI 이름] - 시스템 프롬프트

## 기본 정체성
- 역할
- 성격
- 말투 (유저 설정에 따라 조절)

## 팀 구조 인식
- 다른 AI 역할 설명
- 협업 가이드

## 주요 업무
- 요청 유형별 응답 방식

## 응답 원칙
- DO / DON'T
```

### 제거해야 할 내용 (기존 프롬프트에서)
- "Sol님은 1인 사업가..."
- "Sol님의 현재 목표..."
- 프로젝트 구체적 내용 (운명랩, PTE 등)
- 2월 와디즈 펀딩 등 구체적 일정

### 유지할 내용
- AI 역할, 성격, 말투
- 팀 구조 설명
- 응답 원칙
- DO / DON'T

---

## Part 2-3: 시스템 프롬프트 조합 로직

### 최종 시스템 프롬프트 구조

```
[1. 기본 프롬프트 - 파일에서 로드]
docs/prompts/{ai_name}.md

[2. 유저 정보 - DB에서 로드]
## 유저 정보
- 이름: {user_profiles.name}
- 소개: {user_profiles.bio}
- 대화 스타일: {tone}, {response_length}, {emoji_usage}

[3. 프로젝트 & 목표 - DB에서 로드]
## 현재 프로젝트 & 목표
{projects + goals + kpis + milestones}

[4. 다가오는 일정 - DB에서 로드]
## 다가오는 일정 (7일 이내)
{schedules}

[5. 진행 중 할일 - DB에서 로드]
## 진행 중인 할일
{tasks where status = 'todo' or 'in_progress'}

[6. 최근 대화 요약 - DB에서 로드]
## 최근 대화 요약 (이 방)
{conversation_summaries where room_id = current_room, 최근 7일}

[7. 모디 전용 - 전체 방 요약]
## 전체 AI방 최근 요약
💜 플래니: {summary}
💗 마키: {summary}
🤎 데비: {summary}
💚 서치: {summary}
```

### context.ts 수정

```typescript
import { supabase } from '../supabase';

export const buildContext = async (aiName: string) => {
  // 1. 유저 프로필 로드
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .single();

  // 2. 프로젝트 & 목표 & KPI
  const { data: projects } = await supabase
    .from('projects')
    .select('*, goals(*, milestones(*), kpis(*))')
    .order('priority');

  // 3. 다가오는 일정 (7일)
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*')
    .gte('date', new Date().toISOString().split('T')[0])
    .lte('date', addDays(new Date(), 7).toISOString().split('T')[0])
    .order('date');

  // 4. 진행 중 할일
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .in('status', ['todo', 'in_progress'])
    .order('due_date');

  // 5. 대화 요약 (해당 방, 최근 7일)
  const { data: summaries } = await supabase
    .from('conversation_summaries')
    .select('*')
    .eq('room_id', aiName)
    .gte('date', addDays(new Date(), -7).toISOString().split('T')[0])
    .order('date', { ascending: false });

  // 6. 모디면 전체 요약 추가
  let allSummaries = null;
  if (aiName === 'modi') {
    const { data } = await supabase
      .from('conversation_summaries')
      .select('*')
      .gte('date', addDays(new Date(), -7).toISOString().split('T')[0])
      .order('date', { ascending: false });
    allSummaries = data;
  }

  return formatContext(profile, projects, schedules, tasks, summaries, allSummaries);
};

const formatContext = (profile, projects, schedules, tasks, summaries, allSummaries) => {
  let context = '';

  // 유저 정보
  context += `## 유저 정보\n`;
  context += `- 이름: ${profile.name}\n`;
  context += `- 소개: ${profile.bio || '없음'}\n`;
  context += `- 대화 스타일: ${formatStyle(profile)}\n\n`;

  // 프로젝트 & 목표
  context += `## 현재 프로젝트 & 목표\n`;
  for (const project of projects) {
    context += `### ${project.emoji || '📁'} ${project.name}\n`;
    for (const goal of project.goals || []) {
      context += `- 🎯 ${goal.title} (${goal.progress}%)\n`;
    }
  }
  context += '\n';

  // 일정
  context += `## 다가오는 일정 (7일 이내)\n`;
  for (const schedule of schedules) {
    context += `- ${schedule.date}: ${schedule.title}\n`;
  }
  context += '\n';

  // 할일
  context += `## 진행 중인 할일\n`;
  for (const task of tasks.slice(0, 10)) {
    context += `- ${task.status === 'in_progress' ? '🔄' : '⬜'} ${task.title}\n`;
  }
  context += '\n';

  // 요약
  if (summaries?.length > 0) {
    context += `## 최근 대화 요약\n`;
    context += summaries[0].summary + '\n\n';
  }

  // 모디 전용
  if (allSummaries) {
    context += `## 전체 AI방 최근 요약\n`;
    // 방별로 그룹핑해서 표시
  }

  return context;
};

const formatStyle = (profile) => {
  const tone = {
    'friendly': '친근하게',
    'polite': '존댓말',
    'formal': '격식있게'
  }[profile.tone] || '존댓말';

  const length = {
    'short': '짧게',
    'medium': '적당히',
    'detailed': '자세히'
  }[profile.response_length] || '짧게';

  const emoji = {
    'many': '이모지 많이',
    'moderate': '이모지 적당히',
    'few': '이모지 거의 안씀'
  }[profile.emoji_usage] || '적당히';

  return `${tone}, ${length}, ${emoji}`;
};
```

---

## Part 2-4: API 연동

### .env 설정

```env
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_OPENAI_API_KEY=sk-...
VITE_PERPLEXITY_API_KEY=pplx-...
```

### AI별 모델

| AI | 모델 | API | 이유 |
|----|------|-----|------|
| 플래니 | claude-sonnet-4-20250514 | Anthropic | 전략/분석 |
| 데비 | claude-opus-4-20250514 | Anthropic | 개발 - 고급 모델 필요 |
| 모디 | claude-sonnet-4-20250514 | Anthropic | 비서/정리 |
| 마키 | gpt-4o | OpenAI | 마케팅/창의적 |
| 서치 | sonar-pro | Perplexity | 실시간 검색 |

### 파일 구조

```
src/services/ai/
├── anthropic.ts    # Claude API (플래니, 데비, 모디)
├── openai.ts       # OpenAI API (마키)
├── perplexity.ts   # Perplexity API (서치)
├── prompts.ts      # 프롬프트 로더
├── context.ts      # 동적 컨텍스트 생성
└── index.ts        # AI별 라우팅
```

### anthropic.ts (플래니, 데비, 모디)

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
});

export const sendMessageClaude = async (
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  model: 'sonnet' | 'opus' = 'sonnet'
) => {
  const modelId = model === 'opus' 
    ? 'claude-opus-4-20250514' 
    : 'claude-sonnet-4-20250514';

  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });
  
  return response.content[0].type === 'text' 
    ? response.content[0].text 
    : '';
};
```

### openai.ts (마키)

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true  // 프론트엔드용
});

export const sendMessageGPT = async (
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    max_tokens: 2048,
  });
  
  return response.choices[0].message.content || '';
};
```

### perplexity.ts (서치)

```typescript
export const sendMessagePerplexity = async (
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
) => {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 2048,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content || '';
};
```

### index.ts (AI별 라우팅)

```typescript
import { sendMessageClaude } from './anthropic';
import { sendMessageGPT } from './openai';
import { sendMessagePerplexity } from './perplexity';

export const sendMessage = async (
  aiName: string,
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
) => {
  switch (aiName) {
    case 'plani':
      return sendMessageClaude(systemPrompt, messages, 'sonnet');
    case 'devi':
      return sendMessageClaude(systemPrompt, messages, 'opus');
    case 'modi':
      return sendMessageClaude(systemPrompt, messages, 'sonnet');
    case 'maki':
      return sendMessageGPT(systemPrompt, messages);
    case 'searchi':
      return sendMessagePerplexity(systemPrompt, messages);
    default:
      return sendMessageClaude(systemPrompt, messages, 'sonnet');
  }
};
```

### 패키지 설치 필요

```bash
npm install @anthropic-ai/sdk openai
```

---

## Part 2-5: useChat 훅

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
    const basePrompt = await loadPrompt(aiName);
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

## 구현 순서

1. **DB 테이블 추가** - user_profiles
2. **설정 > 내 정보 UI** - SettingsPage.tsx에 추가
3. **프롬프트 파일 수정** - Sol님 정보 제거
4. **context.ts 구현** - 유저 정보 + 프로젝트 + 일정 등 조합
5. **anthropic.ts 구현** - API 클라이언트
6. **useChat.ts 구현** - 대화 훅
7. **각 AI방에 연결** - ChatRoom 컴포넌트에 적용

---

## 참고: 현재 Supabase 테이블

**기존:**
- conversations, messages, conversation_summaries
- schedules, tasks, insights
- readings, reading_logs, journals
- projects, goals, milestones, kpis, kpi_logs
- options, daily_completions

**새로 추가:**
- user_profiles ← 이번에 추가

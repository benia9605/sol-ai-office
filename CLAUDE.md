# 🏢 Sol AI Office - 개발 지침서

**용도:** Cursor + Claude Code (코딩/실행용)  
**최종 업데이트:** 2026-02-19

---

## 📌 프로젝트 개요

**Sol AI Office** - 1인 사업가를 위한 AI 팀 가상 오피스

### 핵심 기능
1. **방별 AI 채팅** - 5개 방 (전략실, 마케팅룸, 개발실, 리서치랩, 회의실)
2. **회의실 (멀티 AI)** - 4명 AI 순차 답변, 회의록 자동 생성
3. **목표 시스템** - 주간/월간 목표 입력, AI에 자동 주입
4. **히스토리** - 모든 대화 기록 저장, 검색
5. **대시보드** - 목표 달성률, 이번 주 요약
6. **노션 연동** (v1.1) - 중요 인사이트 백업

---

## 🛠️ 기술 스택

```
Frontend: React + TypeScript + Tailwind CSS
Backend: Supabase (DB + Auth + Realtime)
AI APIs:
  - Claude API (플래니, 데비, 모디)
  - OpenAI API (마키)
  - Perplexity API (서치)
External: Notion API (v1.1)
Hosting: Replit
버전관리: GitHub
```

---

## 📁 폴더 구조

> 상세 설명은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 참고

```
sol-ai-office/
├── CLAUDE.md                 # 이 파일 (Claude Code 지침서)
├── docs/
│   ├── ARCHITECTURE.md       # 폴더 구조 + 각 폴더/파일 역할 설명
│   └── DESIGN.md             # 디자인 가이드 (컬러, 폰트, 스타일)
├── public/
│   └── images/               # AI 캐릭터 이미지
├── src/
│   ├── main.tsx              # 앱 진입점
│   ├── App.tsx               # 루트 컴포넌트
│   ├── index.css             # 글로벌 스타일
│   ├── types.ts              # 전역 타입 정의
│   ├── data.ts               # 정적 데이터 (방 목록, AI 설정)
│   ├── components/           # UI 컴포넌트
│   │   ├── RoomCard.tsx
│   │   ├── ChatModal.tsx
│   │   └── Sidebar.tsx
│   ├── hooks/                # 커스텀 훅 (예정: useChat, useGoals 등)
│   ├── services/             # API 연동 (예정: supabase, claude, openai 등)
│   └── utils/                # 유틸 함수 (예정)
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 🗄️ 데이터베이스 스키마 (Supabase)

```sql
-- 대화 세션
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,  -- 'strategy', 'marketing', 'dev', 'research', 'meeting'
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 개별 메시지
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,     -- 'user', 'assistant'
  content TEXT NOT NULL,
  ai_model TEXT,          -- 'claude', 'gpt', 'perplexity'
  ai_name TEXT,           -- '플래니', '마키', '데비', '서치', '모디'
  is_starred BOOLEAN DEFAULT FALSE,
  notion_synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 목표
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project TEXT NOT NULL,  -- '운명랩', 'PTE', '쏠닝포인트'
  goal TEXT NOT NULL,
  deadline DATE,
  status TEXT DEFAULT 'pending',  -- 'pending', 'in_progress', 'completed'
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 회의록
CREATE TABLE meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  summary TEXT,
  action_items JSONB,     -- [{ task: "", assignee: "", deadline: "" }]
  notion_page_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인사이트 (노션 연동용)
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT,              -- 'insight', 'marketing', 'todo', 'idea'
  project TEXT,
  notion_page_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🎨 디자인 가이드

> 상세 내용은 [docs/DESIGN.md](docs/DESIGN.md) 참고

- **메인 컬러**: 보라 계열 (`#a855f7` primary-500 기준, `#faf5ff` ~ `#9333ea`)
- **방별 컬러**: 전략실(`#e9d8fd` 연보라), 마케팅(`#fed7e2` 연핑크), 개발(`#d9f99d` 연라임), 리서치(`#e8d5c4` 연브라운), 회의실(`#fefcbf` 연노랑)
- **폰트**: `-apple-system`, `Noto Sans KR`, sans-serif
- **border-radius**: 카드/사이드바 `rounded-3xl` (24px) / 버튼/인풋 `rounded-2xl` (16px)
- **hover**: scale(1.03) + shadow-hover
- **반응형**: 모바일 1열 / 태블릿(sm) 2열 / PC(lg) 3열, 사이드바 모바일 슬라이드 오버레이

---

## 🤖 AI 팀 설정

| 방 | AI 이름 | 캐릭터 | 모델 | room_id |
|-----|---------|--------|------|---------|
| 전략실 | 플래니 | 💜 보라 헤드폰 | Claude | strategy |
| 마케팅룸 | 마키 | 💗 핑크 머리띠 | GPT-4 | marketing |
| 개발실 | 데비 | 🤎 갈색 비니 | Claude | dev |
| 리서치랩 | 서치 | 💚 초록 트리 | Perplexity | research |
| 회의실 | 모디 | 💛 노랑 볼빨간 | Claude | meeting |

### 캐릭터 이미지
```
public/images/
├── plani.png     # 플래니 (전략실)
├── maki.png      # 마키 (마케팅룸)
├── devi.png      # 데비 (개발실)
├── searchi.png   # 서치 (리서치랩)
└── modi.png      # 모디 (회의실)
```

### 역할 상세
- **플래니**: 전략 총괄, 의사결정 서포트, 우선순위 정리 (신중하고 구조적)
- **마키**: 마케팅, 콘텐츠 아이디어, 카피라이팅 (창의적, 에너지 넘침)
- **데비**: 개발, 기술 구현, 코드 리뷰 (꼼꼼하고 실용적)
- **서치**: 시장조사, 경쟁사 분석, 실시간 검색 (팩트 중심, 출처 제공)
- **모디**: 비서/회장, 회의 진행 & 정리, 스케줄 관리(v2.0) (정리 잘함, 친근함)

### 시스템 프롬프트 템플릿
```typescript
const getSystemPrompt = (aiName: string, goals: Goal[]) => `
당신은 "${aiName}"입니다. Sol님의 AI 팀 멤버입니다.

## 현재 목표
${goals.map(g => `- ${g.project}: ${g.goal} (${g.deadline})`).join('\n')}

## 대화 스타일
${AI_STYLES[aiName]}

## 주의사항
- Sol님의 현재 목표를 인지하고 대화
- 맥락 없는 일반적인 답변 금지
`;
```

---

## ✅ 개발 체크리스트

### Phase 1: 기본 UI ✅ 완료
- [x] 프로젝트 세팅 (React + TS + Tailwind)
- [x] 기본 레이아웃 구성
- [x] 5개 방 카드 UI
- [x] 히스토리 사이드바
- [x] 파스텔 컬러 테마

### Phase 2: 데이터 연동 🔄 진행중
- [ ] Supabase 프로젝트 생성
- [ ] 테이블 생성 (위 스키마 적용)
- [ ] 대화 저장/불러오기
- [ ] 히스토리 실제 데이터 연동

### Phase 3: AI 연동
- [ ] Claude API 연동 (플래니, 데비, 모디)
- [ ] OpenAI API 연동 (마키)
- [ ] Perplexity API 연동 (서치)
- [ ] 시스템 프롬프트 적용

### Phase 4: 목표 시스템
- [ ] 목표 CRUD UI
- [ ] AI 시스템 프롬프트에 목표 주입
- [ ] 진행률 추적

### Phase 5: 회의실 기능
- [ ] 멀티 AI 순차 응답
- [ ] 회의록 자동 생성
- [ ] 액션 아이템 추출

### Phase 6: 대시보드
- [ ] 대시보드 UI
- [ ] 검색 기능
- [ ] 모바일 최적화

### Phase 7: 노션 연동 (v1.1)
- [ ] Notion API 연동
- [ ] "노션에 저장" 버튼

---

## 🔧 환경 변수 (.env)

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI APIs
VITE_CLAUDE_API_KEY=your_claude_api_key
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_PERPLEXITY_API_KEY=your_perplexity_api_key

# Notion (v1.1)
VITE_NOTION_API_KEY=your_notion_api_key
VITE_NOTION_DATABASE_ID=your_notion_database_id
```

---

## 📝 코딩 컨벤션

### 파일 상단 주석 (필수)
모든 `.ts`, `.tsx`, `.js` 파일은 상단에 아래 형식의 주석을 포함해야 한다:
```typescript
/**
 * @file src/components/RoomCard.tsx
 * @description 오피스 방 카드 컴포넌트
 * - 각 방을 카드 형태로 표시
 * - 클릭 시 ChatModal 열기
 * ...
 */
```
- `@file`: 프로젝트 루트 기준 상대 경로
- `@description`: 이 파일이 무엇을 하는지 한 줄 요약 + 세부 역할 목록

### 파일 네이밍
- 컴포넌트: PascalCase (`RoomCard.tsx`)
- 훅: camelCase with use (`useChat.ts`)
- 유틸: camelCase (`formatDate.ts`)

### 타입 정의
```typescript
// types/index.ts
export interface Conversation {
  id: string;
  room_id: RoomId;
  title: string;
  created_at: string;
  updated_at: string;
}

export type RoomId = 'strategy' | 'marketing' | 'dev' | 'research' | 'meeting';
export type AIModel = 'claude' | 'gpt' | 'perplexity';
```

---

## 🗣️ 소통 규칙

- **모든 대화는 한글로** — 질문, 확인 요청, 진행 여부 문의, 설명 등 모든 소통을 한글로 진행
- 코드 내 변수명/함수명/주석은 영어 사용 가능하나, 사용자와의 대화는 항상 한글

---

*Claude Code가 이 파일을 참고해서 코딩합니다.*

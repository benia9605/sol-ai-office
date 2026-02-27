# Sol AI Office - 폴더 구조 & 아키텍처

> 개발자 참고용 문서. 각 폴더와 파일의 역할을 설명합니다.

---

## 프로젝트 루트

```
sol-ai-office/
├── CLAUDE.md               # Claude Code 지침서 (루트 고정)
├── docs/                   # 가이드 문서
│   ├── ARCHITECTURE.md     # 이 파일 (폴더 구조 + 역할)
│   └── DESIGN.md           # 디자인 가이드 (컬러, 폰트, 스타일)
├── public/                 # 정적 파일 (이미지 등)
│   └── images/             # AI 캐릭터 이미지
├── src/                    # 소스 코드
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

---

## `src/` 구조

```
src/
├── main.tsx                # 앱 진입점 (React DOM 렌더)
├── App.tsx                 # 루트 컴포넌트 (레이아웃 + 상태 관리)
├── index.css               # 글로벌 스타일 (Tailwind directives)
├── types.ts                # 전역 타입 정의 (Room, Message, RoomId 등)
├── data.ts                 # 정적 데이터 (방 목록, AI 설정 등)
├── components/             # UI 컴포넌트
│   ├── RoomCard.tsx        # 방 카드 (메인 화면에 표시)
│   ├── ChatModal.tsx       # 채팅 모달 (방 클릭 시 열림)
│   └── Sidebar.tsx         # 히스토리 사이드바
├── hooks/                  # 커스텀 훅 (예정)
│   └── (useChat, useGoals, useHistory 등)
├── services/               # API 연동 (예정)
│   └── (supabase, claude, openai, perplexity 등)
└── utils/                  # 유틸 함수 (예정)
```

---

## 폴더별 역할

### `components/`
- 재사용 가능한 UI 컴포넌트
- 각 파일은 하나의 컴포넌트를 export
- PascalCase 파일명 (`RoomCard.tsx`)

### `hooks/` (예정)
- 비즈니스 로직을 캡슐화하는 커스텀 훅
- `useChat.ts` — 채팅 메시지 전송/수신 로직
- `useGoals.ts` — 목표 CRUD
- `useHistory.ts` — 대화 히스토리 관리
- camelCase + `use` 접두사 (`useChat.ts`)

### `services/` (예정)
- 외부 API 연동 모듈
- `supabase.ts` — Supabase 클라이언트 설정 + DB 연동
- `claude.ts` / `openai.ts` / `perplexity.ts` — AI API 호출
- `notion.ts` — 노션 연동 (v1.1)

### `utils/` (예정)
- 순수 유틸 함수 (날짜 포맷, 문자열 처리 등)
- camelCase 파일명 (`formatDate.ts`)

### `public/`
- 정적 파일 (빌드 시 그대로 복사됨)
- `images/` — AI 캐릭터 이미지 (plani.png, maki.png 등)

---

## 데이터 흐름 (예정)

```
사용자 입력
  → App.tsx (상태 관리)
    → hooks/ (비즈니스 로직)
      → services/ (API 호출)
        → Supabase DB / AI APIs
```

---

*이 문서는 프로젝트가 성장하면서 업데이트됩니다.*

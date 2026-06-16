# MUJI 디자인 샘플 — 다른 앱 적용용

이 폴더는 밋업 앱의 MUJI(무인양품) 디자인 톤을 보여주는 **실제 코드 복제본**.
다른 앱에 톤을 옮길 때 참고용으로 통째로 전달하면 됨.

> 함께 보면 좋은 가이드: `../muji-design-system.md` (포터블 디자인 시스템 문서)

---

## 보는 순서 (★ 추천)

1. **`index.css`** — 컬러 토큰, 폰트, safe-area, `.label` 유틸. **이 파일 하나가 디자인 시스템의 90%**
2. **`pages/dashboard.tsx`** — 헤더 / 섹션 / 카드 / 리스트가 한 화면에 다 들어있는 종합 샘플
3. **`components/dashboard/greeting-hero.tsx`** — 시그니처 헤더 패턴 (`.label` → `font-light` 헤드라인)

이 3개만 봐도 톤은 전달됨. 나머지는 깊이용.

---

## 파일 가이드

### 기반 (1)

| 파일 | 원본 경로 | 무엇을 보여주나 |
|---|---|---|
| `index.css` | `src/index.css` | 컬러 토큰, 폰트 스택, `body` 셋업, `.label` 유틸, safe-area, Tiptap 톤 |

### 시그니처 컴포넌트 (2)

| 파일 | 원본 경로 | 무엇을 보여주나 |
|---|---|---|
| `components/brand-mark.tsx` | `src/components/brand-mark.tsx` | teal 점 + 트래킹 넓은 워드마크. 절제미의 상징 |
| `components/avatar.tsx` | `src/components/avatar.tsx` | 원형 예외가 어떻게 자연스러운지 |

### 페이지 (2)

| 파일 | 원본 경로 | 무엇을 보여주나 |
|---|---|---|
| `pages/dashboard.tsx` | `src/pages/dashboard.tsx` | 헤더·섹션·카드·리스트 종합. **가장 추천** |
| `pages/login.tsx` | `src/pages/login.tsx` | 미니멀 폼 + 여백 활용 |

### 패턴별 대표 (3)

| 파일 | 원본 경로 | 무엇을 보여주나 |
|---|---|---|
| `components/dashboard/greeting-hero.tsx` | `src/components/dashboard/greeting-hero.tsx` | 시그니처 헤더 패턴 |
| `components/dashboard/featured-meeting.tsx` | `src/components/dashboard/featured-meeting.tsx` | 유일한 액센트 컬러(`--accent-teal`) 절제 사용 예 |
| `components/dashboard/upcoming-list.tsx` | `src/components/dashboard/upcoming-list.tsx` | `divide-y divide-line` 리스트 패턴 |

### 모바일 / 레이아웃 (2)

| 파일 | 원본 경로 | 무엇을 보여주나 |
|---|---|---|
| `layouts/app-layout.tsx` | `src/layouts/app-layout.tsx` | 데스크탑 상단 nav + 모바일 햄버거 + BottomNav 분기 |
| `components/mobile-bottom-nav.tsx` | `src/components/mobile-bottom-nav.tsx` | `pb-safe-bottom` PWA 처리 포함 |

### 기타 (2)

| 파일 | 원본 경로 | 무엇을 보여주나 |
|---|---|---|
| `components/modal.tsx` | `src/components/modal.tsx` | hairline 박스 + 그림자 없는 모달 |
| `components/meeting-card.tsx` | `src/components/meeting-card.tsx` | 카드 패턴 |

---

## 주의

- 이 파일들은 **읽기 전용 샘플**. 밋업 본체와 동기화되지 않음 — 원본
  (`src/`) 가 변경돼도 자동으로 안 따라감. 톤이 크게 바뀌면 다시 복사
- 비전보드 (`vision-board*.tsx`) 는 **의도적 예외** (글라스모피즘 무드).
  메인 톤 보여줄 때는 일부러 뺐음
- 라우팅 / 데이터 fetching 코드는 그 앱 환경에 안 맞을 수 있음 —
  **JSX 구조와 className** 만 참고하면 됨

---

## 스택 정보 (사본 환경 가정)

- Tailwind CSS **v4** (`@theme inline` 문법) — v3 라면 `tailwind.config.js`
  `theme.extend.colors` 로 변환 필요
- React 19 / TypeScript / React Router v7
- PWA safe-area 처리 포함 (iOS / Android 노치 대응)

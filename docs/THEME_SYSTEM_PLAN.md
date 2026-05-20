# 테마 시스템 구축 플랜 — "모디 테마" + "모던 테마"

> **목표:** Sol AI Office에 테마 선택 기능을 추가한다. 기본은 **모디 테마**(현재 보라/파스텔/둥근 카드),
> 신규는 **모던 테마**(MUJI 톤 — 흰 배경/hairline/직사각형/가벼운 폰트). 설정 페이지에서 토글.
>
> **참고 문서:**
> - `docs/muji-design-system.md` — 모던 테마 설계 원본 (MUJI 톤)
> - `docs/DESIGN.md` — 모디 테마 현재 가이드
> - `docs/THEME_MONETIZATION.md` — 추후 유료 테마 확장 시 참고 (현 단계는 무료 2종만)
>
> **작성일:** 2026-05-20

---

## 0. 현황 진단 (작업 전에 알아둘 것)

### 0.1 코드 규모 — 토큰 치환 대상
프로젝트 전체 색상/형태 클래스 사용 빈도 (`src/**/*.tsx` 기준):

| 클래스 | 개수 | 처리 방식 |
|--------|------|----------|
| `text-gray-*` | 722 | CSS 변수로 자동 톤 변환 |
| `bg-gray-*` | 335 | CSS 변수로 자동 톤 변환 |
| `bg-green/amber/blue/red/pink/purple-*` | ~350 (합산) | 의미별 토큰으로 점진 치환 |
| `rounded-2xl` | 68 | 테마 토큰 (`--radius-card`) |
| `rounded-3xl` | 18 | 테마 토큰 (`--radius-card-lg`) |
| `shadow-soft` | 66 | 테마 토큰 (모디=그림자, 모던=`none`) |
| `shadow-hover` | 39 | 동일 |
| `font-bold` | 60 | 테마 토큰 (모디=`700`, 모던=`400~500`) |
| `bg-gradient-*` | 6 | 모던에서 단색으로 강제 변환 |
| `bg-primary-*` | 17 | 이미 토큰화됨 (변수 매핑만 하면 됨) |
| `bg-pastel-*` | 3 | 모디 전용, 모던에서는 muted 회색 |

### 0.2 기술 스택 결정
- **Tailwind v3.4 유지** — v4로 마이그레이션하지 않음 (`muji-design-system.md`의 `@theme inline` 문법은 v4용이라 v3에 맞게 변환해 사용)
- **CSS 변수 + `<html data-theme="...">`** 방식 — `THEME_MONETIZATION.md` §1단계 그대로
- **저장:** localStorage 우선 (즉시 반영) + `user_profiles.active_theme` 컬럼 (로그인 시 동기화)

### 0.3 두 테마의 정체성 한 줄

| 테마 | 슬로건 | 시각 키워드 |
|------|--------|------------|
| **모디** (`data-theme="modi"`, 기본) | "친근한 AI 비서들" | 보라/파스텔, `rounded-3xl`, `shadow-soft`, `font-bold` 헤딩, 그라데이션 |
| **모던** (`data-theme="modern"`) | "있는 그대로의 아름다움" | 흰 배경, 1px hairline, `rounded-none`, 그림자 없음, `font-light` 헤딩, 단색 액센트 |

---

## 1. 결정 사항 (확정 ✅ 2026-05-20)

- [x] **Q1. 모던 테마 액센트 = 진초록 `#1b4332`** (deep forest green)
  - 호버: `#0d2b1f` / 텍스트용 톤: `#143829` / 배경 톤: `#e7eee9`
  - MUJI 가이드의 "단 하나의 액센트" 원칙 준수 — 검정 본문 + 진초록 액센트 단 한 가지만
- [x] **Q2. 방별 컬러 = 모노톤** — 흰색+검은색 단조로운 조화
  - 파스텔 변수 5개(`--color-pastel-*`)는 모던 테마에서 전부 `#ffffff`로 통일
  - 방 구분 = **AI 프로필 이미지로만** (`public/images/plani.png` 등)
  - 헤더 컬러 배지, 컬러 라인, 카드 배경색 변형 모두 제거
- [x] **Q3. DB 저장 = 이번에 같이** — `user_profiles.active_theme TEXT DEFAULT 'modi'` 마이그레이션
  - 로그인 시 DB 값으로 초기화, 변경 시 DB 업데이트 + localStorage 백업
- [x] **Q4. Pretendard 웹폰트 = 추가** — 모던 테마일 때만 조건부 로드
  - CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css`
  - `ThemeProvider`에서 `theme === 'modern'`일 때 `<link>` 동적 주입

→ **확정 끝. 바로 Phase 0 진입 가능.**

---

## 2. 아키텍처

### 2.1 레이어 구조
```
┌──────────────────────────────────────────────────┐
│ src/index.css                                    │
│  :root { --color-primary-500: ...; --radius...}  │ ← 모디 (기본)
│  [data-theme="modern"] { ...오버라이드... }      │ ← 모던
├──────────────────────────────────────────────────┤
│ tailwind.config.js                               │
│  colors.primary[500] = var(--color-primary-500)  │ ← 변수 참조
│  borderRadius.card   = var(--radius-card)        │
│  boxShadow.soft      = var(--shadow-soft)        │
├──────────────────────────────────────────────────┤
│ src/contexts/ThemeContext.tsx                    │
│  ThemeProvider, useTheme()                       │
│  document.documentElement.dataset.theme = ...    │
├──────────────────────────────────────────────────┤
│ src/components/settings/ThemePicker.tsx          │
│  설정 페이지의 테마 카드 토글                       │
├──────────────────────────────────────────────────┤
│ src/services/userTheme.service.ts (Q3=A일 때)    │
│  user_profiles.active_theme CRUD                 │
└──────────────────────────────────────────────────┘
```

### 2.2 토큰 카테고리 (총 4종)

```
1) 컬러 토큰      — 색상 (primary, surface, text, line, accent, danger…)
2) 형태 토큰      — radius (card, button, input)
3) 그림자 토큰    — shadow (soft, hover) — 모던에서는 'none'
4) 타이포 토큰    — heading font-weight, label letter-spacing
```

### 2.3 토큰 네이밍 규칙
- 의미 기반: `--color-foreground-muted` (○) vs `--color-gray-500` (✗ — 의미 불명)
- 모디 테마에서는 `gray-500` 같은 톤이지만, 모던에서는 같은 자리에 `#6b6b6b` 들어가도 되는 식으로 의미만 동일하면 됨
- **단, 점진 마이그레이션을 위해 기존 `gray-50~900`도 변수로 두고 테마별 톤 다르게 정의** (gray-50을 모디=`#f9fafb`, 모던=`#f7f7f5`)

---

## 3. Phase별 작업 체크리스트

> 한 Phase 끝낼 때마다 빌드/실행 확인. **모디 테마 화면은 절대 깨지면 안 됨** (기존 사용자 영향 최소화).

### Phase 0 — 토대 (반나절) ★ 가장 먼저 ✅ 완료 (2026-05-20)

목표: CSS 변수 인프라 + ThemeProvider + 설정 페이지 토글 UI까지. **이 단계 끝나면 토글로 색만 일부 바뀌어도 OK**.

- [x] `src/index.css`에 `:root` 변수 블록 작성 (모디 = 현재 값)
- [x] `src/index.css`에 `[data-theme="modern"]` 오버라이드 블록 작성 (Q1/Q4 답 반영)
- [x] `tailwind.config.js`의 하드코딩된 hex를 `var(--...)` 참조로 교체
  - `primary.50~600`, `pastel.*`, `boxShadow.soft/hover`
  - **+ gray.50~900 + surface/foreground/line 의미 토큰 + borderRadius (card/button/input)도 추가**
- [x] `src/contexts/ThemeContext.tsx` — `ThemeProvider`, `useTheme()` 작성
  - 타입: `type Theme = 'modi' | 'modern'` (`hooks/useUserProfile.ts`에 정의)
  - 초기값: localStorage('sol-theme') > user_profiles.active_theme > 'modi'
  - 변경 시 4가지 부수 효과 모두 구현 완료
- [x] `src/main.tsx`에서 `<ThemeProvider>` 최상위 감싸기 (App.tsx가 아닌 main.tsx에 — 로그인 페이지에도 적용)
- [x] `src/components/ThemePicker.tsx` — 카드 2개 토글 UI (settings 폴더 없이 components/ 바로 아래)
  - 카드 미리보기: 모디=보라 그라데이션, 모던=흰 배경 + 진초록 hairline + 직사각형
  - 선택된 카드는 `border-primary-500` 진초록/보라 테두리 + "사용 중" 배지
- [x] `src/pages/SettingsPage.tsx`에 `ThemePicker` 섹션 추가 (NotificationSettings 아래)
  - 기존 "기타 설정" placeholder의 "테마 설정" 항목 제거
- [x] **DB 마이그레이션** — `supabase/migrations/20260520_add_active_theme.sql`:
  ```sql
  ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS active_theme TEXT DEFAULT 'modi'
    CHECK (active_theme IN ('modi', 'modern'));
  ```
- [x] `src/services/userTheme.service.ts` — `fetchActiveTheme()`, `setActiveTheme(theme)`
- [x] `src/services/mockSupabase.ts` — user_profiles 매핑에 `active_theme: 'modi'` 추가
- [x] `src/hooks/useUserProfile.ts` — `Theme` 타입 export + `UserProfile.activeTheme` 필드 (필수, 기본 'modi') + `save` 시그니처에서 activeTheme 제외
- [x] **Pretendard 웹폰트 조건부 로드** — ThemeProvider 안:
  ```ts
  useEffect(() => {
    const LINK_ID = 'pretendard-font';
    if (theme === 'modern') {
      if (!document.getElementById(LINK_ID)) {
        const link = document.createElement('link');
        link.id = LINK_ID;
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css';
        document.head.appendChild(link);
      }
    }
    // 모디로 돌아가도 link는 그대로 둠 (재로드 비용 절약)
  }, [theme]);
  ```
- [x] **body font-family 우선순위** — `src/index.css`:
  ```css
  body {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont,
      "Apple SD Gothic Neo", "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
    letter-spacing: var(--letter-spacing-body, 0);
  }
  ```
  → Pretendard 없으면 자동 fallback. 모디는 변수가 `0`이라 letter-spacing 영향 없음
- [x] `.label` 유틸리티 클래스도 `index.css`에 추가 (Phase 2에서 쓸 예정이지만 미리 작업)
- [x] Vite dev 서버에서 모든 새 파일 컴파일 통과 확인 (`/src/contexts/ThemeContext.tsx` 등 200 응답)
- [ ] ⚠️ **`npm run build` 실행 시 기존 코드의 unused/implicit-any 에러 다수** (내 작업과 무관, 기존 main 브랜치도 동일). Phase 진행하면서 빌드 차원 회귀는 dev 서버로 확인. 빌드 정상화는 별도 정리 작업으로 분리

**완료 기준:** 설정에서 "모던 테마" 누르면 페이지 어딘가는 분명 바뀌어 보임 (예: primary 컬러). 모디는 기존 그대로.

---

### Phase 1 — 컬러 토큰 정의 + 자동 톤 매핑 (반나절)

목표: 색상 클래스(`text-gray-*`, `bg-gray-*`) 변경 없이도 테마에 따라 톤이 자연스럽게 바뀌게 함.

#### 1.1 모디 테마 변수 (`:root`)

```css
:root {
  /* — Primary (보라) — */
  --color-primary-50:  #faf5ff;
  --color-primary-100: #f3e8ff;
  --color-primary-200: #e9d5ff;
  --color-primary-300: #d8b4fe;
  --color-primary-400: #c084fc;
  --color-primary-500: #a855f7;
  --color-primary-600: #9333ea;

  /* — Pastel (방별) — */
  --color-pastel-purple: #e9d8fd;
  --color-pastel-pink:   #fed7e2;
  --color-pastel-lime:   #d9f99d;
  --color-pastel-brown:  #e8d5c4;
  --color-pastel-yellow: #fefcbf;

  /* — Surface / Text — */
  --color-surface:           #ffffff;
  --color-surface-muted:     #f9fafb;
  --color-foreground:        #1f2937;
  --color-foreground-muted:  #6b7280;
  --color-foreground-faint:  #9ca3af;
  --color-line:              #e5e7eb;
  --color-line-strong:       #d1d5db;

  /* — Gray 톤 (기존 text-gray-* 들이 따라감) — */
  --color-gray-50:  #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-600: #4b5563;
  --color-gray-700: #374151;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;

  /* — Shape — */
  --radius-card:    1.5rem;   /* 24px = rounded-3xl */
  --radius-card-sm: 1rem;     /* 16px = rounded-2xl */
  --radius-button:  1rem;     /* 16px */
  --radius-input:   1rem;     /* 16px */

  /* — Shadow — */
  --shadow-soft:  0 4px 20px rgba(0, 0, 0, 0.08);
  --shadow-hover: 0 8px 30px rgba(0, 0, 0, 0.12);

  /* — Typography — */
  --font-heading-weight: 700;   /* font-bold */
  --font-body-weight:    400;
  --letter-spacing-body: 0;
}
```

#### 1.2 모던 테마 오버라이드 (`[data-theme="modern"]`) — ★ 확정값

```css
[data-theme="modern"] {
  /* — Primary = 진초록 액센트 (#1b4332 deep forest green) —
     모던에서 primary-500이 곧 액센트 컬러.
     스케일 50~600은 진초록의 톤 단계로 정의 */
  --color-primary-50:  #e7eee9;   /* accent-soft 배경용 */
  --color-primary-100: #c9d8ce;
  --color-primary-200: #9ab9a4;
  --color-primary-300: #6a9979;
  --color-primary-400: #3d7a55;
  --color-primary-500: #1b4332;   /* ★ 메인 액센트 */
  --color-primary-600: #0d2b1f;   /* hover 시 */

  /* — Pastel = 모노톤으로 통일 (방별 컬러 제거, 프로필 이미지로만 구분) — */
  --color-pastel-purple: #ffffff;
  --color-pastel-pink:   #ffffff;
  --color-pastel-lime:   #ffffff;
  --color-pastel-brown:  #ffffff;
  --color-pastel-yellow: #ffffff;

  /* — Surface / Text (MUJI 톤) — */
  --color-surface:           #ffffff;
  --color-surface-muted:     #f7f7f5;   /* 살짝 구분되는 블록 */
  --color-foreground:        #1a1a1a;
  --color-foreground-muted:  #6b6b6b;
  --color-foreground-faint:  #a1a1a1;
  --color-line:              #e8e6e1;   /* 1px hairline 기본 */
  --color-line-strong:       #c9c6bf;   /* secondary 버튼 border */

  /* — Gray 톤도 warm gray로 (text-gray-* 722개가 자동 변환됨) — */
  --color-gray-50:  #f7f7f5;
  --color-gray-100: #efeeea;
  --color-gray-200: #e8e6e1;
  --color-gray-300: #c9c6bf;
  --color-gray-400: #a1a1a1;
  --color-gray-500: #6b6b6b;
  --color-gray-600: #4a4a4a;
  --color-gray-700: #2c2c2c;
  --color-gray-800: #1a1a1a;
  --color-gray-900: #000000;

  /* — Shape: 직사각형 — */
  --radius-card:    0;
  --radius-card-sm: 0;
  --radius-button:  0;
  --radius-input:   0;

  /* — Shadow: 없음 (hairline border로 대체) — */
  --shadow-soft:  none;
  --shadow-hover: none;

  /* — Typography: 가볍게 + 한글 letter-spacing 조정 — */
  --font-heading-weight: 300;
  --font-body-weight:    400;
  --letter-spacing-body: -0.005em;
}
```

> **진초록 액센트가 들어가는 자리:**
> - Primary 버튼 (`bg-primary-500 text-white`, hover→`bg-primary-600`)
> - 활성 메뉴/탭 인디케이터 (`border-b-2 border-primary-500`)
> - 강조 링크 (`text-primary-500 underline`)
> - 체크된 상태(체크박스/라디오) `bg-primary-500`
> - 진행률 바 활성 부분
>
> **금지:** 진초록을 큰 영역 배경으로 쓰지 말 것. MUJI 원칙 — "화면당 2~3군데 이내". 1px 라인이나 작은 컴포넌트에만.

#### 1.3 체크리스트
- [ ] `:root` 변수 블록 작성 (모디 값)
- [ ] `[data-theme="modern"]` 오버라이드 작성 (Q1/Q2 답 반영)
- [ ] `tailwind.config.js`에 `colors.gray` 추가 (기본 gray 그대로 두면 변수 적용 안 됨 — 명시적으로 변수 참조하도록 덮어쓰기)
- [ ] `tailwind.config.js`에 `colors.surface`, `colors.foreground`, `colors.line` 토큰 추가 (모던 톤 컴포넌트에서 사용)
- [ ] `borderRadius`, `boxShadow` 변수 참조로 변경
- [ ] 모던 테마 적용 후 홈/할일/회의실 페이지 시각 변화 확인
- [ ] gray 압도적 사용 (722개)이라 자동 톤 변환 효과 큼 — 스크린샷 비교

---

### Phase 2 — 형태 토큰 (`rounded`, `shadow`, `font-weight`) (반나절)

목표: 색만 바뀌는 게 아니라 형태(둥글기/그림자/굵기)도 테마에 따라 바뀌게.

문제: Tailwind는 `rounded-3xl` 같은 유틸이 빌드 타임에 정해진 값으로 고정됨. CSS 변수만으로는 안 바뀜.

해결: **두 가지 병행**
1. `tailwind.config.js`에 새 유틸 추가 (`rounded-card` = `var(--radius-card)`) → 신규 컴포넌트는 이거 사용
2. 글로벌 CSS에서 `[data-theme="modern"] .rounded-3xl, [data-theme="modern"] .rounded-2xl { border-radius: 0; }` 식으로 강제 오버라이드 → 기존 코드 그대로 둬도 모던에서 직사각형 됨

- [ ] `tailwind.config.js`에 `borderRadius.card`, `borderRadius.button`, `borderRadius.input` 추가 (변수 참조)
- [ ] `tailwind.config.js`에 `boxShadow.soft`, `boxShadow.hover` 변수 참조로 변경
- [ ] `src/index.css`에 모던 테마용 글로벌 오버라이드 작성:
  ```css
  [data-theme="modern"] .rounded-3xl,
  [data-theme="modern"] .rounded-2xl,
  [data-theme="modern"] .rounded-xl {
    border-radius: 0;
  }
  [data-theme="modern"] .shadow-soft,
  [data-theme="modern"] .shadow-hover {
    box-shadow: none;
    /* 대체: 그림자 사라진 자리에 hairline 보더 */
    border: 1px solid var(--color-line);
  }
  [data-theme="modern"] .font-bold {
    font-weight: 500;   /* 700 → 500로 다운 */
  }
  [data-theme="modern"] .bg-gradient-to-r,
  [data-theme="modern"] .bg-gradient-to-b,
  [data-theme="modern"] .bg-gradient-to-br {
    background-image: none !important;
    background-color: var(--color-surface);
  }
  ```
- [ ] 위 글로벌 오버라이드 적용 후 깨지는 곳 스크린샷으로 잡기
  - 카드 너무 휑한가 → `border border-line` 자동 추가됐는지 확인
  - 버튼 직사각형 어색한가 → 패딩/사이즈 점검
- [ ] `.label` 유틸리티 추가 (`src/index.css`):
  ```css
  .label {
    font-size: 0.6875rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-foreground-faint);
    font-weight: 500;
  }
  ```

---

### Phase 3 — 핵심 레이아웃 컴포넌트 마이그레이션 (1~2일)

목표: 토큰만으로 안 잡히는 디테일을 컴포넌트 단위로 모던 테마 친화적으로 고침.
**모디 테마 동작은 그대로 유지 + 모던에서 어색한 부분만 분기**.

#### 3.1 우선순위 (사용자 노출 빈도 기준)
- [ ] `src/Layout.tsx` — 페이지 배경(`bg-gradient-to-br from-primary-100 via-white to-pastel-pink/30` → 모던에선 단색 `bg-surface`)
- [ ] `src/components/NewSidebar.tsx` — 사이드바 배경/구분선/메뉴 hover
- [ ] `src/components/BottomNav.tsx` — 모바일 하단 네비 (모던에선 hairline top border)
- [ ] `src/components/ChatModal.tsx` — 채팅 패널 배경/말풍선 컬러
- [ ] `src/components/RoomCard.tsx` — 방 카드 **모노톤 처리**
  - 배경 `bg-white` 통일 (파스텔 변수가 이미 흰색이지만 명시적으로)
  - 방 구분 = **AI 프로필 이미지(`/images/{room}.png`)만** — 64~80px 정도로 크게
  - 이모지 캐릭터(💜 💗 🤎 💚 💛)도 모던에선 숨기거나 grayscale 처리
  - 호버 시 진초록 1px border 활성화 (`hover:border-primary-500`)
- [ ] `src/components/ItemDetailPopup.tsx` — 모달 (그림자 제거 영향 큼)
- [ ] `src/pages/HomePage.tsx` — 위젯 카드들
- [ ] `src/pages/SettingsPage.tsx` — 설정 페이지 (테마 토글 들어가는 곳)

#### 3.2 분기 패턴 (참고)

```tsx
import { useTheme } from '@/contexts/ThemeContext';

export function RoomCard({ ... }) {
  const { theme } = useTheme();
  return (
    <div className={
      theme === 'modern'
        ? "border border-line bg-surface p-6"
        : "rounded-3xl bg-white/60 shadow-soft p-5"
    }>
      ...
    </div>
  );
}
```

→ **남발하면 코드 더러워짐**. 90%는 토큰만으로 자동 변환, 분기는 진짜 형태가 완전히 다른 곳만.

- [ ] 위 컴포넌트 8개 모던 테마에서 시각 확인
- [ ] 분기 코드 5개 이하로 유지 (남발 금지)

---

### Phase 4 — 페이지 단위 점검 + 안티패턴 잡기 (1일)

목표: 모든 페이지를 모던 테마로 둘러보면서 깨진 곳/어색한 곳 잡기. **체크리스트 진행률 = QA 진행률**.

페이지별로 모디 → 모던 토글하면서 다음 항목 확인:

- [ ] `/` 홈 (대시보드 위젯)
- [ ] `/tasks` 할일 (리스트 + 칸반)
- [ ] `/schedule` 일정
- [ ] `/insights` 인사이트
- [ ] `/readings` 독서
- [ ] `/records` 기록
- [ ] `/projects` 프로젝트
- [ ] `/projects/:id` 프로젝트 상세
- [ ] 채팅 모달 (전략실/마케팅/개발/리서치/회의실/비서실 6개 방)
- [ ] `/settings` 설정 (테마 토글 동작 확인)

각 페이지에서 잡아야 할 안티패턴:
- ❌ `bg-gradient-*` 잔존 → 모던에서 단색으로 강제 변환됐는지 확인
- ❌ `shadow-md/lg/xl` 등 토큰 외 그림자 → 수동으로 글로벌 오버라이드 추가
- ❌ `bg-pink-100` `text-blue-500` 같은 임시 액센트 → 의미 토큰으로 점진 치환
- ❌ `font-bold` 의 의도가 진짜 강조면 두기, 단순 헤딩이면 토큰화

---

### Phase 5 — 디테일 + 마무리 (반나절)

- [ ] `markdown-body` 스타일 진초록 매핑 — `src/index.css` line 41~135
  - `#a855f7` 보라색 링크/blockquote의 hex를 `var(--color-primary-500)` 참조로 변경
  - 그러면 모디=보라, 모던=진초록 자동 분기
- [ ] AI 메시지 말풍선 색 점검 — 모디는 파스텔 유지, 모던은 `bg-surface-muted` (`#f7f7f5`) + 1px hairline
- [ ] AI 캐릭터 이미지 (`public/images/plani|maki|devi|searchi|modi.png`) — 그대로 둠 (방별 정체성 = 프로필 이미지로만 구분이므로 가장 중요)
  - 모던에서 이모지 캐릭터(💜 💗 🤎 💚 💛)는 grayscale 처리 또는 숨김 결정
- [ ] 빈 상태 컴포넌트들 (`EmptyState`) — 모던에선 일러스트 없이 `.label` + 텍스트 + 버튼만
- [ ] `.label` 사용처 발굴 — 모던 페이지 헤더 패턴(`.label` → `font-light h1` → 보조 텍스트)을 핵심 페이지(홈/할일/일정) 헤더에 적용
- [ ] 모던 테마 스크린샷 3장 (홈/할일/회의실) → `docs/screenshots/modern/` 저장 (선택)
- [ ] `docs/DESIGN.md` 업데이트 — "모디 테마 가이드"로 명시, 모던은 `muji-design-system.md` 참조 안내
- [ ] `CLAUDE.md`의 디자인 섹션에 테마 시스템 한 문단 추가
  - "테마 2종: 모디(기본, 보라/파스텔/rounded) + 모던(MUJI톤, 진초록 액센트). 설정에서 토글. `useTheme()` 훅, CSS 변수 + `data-theme`."

---

## 4. 토큰 매핑 표 (모디 ↔ 모던) — ★ 확정값

| 의미 | 모디 | 모던 | 변수 |
|------|------|------|------|
| Primary (액센트) | `#a855f7` 보라 | **`#1b4332` 진초록** | `--color-primary-500` |
| Primary hover | `#9333ea` | `#0d2b1f` | `--color-primary-600` |
| Primary soft (배경) | `#faf5ff` | `#e7eee9` | `--color-primary-50` |
| 페이지 배경 | 그라데이션 | `#ffffff` | `--color-surface` |
| 카드 배경 | `white/60` + blur | `#ffffff` + 1px border | `--color-surface` |
| 살짝 구분 블록 | `#f9fafb` | `#f7f7f5` warm | `--color-surface-muted` |
| 본문 텍스트 | `#1f2937` | `#1a1a1a` | `--color-foreground` |
| 보조 텍스트 | `#6b7280` | `#6b6b6b` | `--color-foreground-muted` |
| 메타/placeholder | `#9ca3af` | `#a1a1a1` | `--color-foreground-faint` |
| 구분선 | `#e5e7eb` | `#e8e6e1` | `--color-line` |
| Strong 구분선 | `#d1d5db` | `#c9c6bf` | `--color-line-strong` |
| **방별 컬러** (전략/마케팅/개발/리서치/회의) | 파스텔 5종 | **전부 `#ffffff`** (프로필 이미지로만 구분) | `--color-pastel-*` |
| 카드 radius | `24px` | `0` | `--radius-card` |
| 버튼 radius | `16px` | `0` | `--radius-button` |
| 카드 그림자 | `0 4px 20px rgba(0,0,0,.08)` | `none` | `--shadow-soft` |
| Heading 굵기 | `700` | `300` | `--font-heading-weight` |
| Body 폰트 | 시스템 | **Pretendard** (모던에서만 로드) | (CSS `font-family`) |
| Letter spacing | `0` | `-0.005em` | `--letter-spacing-body` |

---

## 5. 자주 깨질 만한 지점 (미리 경고)

1. **`bg-gradient-*` 잔존 (6곳)** — 글로벌 오버라이드 빠지면 모던에서 그라데이션이 그대로 나옴. Phase 2 글로벌 오버라이드로 자동 단색 변환됨. 어색하면 컴포넌트별 분기로 대체
2. **그림자 사라진 자리** — 카드들이 평면이 되면서 페이지가 휑해 보임 → 자동으로 hairline border 추가 (Phase 2 오버라이드의 `border: 1px solid var(--color-line)`)
3. **`bg-white/60` + backdrop blur** — 모던 테마는 투명/블러 안 어울림. 모던에서는 `backdrop-blur` 무력화하고 `bg-surface` 단색으로 (글로벌 오버라이드 또는 컴포넌트 분기)
4. **AI 채팅 말풍선 색** — `bg-pink-100` `bg-purple-100` 같은 직접 색이 모디 정체성. 모던에선 `bg-surface-muted` + hairline로 통일 (의미 토큰 `bg-message-user` / `bg-message-ai` 분리 권장)
5. **방별 파스텔 → 흰색** ★ 의사결정 됨 (Q2=모노톤): `pastel-*` 변수가 모던에서 전부 `#ffffff`. RoomCard에서 배경 컬러로 구분하던 곳은 자동으로 흰색이 됨 → **AI 프로필 이미지 크기 키워서 변별력 확보** (Phase 3.1에서 작업)
6. **이모지 (💜 💗 🤎 💚 💛)** ★ Q2 결정에 따라 모던에선 자제 — `grayscale(1)` filter로 회색 변환 또는 hidden. 단, 채팅 메시지의 AI 이름 옆 이모지는 작아서 그대로 둬도 OK
7. **`text-purple-*` / `text-primary-*` 직접 사용처 (28곳)** — 모디에서 보라 텍스트가 모던에선 진초록으로 자동 변환됨. 의도가 "강조"면 OK, 단순 보라 장식이면 어색할 수 있음 → Phase 4 QA에서 페이지별로 확인
8. **진초록 액센트 과사용 위험** — `bg-primary-500` 큰 영역에 쓰면 무겁고 진초록 덩어리가 됨. MUJI 원칙대로 화면당 2~3군데, 작은 컴포넌트(버튼/체크/링크)에만
9. **다크 모드 요청** — MUJI 가이드는 다크 모드 안 함이 원칙. 모던 = 순백 단일. 추후 다크 모드는 별도 테마로 ("미드나잇" 등 `THEME_MONETIZATION.md` 참조)
10. **Pretendard 로드 실패** — CDN 차단된 환경에서 fallback이 잘 동작하는지 확인. `font-family` 첫 항목이 'Pretendard'면 다음 항목으로 자동 폴백 (걱정 없음)

---

## 6. 작업 산출물 (다 끝나면 이게 있어야 함)

- [ ] `src/index.css` — `:root` + `[data-theme="modern"]` 변수 블록 + 글로벌 오버라이드
- [ ] `tailwind.config.js` — 컬러/라운드/그림자 변수 참조로 전환
- [ ] `src/contexts/ThemeContext.tsx` — Provider + 훅
- [ ] `src/components/settings/ThemePicker.tsx` — 토글 UI
- [ ] (Q3=A) `supabase/migrations/...add_active_theme.sql`
- [ ] (Q3=A) `src/services/userTheme.service.ts` + mockSupabase 매핑
- [ ] (Q4=B) Pretendard 웹폰트 조건부 로드 (`<link>` 태그 또는 dynamic import)
- [ ] 핵심 컴포넌트 8개 모던 분기 (Phase 3)
- [ ] 전 페이지 QA 통과 (Phase 4)
- [ ] `docs/DESIGN.md` 모디 테마로 리네이밍/정리
- [ ] `CLAUDE.md`에 테마 시스템 문단 추가

---

## 7. 다음 단계 (이 작업 끝난 뒤)

이번 작업으로 테마 인프라가 깔리고 무료 테마 2종(모디/모던) 운영 가능.
추후 확장은 `docs/THEME_MONETIZATION.md` 참조:
- 유료 테마 추가 (오션/포레스트/선셋/미드나잇 등) — 변수 블록만 추가하면 됨
- 테마 스토어 UI / 미리보기 10초 / 토스페이먼츠 결제 연동
- `user_themes` 테이블로 구매 내역 관리

---

## 8. 빠른 시작 — 진행 순서

1. ✅ Q1~Q4 답 확정 (2026-05-20)
2. **Phase 0 (반나절)** — 인프라 (CSS 변수 + ThemeProvider + DB + Pretendard + 설정 토글 UI)
3. **Phase 1 (반나절)** — 컬러 토큰 정의 (진초록 액센트 적용)
4. **Phase 2 (반나절)** — 형태 토큰 (radius/shadow/font-weight 글로벌 오버라이드)
5. **Phase 3 (1~2일)** — 핵심 컴포넌트 8개 분기 (Layout/Sidebar/ChatModal/RoomCard 등)
6. **Phase 4 (1일)** — 페이지 10개 QA
7. **Phase 5 (반나절)** — 디테일 (markdown / 빈상태 / .label 패턴)

**합산 4~5일.** Phase 0~2 끝나면 (1.5일) 이미 토글 가능 상태.

### 첫날 시작 순서 (Phase 0)
1. `src/index.css` `:root` + `[data-theme="modern"]` 변수 블록 작성
2. `tailwind.config.js` 컬러를 변수 참조로 변경
3. DB 마이그레이션 작성 + 적용
4. `ThemeContext.tsx` + `userTheme.service.ts` + mockSupabase 매핑
5. `<ThemeProvider>` App에 감싸기
6. `ThemePicker` 컴포넌트 + SettingsPage 통합
7. 브라우저에서 토글 동작 확인 (먼저 primary 컬러만 바뀌면 OK)

---

*이 문서는 작업 진행하면서 체크박스 채우는 용도. Phase 0부터 바로 진행 가능.*

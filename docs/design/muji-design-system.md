# MUJI 디자인 시스템 — 포터블 가이드

> 밋업에서 검증된 무인양품(無印良品) 스타일 디자인 시스템을 다른 앱에
> 그대로 옮겨 쓸 수 있게 정리한 문서. 토큰, 타이포, 여백, 컴포넌트 패턴까지
> "복붙해서 시작" 할 수 있는 수준으로 담음.
>
> 이 문서는 **결정본** 성격이라 자주 안 바뀌고, 새 프로젝트의 `CLAUDE.md`
> 디자인 섹션 / `index.css` 토큰 정의에 그대로 옮겨 붙일 수 있다.

---

## 0. 한 줄 요약

> 「있는 그대로의 아름다움」 — 흰 여백, 가는 선(hairline), 절제된 타이포그래피, 그리고 단 하나의 컬러 액센트.

## 1. 핵심 원칙 (7개)

1. **순백의 배경 (`#ffffff`)**. 그라데이션·다크 모드·컬러풀한 배경 금지.
2. **그림자 없음**. 깊이는 hairline border (1px `--line`) 로만 표현.
3. **둥근 모서리 거의 없음**. 카드/버튼 모두 직사각형 (`rounded-none`).
   아바타·체크박스·라디오 등 원형이 자연스러운 요소만 예외.
4. **가벼운 글자 두께** — 본문 `font-normal(400)`, 헤딩도 `font-light(300)` ~
   `font-normal(400)` 까지. `font-bold` 는 사용 자제.
5. **여백이 곧 디자인**. 섹션 사이 `space-y-14` ~ `space-y-20`. 빽빽함 금지.
6. **컬러 절제**. 본문은 무채색만 사용. **유일한 컬러 액센트는 단 하나**
   (밋업은 `--accent-teal` `#0a4145`) — 그리고 그것조차 화면당 2~3군데
   이내로 제한.
7. **레이블은 트래킹 넓은 영문 대문자** (예: `MEETING` `MEMBER`). 한국어
   본문과 시각적으로 구분하는 유일한 장식 요소.

---

## 2. 컬러 — 토큰 시스템

### 2.1 CSS 변수 (붙여넣기용)

```css
:root {
  /* — Background / Surface — */
  --background:        #ffffff;
  --surface:           #ffffff;
  --surface-muted:     #f7f7f5;   /* warm off-white for subtle blocks */

  /* — Foreground — */
  --foreground:        #1a1a1a;   /* 본문 */
  --foreground-muted:  #6b6b6b;   /* 보조 텍스트 */
  --foreground-faint:  #a1a1a1;   /* 레이블, 메타 정보 */

  /* — Lines (no shadows!) — */
  --line:              #e8e6e1;   /* hairline borders, dividers */
  --line-strong:       #c9c6bf;   /* secondary 버튼 border 등 */

  /* — Accent (단색) — */
  --accent:            #1a1a1a;   /* primary 버튼 = 검정 */
  --accent-foreground: #ffffff;
  --accent-teal:       #0a4145;   /* ★ 단 하나의 컬러 액센트. 절제 사용 */
  --accent-amber:      #b5862c;   /* 중간 상태(지각/대기 등) 강조 */

  /* — Danger — */
  --danger:            #b54a3a;   /* warm muted red, 너무 빨갛지 않게 */
  --danger-bg:         #fbf1ef;
}
```

> **다른 앱으로 가져갈 때**: `--accent-teal` 만 그 앱의 정체성 컬러로 갈아끼면
> 나머지 톤은 그대로 써도 됨. 예) 푸드 앱이면 `--accent-clay` `#7a4a2b`,
> 핀테크면 `--accent-navy` `#1c2d4a`. **단, 한 앱에 액센트는 하나**.

### 2.2 Tailwind v4 노출 (`@theme inline`)

```css
@theme inline {
  --color-background:        var(--background);
  --color-surface:           var(--surface);
  --color-surface-muted:     var(--surface-muted);
  --color-foreground:        var(--foreground);
  --color-foreground-muted:  var(--foreground-muted);
  --color-foreground-faint:  var(--foreground-faint);
  --color-line:              var(--line);
  --color-line-strong:       var(--line-strong);
  --color-accent:            var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent-teal:       var(--accent-teal);
  --color-accent-amber:      var(--accent-amber);
  --color-danger:            var(--danger);
  --color-danger-bg:         var(--danger-bg);
}
```

이러면 `bg-surface` `text-foreground-muted` `border-line` 처럼 토큰명을 그대로
유틸리티로 쓸 수 있다.

### 2.3 사용 규칙

| 용도 | 사용할 토큰 |
|---|---|
| 페이지 / 카드 배경 | `bg-surface` (`#fff`) — 거의 모든 곳 |
| 살짝 구분되는 블록 | `bg-surface-muted` (`#f7f7f5`) — 코드, FAQ, 인용 |
| 본문 텍스트 | `text-foreground` |
| 보조 설명 (날짜·작성자) | `text-foreground-muted` |
| 메타·레이블·placeholder | `text-foreground-faint` |
| 모든 구분선 / 경계선 | `border-line` (1px) — 그림자 대신 |
| Secondary 버튼 border | `border-line-strong` |
| Primary 버튼 | `bg-accent text-accent-foreground` (검정/흰) |
| 브랜드 강조 (★ 절제) | `text-accent-teal` / `bg-accent-teal` |
| 경고 / 위험 | `text-danger` / `bg-danger-bg` |

**금지**:
- ❌ `bg-slate-*` / `bg-gray-*` / `bg-stone-*` 같은 Tailwind 기본 회색 — 우리
  토큰만 사용. 톤 일관성 깨지기 시작하는 원흉.
- ❌ `shadow-*` 어떤 단계도 — 그림자는 안 씀.
- ❌ `bg-gradient-*` — 그라데이션 금지.
- ❌ 두 번째 액센트 컬러 추가 — 하나로 유지.

---

## 3. 타이포그래피

### 3.1 폰트 스택

```css
body {
  font-family:
    -apple-system, BlinkMacSystemFont,
    "Apple SD Gothic Neo",        /* macOS / iOS 한글 */
    "Pretendard",                  /* 웹폰트 쓸 때 */
    "Noto Sans KR",                /* fallback */
    "Segoe UI",                    /* Windows */
    sans-serif;
  letter-spacing: -0.005em;       /* 한글 가독성을 위해 살짝 좁힘 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4 {
  font-weight: 400;               /* 헤딩도 가볍게 */
  letter-spacing: -0.015em;       /* 큰 글자는 더 좁힘 */
}
```

> 별도 웹폰트 로딩 안 함이 기본. **Pretendard** 같은 깔끔한 한글 폰트가 이미
> 시스템에 있으면 자연스럽게 사용됨. 한글 가독성을 위해 letter-spacing 을
> 살짝 음수로.

### 3.2 위계 (heading scale)

| 용도 | 클래스 | 비고 |
|---|---|---|
| 페이지 헤드라인 | `text-3xl font-light` (30px / 300) | 가볍게. 페이지당 1개 |
| 섹션 헤딩 | `text-xl font-normal` (20px / 400) | |
| 카드 제목 | `text-base font-normal` (16px / 400) | |
| 본문 | `text-sm` (14px) 모바일 / `text-base` (16px) | 본문은 normal |
| 보조 / 메타 | `text-xs text-foreground-muted` (12px) | |
| **레이블** (`.label`) | 11px / `letter-spacing: 0.22em` / UPPERCASE | 영문 전용 |

### 3.3 레이블 유틸리티 (`.label`)

밋업 디자인의 시그니처. 한국어 페이지 안에서 영문 대문자 라벨을 트래킹
넓게 배치 — 무인양품 카탈로그 같은 분위기.

```css
.label {
  font-size: 0.6875rem;          /* 11px */
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--foreground-faint);
  font-weight: 500;
}
```

사용 예:
```tsx
<p className="label">Section</p>
<h1 className="mt-3 text-3xl font-light">한국어 헤드라인</h1>
```

★ 한국어 페이지에서 영문 레이블 → 한국어 헤드라인 순서로 배치하면 시각적
리듬이 살아난다. 반대로 한국어 레이블 → 한국어 헤드라인은 단조로움.

### 3.4 한국어 / 영문 규칙

- **본문, 카피, 도메인 용어, 에러 메시지 → 한국어**
- **영문은 액센트로만**:
  - 레이블 (`.label`)
  - 브랜드 워드마크
  - 상태 뱃지 (`NEW`, `BETA`)
- 짧은 카피는 **마침표 없이** 끝낸다 ("로그인하기" ○ / "로그인하기." ✗)
- 버튼 텍스트는 동사로 시작 ("저장" "취소" "확인")

---

## 4. 여백 / 레이아웃

### 4.1 Spacing scale (Tailwind 기본 사용)

| 용도 | 권장값 |
|---|---|
| 인접 요소 사이 (밀착) | `gap-2` ~ `gap-3` (8~12px) |
| 폼 필드 사이 | `space-y-4` ~ `space-y-6` (16~24px) |
| 카드 안 패딩 | `p-5` ~ `p-6` (20~24px) |
| 카드 사이 | `space-y-4` (16px) 모바일 / `space-y-6` 데스크탑 |
| 페이지 섹션 사이 | **`space-y-14` ~ `space-y-20`** (56~80px) ★ 핵심 |
| 페이지 좌우 패딩 | `px-5` 모바일 / `px-8` ~ `px-12` 데스크탑 |

**섹션 간 큰 여백** 이 무인양품 톤의 가장 큰 차별점. 빽빽한 SaaS 톤이 되지
않도록 `space-y-14` 아래로는 잘 안 내려간다.

### 4.2 컨테이너 폭

```tsx
<div className="mx-auto max-w-3xl px-5 sm:px-8">…</div>
```

- 기본 본문 컨테이너: `max-w-3xl` (768px) — 읽기 편한 폭
- 와이드 콘텐츠: `max-w-5xl` (1024px)
- 본문 텍스트: `max-w-prose` (~65ch) 로 줄 길이 제한 권장

### 4.3 그리드 / 정렬

- 카드 그리드: 모바일 1열 → 데스크탑 2~3열
  ```tsx
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">…</div>
  ```
- 리스트는 그리드보다 **세로 분할선 리스트** (divide) 가 더 무지스러움:
  ```tsx
  <ul className="divide-y divide-line border-y border-line">…</ul>
  ```

### 4.4 hairline border 규칙

- 두께는 **항상 1px** — `border-2` 이상 안 씀
- 색은 `--line` 이 기본, 강조 시 `--line-strong`
- 카드의 경계는 `border border-line` — 그림자 없음
- 섹션 구분은 `border-t border-line` 한 줄로 끝

---

## 5. 컴포넌트 패턴 (복붙용 스니펫)

### 5.1 페이지 헤더

```tsx
<header className="space-y-3">
  <p className="label">Dashboard</p>
  <h1 className="text-3xl font-light">안녕하세요, {name}</h1>
  <p className="text-sm text-foreground-muted">오늘 일정 3개</p>
</header>
```

### 5.2 Primary 버튼

```tsx
<button className="
  border border-accent bg-accent
  px-7 py-3 text-sm text-accent-foreground
  hover:bg-foreground-muted hover:border-foreground-muted
  disabled:opacity-40 disabled:cursor-not-allowed
">
  시작하기
</button>
```

### 5.3 Secondary 버튼

```tsx
<button className="
  border border-line-strong
  px-7 py-3 text-sm text-foreground
  hover:border-foreground
">
  둘러보기
</button>
```

### 5.4 Tertiary / 텍스트 버튼

```tsx
<button className="text-sm text-foreground-muted hover:text-foreground underline underline-offset-2">
  자세히
</button>
```

### 5.5 카드 (그림자 없는 hairline 박스)

```tsx
<article className="border border-line p-6 bg-surface">
  <p className="label">Meeting</p>
  <h3 className="mt-2 text-base font-normal">2026 1Q 정기 모임</h3>
  <p className="mt-2 text-sm text-foreground-muted">3월 12일 · 강남</p>
</article>
```

### 5.6 리스트 (divider 기반)

```tsx
<ul className="divide-y divide-line border-y border-line">
  {items.map(it => (
    <li key={it.id} className="flex items-center justify-between py-4">
      <span className="text-sm">{it.title}</span>
      <span className="text-xs text-foreground-faint">{it.date}</span>
    </li>
  ))}
</ul>
```

### 5.7 폼 입력

```tsx
<label className="block space-y-2">
  <span className="label">Email</span>
  <input
    type="email"
    className="
      w-full border border-line bg-surface
      px-4 py-3 text-base text-foreground
      placeholder:text-foreground-faint
      focus:border-foreground focus:outline-none
    "
    placeholder="you@example.com"
  />
</label>
```

★ `focus:ring-*` 안 씀 → 대신 `focus:border-foreground` 로 border 진하게.
시스템 일관성 유지.

### 5.8 뱃지 / 태그

```tsx
<span className="border border-line px-2 py-0.5 text-xs text-foreground-muted">
  진행중
</span>
```

상태별 컬러:
- 기본: `border-line text-foreground-muted`
- 위험: `border-danger text-danger`
- 중간상태 (지각/대기): `border-accent-amber/40 text-accent-amber`
- 강조 (★ 절제): `bg-accent-teal text-white`

### 5.9 빈 상태 (Empty state)

```tsx
<div className="border border-line py-16 text-center">
  <p className="label">Empty</p>
  <p className="mt-3 text-sm text-foreground-muted">아직 회의록이 없어요</p>
  <button className="mt-6 border border-line-strong px-5 py-2 text-sm">
    첫 회의록 작성
  </button>
</div>
```

일러스트/아이콘 자제. 텍스트와 버튼만으로 충분.

---

## 6. 모바일 / PWA

### 6.1 모바일 우선

- **기본 스타일이 모바일**, `sm:` / `md:` / `lg:` 로 키워나감
- 터치 영역 ≥ **44×44px** — 버튼은 `py-3` 이상
- 본문 폰트 ≥ **14px** (`text-sm`), 기본은 16px (`text-base`)
- **가로 스크롤 절대 금지** — `truncate` / `line-clamp-N` / `break-all`

### 6.2 Safe area (iPhone 노치 / 홈 인디케이터)

`index.html` 의 viewport meta:
```html
<meta name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="theme-color" content="#ffffff" />
```

`index.css` 의 safe-area 토큰:
```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}
body {
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
  padding-left: var(--safe-left);
  padding-right: var(--safe-right);
}
```

`@theme inline` 에 spacing 토큰으로 노출:
```css
--spacing-safe-top: var(--safe-top);
--spacing-safe-bottom: var(--safe-bottom);
```

→ `pt-safe-top` / `pb-safe-bottom` 같은 유틸리티 사용 가능.

**규칙**:
- 고정 헤더 → `pt-safe-top`
- 고정 푸터 / BottomNav → `pb-safe-bottom`
- 페이지 높이는 `min-h-dvh` (`min-h-screen` 대신 — iOS 동적 주소창 대응)

### 6.3 모바일 네비게이션 패턴

| 화면 | 네비 |
|---|---|
| 메인 (랜딩/대시보드) | 상단 햄버거 → 슬라이드 패널 |
| 서브 (목록/상세) | 하단 BottomNav (4~5개 메뉴) |
| 데스크탑 (`lg:`) | 상단 가로 네비 — 햄버거/BottomNav 둘 다 숨김 |

BottomNav 5개 초과 시 마지막은 **"더보기"** 로 묶기.

### 6.4 인터랙션 톤

- 트랜지션: `transition-colors duration-150` 정도. 길고 화려한 모션 금지
- 호버 효과: 색 살짝 진해지는 정도 (`hover:border-foreground`)
- 클릭 피드백: `active:bg-surface-muted` 로 가볍게
- 로딩: 스피너 대신 **텍스트** ("불러오는 중…") 또는 hairline 한 줄
- 스켈레톤: `bg-surface-muted` + `animate-pulse` 정도, 컬러 X

---

## 7. 다크 모드 — 사용 안 함

이 시스템은 **순백 단일 모드**가 정체성. 다크 모드 추가는 톤을 깨므로
기본적으로 도입하지 않는다.

> 정말 필요해진다면 — `--background` `#fafaf7` 정도로 살짝 톤 다운하는
> "warm light" 정도까지만 고려. 실제 다크 모드는 무인양품 톤이 아님.

---

## 8. 다른 앱에 옮길 때 체크리스트

새 프로젝트에 이 시스템을 이식할 때 순서:

- [ ] `src/index.css` 에 위 **§2.1 + §2.2** 토큰 블록 그대로 복사
- [ ] `body` 폰트 스택 / safe-area padding / `overscroll-behavior: none`
      / `touch-action: pan-y` / `overflow-x: hidden` 복사 (**§3.1 + §6.2**)
- [ ] `.label` 유틸리티 추가
- [ ] Tailwind v4 라면 `@theme inline` 그대로, v3 라면 `tailwind.config.js`
      의 `theme.extend.colors` 로 동일 매핑
- [ ] **단 하나의 액센트 컬러** 결정 (`--accent-teal` 자리) — 그 앱의 정체성
      컬러로 교체. 나머지 토큰은 그대로 시작
- [ ] 기존 `slate-*` / `gray-*` / `stone-*` 색상 클래스 전부 토큰으로 치환
- [ ] 모든 `shadow-*` / `rounded-*` (아바타·체크박스 제외) 제거
- [ ] 페이지 헤더에 `.label` → `font-light` 헤드라인 패턴 적용 (**§5.1**)
- [ ] 카드/리스트를 `border border-line` + `divide-y divide-line` 로 통일
- [ ] 섹션 간 여백 `space-y-14` 이상 확보
- [ ] 모바일에서 BottomNav 적용, `pb-safe-bottom` 빠지지 않게
- [ ] 폰트 두께 점검 — `font-bold` 잔존하면 `font-normal` 로 다운

이 체크리스트만 통과하면 어느 앱이든 무인양품 톤이 나온다.

---

## 9. 안티패턴 (자주 무너지는 지점)

- **"강조하려고 색 하나만 더 쓸게요"** → 두 번째 액센트 컬러는 댐 무너지는
  시작점. 강조는 굵기·크기·여백으로.
- **"카드에 살짝 그림자만"** → `shadow-sm` 도 NO. 그림자가 들어가는 순간
  무지 톤이 사라짐.
- **"버튼 둥글게 하면 친근해 보이는데"** → 직사각형 유지. 친근함은 카피와
  여백에서.
- **"빈 공간이 너무 휑한데 일러스트라도"** → 일러스트 없이 텍스트로 처리.
  여백은 디자인의 일부.
- **"본문 굵게 해야 잘 보일 것 같은데"** → 굵기 대신 크기를 키우거나
  레이블을 추가.
- **"모바일에서 폰트 좀 줄여서 빽빽하게"** → 14px 이하 금지. 줄이는 대신
  덜어내라.

---

## 10. 참고 자료

- 무인양품 (MUJI) 공식 가이드 — 미니멀리즘 / 한큐 카탈로그 톤
- iA Writer / Notion — 타이포 위계의 절제
- Linear, Vercel — 흰 배경 + hairline 사용 사례

> 이 시스템의 가장 큰 적은 "조금만 더 화려하게" 라는 충동이다. 의심스러우면
> **덜어내는 쪽**이 항상 맞다.

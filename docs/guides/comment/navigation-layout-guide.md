# 상단바 · 네비게이션 — PC / 모바일 전체 가이드

> 밋업 앱의 **현재 네비게이션 구현 전체**를 정리한 문서.
> 대분류를 어떻게 잡았고, 세부 메뉴를 어디에 배치했고, PC 에선 메가메뉴 / 모바일에선
> 하단바+풀시트로 어떻게 갈랐고, 프로필을 누르면 뭐가 뜨는지 — 레이아웃 코드까지 전부.
>
> 구현 파일: `src/layouts/app-layout.tsx` (686줄) · `src/components/mobile-bottom-nav.tsx` (171줄)
> · `src/components/brand-mark.tsx`

---

## 목차

1. [한눈에 보기](#1-한눈에-보기)
2. [정보 구조 — 대분류를 어떻게 잡았나](#2-정보-구조--대분류를-어떻게-잡았나)
3. [단일 소스 `NAV` 상수](#3-단일-소스-nav-상수)
4. [브레이크포인트 전략 — `sm` 하나로 가른다](#4-브레이크포인트-전략--sm-하나로-가른다)
5. [PC — 상단바 레이아웃](#5-pc--상단바-레이아웃)
6. [PC — 메가메뉴 (세부 메뉴 4열)](#6-pc--메가메뉴-세부-메뉴-4열)
7. [PC — 프로필 드롭다운](#7-pc--프로필-드롭다운)
8. [모바일 — 상단바는 브랜드만](#8-모바일--상단바는-브랜드만)
9. [모바일 — 하단 고정 BottomNav](#9-모바일--하단-고정-bottomnav)
10. [모바일 — 「더보기」 풀스크린 시트](#10-모바일--더보기-풀스크린-시트)
11. [열림 상태 3개와 닫힘 규칙](#11-열림-상태-3개와-닫힘-규칙)
12. [z-index 지도](#12-z-index-지도)
13. [스타일 토큰 · 클래스 레퍼런스](#13-스타일-토큰--클래스-레퍼런스)
14. [접근성 체크리스트](#14-접근성-체크리스트)
15. [Safe Area · PWA](#15-safe-area--pwa)
16. [메뉴 추가·변경하는 법](#16-메뉴-추가변경하는-법)
17. [자주 하는 실수 10가지](#17-자주-하는-실수-10가지)

---

## 1. 한눈에 보기

| | **PC (`sm:` 이상, 640px~)** | **모바일 (~639px)** |
| --- | --- | --- |
| 상단바 | 브랜드 + 대분류 5개 + 검색 + 프로필칩 | **브랜드만** (오른쪽 비어 있음) |
| 대분류 진입 | 상단 텍스트 버튼 클릭 | 하단 「더보기」 |
| 세부 메뉴 | **메가메뉴** — 헤더 아래 4열 슬라이드 패널 | **풀스크린 시트** — 그룹별 세로 리스트 |
| 자주 쓰는 메뉴 | 상단바에 상시 노출 | **하단 고정 BottomNav 5칸** |
| 프로필 | 우상단 칩 → **드롭다운** (아래로 이어진 한 박스) | 시트 최상단 sticky 프로필 + 「마이」/「기타」 그룹 |
| 검색 | 상단 아이콘 버튼 (9×9 정사각) | 시트 sticky 영역의 「통합 검색」 행 |
| 로그아웃 | 드롭다운 맨 아래 (danger) | 시트 「기타」 맨 아래 (danger) |

```
── PC ───────────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────────┐
│ ● MEETUP    홈  모임▾ 실행▾ 성장▾ 소개▾  밋업메인홈↗ 딴길청년↗  [🔍] [⬤ 김대표 ▾] │
└──────────────────────────────────────────────────────────────────┘
   ↓ 대분류 클릭 시 (슬라이드 다운, 뒤 배경 dim)
┌──────────────────────────────────────────────────────────────────┐
│  모임            실행            성장            소개            │
│  일정            프로젝트        글쓰기          공지사항        │
│  회의록          할일            챌린지          밋업 소개       │
│  안건·투표       콘텐츠          인사이트                        │
│  멤버                            비전보드                        │
└──────────────────────────────────────────────────────────────────┘

── 모바일 ──────────────────
┌────────────────────────┐
│ ● MEETUP               │  ← 상단바: 브랜드만
├────────────────────────┤
│                        │
│      (본문 콘텐츠)      │
│                        │
├────────────────────────┤
│ 🏠   📅   📖   ✓   ⋯   │  ← 하단 고정 5칸
│ 홈  일정 챌린지 할일 더보기│
└────────────────────────┘
      ↓ 더보기 탭
┌────────────────────────┐
│ ⬤ 김대표          [닫기]│ ← sticky
│ 🔍 통합 검색            │
├────────────────────────┤
│ 마이                    │
│  내 정보 관리        ›  │
│  내 활동             ›  │
│ ─────────────────────  │
│ 모임                    │
│  일정 / 회의록 / …   ›  │
│ ─────────────────────  │
│ 실행 · 성장 · 소개 …    │
│ 바로가기 (↗)            │
│ 기타 + 로그아웃         │
└────────────────────────┘
```

---

## 2. 정보 구조 — 대분류를 어떻게 잡았나

메뉴가 17개다. 평평하게 늘어놓으면 상단바가 터지고, 사용자는 무엇이 어디 있는지 못 외운다.
**「사용자가 지금 무슨 모드인가」** 를 기준으로 4개 그룹 + 홈으로 묶었다.

| 대분류 | 세부 메뉴 | 묶은 기준 |
| --- | --- | --- |
| **홈** (그룹 아님) | `/dashboard` | 진입점. 하위가 없으므로 바로 링크 |
| **모임** | 일정 · 회의록 · 안건·투표 · 멤버 | **함께 모여서** 하는 일 |
| **실행** | 프로젝트 · 할일 · 콘텐츠 | 모임에서 나온 걸 **실제로 굴리는** 일 |
| **성장** | 글쓰기 · 챌린지 · 인사이트 · 비전보드 | **개인이 쌓아가는** 것 |
| **소개** | 공지사항 · 밋업 소개 | 읽기만 하는 정적 정보 |

### 설계 규칙

1. **그룹은 4개까지.** 5개를 넘으면 메가메뉴 4열 그리드가 깨지고 상단바도 좁아진다.
2. **한 그룹의 항목은 2~4개.** 1개면 그룹으로 묶을 이유가 없고(그냥 leaf), 5개 넘으면
   그룹 이름이 부정확하다는 신호.
3. **그룹 이름은 두 글자 한국어.** 「모임 / 실행 / 성장 / 소개」 — 길이가 같아 상단바
   리듬이 고르다. 영어 라벨(`.label`)은 메가메뉴 안 소제목에서만 쓴다.
4. **개인 계정 관련은 대분류에 넣지 않는다.** 전부 프로필 드롭다운으로 (§7).
5. **워크스페이스 밖으로 나가는 링크는 `↗`** 를 붙여 시각적으로 분리한다
   (밋업 메인홈 `/`, 딴길청년 `/dangil`).

### 「홈」만 그룹이 아닌 이유

`/dashboard` 는 하위 메뉴가 없다. 그룹으로 만들면 클릭했을 때 항목 1개짜리 메가메뉴가
열려서 클릭 한 번을 낭비한다. **타입 자체를 나눠서** 이걸 구조적으로 강제한다 (§3).

---

## 3. 단일 소스 `NAV` 상수

네비게이션은 **한 곳에서만 정의**한다. PC 상단바 · PC 메가메뉴 · 모바일 시트가 전부
이 배열을 순회해서 그려진다. 메뉴를 추가할 때 고칠 곳이 1개면 세 화면이 동시에 바뀐다.

```tsx
type NavLeaf = { kind: "leaf"; to: string; label: string };
type NavGroup = {
  kind: "group";
  /** 열린 그룹을 식별하는 안정적인 키 */
  id: string;
  label: string;
  items: { to: string; label: string }[];
};
type NavEntry = NavLeaf | NavGroup;

const NAV: NavEntry[] = [
  { kind: "leaf", to: "/dashboard", label: "홈" },
  {
    kind: "group",
    id: "moim",
    label: "모임",
    items: [
      { to: "/meetings", label: "일정" },
      { to: "/notes",    label: "회의록" },
      { to: "/agendas",  label: "안건·투표" },
      { to: "/members",  label: "멤버" },
    ],
  },
  {
    kind: "group",
    id: "execute",
    label: "실행",
    items: [
      { to: "/projects", label: "프로젝트" },
      { to: "/tasks",    label: "할일" },
      { to: "/channels", label: "콘텐츠" },
    ],
  },
  {
    kind: "group",
    id: "content",
    label: "성장",
    items: [
      { to: "/writings",      label: "글쓰기" },
      { to: "/readings",      label: "챌린지" },
      { to: "/insights",      label: "인사이트" },
      { to: "/vision-boards", label: "비전보드" },
    ],
  },
  {
    kind: "group",
    id: "intro",
    label: "소개",
    items: [
      { to: "/notices", label: "공지사항" },
      { to: "/about",   label: "밋업 소개" },
    ],
  },
];
```

> **판별 유니온(discriminated union)을 쓴 이유** — `kind` 로 갈라두면 렌더 코드에서
> `if (entry.kind === "leaf")` 분기 후 TypeScript 가 `entry.items` 접근을 막아준다.
> "홈에는 하위 메뉴가 없다" 는 규칙이 타입으로 강제된다.

### 프로필 메뉴도 상수로

```tsx
type ProfileItem = { to: string; label: string };

const PROFILE_PRIMARY: ProfileItem[] = [
  { to: "/profile",  label: "내 정보 관리" },
  { to: "/me/posts", label: "내 활동" },
];
const PROFILE_SECONDARY: ProfileItem[] = [
  { to: "/stats",    label: "활동 리포트" },
  { to: "/feedback", label: "개발자에게 한마디" },
];
const PROFILE_ADMIN: ProfileItem[] = [
  { to: "/admin", label: "관리자 메뉴" },
];
```

3덩어리로 나눈 이유는 §7 에서.

### 그룹 활성 판정

현재 URL 이 그 그룹에 속하는지 — 하위 경로(`/meetings/123`)까지 포함해야 한다.

```tsx
function isPathInGroup(pathname: string, group: NavGroup): boolean {
  return group.items.some(
    (it) => pathname === it.to || pathname.startsWith(`${it.to}/`),
  );
}
```

> `startsWith(it.to)` 만 쓰면 `/notes` 와 `/notices` 가 서로를 활성화시킨다.
> **반드시 `${it.to}/` 처럼 슬래시를 붙여** 비교한다.

---

## 4. 브레이크포인트 전략 — `sm` 하나로 가른다

밋업은 `md` / `lg` 를 네비게이션에 쓰지 않는다. **`sm`(640px) 한 줄로만** 자른다.

```
~639px   : 모바일 모드 — 상단바 브랜드만 + 하단바 + 풀시트
640px~   : 데스크탑 모드 — 상단바 전체 + 메가메뉴 + 프로필 드롭다운
```

```tsx
// 데스크탑 전용
className="hidden sm:flex"      // 상단 nav
className="hidden sm:inline-flex" // 검색 버튼
className="hidden sm:block"     // 프로필 칩
className="hidden sm:grid"      // 메가메뉴 패널

// 모바일 전용
className="sm:hidden"           // BottomNav, 더보기 시트
```

**태블릿(768px)을 따로 만들지 않는 이유** — 640px 이상이면 상단바에 대분류 5개 + 검색 +
프로필이 여유 있게 들어간다. 중간 단계를 만들면 테스트할 조합이 3배가 되고, 실제 사용자
중 태블릿 비율은 무시할 수준이다. **분기는 적을수록 좋다.**

---

## 5. PC — 상단바 레이아웃

### 5.1 구조

```
헤더 (border-b, bg-surface, relative, z-30)
└ mx-auto max-w-6xl · flex justify-between · px-4 sm:px-8 · py-4 sm:py-5
   ├ [좌] BrandMark  (shrink-0)
   └ [우] flex gap-3 sm:gap-5
        ├ nav        (hidden sm:flex)  — 대분류 5개 + 외부링크 2개
        ├ 검색 버튼   (hidden sm:inline-flex) — 36×36 정사각 보더
        └ 프로필 칩   (hidden sm:block, relative, min-w-[14rem])
```

```tsx
<header ref={megaRef} className="border-b border-line bg-surface relative z-30">
  <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
    <Link to="/dashboard" aria-label="Meetup home" className="shrink-0">
      <BrandMark />
    </Link>

    <div className="flex items-center gap-3 sm:gap-5">
      {/* … nav / 검색 / 프로필 … */}
    </div>
  </div>
  {/* 메가메뉴 패널은 header 안, 이 div 밖 (§6) */}
</header>
```

**핵심 포인트**

- `max-w-6xl`(1152px) — 본문 `<main>` 과 **같은 폭**. 브랜드와 본문 왼쪽 끝이 정확히
  맞아떨어진다.
- `relative` + `z-30` — 메가메뉴 패널이 `absolute top-full` 로 붙을 기준점이자,
  dim 오버레이(z-20)보다 위에 있어야 헤더는 계속 클릭 가능하다.
- `border-b border-line` — 그림자 대신 hairline 한 줄. MUJI 원칙.
- 세로 패딩 `py-4 sm:py-5` — 모바일에서 살짝 낮춰 콘텐츠 영역을 벌어준다.

### 5.2 브랜드 마크

```tsx
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {/* 앱 전체에서 유일하게 상시 노출되는 컬러 액센트 */}
      <span aria-hidden className="block size-1.5 rounded-full bg-accent-teal" />
      <span className="label">Meetup</span>
    </span>
  );
}
```

로고 이미지가 아니라 **6px teal 점 + 트래킹 넓은 대문자 워드마크**다. 라이트/다크 걱정도
없고 어떤 크기에서도 선명하다.

### 5.3 대분류 버튼 (leaf / group)

```tsx
<nav className="hidden sm:flex items-center gap-1 text-sm">
  {NAV.map((entry) => {
    // ① leaf — 그냥 링크
    if (entry.kind === "leaf") {
      return <NavLeafItem key={entry.to} to={entry.to}>{entry.label}</NavLeafItem>;
    }
    // ② group — 메가메뉴 토글 버튼
    const activeChild = isPathInGroup(location.pathname, entry);
    return (
      <button
        key={entry.id}
        type="button"
        onClick={() => setMegaOpen((v) => !v)}
        aria-expanded={megaOpen}
        aria-haspopup="menu"
        className={`px-3 py-1.5 transition-colors ${
          activeChild || megaOpen
            ? "text-foreground"                                   // 활성 = 진한 글자
            : "text-foreground-muted hover:text-foreground"       // 기본 = 회색
        }`}
      >
        {entry.label}
      </button>
    );
  })}
  {/* 외부 제품 이동 */}
  <Link to="/" className="px-3 py-1.5 inline-flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors">
    밋업 메인홈 <span aria-hidden className="text-foreground-faint">↗</span>
  </Link>
  <Link to="/dangil" className="px-3 py-1.5 inline-flex items-center gap-1 text-foreground-muted hover:text-foreground transition-colors">
    딴길청년 <span aria-hidden className="text-foreground-faint">↗</span>
  </Link>
</nav>
```

```tsx
function NavLeafItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={false}                            // ★ 하위 경로도 활성으로 인정
      className={({ isActive }) =>
        `px-3 py-1.5 transition-colors ${
          isActive ? "text-foreground" : "text-foreground-muted hover:text-foreground"
        }`
      }
    >
      {children}
    </NavLink>
  );
}
```

**활성 표현은 밑줄이나 배경이 아니라 「글자 농도」다.** 회색(`text-foreground-muted`) →
검정(`text-foreground`). 선이 하나도 늘지 않아 상단바가 조용하다.

**어떤 그룹을 눌러도 같은 메가메뉴가 열린다.** 그룹별로 다른 패널을 여는 게 아니라
**4열 전체가 한 번에** 펼쳐진다. 이유:
- 사용자가 "안건이 모임에 있었나 실행에 있었나" 를 고민하지 않아도 된다 — 다 보인다.
- 그룹마다 패널 위치를 계산하는 코드가 사라진다.
- 열고 닫는 상태가 boolean 하나(`megaOpen`)면 끝난다.

### 5.4 검색 버튼

```tsx
<Link
  to="/search"
  aria-label="검색"
  className="hidden sm:inline-flex items-center justify-center w-9 h-9 border border-line
             text-foreground-muted hover:border-foreground hover:text-foreground transition-colors"
>
  <svg viewBox="0 0 20 20" aria-hidden className="w-4 h-4"
       fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="9" cy="9" r="6" />
    <path d="M14 14l3 3" strokeLinecap="round" />
  </svg>
</Link>
```

36×36 **정사각형 보더 박스**. 둥근 모서리 없음. 아이콘은 16px, stroke 1.5.
검색창을 상단바에 상시 노출하지 않는 이유 — 폭을 크게 잡아먹고, 실제 검색 빈도는
페이지 이동보다 훨씬 낮다.

---

## 6. PC — 메가메뉴 (세부 메뉴 4열)

### 6.1 마크업

패널은 `<header>` **안**에 있고, 헤더 하단(`top-full`)에 절대배치된다.

```tsx
<div
  className={`hidden sm:grid absolute left-0 right-0 top-full bg-surface z-10 overflow-hidden
    transition-[grid-template-rows,opacity,border-bottom-width] duration-300 ease-out ${
    megaOpen
      ? "grid-rows-[1fr] opacity-100 border-b border-line"
      : "grid-rows-[0fr] opacity-0 pointer-events-none"
  }`}
  aria-hidden={!megaOpen}
>
  <div className="min-h-0 overflow-hidden">
    <div className="mx-auto max-w-6xl px-4 sm:px-8 py-10">
      <div className="grid grid-cols-4 gap-12">
        {NAV.filter((e): e is Extract<NavEntry, { kind: "group" }> => e.kind === "group")
            .map((group) => (
          <div key={group.id}>
            <p className="label">{group.label}</p>
            <ul className="mt-4 space-y-1">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={false}
                    onClick={() => setMegaOpen(false)}
                    className={({ isActive }) =>
                      `block py-1.5 text-sm transition-colors ${
                        isActive ? "text-foreground" : "text-foreground-muted hover:text-foreground"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  </div>
</div>
```

### 6.2 `grid-rows-[0fr] → [1fr]` 슬라이드 트릭 (★)

높이를 모르는 콘텐츠를 **CSS 만으로** 부드럽게 펼치는 방법이다.

```
❌ height: auto  → transition 불가 (auto 는 애니메이션 안 됨)
❌ max-height: 800px → 실제 높이보다 크면 닫힐 때 지연이 생기고, 작으면 잘림
✅ grid-template-rows: 0fr → 1fr  → 정확한 콘텐츠 높이로 자연스럽게 전개
```

3가지 조건이 반드시 같이 있어야 동작한다:

1. 바깥 요소가 `grid` + `grid-rows-[0fr]/[1fr]` + `overflow-hidden`
2. **자식에 `min-h-0`** — 없으면 grid item 이 콘텐츠 높이 아래로 안 줄어들어 처음부터 펼쳐져 보인다
3. 그 자식도 `overflow-hidden`

`transition-[grid-template-rows,opacity,border-bottom-width]` 로 세 속성을 함께 300ms.
**보더까지 트랜지션에 넣는 이유** — 닫힐 때 높이만 0이 되고 `border-b` 가 남으면 헤더
아래에 정체 모를 선 한 줄이 남는다.

### 6.3 배경 dim 오버레이

```tsx
<div
  className={`hidden sm:block fixed inset-0 z-20 bg-foreground/10 transition-opacity duration-300 ${
    megaOpen ? "opacity-100" : "opacity-0 pointer-events-none"
  }`}
  onClick={() => setMegaOpen(false)}
  aria-hidden
/>
```

- `bg-foreground/10` — 검정 10%. 20%를 넘으면 무겁다.
- `pointer-events-none` — 닫힌 상태에서 투명 레이어가 클릭을 먹지 않게. **필수.**
- 헤더는 `z-30`, 오버레이 `z-20`, 패널 `z-10` → 오버레이가 본문만 덮고 헤더는 살아있다.
- 오버레이를 조건부 렌더(`{megaOpen && …}`)하지 않고 **항상 두고 opacity 만** 바꾼다.
  그래야 사라질 때도 페이드아웃이 걸린다.

### 6.4 닫히는 3가지 경로

```tsx
// ① 바깥 클릭 — 헤더(megaRef) 밖을 누르면 닫힘
useEffect(() => {
  if (!megaOpen) return;
  const onPointer = (e: PointerEvent) => {
    if (!megaRef.current) return;
    if (!megaRef.current.contains(e.target as Node)) setMegaOpen(false);
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMegaOpen(false); };
  document.addEventListener("pointerdown", onPointer);
  document.addEventListener("keydown", onKey);
  return () => {
    document.removeEventListener("pointerdown", onPointer);
    document.removeEventListener("keydown", onKey);
  };
}, [megaOpen]);

// ② ESC — 위 훅에 포함
// ③ 라우트 변경 — §11
```

`pointerdown` 을 쓴다 (`click` 아님). 마우스를 누른 순간 반응해 체감이 빠르고,
드래그로 끝난 제스처에도 닫힌다.

---

## 7. PC — 프로필 드롭다운

### 7.1 「하나의 이어진 박스」 트릭 (★)

칩과 드롭다운이 **따로 뜬 팝오버가 아니라 하나의 세로로 긴 박스**처럼 보이게 만든다.

```tsx
<div ref={profileRef} className="hidden sm:block relative min-w-[14rem]">
  <button
    type="button"
    onClick={() => setProfileOpen((v) => !v)}
    aria-expanded={profileOpen}
    aria-haspopup="menu"
    className={`flex w-full items-center gap-2 border px-3 py-1.5 transition-colors ${
      profileOpen
        ? "border-foreground border-b-line"     // ★ 열리면 아래쪽 보더만 연하게
        : "border-line hover:border-foreground"
    }`}
  >
    <Avatar url={userProfile?.avatar_url ?? null} name={displayName} size="sm" />
    <span className="text-sm truncate flex-1 text-left">{displayName}</span>
    <span aria-hidden className={`text-foreground-faint text-xs transition-transform ${
      profileOpen ? "rotate-180" : ""
    }`}>▾</span>
  </button>

  {profileOpen && (
    <div role="menu"
         className="absolute left-0 right-0 top-full border border-t-0 border-foreground bg-surface z-40">
      {/* ★ border-t-0 — 칩의 아래 보더와 겹치지 않게 */}
      …
    </div>
  )}
</div>
```

세 줄이 핵심이다:

| 코드 | 효과 |
| --- | --- |
| 칩: `border-foreground border-b-line` | 열렸을 때 **아래 보더만 연한 색** → 경계가 사라진 듯 |
| 패널: `border border-t-0 border-foreground` | 위 보더를 지워 칩과 이어짐 |
| 패널: `left-0 right-0` + 부모 `min-w-[14rem]` | 칩과 **폭이 정확히 같다** |

`min-w-[14rem]`(224px)을 부모에 고정하는 이유 — 이름 길이에 따라 칩 폭이 바뀌면
드롭다운 폭도 흔들리고, 헤더의 오른쪽 정렬이 이름마다 달라진다.

`▾` 는 열릴 때 `rotate-180`. 아이콘 라이브러리 없이 문자 하나로 처리.

### 7.2 3단 구성 — 왜 나눴나

```
┌─────────────────────────┐
│ ⬤ 김대표             ▴ │  ← 칩 (border-b 만 연함)
├─────────────────────────┤
│ 내 정보 관리            │  PRIMARY — 매일 쓰는 것
│ 내 활동                 │
├─────────────────────────┤  ← border-t border-line (구분)
│ 활동 리포트             │  SECONDARY — 가끔 쓰는 것
│ 개발자에게 한마디       │
│ 관리자 메뉴             │  ADMIN — 권한 있을 때만
│ 로그아웃                │  danger — 항상 맨 아래
└─────────────────────────┘
```

- **PRIMARY / SECONDARY 사이에만 구분선.** 선을 더 넣으면 리스트가 감옥살이 한다.
- **로그아웃은 항상 마지막.** 실수 클릭을 줄이려면 물리적으로 가장 멀리.
- 로그아웃만 `text-danger` + `hover:bg-danger-bg`. 다른 항목엔 색을 쓰지 않는다.

### 7.3 권한에 따른 항목 추가

```tsx
const isAdmin =
  userProfile?.role === "admin" ||          // 글로벌 관리자
  myWorkspaceRole === "owner" ||            // 워크스페이스 소유자
  myWorkspaceRole === "admin";

const profileSecondary = isAdmin
  ? [...PROFILE_SECONDARY, ...PROFILE_ADMIN]
  : PROFILE_SECONDARY;
```

> 판정 조건은 **`/admin` 페이지 자체의 접근 조건과 반드시 동일**해야 한다.
> 메뉴는 보이는데 들어가면 튕기거나, 권한이 있는데 메뉴가 없는 상황이 최악이다.
> 조건을 훅(`useIsAdmin()`)으로 빼서 양쪽이 같은 함수를 쓰게 하는 것이 더 안전하다.

### 7.4 항목 렌더 — 활성 상태는 teal

```tsx
<NavLink
  to={item.to}
  end={false}
  onClick={() => setProfileOpen(false)}     // ★ 같은 경로 재클릭 시엔 라우트가 안 바뀌므로 수동 닫기
  role="menuitem"
  className={({ isActive }) =>
    `block px-3 py-2.5 text-sm transition-colors ${
      isActive
        ? "text-accent-teal bg-accent-teal/10"
        : "text-foreground-muted hover:text-foreground hover:bg-surface-muted"
    }`
  }
>
  {item.label}
</NavLink>
```

상단바 대분류는 「글자 농도」로, **드롭다운/시트 안에서는 「teal + 연한 배경」** 으로
활성을 표시한다. 리스트에서는 농도 차이만으론 안 읽힌다.

### 7.5 바깥 클릭 / ESC

메가메뉴와 완전히 같은 패턴 (§6.4). `profileRef` 만 다르다.

```tsx
useEffect(() => {
  if (!profileOpen) return;
  const onPointer = (e: PointerEvent) => {
    if (!profileRef.current) return;
    if (!profileRef.current.contains(e.target as Node)) setProfileOpen(false);
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setProfileOpen(false); };
  document.addEventListener("pointerdown", onPointer);
  document.addEventListener("keydown", onKey);
  return () => {
    document.removeEventListener("pointerdown", onPointer);
    document.removeEventListener("keydown", onKey);
  };
}, [profileOpen]);
```

> `profileRef` 는 **칩과 패널을 함께 감싼 div** 에 걸려 있다. 패널에만 걸면 칩을 다시
> 눌렀을 때 "바깥 클릭 → 닫기" 와 "토글 → 열기" 가 동시에 발생해 깜빡인다.

---

## 8. 모바일 — 상단바는 브랜드만

모바일에서 헤더 오른쪽은 **비어 있다.** 상단 nav · 검색 · 프로필칩이 전부
`hidden sm:*` 이기 때문이다.

```tsx
<div className="flex items-center gap-3 sm:gap-5">
  <nav className="hidden sm:flex …">…</nav>              {/* 모바일에선 없음 */}
  <Link className="hidden sm:inline-flex …">🔍</Link>     {/* 없음 */}
  <div className="hidden sm:block …">프로필칩</div>        {/* 없음 */}
</div>
```

**상단에 햄버거 버튼을 두지 않는다.** 이유:

| 상단 햄버거 | 하단 「더보기」 (채택) |
| --- | --- |
| 한 손으로 잡았을 때 **엄지가 안 닿는다** | 엄지 자연 위치 |
| 상단바가 콘텐츠와 경쟁 | 상단은 브랜드만 → 조용함 |
| 다른 5개 메뉴와 따로 논다 | BottomNav 5칸 중 하나로 통합 |

결과적으로 모바일 상단바의 역할은 **① 브랜드 정체성 ② 홈으로 가는 링크** 두 개뿐이다.
스크롤해도 고정되지 않는다(sticky 아님) — 화면 세로를 아끼기 위해.

> 프로젝트 초기 문서(CLAUDE.md)에는 "메인 화면은 상단 햄버거" 로 적혀 있지만,
> **실제 구현은 전 화면 BottomNav 로 통일**됐다. 화면마다 네비 방식이 다르면
> 사용자가 매번 어디를 눌러야 할지 다시 찾게 된다.

---

## 9. 모바일 — 하단 고정 BottomNav

### 9.1 전체 코드

```tsx
/**
 * 모바일 전용 하단 고정 네비 (sm:hidden).
 * 자주 쓰는 4개 + 더보기(전체 메뉴 시트 토글).
 * pb-safe-bottom 으로 iOS 홈 인디케이터 회피.
 */
export function MobileBottomNav({ moreOpen, onToggleMore }: Props) {
  return (
    <nav
      aria-label="모바일 빠른 이동"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-20
                 border-t border-line bg-surface pb-safe-bottom"
    >
      <ul className="grid grid-cols-5">
        <BottomItem to="/dashboard" label="홈"     icon={HomeIcon} end />
        <BottomItem to="/meetings"  label="일정"   icon={CalendarIcon} />
        <BottomItem to="/readings"  label="챌린지" icon={ChallengeIcon} />
        <BottomItem to="/tasks"     label="할일"   icon={CheckIcon} />
        <li>
          <button
            type="button"
            onClick={onToggleMore}
            aria-expanded={moreOpen}
            aria-label="더보기"
            className={`w-full flex flex-col items-center justify-center gap-1 py-2.5
                        text-[10px] tracking-wider transition-colors min-h-[56px] ${
              moreOpen ? "text-accent-teal" : "text-foreground-muted hover:text-foreground"
            }`}
          >
            <MoreIcon className="w-5 h-5" />
            <span>더보기</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

function BottomItem({ to, label, icon: Icon, end = false }: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          `flex flex-col items-center justify-center gap-1 py-2.5
           text-[10px] tracking-wider transition-colors min-h-[56px] ${
            isActive ? "text-accent-teal" : "text-foreground-muted hover:text-foreground"
          }`
        }
      >
        <Icon className="w-5 h-5" />
        <span>{label}</span>
      </NavLink>
    </li>
  );
}
```

### 9.2 5칸을 무엇으로 채웠나

| 칸 | 경로 | 선정 이유 |
| --- | --- | --- |
| 홈 | `/dashboard` | 진입점. 길 잃었을 때 돌아오는 곳 |
| 일정 | `/meetings` | 모임 앱의 1순위 관심사 |
| 챌린지 | `/readings` | 매일 들어오는 습관 트래킹 |
| 할일 | `/tasks` | 내가 해야 할 일 |
| 더보기 | (시트) | 나머지 전부 |

**선정 기준: 방문 빈도.** 정보 구조(§2)의 대분류와 **일부러 다르다.** 대분류는
"논리적 분류", BottomNav 는 "실제 손이 가는 순서". 「멤버」는 대분류 1군(모임)이지만
자주 안 들어가므로 하단바에 없고, 「챌린지」는 3군(성장)이지만 매일 쓰므로 있다.

**5칸이 상한.** 6칸이 되면 360px 화면에서 칸당 60px 이라 라벨이 줄바꿈된다.

### 9.3 규격

| 항목 | 값 | 이유 |
| --- | --- | --- |
| 터치 높이 | `min-h-[56px]` | 44px 최소 기준을 넉넉히 상회 |
| 아이콘 | `w-5 h-5` (20px), stroke 1.5 | 라벨과 균형 |
| 라벨 | `text-[10px] tracking-wider` | 5칸에 한글 3자까지 안전 |
| 배치 | `grid grid-cols-5` | flex 보다 균등 분할이 정확 |
| 활성색 | `text-accent-teal` | 아이콘+라벨이 함께 물든다 |
| 하단 여백 | `pb-safe-bottom` | iOS 홈 인디케이터 회피 (§15) |
| 레이어 | `z-20` | 본문 위, 더보기 시트(z-30) 아래 |

**아이콘은 인라인 SVG로 직접 그린다.** 아이콘 라이브러리(lucide 등)를 넣지 않는 이유 —
번들 크기, 그리고 라이브러리 아이콘은 stroke 굵기·모서리 곡률이 제각각이라 hairline
디자인과 안 맞는다. 5개뿐이라 직접 그리는 게 빠르다.

```tsx
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}
         fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5" />
    </svg>
  );
}
```

**공통 규격**: `viewBox="0 0 24 24"` · `fill="none"` · `stroke="currentColor"` ·
`strokeWidth="1.5"` · `round` 캡/조인. 5개 전부 이 규격이라 한 세트로 보인다.

### 9.4 본문 하단 여백

BottomNav 가 `fixed` 라 본문 마지막이 가려진다. `<main>` 에서 보정한다.

```tsx
<main className="mx-auto max-w-6xl px-4 sm:px-8 py-10 sm:py-14 pb-24 sm:pb-14">
```

`pb-24`(96px) 모바일 / `sm:pb-14`(56px) 데스크탑. BottomNav 높이(56px) + safe area +
여유. **이걸 빼먹으면 목록 마지막 항목을 영원히 못 누른다.**

### 9.5 워크스페이스 없으면 숨김

```tsx
{workspace && (
  <MobileBottomNav moreOpen={menuOpen} onToggleMore={() => setMenuOpen((v) => !v)} />
)}
```

가입 대기 중(`<JoinFlow />` 표시)인 사용자에게는 이동할 데가 없으므로 하단바를 감춘다.

---

## 10. 모바일 — 「더보기」 풀스크린 시트

### 10.1 왜 사이드 드로어가 아니라 풀스크린인가

| 사이드 드로어 (좌→우 슬라이드) | 풀스크린 시트 (채택) |
| --- | --- |
| 좁은 폭에 17개 메뉴 → 스크롤 지옥 | 화면 전체를 써서 그룹이 한눈에 |
| 뒤 콘텐츠가 반쯤 보여 산만 | 온전히 메뉴에 집중 |
| 열림 방향 애니메이션 필요 | 조건부 렌더로 끝 (`{menuOpen && …}`) |
| 스와이프 제스처 충돌 | 없음 |

### 10.2 구조 — sticky 상단 + 스크롤 영역

```tsx
{menuOpen && (
  <div className="sm:hidden fixed inset-0 z-30" aria-hidden={!menuOpen}>
    <nav className="absolute inset-0 bg-surface flex flex-col pt-safe-top pb-safe-bottom">

      {/* ① sticky 상단 — 프로필 + 닫기 + 검색 (스크롤과 무관) */}
      <div className="shrink-0 bg-surface border-b border-line">
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar url={userProfile?.avatar_url ?? null} name={displayName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate">{displayName}</p>
            <p className="text-xs text-foreground-faint truncate">{user.email}</p>
          </div>
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="닫기"
                  className="text-xs text-foreground-muted hover:text-foreground
                             border border-line-strong px-3 py-1.5 hover:border-foreground">
            닫기
          </button>
        </div>
        <Link to="/search"
              className="flex items-center gap-3 px-4 py-3 border-t border-line
                         text-sm text-foreground-muted hover:text-foreground hover:bg-surface-muted">
          <svg viewBox="0 0 20 20" aria-hidden className="w-4 h-4"
               fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="9" r="6" /><path d="M14 14l3 3" strokeLinecap="round" />
          </svg>
          <span>통합 검색</span>
        </Link>
      </div>

      {/* ② 스크롤 영역 — 메뉴 그룹들 */}
      <div className="flex-1 overflow-y-auto">
        …
      </div>
    </nav>
  </div>
)}
```

`flex flex-col` + 상단 `shrink-0` + 하단 `flex-1 overflow-y-auto` — **position:sticky 없이**
고정 헤더를 만드는 가장 견고한 방법이다. iOS 에서 sticky 는 스크롤 관성 중에 튀는 경우가 있다.

**PC 프로필 칩이 하는 일(계정 확인)을 여기 상단이 대신한다.** 아바타·이름·이메일을 보여주고,
바로 아래에 검색을 붙였다.

### 10.3 시트 안 메뉴 순서

```
① 마이            내 정보 관리 · 내 활동            (= PROFILE_PRIMARY)
② 모임            일정 · 회의록 · 안건·투표 · 멤버   ┐
③ 실행            프로젝트 · 할일 · 콘텐츠          │ = NAV 그룹 그대로
④ 성장            글쓰기 · 챌린지 · 인사이트 · 비전보드│
⑤ 소개            공지사항 · 밋업 소개              ┘
⑥ 바로가기        밋업 메인홈↗ · 딴길청년 비전보드↗
⑦ 기타            활동 리포트 · 개발자에게 한마디 · (관리자 메뉴) · 로그아웃
                                                    (= PROFILE_SECONDARY + ADMIN)
```

**「마이」가 왜 맨 위인가** — PC 에선 프로필이 우상단에 있어 언제든 보이지만, 모바일에선
시트를 열어야만 접근 가능하다. 접근 비용이 높아진 만큼 위로 올린다.

### 10.4 렌더 코드 — 같은 `NAV` 를 순회

```tsx
{/* ① 마이 — 위에 구분선 없음 (sticky 헤더가 경계 역할) */}
<div className="pt-6">
  <p className="label px-5 pb-2">마이</p>
  <ul>
    {PROFILE_PRIMARY.map((item) => (
      <li key={item.to}><MobileLink to={item.to} label={item.label} /></li>
    ))}
  </ul>
</div>

{/* ②~⑤ NAV 그룹 */}
{NAV.map((entry) => {
  // ★ 홈은 하단 BottomNav 에 있으므로 시트에선 생략 — 중복 제거
  if (entry.kind === "leaf") {
    if (entry.to === "/dashboard") return null;
    return (
      <ul key={entry.to} className="mt-3 border-t border-line/60">
        <li><MobileLink to={entry.to} label={entry.label} /></li>
      </ul>
    );
  }
  return (
    <div key={entry.id} className="mt-3 pt-6 border-t border-line/60">
      <p className="label px-5 pb-2">{entry.label}</p>
      <ul>
        {entry.items.map((item) => (
          <li key={item.to}><MobileLink to={item.to} label={item.label} /></li>
        ))}
      </ul>
    </div>
  );
})}
```

```tsx
function MobileLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={false}
      className={({ isActive }) =>
        `flex items-center justify-between px-5 py-3 text-sm transition-colors ${
          isActive
            ? "text-accent-teal bg-accent-teal/10"
            : "text-foreground-muted hover:text-foreground hover:bg-surface-muted"
        }`
      }
    >
      <span>{label}</span>
      <span aria-hidden className="text-foreground-faint">›</span>
    </NavLink>
  );
}
```

- **행 전체가 링크** (`px-5 py-3` = 높이 약 45px). 텍스트만 링크로 만들면 터치가 어렵다.
- 오른쪽 `›` — "여기 들어가면 화면이 바뀐다" 는 모바일 관용 기호.
- 활성은 PC 드롭다운과 같은 **teal + 연한 배경**.

### 10.5 24px 여백 규칙 (구분선 위아래 대칭)

```tsx
<div className="mt-3 pt-6 border-t border-line/60">
```

```
구분선 위쪽 여백 = 앞 ul 마지막 li 의 py-3 하단(12px) + mt-3(12px) = 24px
구분선 아래 여백 = pt-6 (24px)
```

위아래가 정확히 24px 로 맞아 구분선이 **정중앙**에 놓인다. `mt-6` 만 쓰면 위 36px /
아래 24px 로 어긋나 보인다. 구분선 색은 `border-line/60` — 본문 hairline 보다 연하게 해서
메뉴 리스트가 표처럼 보이지 않게.

### 10.6 바로가기 · 기타 · 로그아웃

```tsx
<div className="mt-3 pt-6 border-t border-line/60">
  <p className="label px-5 pb-2">바로가기</p>
  <ul>
    <li>
      <Link to="/" onClick={() => setMenuOpen(false)}
            className="flex items-center justify-between px-5 py-3 text-sm
                       text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors">
        <span>밋업 메인홈</span>
        <span aria-hidden className="text-foreground-faint">↗</span>
      </Link>
    </li>
    {/* 딴길청년도 동일 */}
  </ul>
</div>

<div className="mt-3 pt-6 pb-4 border-t border-line/60">
  <p className="label px-5 pb-2">기타</p>
  <ul>
    {profileSecondary.map((item) => (
      <li key={item.to}><MobileLink to={item.to} label={item.label} /></li>
    ))}
    <li>
      <button type="button" onClick={handleSignOut}
              className="w-full flex items-center justify-between px-5 py-3 text-sm
                         text-danger hover:bg-danger-bg">
        <span>{demo ? "나가기" : "로그아웃"}</span>
        <span aria-hidden className="text-danger/70">›</span>
      </button>
    </li>
  </ul>
</div>
```

`↗` 는 **앱 밖으로 나감**, `›` 는 **앱 안에서 이동**. 두 기호를 섞어 쓰지 않는다.
마지막 그룹에 `pb-4` — 스크롤 끝에서 마지막 항목이 화면 하단에 딱 붙지 않게.

### 10.7 body 스크롤 잠금

시트가 열린 동안 뒤 본문이 스크롤되면 안 된다.

```tsx
useEffect(() => {
  if (!menuOpen) return;
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => { document.body.style.overflow = prev; };
}, [menuOpen]);
```

**원래 값을 저장했다가 복원**하는 게 핵심. 무조건 `""` 로 되돌리면 다른 모달이 걸어둔
잠금까지 풀어버린다.

---

## 11. 열림 상태 3개와 닫힘 규칙

```tsx
const [menuOpen, setMenuOpen]     = useState(false);  // 모바일 더보기 시트
const [profileOpen, setProfileOpen] = useState(false); // PC 프로필 드롭다운
const [megaOpen, setMegaOpen]     = useState(false);  // PC 메가메뉴
```

세 개가 서로 독립이어도 되는 이유 — `menuOpen` 은 모바일 전용, 나머지 둘은 PC 전용이라
**동시에 존재할 수 있는 건 `profileOpen` + `megaOpen` 뿐**이고, 둘 다 열려도 위치가
겹치지 않는다(하나는 헤더 아래 전체, 하나는 우상단).

### 라우트가 바뀌면 전부 닫는다

```tsx
useEffect(() => {
  setMenuOpen(false);
  setProfileOpen(false);
  setMegaOpen(false);
}, [location.pathname]);
```

**이 훅 하나가 메뉴 UX의 절반이다.** 이게 없으면 메뉴에서 링크를 눌러 이동한 뒤에도
패널이 그대로 떠 있다.

단, `pathname` 이 같으면 이 훅이 안 돈다(현재 페이지 링크를 다시 누른 경우).
그래서 각 링크에 `onClick={() => setXOpen(false)}` 도 **함께** 걸어둔다. 이중 안전장치.

### 열려 있을 때 시각 피드백

| 요소 | 열림 표시 |
| --- | --- |
| 대분류 버튼 | `megaOpen` 이면 활성 아니어도 `text-foreground` |
| 프로필 칩 | `border-foreground` + `▾` 180° 회전 |
| 더보기 버튼 | `text-accent-teal` |

---

## 12. z-index 지도

```
z-40  프로필 드롭다운 패널      — 헤더(z-30) 안에서 가장 위
z-30  헤더 / 모바일 더보기 시트  — dim 위에 있어야 클릭 가능
z-20  PC dim 오버레이 / 모바일 BottomNav
z-10  메가메뉴 패널             — 헤더 아래로 슬라이드
 —    본문 (기본)
```

**규칙 3가지**

1. 값은 `10 / 20 / 30 / 40` 만 쓴다. `z-[9999]` 가 등장하는 순간 층 관계가 붕괴한다.
2. **dim 오버레이보다 헤더가 위.** 그래야 메가메뉴가 열린 상태에서도 프로필/검색을 누를 수 있다.
3. 모바일 시트(z-30)가 BottomNav(z-20)를 **덮는다.** 시트 안에 자체 닫기 버튼이 있으므로
   하단바가 가려져도 갇히지 않는다.

---

## 13. 스타일 토큰 · 클래스 레퍼런스

### 색 사용 규칙

| 상황 | 클래스 |
| --- | --- |
| 기본 메뉴 텍스트 | `text-foreground-muted` |
| hover | `hover:text-foreground` (+ 리스트는 `hover:bg-surface-muted`) |
| 활성 — 상단바 대분류 | `text-foreground` (농도만) |
| 활성 — 드롭다운/시트/하단바 | `text-accent-teal` (+ 리스트는 `bg-accent-teal/10`) |
| 보조 기호 (`›` `↗` `▾`) | `text-foreground-faint` |
| 로그아웃 | `text-danger` / `hover:bg-danger-bg` |
| 경계선 | `border-line` (기본) · `border-line/60` (시트 그룹 구분) · `border-line-strong` (버튼) |
| dim | `bg-foreground/10` |

### 여백 · 크기

| 항목 | 값 |
| --- | --- |
| 헤더 좌우 | `px-4 sm:px-8` |
| 헤더 상하 | `py-4 sm:py-5` |
| 최대 폭 | `max-w-6xl` (헤더 · 메가메뉴 · main 전부 동일) |
| 상단 메뉴 항목 | `px-3 py-1.5` |
| 드롭다운 항목 | `px-3 py-2.5` |
| 시트 항목 | `px-5 py-3` |
| 하단바 칸 | `py-2.5 min-h-[56px]` |
| 메가메뉴 패널 | `py-10`, 4열 `gap-12` |
| 시트 그룹 간격 | `mt-3 pt-6` (구분선 위아래 24px) |

### 라운드 · 그림자

**전부 없음.** `rounded-*` 는 아바타(원형)에만. `shadow-*` 는 앱 전체에서 0회 사용.
깊이는 오직 `border` 와 `bg-surface-muted` 로만 표현한다.

---

## 14. 접근성 체크리스트

- [x] 토글 버튼에 `aria-expanded={열림상태}`
- [x] 메뉴를 여는 버튼에 `aria-haspopup="menu"`
- [x] 드롭다운 컨테이너 `role="menu"`, 항목 `role="menuitem"`, `<li role="none">`
- [x] 아이콘 전용 버튼에 `aria-label` (`검색` / `더보기` / `닫기`)
- [x] 장식용 SVG·기호에 `aria-hidden`
- [x] `<nav aria-label="모바일 빠른 이동">` — 랜드마크가 2개 이상이면 라벨 필수
- [x] ESC 로 메가메뉴·드롭다운 닫힘
- [x] 닫힌 메가메뉴에 `pointer-events-none` + `aria-hidden` — 보이지 않는 링크에 탭 포커스가 가지 않게
- [x] 터치 타깃 ≥ 44px (하단바 56px, 시트 행 45px)
- [ ] **미구현**: 드롭다운 안에서 ↑↓ 화살표 이동, 열릴 때 첫 항목 포커스, 닫힐 때 트리거로 포커스 복귀

> 마지막 항목은 키보드 사용자 비중이 높은 서비스라면 추가한다. 6명 모바일 앱에서는
> 우선순위가 낮아 의도적으로 뺐다.

---

## 15. Safe Area · PWA

### 토큰 정의

```css
:root {
  --safe-top:    env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left:   env(safe-area-inset-left, 0px);
  --safe-right:  env(safe-area-inset-right, 0px);
}

@theme inline {
  --spacing-safe-top:    var(--safe-top);
  --spacing-safe-bottom: var(--safe-bottom);
  --spacing-safe-left:   var(--safe-left);
  --spacing-safe-right:  var(--safe-right);
}

body {
  padding-top:    var(--safe-top);
  padding-bottom: var(--safe-bottom);
  padding-left:   var(--safe-left);
  padding-right:  var(--safe-right);
  overflow-x: hidden;              /* 가로 스크롤 금지 */
  -webkit-text-size-adjust: 100%;  /* iOS 더블탭 확대 방지 */
}

html, body {
  overscroll-behavior: none;   /* 좌우 스와이프 이탈 + 바운스 방지 */
  touch-action: pan-y;         /* 세로 스크롤만 허용 */
}
```

### 적용 지점

| 요소 | 클래스 | 없으면 |
| --- | --- | --- |
| `body` | CSS 로 4방향 패딩 | 상태바/홈인디케이터에 콘텐츠가 깔림 |
| BottomNav | `pb-safe-bottom` | 홈 인디케이터 바(–)와 아이콘이 겹침 |
| 더보기 시트 | `pt-safe-top pb-safe-bottom` | 프로필이 시계·와이파이 아래로 들어감 |
| 최외곽 | `min-h-dvh` (`min-h-screen` 아님) | iOS 동적 주소창 때문에 바닥이 잘림 |

> **`position: fixed` 요소는 body 패딩의 영향을 받지 않는다.** BottomNav 와 시트가
> `pb-safe-bottom` / `pt-safe-top` 을 각자 따로 가져야 하는 이유가 이것이다.

`index.html` 필수 메타:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="theme-color" content="#ffffff" />
```

`viewport-fit=cover` 가 없으면 `env(safe-area-inset-*)` 이 전부 0 이 되어 위 작업이 무효가 된다.

---

## 16. 메뉴 추가·변경하는 법

### 세부 메뉴 1개 추가 → `NAV` 만 고친다

```diff
   {
     kind: "group",
     id: "execute",
     label: "실행",
     items: [
       { to: "/projects", label: "프로젝트" },
       { to: "/tasks",    label: "할일" },
+      { to: "/okr",      label: "OKR" },
       { to: "/channels", label: "콘텐츠" },
     ],
   },
```

이 한 줄로 **PC 메가메뉴 · 모바일 시트** 두 곳이 동시에 갱신된다. 라우트만 따로
`router.tsx` 에 등록하면 끝.

### 대분류 추가 → 4열 그리드를 확인할 것

```tsx
<div className="grid grid-cols-4 gap-12">   {/* ← 그룹 수와 맞춰야 한다 */}
```

그룹이 5개가 되면 `grid-cols-5 gap-8` 로 바꾸고 상단바 폭도 확인한다.
**권장은 4개 유지.** 5번째가 필요하다면 기존 그룹 재편을 먼저 검토한다.

### BottomNav 항목 교체 → 빈도 기준으로

`mobile-bottom-nav.tsx` 의 `BottomItem` 4개를 바꾼다. 아이콘도 같은 규격
(`24 24` / `fill=none` / `stroke=currentColor` / `1.5` / round)으로 새로 그린다.
**5칸을 넘기지 않는다.**

### 프로필 메뉴 추가 → 3덩어리 중 어디인지 판단

| 성격 | 상수 |
| --- | --- |
| 매일 쓰는 개인 화면 | `PROFILE_PRIMARY` |
| 가끔 쓰는 것 | `PROFILE_SECONDARY` |
| 권한자 전용 | `PROFILE_ADMIN` (+ `isAdmin` 조건 확인) |

세 상수 모두 PC 드롭다운과 모바일 시트가 함께 읽으므로 한 곳만 고치면 된다.

### 이식 체크리스트 (다른 앱으로 옮길 때)

- [ ] `NAV` / `PROFILE_*` 상수를 그 앱 메뉴로 교체
- [ ] `isPathInGroup` 의 슬래시 비교 유지 (`/notes` vs `/notices` 충돌 방지)
- [ ] 헤더 `relative z-30` + 패널 `absolute top-full` 관계 유지
- [ ] `grid-rows-[0fr]/[1fr]` + 자식 `min-h-0` 세트로 복사 (하나만 빠지면 안 열림)
- [ ] dim 오버레이는 조건부 렌더 말고 `opacity` + `pointer-events-none`
- [ ] `profileRef` 는 칩+패널을 **함께 감싼** div 에
- [ ] 라우트 변경 시 3개 상태 전부 닫는 `useEffect`
- [ ] `<main>` 에 `pb-24 sm:pb-14`
- [ ] BottomNav `pb-safe-bottom`, 시트 `pt-safe-top pb-safe-bottom`
- [ ] `min-h-dvh` 사용, `viewport-fit=cover` 메타 확인

---

## 17. 자주 하는 실수 10가지

### ① `startsWith` 로만 활성 판정

```ts
❌ pathname.startsWith(it.to)          // '/notices' 가 '/notes' 를 활성화
✅ pathname === it.to || pathname.startsWith(`${it.to}/`)
```

### ② `NavLink` 에 `end` 를 안 줘서 홈이 항상 활성

`to="/dashboard"` 는 `end={false}` 로 하위 경로까지 잡아도 되지만, 루트(`/`)를 가리키는
링크는 반드시 `end` 를 줘야 모든 경로에서 활성이 되지 않는다. BottomNav 홈에 `end` 가
붙어 있는 이유.

### ③ 메가메뉴 자식에 `min-h-0` 누락

`grid-rows-[0fr]` 을 걸어도 자식이 콘텐츠 높이만큼 버텨서 **처음부터 펼쳐진 채로** 보인다.
증상이 "닫혀 있어야 하는데 계속 보인다" 라면 99% 이것.

### ④ dim 오버레이를 조건부 렌더

```tsx
❌ {megaOpen && <div className="fixed inset-0 bg-foreground/10" />}   // 페이드아웃 없음
✅ <div className={`… ${megaOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} />
```

`pointer-events-none` 을 빠뜨리면 **닫힌 상태에서 화면 전체가 클릭을 먹는다.**
"버튼이 안 눌려요" 버그의 단골 원인.

### ⑤ 바깥 클릭 ref 를 패널에만 걸기

칩을 다시 누를 때 "바깥 클릭 → 닫기" 와 "토글 → 열기" 가 같은 프레임에 발생해 깜빡인다.
**칩과 패널을 함께 감싼 컨테이너**에 ref 를 건다.

### ⑥ 라우트 변경 시 메뉴를 안 닫음

`useEffect(..., [location.pathname])` 하나로 해결. 여기에 더해 각 링크의 `onClick` 에도
닫기를 걸어야 **같은 페이지 링크 재클릭** 케이스가 처리된다.

### ⑦ `<main>` 하단 패딩 누락

BottomNav 가 `fixed` 라 목록 마지막 항목이 영구히 가려진다. `pb-24 sm:pb-14`.

### ⑧ `fixed` 요소에 safe-area 미적용

body 패딩은 `fixed` 요소에 적용되지 않는다. BottomNav 는 `pb-safe-bottom`,
시트는 `pt-safe-top pb-safe-bottom` 을 각자 가져야 한다.

### ⑨ 스크롤 잠금 복원을 `""` 로

```tsx
❌ return () => { document.body.style.overflow = ""; };
✅ const prev = document.body.style.overflow;
   return () => { document.body.style.overflow = prev; };
```

### ⑩ 모바일 상단에 햄버거 + 하단바를 둘 다 두기

같은 메뉴로 가는 입구가 두 개면 사용자가 매번 어디를 눌러야 할지 다시 판단한다.
**입구는 하나.** 밋업은 하단 「더보기」로 통일했다.

---

## 부록 — 파일 배치

```
src/
  layouts/
    app-layout.tsx            # NAV 상수 · 헤더 · 메가메뉴 · 프로필 드롭다운 · 모바일 시트
  components/
    brand-mark.tsx            # teal 점 + 워드마크
    mobile-bottom-nav.tsx     # 하단 고정 5칸 + 인라인 SVG 아이콘 5개
    avatar.tsx                # 프로필 칩 / 시트 상단 / 댓글 공용
  index.css                   # safe-area 토큰 · .label · 색 토큰
index.html                    # viewport-fit=cover · theme-color · manifest
```

*작성 기준: `src/layouts/app-layout.tsx` (686줄), `src/components/mobile-bottom-nav.tsx` (171줄) 현재 구현.*

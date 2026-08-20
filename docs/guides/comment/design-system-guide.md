# UI 디자인 시스템 · 레이아웃 가이드

> 밋업 앱의 화면이 **왜 깔끔해 보이는지**를 규칙으로 환원한 문서.
> 토큰 · 타이포 · 여백 리듬 · 페이지 템플릿 · 반복 패턴 · 관리 방법까지.
>
> 다른 앱(AI 오피스)에 이식할 때는 §2 토큰과 §7 패턴 라이브러리를 먼저 옮기고,
> §12 의 관리 규칙을 팀 규약으로 채택하면 된다.
>
> **핵심 한 줄** — 이 디자인은 "무엇을 더할까" 가 아니라 **"무엇을 뺄 수 있나"** 로 만들어졌다.
> 그림자·라운드·컬러·구분선을 계속 빼다 보면 남는 건 **여백과 1px 선**뿐이고, 그게 곧 스타일이다.

---

## 목차

1. [5가지 원칙](#1-5가지-원칙)
2. [토큰 — 색의 단일 출처](#2-토큰--색의-단일-출처)
3. [타이포그래피](#3-타이포그래피)
4. [여백 리듬](#4-여백-리듬)
5. [레이아웃 골격](#5-레이아웃-골격)
6. [페이지 템플릿 4종](#6-페이지-템플릿-4종)
7. [반복 패턴 라이브러리](#7-반복-패턴-라이브러리)
8. [컴포넌트 작성 규약](#8-컴포넌트-작성-규약)
9. [상호작용 상태 표준](#9-상호작용-상태-표준)
10. [모바일 대응 규칙](#10-모바일-대응-규칙)
11. [색을 언제 쓰는가](#11-색을-언제-쓰는가)
12. [무너뜨리지 않고 관리하는 법](#12-무너뜨리지-않고-관리하는-법)
13. [안티패턴 12가지](#13-안티패턴-12가지)
14. [샘플 모음](#14-샘플-모음)
15. [부록 — 클래스 치트시트](#15-부록--클래스-치트시트)

---

## 1. 5가지 원칙

무인양품(MUJI) 매장의 「있는 그대로의 아름다움」을 화면에 옮긴 것이다.
아래 5개만 지키면 누가 어떤 화면을 만들어도 같은 앱처럼 보인다.

### ① 배경은 순백 하나

```
✅ bg-surface (#ffffff) · bg-surface-muted (#f7f7f5) — 딱 두 가지
❌ 그라데이션, 컬러 배경, 다크 모드, 반투명 유리 효과
```

`surface-muted` 는 **강조가 아니라 후퇴**를 뜻한다. hover 배경, 완료된 행, 메타 그리드의
틈 — "여기는 덜 중요하다" 는 신호로만 쓴다.

### ② 그림자 없음 — 깊이는 1px 선으로

```
❌ shadow-sm / shadow-md / drop-shadow …   (앱 전체에서 사용 0회)
✅ border border-line
```

카드가 떠 보일 필요가 없다. **평면에 선으로 구획하면 정보 구조가 오히려 더 정확하게 읽힌다.**
모달만 예외적으로 배경 딤(`bg-foreground/40`)을 쓰지만 모달 자체는 여전히 `border border-line`.

### ③ 직사각형 — 라운드는 원형 요소만

```
❌ rounded-lg, rounded-md, rounded-sm  (카드·버튼·입력·배지 전부 금지)
✅ rounded-full — 아바타, 컬러 점(●), 그것뿐
```

버튼도 입력창도 각지다. 각진 요소끼리는 **선이 정확히 이어져** 격자가 깔끔하게 맞는다.

### ④ 가벼운 글자

```
h1 → text-3xl font-light      (400 이 아니라 300)
h2~h4 → font-weight: 400      (global CSS 로 강제)
본문 → text-sm / text-base
강조 → font-medium 까지만. font-bold 는 쓰지 않는다
```

### ⑤ 여백이 곧 디자인

장식이 없으므로 **간격이 유일한 표현 수단**이다. 그래서 간격을 아무 값이나 쓰면
디자인이 통째로 무너진다. §4 의 리듬 표를 따른다.

---

## 2. 토큰 — 색의 단일 출처

### 2.1 정의 (`src/index.css`)

```css
@import "tailwindcss";

:root {
  /* PWA safe area */
  --safe-top:    env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left:   env(safe-area-inset-left, 0px);
  --safe-right:  env(safe-area-inset-right, 0px);

  --background:      #ffffff;
  --surface:         #ffffff;
  --surface-muted:   #f7f7f5;   /* hover · 완료 · 후퇴 */

  --foreground:        #1a1a1a;  /* 본문 */
  --foreground-muted:  #6b6b6b;  /* 보조 텍스트 */
  --foreground-faint:  #a1a1a1;  /* 메타 · 라벨 · 기호 */

  --line:        #e8e6e1;        /* 기본 hairline */
  --line-strong: #c9c6bf;        /* 입력 밑줄 · 보조 버튼 테두리 */

  --accent:            #1a1a1a;  /* Primary 버튼 = 검정 */
  --accent-foreground: #ffffff;
  --accent-teal:       #0a4145;  /* 유일한 컬러 액센트 */
  --accent-amber:      #b5862c;  /* 중간 상태 (지각 등) — 극히 드물게 */

  --danger:    #b54a3a;
  --danger-bg: #fbf1ef;
}

@theme inline {
  --spacing-safe-top:    var(--safe-top);
  --spacing-safe-bottom: var(--safe-bottom);
  --spacing-safe-left:   var(--safe-left);
  --spacing-safe-right:  var(--safe-right);

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

`@theme inline` 이 CSS 변수를 Tailwind 유틸리티로 노출한다 →
`bg-surface` · `text-foreground-muted` · `border-line` · `divide-line` 이 전부 자동 생성된다.

### 2.2 색은 **14개가 전부**다

| 토큰 | 값 | 쓰는 곳 |
| --- | --- | --- |
| `surface` | `#ffffff` | 모든 배경 |
| `surface-muted` | `#f7f7f5` | hover · 완료 행 · 격자 틈 · 안내 박스 |
| `foreground` | `#1a1a1a` | 본문, 활성 메뉴 |
| `foreground-muted` | `#6b6b6b` | 설명문, 비활성 메뉴 |
| `foreground-faint` | `#a1a1a1` | 날짜, 라벨, `›` `↗` `▾` 기호 |
| `line` | `#e8e6e1` | 카드·행·섹션 구분 |
| `line-strong` | `#c9c6bf` | 입력 밑줄, Secondary 버튼 |
| `accent` | `#1a1a1a` | Primary 버튼 배경 |
| `accent-teal` | `#0a4145` | 액센트 (§11) |
| `accent-amber` | `#b5862c` | 중간 상태 |
| `danger` / `danger-bg` | | 삭제·에러·지연 |

### 2.3 절대 금지

```
❌ text-slate-500 / bg-gray-100 / border-stone-200 …  Tailwind 기본 팔레트 전부
❌ style={{ color: "#666" }}                          하드코딩 hex
❌ bg-[#f5f5f5]                                        임의값
```

**이유** — 기본 팔레트의 회색은 우리 `#6b6b6b` 와 미묘하게 톤이 달라서, 한 화면에 섞이면
"왜인지 모르게 지저분한" 느낌이 난다. 그리고 나중에 색을 조정할 때 grep 이 불가능해진다.

예외는 **DB 에 저장된 사용자 지정 색**(일정 종류 컬러) 하나뿐이고, 이건 인라인 style 로 쓴다.

```tsx
<span aria-hidden className="rounded-full shrink-0"
      style={{ backgroundColor: t.color, width: 8, height: 8 }} />
```

### 2.4 투명도 문법은 적극 활용

토큰이 14개뿐이어도 `/숫자` 로 충분히 변주된다.

```tsx
border-accent-teal/40      // 연한 teal 테두리
bg-accent-teal/10          // 활성 행 배경
bg-accent-teal/[0.03]      // 거의 안 보이는 강조 박스
border-line/60             // 기본선보다 더 연한 구분
bg-foreground/10           // 메가메뉴 딤
bg-foreground/40           // 모달 딤
text-danger/70             // 위험 기호
```

**새 색을 추가하기 전에 기존 토큰의 투명도로 해결되는지 먼저 본다.**

---

## 3. 타이포그래피

### 3.1 폰트

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo",
    "Pretendard", "Noto Sans KR", "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  letter-spacing: -0.005em;   /* 한글은 살짝 좁혀야 정갈하다 */
}

h1, h2, h3, h4 {
  font-weight: 400;           /* ★ 전역에서 굵기를 눌러둔다 */
  letter-spacing: -0.015em;
}
```

웹폰트를 로드하지 않는다. 시스템 폰트가 각 OS 에서 가장 잘 렌더링되고, 로딩 깜빡임(FOUT)도
없다. 한글은 iOS/macOS 에서 Apple SD Gothic Neo, Windows 는 맑은 고딕으로 떨어진다.

### 3.2 스케일

| 용도 | 클래스 | 비고 |
| --- | --- | --- |
| 페이지 제목 | `text-3xl font-light` (상세는 `sm:text-4xl`) | 유일하게 큰 글자 |
| 섹션 제목 | `text-base` | h2. 크기를 안 키운다 |
| 카드 제목 | `text-lg font-medium leading-snug` | |
| 본문 | `text-sm leading-[1.85]` | ★ 한글 가독성의 핵심 |
| 긴 읽기 본문 | `text-base leading-[1.85]` | |
| 보조 설명 | `text-xs text-foreground-muted` | |
| 메타(날짜 등) | `text-xs text-foreground-faint` | |
| 마이크로 라벨 | `text-[10px] tracking-wider` | 하단바, 상태 배지 |
| 섹션 라벨 | `.label` | 아래 참고 |

### 3.3 `.label` — 이 디자인의 시그니처

```css
.label {
  font-size: 0.6875rem;      /* 11px */
  letter-spacing: 0.22em;    /* ★ 아주 넓게 */
  text-transform: uppercase;
  color: var(--foreground-faint);
  font-weight: 500;
}
```

영문 대문자를 넓은 자간으로 흩뿌리는 이 한 줄이 화면의 격을 만든다.

```tsx
<p className="label">Meeting Note</p>
<h1 className="mt-3 text-3xl font-light">8월 셋째주 정기모임</h1>
```

**한국어에도 쓴다** (`<p className="label">마이</p>`). 대문자 변환은 한글에 영향이 없고
자간·색·크기만 적용돼 "작은 소제목" 역할을 한다.

### 3.4 숫자는 `tabular-nums`

```tsx
<span className="text-xs tabular-nums">{page} / {pageCount}</span>
<p className="text-3xl font-light leading-none tabular-nums">{day}</p>
```

진행률·페이지·날짜처럼 **바뀌는 숫자**에 반드시. 없으면 1과 8의 폭이 달라 값이 갱신될 때마다
레이아웃이 떨린다.

### 3.5 한국어 카피 규칙

- UI·에러·도메인 용어 전부 **한국어 우선**. 영문은 `.label` 과 브랜드에만.
- **짧은 카피는 마침표 없이** 끝낸다 (`할일 추가`, `아직 작성된 회의록이 없습니다.` ← 문장은 예외).
- 안내문은 지시가 아니라 **설명**으로: "제목을 입력하세요" → "회의를 한 줄로 적습니다".
- 빈 상태는 부정형 대신 담백하게: "데이터 없음" → "아직 작성된 회의록이 없습니다."

---

## 4. 여백 리듬

### 4.1 표준 값

| 위치 | 값 | 클래스 |
| --- | --- | --- |
| 페이지 좌우 | 16 / 32px | `px-4 sm:px-8` |
| 페이지 상하 | 40 / 56px | `py-10 sm:py-14` |
| 섹션 사이 (상세) | 56px | `space-y-14` |
| 섹션 사이 (일반) | 40px | `space-y-10` |
| 섹션 제목 ↔ 내용 | 12~20px | `mb-3` ~ `mb-5` |
| 리스트 행 | 16~24px | `py-4` ~ `py-6` |
| 카드 안쪽 | 24px | `p-6` |
| 폼 필드 사이 | 20px | `space-y-5` |
| 폼 섹션 사이 | 48px | `space-y-12` |

**4의 배수만 쓴다.** `py-[13px]` 같은 임의값이 등장하는 순간 리듬이 깨진다.

### 4.2 ★ 헤더와 첫 행은 붙인다

이 규칙 하나가 "잘 만든 화면"과 "어설픈 화면"을 가른다.

```tsx
❌ 잘못
<div className="space-y-10">
  <header className="border-b border-line pb-6">…</header>
  <ul className="divide-y divide-line">…</ul>     {/* 40px 떠 있음 */}
</div>

✅ 옳음
<div className="max-w-3xl">
  <header className="border-b border-line pb-6">…</header>
  <ul className="divide-y divide-line">…</ul>     {/* 헤더 선과 첫 행이 맞닿음 */}
</div>
```

헤더의 `border-b` 와 첫 행의 hover 영역이 **곧장 이어져야** 표처럼 단단하게 읽힌다.
컨테이너에 `space-y-*` 를 걸면 그 사이가 벌어져 헤더가 붕 뜬다.

탭도 마찬가지 — 탭 nav 의 `border-b` 와 첫 행 사이에 `pt-8` 같은 패딩을 넣지 않는다.
행 자체로 구분이 명확한 콘텐츠일수록 **0px 로 붙이는 게 자연스럽다.**

### 4.3 hover 영역은 컨테이너 밖으로 넓힌다

```tsx
className="block py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors"
//                  ↑ 음수 마진 + 같은 값의 패딩
```

`-mx-2 px-2` 로 좌우 8px 씩 hover 배경이 넓어진다. 텍스트에 딱 맞는 hover 는 인색해 보인다.
값은 리스트 밀도에 맞춘다 — 촘촘하면 `-mx-2 px-2`, 널널하면 `-mx-4 px-4`.

### 4.4 구분선 위아래 대칭

```tsx
<div className="mt-3 pt-6 border-t border-line/60">
```

```
위 = 앞 항목의 py-3 하단(12) + mt-3(12) = 24px
아래 = pt-6 = 24px
```

`mt-6` 만 쓰면 위 36 / 아래 24 로 어긋난다. **구분선은 항상 정중앙에.**

---

## 5. 레이아웃 골격

### 5.1 폭 3단계

```
max-w-6xl (1152px)  헤더 · main 컨테이너 · 대시보드 · 목록
max-w-3xl (768px)   상세 · 폼 — 읽기/쓰기 콘텐츠
max-w-md  (448px)   모달
```

```tsx
{/* 앱 셸 */}
<main className="mx-auto max-w-6xl px-4 sm:px-8 py-10 sm:py-14 pb-24 sm:pb-14">
  <Outlet />
</main>

{/* 상세 페이지 */}
<article className="space-y-14 max-w-3xl">…</article>

{/* 폼 페이지 */}
<div className="space-y-10 max-w-3xl">…</div>
```

**본문 텍스트는 절대 1152px 을 꽉 채우지 않는다.** 한 줄이 너무 길면 눈이 다음 줄을 못 찾는다.
`max-w-3xl` = 한글 기준 약 45~50자, 읽기에 최적.

### 5.2 세로 구조

```
body (safe-area padding, overflow-x hidden)
└ div.min-h-dvh
   ├ header            (border-b, 브랜드 + 네비)
   ├ main              (max-w-6xl, pb-24 sm:pb-14)
   │   └ 페이지 컴포넌트
   └ MobileBottomNav   (fixed bottom, sm:hidden)
```

`min-h-screen` 이 아니라 **`min-h-dvh`** — iOS 동적 주소창 보정.

---

## 6. 페이지 템플릿 4종

새 화면을 만들 때는 이 넷 중 하나를 고른 뒤 안을 채운다. **새 골격을 발명하지 않는다.**

### 6.1 목록형 (`/tasks`, `/notes`, `/meetings`)

```tsx
export function XxxListPage() {
  return (
    <div>
      {/* ① 헤더 — 라벨 / 제목 / 한 줄 설명 + 우측 액션 */}
      <header className="flex items-end justify-between border-b border-line pb-6 gap-4">
        <div>
          <p className="label">All Notes</p>
          <h1 className="mt-3 text-3xl font-light">회의록</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            함께 나눈 대화, 다시 꺼내 볼 수 있도록.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-foreground-faint">{list.length}건</p>
          <Link to="/notes/new"
                className="bg-accent-teal text-accent-foreground px-3 py-1.5 text-xs
                           hover:bg-accent-teal/85 transition-colors">
            + 회의록 작성
          </Link>
        </div>
      </header>

      {/* ② 본문 — 헤더 바로 아래 (여백 없음!) */}
      {loading ? null : list.length === 0 ? (
        <p className="border-b border-line py-16 text-center text-sm text-foreground-faint">
          아직 작성된 회의록이 없습니다.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line border-b border-line">
            {paginate(list, page, PAGE_SIZE).map((n) => (
              <li key={n.id}>{/* 행 */}</li>
            ))}
          </ul>
          <Pager page={page} total={list.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </>
      )}
    </div>
  );
}
```

**3상태를 항상 처리한다**: 로딩(`null`) → 빈 상태(안내문) → 목록.
로딩에 스피너를 쓰지 않고 `null` 을 반환하는 이유 — 데이터가 대부분 100ms 안에 오는데
스피너가 깜빡이면 더 느려 보인다.

### 6.2 상세형 (`/notes/:id`, `/tasks/:id`)

```tsx
<article className="space-y-14 max-w-3xl">
  {/* ① 상단 바 — 뒤로가기 / 관리 액션 */}
  <div className="flex items-center justify-between">
    <Link to="/notes" className="text-xs text-foreground-muted hover:text-foreground">
      ← 회의록
    </Link>
    {canManage && (
      <div className="flex items-center gap-3 text-xs">
        <Link to={`/notes/${note.id}/edit`}
              className="text-foreground-muted hover:text-foreground">편집</Link>
        <span aria-hidden className="text-foreground-faint">·</span>
        <button type="button" onClick={handleDelete}
                className="text-danger hover:underline underline-offset-4">삭제</button>
      </div>
    )}
  </div>

  {/* ② 타이틀 */}
  <header>
    <p className="label">Meeting Note</p>
    <h1 className="mt-3 text-3xl font-light leading-tight sm:text-4xl">{note.title}</h1>
  </header>

  {/* ③ 메타 그리드 — gap-px 격자 */}
  <section className="grid gap-px bg-surface-muted border border-line sm:grid-cols-2">
    <Stat label="연결된 일정" value="…" />
    <Stat label="작성일" value="…" />
  </section>

  {/* ④ 본문 섹션들 — label + 내용 반복 */}
  <section>
    <h2 className="label mb-3">본문</h2>
    <RichRender html={note.content} />
  </section>

  {/* ⑤ 소셜 블록 */}
  <LikeCommentBlock … />
</article>
```

### 6.3 폼형 (`/notes/new`, `/meetings/new`)

```tsx
<form onSubmit={handleSubmit} className="space-y-12">
  <header>
    <p className="label">Meeting Note</p>
    <h1 className="mt-3 text-3xl font-light leading-tight sm:text-4xl">{previewTitle}</h1>
  </header>

  <Section title="연결">…</Section>
  <Section title="아젠다">…</Section>
  <Section title="할일" subtitle="저장 시 회의록에 연결된 할일로 등록됩니다.">…</Section>

  {error && <p className={errorBox}>{error}</p>}

  {/* 액션은 항상 우측 정렬, 취소 → 삭제 → 저장 순 */}
  <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-6">
    <button type="button" onClick={onCancel}
            className="border border-line-strong px-5 py-2.5 text-sm text-foreground hover:border-foreground">
      취소
    </button>
    <button type="submit"
            className="border border-accent bg-accent px-5 py-2.5 text-sm text-accent-foreground
                       hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-60">
      {busy ? "저장 중..." : submitLabel}
    </button>
  </footer>
</form>
```

```tsx
function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 border-b border-line pb-3">
        <h2 className="text-base">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-foreground-faint">{subtitle}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Stacked({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1 text-xs text-foreground-faint">{hint}</p>}
    </div>
  );
}
```

### 6.4 대시보드형 (`/dashboard`)

```tsx
<div className="space-y-14">
  <GreetingHero … />
  <MyActionPanel … />     {/* 항목 0개면 컴포넌트가 스스로 null */}
  <UpcomingList … />
  <MyTasksPreview … />
  <ActivityFeed … />
</div>
```

위젯은 전부 `<section>` + `SectionHeader` 로 시작하고, **비면 스스로 사라진다**(§8.2).
대시보드 페이지는 조립만 하고 조건 분기를 갖지 않는다.

---

## 7. 반복 패턴 라이브러리

앱 전체에서 계속 재사용되는 12개. 새 화면은 이 조합으로 90% 가 만들어진다.

### 7.1 행 리스트 (가장 많이 쓰임)

```tsx
<ul className="divide-y divide-line border-b border-line">
  {items.map((it) => (
    <li key={it.id}>
      <Link to={`/x/${it.id}`}
            className="block py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm truncate">{it.title}</p>
          <span className="text-xs text-foreground-faint shrink-0">{it.date}</span>
        </div>
        <p className="mt-1 text-xs text-foreground-muted line-clamp-2">{it.preview}</p>
      </Link>
    </li>
  ))}
</ul>
```

- `divide-y divide-line` + `border-b` — 행 사이와 마지막 아래에만 선. **위에는 선이 없다**
  (헤더의 `border-b` 가 그 역할).
- `flex justify-between` + 오른쪽 `shrink-0` + 왼쪽 `truncate` — 긴 제목이 날짜를 밀어내지 않는다.

### 7.2 카드 그리드

```tsx
<div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
  {items.map((it) => <Card key={it.id} … />)}
</div>
```

또는 개별 보더 방식:

```tsx
<Link className="h-full flex flex-col border border-line p-6 hover:border-foreground transition-colors">
  <header className="flex items-center gap-3">
    <Avatar url={owner.avatar_url} name={display} size="md" />
    <div className="min-w-0">
      <p className="text-sm truncate">{display}</p>
      <p className="text-xs text-foreground-muted truncate">{subtitle}</p>
    </div>
    <span className="ml-auto text-xs text-foreground-faint shrink-0">{date}</span>
  </header>
  <div className="flex-1">
    <h3 className="mt-5 text-lg font-medium leading-snug">{title}</h3>
    <p className="mt-3 text-sm leading-[1.85] text-foreground-muted line-clamp-3">{preview}</p>
  </div>
</Link>
```

`h-full flex flex-col` + 내용부 `flex-1` — 그리드 안에서 카드 높이가 서로 맞고
푸터가 바닥에 붙는다. **카드 hover 는 배경이 아니라 `hover:border-foreground`** (테두리가 진해짐).

### 7.3 메타 그리드 — `gap-px` 격자 (★)

```tsx
<section className="grid gap-px bg-surface-muted border border-line sm:grid-cols-3">
  <MetaCell label="담당자" person={assignee} />
  <MetaCell label="기한"   value="2026-08-25" />
  <MetaCell label="작성자" person={creator} />
</section>

function MetaCell({ label, value, person }) {
  return (
    <div className="bg-surface px-4 py-4">     {/* ★ 셀은 반드시 흰 배경 */}
      <p className="label">{label}</p>
      {person ? (
        <div className="mt-2 flex items-center gap-2">
          <Avatar url={person.avatar_url} name={person.name} size="sm" />
          <span className="text-sm truncate">{person.name}</span>
        </div>
      ) : (
        <p className="mt-2 text-sm">{value}</p>
      )}
    </div>
  );
}
```

**원리** — 부모 배경을 `surface-muted` 로 두고 `gap-px` 로 1px 틈을 내면, 그 틈으로 부모 색이
비쳐 **보더처럼 보인다.** 셀마다 border 를 주면 맞닿는 곳이 2px 로 두꺼워지는데 이 방법은
어디서나 정확히 1px. 반응형으로 열 수가 바뀌어도 자동으로 맞는다.

### 7.4 빈 상태

```tsx
<p className="border-b border-line py-12 text-center text-sm text-foreground-faint">
  아직 작성된 회의록이 없습니다.
</p>
```

일러스트·아이콘 없음. **한 문장.** 목록 안이면 `border-b` 를 붙여 리스트의 일부처럼 보이게.
행동을 유도할 땐 헤더의 기존 액션 버튼으로 충분하다 (빈 상태 안에 버튼을 또 넣지 않는다).

### 7.5 섹션 헤더 + 전체 보기

```tsx
export function SectionHeader({ title, href, cta = "전체 보기" }: {
  title: string; href?: string; cta?: string;
}) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <h2 className="label">{title}</h2>
      {href && (
        <Link to={href} className="text-xs text-foreground-muted hover:text-foreground">
          {cta} →
        </Link>
      )}
    </div>
  );
}
```

### 7.6 탭

```tsx
function TabButton({ active, onClick, label, count }) {
  return (
    <button type="button" onClick={onClick}
      className={`pb-3 -mb-px border-b transition-colors ${
        active ? "text-foreground border-foreground"
               : "text-foreground-muted hover:text-foreground border-transparent"
      }`}>
      {label}{" "}
      <span className={`ml-1 text-xs ${active ? "text-foreground" : "text-foreground-faint"}`}>
        {count}
      </span>
    </button>
  );
}

// 컨테이너
<div className="flex items-end justify-between gap-4 border-b border-line -mb-px">
  <div className="flex gap-6 text-sm">{/* 탭들 */}</div>
  <div className="flex items-center gap-3 pb-2 text-xs">{/* 우측 도구 */}</div>
</div>
```

`-mb-px` + 탭의 `pb-3 -mb-px border-b` — 활성 탭의 밑줄이 컨테이너 선을 **덮어써서**
탭이 아래 콘텐츠와 이어진 것처럼 보인다.

### 7.7 세그먼트 필터 (Pill)

```tsx
<div className="inline-flex border border-line-strong">
  <StatusPill active={f === "open"} onClick={…} label="미완료" />
  <StatusPill active={f === "done"} onClick={…} label="완료" />
  <StatusPill active={f === "all"}  onClick={…} label="전체" />
</div>

function StatusPill({ active, onClick, label }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 transition-colors ${
        active ? "bg-foreground text-accent-foreground" : "text-foreground hover:bg-surface-muted"
      }`}>
      {label}
    </button>
  );
}
```

바깥 보더 하나에 버튼들을 붙인다. 버튼마다 보더를 주지 않는다.

### 7.8 아이콘 버튼 (정사각 36px)

```tsx
<button type="button" aria-label="필터"
  className={`inline-flex items-center justify-center w-8 h-8 border transition-colors ${
    on ? "border-foreground text-foreground"
       : "border-line-strong text-foreground-muted hover:border-foreground hover:text-foreground"
  }`}>
  <svg viewBox="0 0 20 20" aria-hidden className="w-4 h-4"
       fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 5h14M6 10h8M9 15h2" strokeLinecap="round" />
  </svg>
</button>
```

**SVG 공통 규격** — `fill="none"` · `stroke="currentColor"` · `strokeWidth="1.5"` ·
`strokeLinecap/Linejoin="round"` · `aria-hidden`. 아이콘 라이브러리를 쓰지 않고 직접 그린다
(라이브러리 아이콘은 굵기·곡률이 제각각이라 hairline 톤과 충돌).

### 7.9 버튼 3종

```ts
// Primary — 검정. 페이지에 하나만.
"border border-accent bg-accent px-5 py-2.5 text-sm text-accent-foreground
 hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-60"

// Secondary — 보더만
"border border-line-strong px-5 py-2.5 text-sm text-foreground hover:border-foreground disabled:opacity-60"

// Accent(teal) — 생성/등록 같은 긍정 액션, 작은 사이즈
"bg-accent-teal text-accent-foreground px-4 py-2 text-xs hover:bg-accent-teal/85
 transition-colors disabled:opacity-60"

// Danger — 텍스트 버튼으로만
"text-xs text-danger hover:underline underline-offset-4"
```

**한 화면에 Primary 는 하나.** 나머지는 Secondary 나 텍스트 버튼.

### 7.10 입력

```ts
export const inputClass =
  "w-full border-b border-line-strong px-0 py-2 text-sm focus:border-foreground
   focus:outline-none bg-transparent placeholder:text-foreground-faint";
export const labelClass = "text-xs text-foreground-muted";
export const errorBox   = "border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger";
```

**입력은 박스가 아니라 밑줄 하나.** 포커스 시 밑줄이 진해진다(`focus:border-foreground`).
`focus:outline-none` 을 쓰되 밑줄 변화가 포커스 표시를 대신한다.

`<select>` 와 `<input type="date">` 도 같은 `inputClass` 를 쓴다 — 네이티브 컨트롤이지만
밑줄만 남아 통일감이 생긴다.

### 7.11 토글 스위치 (직사각형)

```tsx
<button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
  className={`relative w-10 h-6 transition-colors ${checked ? "bg-accent-teal" : "bg-line-strong"}`}>
  <span aria-hidden
    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-surface transition-transform ${
      checked ? "translate-x-4" : ""}`} />
</button>
```

둥근 스위치를 쓰지 않아도 **움직이는 사각형 손잡이**로 충분히 스위치로 읽힌다.

### 7.12 모달

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40
                px-4 py-6 pt-safe-top pb-safe-bottom"
     onClick={closable ? onClose : undefined} role="presentation">
  <div className={`relative w-full ${sizes[size]} max-h-[calc(100dvh-3rem)] overflow-auto
                   bg-surface border border-line`}
       onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
    <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
      <div className="min-w-0">
        <h2 className="text-base">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-foreground-faint">{subtitle}</p>}
      </div>
      <button onClick={onClose} aria-label="닫기"
              className="text-foreground-faint hover:text-foreground text-2xl leading-none px-1 -mr-1 -mt-1">
        ×
      </button>
    </header>
    <div className="px-6 py-6">{children}</div>
    {footer && <footer className="border-t border-line px-6 py-4">{footer}</footer>}
  </div>
</div>
```

- `bg-foreground/40` 딤, 모달 자체는 그림자 없이 `border border-line`.
- `max-h-[calc(100dvh-3rem)] overflow-auto` — 긴 내용도 화면을 넘지 않는다.
- `pt-safe-top pb-safe-bottom` — `fixed` 요소라 body 패딩이 안 먹는다.
- body 스크롤 잠금 + ESC 처리 + **원래 overflow 값 복원**은 §10.5 와 동일.

### 7.13 페이저

```tsx
<nav aria-label="페이지" className="flex items-center justify-center gap-4 pt-8">
  <button disabled={page <= 1} aria-label="이전 페이지"
          className="text-foreground-muted hover:text-foreground disabled:opacity-30
                     text-sm w-7 h-7 flex items-center justify-center">‹</button>
  <span className="text-xs text-foreground-muted tabular-nums">{page} / {pageCount}</span>
  <button disabled={page >= pageCount} aria-label="다음 페이지" …>›</button>
</nav>
```

숫자 나열식 페이지네이션을 쓰지 않는다. `‹ 3 / 12 ›` 만으로 충분하고 모바일에서도 안 깨진다.

### 7.14 아바타

```tsx
const dims = { xs: "size-5", sm: "size-8", md: "size-10", lg: "size-14", xl: "size-20" };

const cls = `${dims[size]} shrink-0 rounded-full overflow-hidden border border-line bg-surface-muted`;
// 이미지 없으면 이름 첫 글자
<span className="text-sm text-foreground-muted">{initial}</span>
```

크기 5단계를 벗어나지 않는다. 이미지가 없을 때 **회색 원 + 첫 글자**가 기본 — 랜덤 컬러
아바타를 쓰지 않는다(컬러 절제 원칙).

---

## 8. 컴포넌트 작성 규약

### 8.1 공용 클래스는 상수로

```ts
// src/features/_shared.ts
export const inputClass = "w-full border-b border-line-strong px-0 py-2 text-sm focus:border-foreground focus:outline-none bg-transparent placeholder:text-foreground-faint";
export const labelClass = "text-xs text-foreground-muted";
export const primaryBtn = "w-full border border-accent bg-accent px-4 py-3 text-sm text-accent-foreground hover:bg-foreground-muted hover:border-foreground-muted transition disabled:opacity-50";
export const secondaryBtn = "w-full flex items-center justify-center gap-3 border border-line-strong bg-surface px-4 py-3 text-sm text-foreground hover:border-foreground transition disabled:opacity-60";
export const errorBox = "border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger";
```

같은 클래스 문자열이 **3번째로 복사되는 순간** 상수로 뺀다. 컴포넌트로 만들 정도는
아니지만 반복되는 것들이 여기 모인다.

### 8.2 비면 스스로 사라진다

```tsx
export function TaskProgress({ done, total }: Props) {
  if (total === 0) return null;          // ★ 첫 줄
  …
}

export function MyActionPanel({ … }: Props) {
  const total = pendingAgendas.length + pendingTasks.length + (draftCount > 0 ? 1 : 0);
  if (total === 0) return null;          // ★
  …
}
```

**빈 컴포넌트를 부모가 조건 분기로 감추게 하지 않는다.** 컴포넌트가 스스로 판단하면
부모(대시보드 등)는 조립만 하면 되고, 빈 카드가 남는 사고가 구조적으로 없어진다.

예외 — **목록 페이지의 본문**은 빈 상태 문구를 보여줘야 하므로 `null` 이 아니다.
"이 자리에 원래 뭔가 있어야 한다" 면 문구, "부가 정보" 면 `null`.

### 8.3 `compact` variant 로 재사용

```tsx
type Props = {
  done: number;
  total: number;
  /** 리스트 행 안에서 쓰는 축소판 — 박스 없음, 작은 글씨 */
  compact?: boolean;
};
```

같은 정보를 큰 자리/작은 자리 양쪽에서 쓸 때 컴포넌트를 두 개 만들지 않는다.
`compact` boolean 하나로 가른다. 3가지 이상 필요해지면 그때 `variant: "full" | "compact" | "row"`.

### 8.4 props 는 도메인 타입이 아니라 표시값으로

```tsx
❌ <TaskProgress tasks={tasks} />              // 컴포넌트가 Task 타입을 알아야 함
✅ <TaskProgress done={3} total={9} />         // 숫자 두 개만
```

프레젠테이션 컴포넌트가 도메인 타입을 import 하면, 그 타입이 바뀔 때마다 UI 가 깨지고
다른 도메인에 재사용할 수 없다. **계산은 페이지에서, 표시는 컴포넌트에서.**

카드처럼 필드가 많은 건 `Pick<>` 으로 최소 필드만 받는다:

```tsx
type Props = {
  meeting: Pick<Meeting, "id" | "title" | "description" | "location" | "starts_at" | "type_id">;
};
```

### 8.5 파일 배치

```
src/components/           # 도메인 무관 · 여러 곳에서 쓰임
  avatar.tsx · modal.tsx · pager.tsx · brand-mark.tsx · task-progress.tsx
src/components/dashboard/ # 대시보드 전용 위젯
src/features/<도메인>/     # 그 도메인 화면 조각 (폼, 섹션, 피커)
src/pages/                # 라우트 단위 페이지
src/layouts/              # 앱 셸
```

**승격 기준** — `pages/` 안에 있던 조각이 **두 번째 페이지에서 필요해지면** `features/` 로,
`features/` 안의 것이 **도메인 3개에서 쓰이면** `components/` 로 올린다.
미리 올리지 않는다.

### 8.6 주석은 「왜」만

```tsx
// ❌ 상태를 true 로 만든다
setOpen(true);

// ✅ 서버 왕복 + 전체 refetch 를 기다리면 느리고, 빠른 더블클릭 시
//    토글이 두 번 돌아 되돌아가는 문제가 있어 낙관적 업데이트를 쓴다.
const [optimisticLiked, setOptimisticLiked] = useState(liked);
```

코드를 읽으면 아는 것은 적지 않는다. **그렇게 한 이유**, 특히 시행착오 끝에 정한 값
(`-mx-2`, `24px 대칭`, `sm:contents`)에는 반드시 한 줄 남긴다.

---

## 9. 상호작용 상태 표준

| 상태 | 표현 | 클래스 |
| --- | --- | --- |
| hover — 행/리스트 | 배경이 살짝 | `hover:bg-surface-muted` |
| hover — 카드 | 테두리가 진해짐 | `hover:border-foreground` |
| hover — 텍스트/메뉴 | 글자가 진해짐 | `hover:text-foreground` |
| active — 메뉴(상단바) | 글자 농도 | `text-foreground` |
| active — 리스트 항목 | teal + 연한 배경 | `text-accent-teal bg-accent-teal/10` |
| active — 탭 | 밑줄 | `border-b border-foreground` |
| active — 세그먼트 | 반전 | `bg-foreground text-accent-foreground` |
| disabled | 흐리게 | `disabled:opacity-60` (아이콘은 `disabled:opacity-30`) |
| 전환 | 색만, 짧게 | `transition-colors` |
| 큰 패널 | 300ms | `transition-[…] duration-300 ease-out` |

**애니메이션 규칙**
- 기본은 `transition-colors` 만. 이동·확대·회전은 쓰지 않는다.
- 예외 2개: 메가메뉴 슬라이드(`grid-rows`), 토글 손잡이(`translate-x`), 화살표 회전(`rotate-180`).
- 페이지 전환 애니메이션 없음. 즉시 바뀌는 게 가장 빠르게 느껴진다.

**hover 는 데스크탑 전용 효과다.** 모바일에서 활성 상태를 hover 로만 표현하면 안 된다 —
반드시 색(teal)으로도 구분한다.

---

## 10. 모바일 대응 규칙

### 10.1 분기는 `sm` 하나

```
~639px : 모바일    640px~ : 데스크탑
```

`md:` / `lg:` 는 **그리드 열 수**에만 쓴다 (`sm:grid-cols-2 lg:grid-cols-3`).
레이아웃 구조 자체를 바꾸는 분기는 `sm` 하나로 제한한다. 분기가 늘면 테스트 조합이 폭발한다.

### 10.2 모바일 우선으로 쓴다

```tsx
✅ className="text-3xl sm:text-4xl"      // 기본이 모바일
❌ className="text-4xl max-sm:text-3xl"  // 데스크탑 먼저 → 예외 처리
```

### 10.3 `sm:contents` 트릭 — DOM 하나로 두 레이아웃

모바일에선 여러 컨트롤을 한 줄로 묶고, 데스크탑에선 바깥 그리드에 직접 배치.

```tsx
<li className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_160px_140px_auto] sm:gap-2 sm:items-center">
  <input className={inputClass} placeholder="내용" />
  {/* 모바일: 이 div 가 3개를 한 줄로 묶음
      sm+ : display:contents 로 래퍼가 사라져 자식이 바깥 그리드 열에 들어감 */}
  <div className="grid grid-cols-[1fr_auto_auto] gap-2 sm:contents">
    <select className={inputClass}>…</select>
    <input type="date" className={`${inputClass} w-32 sm:w-auto`} />
    <button className="…">×</button>
  </div>
</li>
```

같은 UI 를 두 번 렌더(`sm:hidden` / `hidden sm:block`)하지 않아도 된다.

### 10.4 터치 · 가독성 최소치

| 항목 | 최소 |
| --- | --- |
| 터치 영역 | 44px (`py-3` 이상). 하단바는 `min-h-[56px]` |
| 본문 글자 | 14px (`text-sm`). 읽기 콘텐츠는 16px |
| 행 전체가 링크 | 텍스트만 링크로 만들지 않는다 |

### 10.5 가로 스크롤 절대 금지

```css
body { overflow-x: hidden; }
html, body {
  overscroll-behavior: none;   /* 좌우 스와이프 이탈 · 바운스 차단 */
  touch-action: pan-y;         /* 세로 스크롤만 */
}
```

긴 콘텐츠 처리:

```tsx
truncate            // 한 줄 말줄임 — 제목, 이름
line-clamp-2 / -3   // 여러 줄 말줄임 — 미리보기
break-all           // URL 등 끊을 데 없는 문자열
min-w-0             // ★ flex/grid 자식에 없으면 truncate 가 안 먹는다
shrink-0            // 날짜·배지처럼 줄면 안 되는 것
```

**테이블은 만들지 않는다.** 와이드한 표 데이터는 모바일에서 반드시 깨진다.
카드나 행 리스트로 재구성하거나, 정말 필요하면 `overflow-x-auto` 컨테이너에 가둔다.

### 10.6 Safe Area

```tsx
// fixed 요소는 body 패딩이 안 먹으므로 각자 붙인다
<nav className="fixed bottom-0 … pb-safe-bottom">        {/* 하단바 */}
<div className="fixed inset-0 … pt-safe-top pb-safe-bottom">  {/* 시트·모달 */}
<div className="min-h-dvh">                              {/* min-h-screen 아님 */}
```

---

## 11. 색을 언제 쓰는가

무채색이 기본이고, 색은 **의미가 있을 때만** 켠다.

### `accent-teal` — 3가지 경우에만

1. **브랜드 정체성** — BrandMark 의 점 하나
2. **현재 위치** — 활성 메뉴/행 (`text-accent-teal` + `bg-accent-teal/10`)
3. **긍정 액션과 완료** — 등록/추가 버튼, 완료 체크박스, 진행률 바

```tsx
bg-accent-teal text-accent-foreground   // 작은 액션 버튼
border-accent-teal bg-accent-teal       // 체크된 체크박스
bg-accent-teal                          // 진행률 채움
border-accent-teal/40 bg-accent-teal/[0.03]  // 강조 박스 (거의 흰색)
text-accent-teal bg-accent-teal/10      // 활성 리스트 행
```

### `danger` — 3가지

1. 삭제 버튼/링크 (`text-danger hover:underline`)
2. 에러 메시지 (`errorBox`)
3. **기한 초과** (`text-danger` — 날짜 텍스트만, 행 전체를 칠하지 않는다)

### `accent-amber` — 중간 상태

「지각」처럼 완료도 실패도 아닌 상태. 앱 전체에서 한두 군데만.

### 판단 기준

> **"이 색을 지우면 사용자가 잘못된 행동을 하게 되나?"**
> 아니라면 무채색으로 둔다.

진행률 바가 teal 인 이유는 "얼마나 찼는지"가 즉시 읽혀야 해서고, 삭제가 빨간 이유는
실수하면 되돌릴 수 없어서다. 카드 제목을 파랗게 할 이유는 없다.

---

## 12. 무너뜨리지 않고 관리하는 법

디자인 시스템은 만드는 것보다 **유지하는 게** 어렵다. 아래 5개 장치로 관리한다.

### 12.1 신규 화면 체크리스트 (PR 전 자가 점검)

```
□ 페이지 템플릿 4종(§6) 중 하나를 골랐다 — 새 골격을 만들지 않았다
□ 색은 토큰만 썼다 (slate/gray/hex/임의값 0개)
□ shadow · rounded(원형 제외) 0개
□ 헤더 border-b 와 첫 행이 붙어 있다 (사이에 space-y 없음)
□ 여백은 4의 배수, §4 표의 값을 썼다
□ 로딩 / 빈 상태 / 정상 3가지를 다 처리했다
□ 모바일 375px 에서 가로 스크롤이 없다
□ truncate / line-clamp 를 걸고 min-w-0 을 줬다
□ 터치 영역 44px 이상
□ Primary 버튼이 화면에 하나뿐이다
□ 반복되는 클래스를 3번째 복사하지 않았다
□ 아이콘은 stroke 1.5 / round 규격이다
```

### 12.2 새 토큰·패턴 추가 절차

```
1. 기존 토큰의 투명도(/10, /40)로 해결되는지 먼저 확인   ← 90% 는 여기서 끝난다
2. 안 되면 이 문서에 먼저 추가 규칙을 쓴다 (이름 · 값 · 언제 쓰는지)
3. index.css 의 :root + @theme inline 양쪽에 정의
4. 기존 화면에 회귀가 없는지 확인
```

**코드부터 고치고 문서를 나중에 쓰지 않는다.** 문서에 못 쓸 규칙이면 그 색은 필요 없는 색이다.

### 12.3 컴포넌트 승격 3회 규칙

```
1회차 — 그 자리에 인라인으로 쓴다
2회차 — 복사한다. 아직 추상화하지 않는다 (형태가 확정 안 됨)
3회차 — 공통 컴포넌트나 클래스 상수로 뺀다
```

두 번째에 성급히 추상화하면 세 번째 사례에서 props 가 폭발한다.

### 12.4 리뷰에서 반드시 보는 4가지

| 항목 | 확인 |
| --- | --- |
| **색** | 토큰 외 색상 리터럴이 있는가 (`grep -n "slate-\|gray-\|#[0-9a-f]\{3,6\}"`) |
| **여백** | 임의값(`py-[13px]`)이 있는가 |
| **밀도** | 헤더-본문이 떠 있지 않은가 |
| **모바일** | 375px 스크린샷을 첨부했는가 |

간단한 grep 가드:

```bash
# 금지 팔레트 / 하드코딩 색 / 그림자 / 라운드 검사
grep -rnE "(slate|gray|stone|zinc|neutral)-[0-9]{2,3}" src/ && echo "❌ 금지 팔레트"
grep -rnE "shadow-(sm|md|lg|xl)" src/ && echo "❌ 그림자"
grep -rnE "rounded-(sm|md|lg|xl|2xl)" src/ && echo "❌ 라운드"
```

CI 에 붙이면 자동으로 막힌다. 3줄이면 충분하다.

### 12.5 문서와 코드를 같이 고친다

- 디자인 규칙이 바뀌면 **이 문서를 먼저** 고치고 코드를 맞춘다.
- `CLAUDE.md` 같은 에이전트 지시 문서에도 토큰 표와 금지 목록을 넣어둔다 →
  AI 가 코드를 쓸 때 자동으로 규칙을 따른다.
- 예외를 만들었으면 **왜 예외인지 코드 주석에** 남긴다
  (예: "비전보드만 글라스모피즘 — 별개 제품 무드").

---

## 13. 안티패턴 12가지

### ① 헤더와 목록 사이에 `space-y-10`

가장 흔하고 가장 눈에 띈다. 헤더 밑줄과 첫 행은 맞닿아야 한다. → §4.2

### ② 카드에 그림자 추가

"떠 보이게 하려고" 넣는 순간 다른 카드와 톤이 안 맞는다. `border-line` 으로 충분하다.

### ③ 상태를 색으로만 표현

```tsx
❌ <span className="text-accent-teal">●</span>
✅ <span className="text-[10px] uppercase tracking-wider text-accent-teal">완료</span>
```

색맹 사용자와 흑백 인쇄를 고려해 **텍스트나 형태**를 함께 준다.

### ④ 빈 상태에 일러스트/버튼 잔뜩

한 문장이면 된다. 액션은 이미 헤더에 있다.

### ⑤ `min-w-0` 누락

flex/grid 자식에 `min-w-0` 이 없으면 `truncate` 가 무시되고 컨테이너가 밀려 **가로 스크롤**이 생긴다.
"모바일에서 화면이 옆으로 밀려요" 의 1순위 원인.

### ⑥ `divide-y` 와 각 행 `border-b` 를 같이

선이 2px 로 두꺼워지고 마지막 행 아래가 이상해진다. 둘 중 하나만.

### ⑦ 반응형 분기를 3~4개

`sm/md/lg/xl` 을 다 쓰면 어느 폭에서 뭐가 깨지는지 아무도 모른다. `sm` 하나 + 그리드 열 수만.

### ⑧ 로딩 스피너 남발

100ms 안에 오는 데이터에 스피너를 띄우면 깜빡여서 더 느려 보인다. `return null` 이 낫다.

### ⑨ 도메인 타입을 프레젠테이션 컴포넌트에 주입

`<TaskProgress tasks={tasks} />` → `<TaskProgress done={3} total={9} />`. → §8.4

### ⑩ 아이콘 라이브러리 도입

굵기·곡률이 우리 hairline 과 안 맞고 번들만 커진다. 필요한 5~10개는 직접 그린다.

### ⑪ 폰트 굵기 인플레이션

`font-bold` 를 한 번 쓰면 옆 요소도 굵어지고 결국 다 굵어진다. `font-medium` 까지만.

### ⑫ "이번만 예외"

한 화면만 다르게 하면 그 화면이 버그처럼 보인다. 정말 다른 무드가 필요하면
**별개 제품으로 선언**하고 문서에 적는다 (밋업의 비전보드가 그 사례).

---

## 14. 샘플 모음

밋업 앱에서 뽑은 **표본 8개 전문**. 각 샘플마다 ① 원본 코드 ② 쓰인 패턴 매핑 ③ 주의점 순으로 정리했다.

이 8개면 §6 페이지 템플릿 4종과 §7 패턴 라이브러리, §8 컴포넌트 규약이 전부 실물로 덮인다.
새 화면을 만들 때는 **가장 가까운 샘플을 복사해서 시작**하는 것이 규칙을 외우는 것보다 빠르고 정확하다.

| # | 파일 | 표본 |
| --- | --- | --- |
| 14.1 | `src/index.css` | 토큰 · 전역 베이스 — 모든 화면의 출발점 |
| 14.2 | `src/features/auth/_shared.tsx` | 클래스 상수 — 컴포넌트로 만들기엔 이른 반복의 집합소 |
| 14.3 | `src/pages/notes.tsx` | 목록형 페이지 템플릿 — 가장 짧고 완결적인 표본 |
| 14.4 | `src/pages/note-detail.tsx` | 상세형 페이지 템플릿 — 섹션 조립의 표본 |
| 14.5 | `src/features/meetings/meeting-form.tsx` | 폼형 템플릿 — Section / Stacked 조립과 액션 푸터 |
| 14.6 | `src/features/tasks/task-row.tsx` | 행 컴포넌트 — 모바일/데스크탑 정보 배치가 다른 사례 |
| 14.7 | `src/components/task-progress.tsx` | 컴포넌트 규약 3종 세트 — 47줄에 전부 들어 있음 |
| 14.8 | `src/components/dashboard/my-action-panel.tsx` | 대시보드 위젯 규약 — 여러 도메인을 한 리스트로 합치기 |

> 코드는 실제 파일 전문이다. 발췌·요약하지 않았으므로 그대로 복사해 쓸 수 있다.
> 도메인 함수(`getTasks`, `useAsync` 등) import 경로만 새 앱에 맞게 바꾸면 된다.

---

### 14.1 `src/index.css` — 토큰 · 전역 베이스 — 모든 화면의 출발점

색 · safe-area · 폰트 · `.label` · 에디터 타이포까지 **디자인의 모든 상수가 이 한 파일에 있다.** 다른 앱으로 옮길 때 가장 먼저 복사할 파일.

**전문** (343줄)

```css
@import "tailwindcss";

/* ============================================================
 * 밋업 — MUJI-inspired design tokens
 * Pure white surfaces, restrained type, generous whitespace,
 * hairline borders, no shadows or rounded corners by default.
 * Single teal touchpoint is reserved for the BrandMark dot and
 * the dashboard "Featured Meetup" label.
 * ============================================================ */

:root {
  /* iOS / Android PWA safe area insets — overlap with status bar &
   * home indicator. Defaults to 0 on browsers without notch. */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);

  --background: #ffffff;
  --surface: #ffffff;
  --surface-muted: #f7f7f5;

  --foreground: #1a1a1a;
  --foreground-muted: #6b6b6b;
  --foreground-faint: #a1a1a1;

  --line: #e8e6e1;
  --line-strong: #c9c6bf;

  --accent: #1a1a1a;
  --accent-foreground: #ffffff;
  --accent-teal: #0a4145;
  --accent-amber: #b5862c;      /* 지각 등 중간 상태 강조 (warm ochre) */

  --danger: #b54a3a;
  --danger-bg: #fbf1ef;
}

@theme inline {
  /* expose safe-area as Tailwind spacing tokens for utility classes:
   * pt-safe / pb-safe / pl-safe / pr-safe */
  --spacing-safe-top: var(--safe-top);
  --spacing-safe-bottom: var(--safe-bottom);
  --spacing-safe-left: var(--safe-left);
  --spacing-safe-right: var(--safe-right);

  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-surface-muted: var(--surface-muted);
  --color-foreground: var(--foreground);
  --color-foreground-muted: var(--foreground-muted);
  --color-foreground-faint: var(--foreground-faint);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent-teal: var(--accent-teal);
  --color-accent-amber: var(--accent-amber);
  --color-danger: var(--danger);
  --color-danger-bg: var(--danger-bg);
}

html,
body {
  /* 좌우 스와이프로 페이지가 튀어나가는 것 + iOS 오버스크롤 바운스 방지 */
  overscroll-behavior: none;
  /* 가로 패닝/핀치 확대 차단 — 세로 스크롤만 허용 */
  touch-action: pan-y;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo",
    "Pretendard", "Noto Sans KR", "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  letter-spacing: -0.005em;
  /* PWA / standalone: 상태바와 홈 인디케이터를 피해서 본문 콘텐츠 보호.
   * 좌우는 가로 노치(랜드스케이프 X 위치)까지 고려. */
  padding-top: var(--safe-top);
  padding-bottom: var(--safe-bottom);
  padding-left: var(--safe-left);
  padding-right: var(--safe-right);
  /* 가로 스크롤 절대 금지 */
  overflow-x: hidden;
  /* iOS 더블탭 확대 비활성 */
  -webkit-text-size-adjust: 100%;
}

h1, h2, h3, h4 {
  font-weight: 400;
  letter-spacing: -0.015em;
}

.label {
  font-size: 0.6875rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--foreground-faint);
  font-weight: 500;
}

/* Horizontally scrollable rows (e.g. mobile nav) without the visible
   scrollbar. Falls back to default scrollbar on browsers that don't
   support these properties. */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* ============================================================
 * Rich text editor (Tiptap) — MUJI-aligned typography for the
 * editor canvas and read-only render output.
 * ============================================================ */
.prose-meetup h1 {
  font-size: 1.5rem;
  font-weight: 500;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  color: var(--foreground);
  letter-spacing: -0.01em;
}
.prose-meetup h2 {
  font-size: 1.25rem;
  font-weight: 500;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  color: var(--foreground);
}
.prose-meetup h3 {
  font-size: 1.05rem;
  font-weight: 500;
  margin-top: 1.25em;
  margin-bottom: 0.4em;
  color: var(--foreground);
}
.prose-meetup p {
  margin: 0.6em 0;
}
/* 빈 단락 (Enter 두 번 = 시각적 빈 줄) 이 인접 margin 으로 collapse
   되어 사라지는 문제 — min-height 로 한 줄 분량 공간 확보. <p><br></p>
   형태(일부 에디터 출력)도 같이 처리. */
.prose-meetup p:empty,
.prose-meetup p:has(> br:only-child) {
  min-height: 1em;
}
.prose-meetup ul,
.prose-meetup ol {
  margin: 0.6em 0;
  padding-left: 1.4em;
}
.prose-meetup ul {
  list-style: disc;
}
.prose-meetup ol {
  list-style: decimal;
}
.prose-meetup li {
  margin: 0.25em 0;
}
.prose-meetup li > p {
  margin: 0;
}
/* 체크리스트 (Tiptap TaskList / TaskItem) */
.prose-meetup ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0.25em;
}
.prose-meetup ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5em;
  margin: 0.25em 0;
}
.prose-meetup ul[data-type="taskList"] li > label {
  flex-shrink: 0;
  margin-top: 0.35em;
  user-select: none;
}
.prose-meetup ul[data-type="taskList"] li > label input[type="checkbox"] {
  appearance: none;
  width: 0.9em;
  height: 0.9em;
  border: 1px solid var(--line-strong);
  background: var(--surface);
  cursor: pointer;
  display: inline-block;
  vertical-align: middle;
  position: relative;
}
.prose-meetup ul[data-type="taskList"] li > label input[type="checkbox"]:checked {
  background: var(--accent-teal);
  border-color: var(--accent-teal);
}
.prose-meetup ul[data-type="taskList"] li > label input[type="checkbox"]:checked::after {
  content: "✓";
  color: var(--accent-foreground);
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7em;
  line-height: 1;
}
.prose-meetup ul[data-type="taskList"] li > div {
  flex: 1;
  min-width: 0;
}
.prose-meetup ul[data-type="taskList"] li[data-checked="true"] > div {
  color: var(--foreground-faint);
  text-decoration: line-through;
}
.prose-meetup blockquote {
  border-left: 2px solid var(--line-strong);
  padding-left: 0.9em;
  color: var(--foreground-muted);
  margin: 0.8em 0;
}

/* 대화 틀(클로드/질문답변) — 좌측 라인 대신 회색 라운드 박스.
   me=오른쪽 말풍선 · claude=왼쪽 말풍선 · q/a=폭 꽉 채운 박스. */
.prose-meetup blockquote[data-speaker] {
  border: none;
  padding: 12px 16px;
  border-radius: 14px;
  background: var(--surface-muted);
  color: var(--foreground);
  position: relative;
  margin: 8px 0;
  max-width: 100%;
}
.prose-meetup blockquote[data-speaker] > p:first-child {
  margin: 0 0 4px;
  font-size: 0.82em;
  font-weight: 600;
  color: var(--foreground-muted);
}
.prose-meetup blockquote[data-speaker] > p:last-child {
  margin-bottom: 0;
}
/* 나 — 오른쪽 말풍선 + 우측 꼬리 */
.prose-meetup blockquote[data-speaker="me"] {
  max-width: 82%;
  margin-left: auto;
  margin-right: 9px;
}
.prose-meetup blockquote[data-speaker="me"]::after {
  content: "";
  position: absolute;
  top: 16px;
  right: -7px;
  border-top: 7px solid transparent;
  border-bottom: 7px solid transparent;
  border-left: 8px solid var(--surface-muted);
}
/* Claude — 왼쪽 말풍선 + 좌측 꼬리 */
.prose-meetup blockquote[data-speaker="claude"] {
  max-width: 82%;
  margin-right: auto;
  margin-left: 9px;
}
.prose-meetup blockquote[data-speaker="claude"]::before {
  content: "";
  position: absolute;
  top: 16px;
  left: -7px;
  border-top: 7px solid transparent;
  border-bottom: 7px solid transparent;
  border-right: 8px solid var(--surface-muted);
}
.prose-meetup pre {
  background: var(--surface-muted);
  border: 1px solid var(--line);
  padding: 0.75em 1em;
  font-size: 0.85em;
  overflow-x: auto;
  margin: 0.8em 0;
}
.prose-meetup code {
  background: var(--surface-muted);
  padding: 0.1em 0.35em;
  font-size: 0.92em;
}
.prose-meetup pre code {
  background: transparent;
  padding: 0;
}
.prose-meetup hr {
  border: 0;
  border-top: 1px solid var(--line);
  margin: 1.5em 0;
}
.prose-meetup a {
  color: var(--accent-teal);
  text-decoration: underline;
  text-underline-offset: 2px;
}
/* Tiptap placeholder */
.tiptap p.is-editor-empty:first-child::before {
  color: var(--foreground-faint);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

/* ============================================================
 * Editor custom tooltip — data-tip + .editor-tip class
 * Replaces native title; 350ms hover delay, dark popup.
 * Used by toolbar + BubbleMenu buttons.
 * ============================================================ */
.editor-tip {
  position: relative;
}
.editor-tip::after {
  content: attr(data-tip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%) translateY(2px);
  background: var(--foreground);
  color: var(--surface);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  padding: 4px 8px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 140ms ease, transform 140ms ease;
  transition-delay: 0ms;
  z-index: 10001;
  letter-spacing: 0.02em;
}
.editor-tip:hover::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
  transition-delay: 350ms;
}
```

**쓰인 패턴**

| 부분 | 패턴 | 문서 |
| --- | --- | --- |
| `:root` 색 변수 14개 | 토큰 단일 출처 | §2.1 |
| `@theme inline` | CSS 변수 → Tailwind 유틸리티 노출 | §2.1 |
| `--safe-*` + `--spacing-safe-*` | `pt-safe-top` / `pb-safe-bottom` 생성 | §10.6 |
| `body` 4방향 패딩 · `overflow-x:hidden` | PWA 안전영역 · 가로 스크롤 차단 | §10.5 |
| `h1~h4 { font-weight: 400 }` | 굵기 인플레이션을 전역에서 차단 | §3.1 |
| `.label` | 시그니처 소제목 | §3.3 |
| `.prose-meetup` | 리치 에디터 본문 타이포 | §3.2 |

**주의점**

- **`@theme inline` 안에 정의하는 게 아니라, `:root` 값을 참조만 한다.** 이래야 런타임에 CSS 변수를 바꿔 테마를 갈아끼울 여지가 남는다.
- `--accent-teal` 은 이 파일에서 `#0a4145` — 문서/디자인 초안의 `#0f5258` 보다 조금 더 어둡게 조정된 최종값이다. **코드가 진실**이므로 새 앱에 옮길 땐 이 값을 쓴다.
- `touch-action: pan-y` 는 모바일에서 가로 팬·핀치 확대를 막는다. 지도나 이미지 뷰어를 넣는다면 그 컨테이너에서만 해제해야 한다.
- 에디터를 안 쓰는 앱이라면 `.prose-*` 블록은 통째로 빼도 된다.

---

### 14.2 `src/features/auth/_shared.tsx` — 클래스 상수 — 컴포넌트로 만들기엔 이른 반복의 집합소

`inputClass` / `labelClass` / `primaryBtn` / `secondaryBtn` / `errorBox`. 앱 전체의 폼이 이 5개 문자열을 공유한다.

**전문** (61줄)

```tsx
/**
 * Small utilities shared by the auth modal family — kept here so each
 * modal file stays focused on its own form.
 */

export function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (m.includes("email not confirmed")) {
    return "이메일 인증이 필요합니다. 메일함을 확인해 주세요.";
  }
  if (m.includes("user already registered") || m.includes("already exists")) {
    return "이미 가입된 이메일입니다. 로그인을 시도해 주세요.";
  }
  if (m.includes("password should be at least")) {
    return "비밀번호는 8자 이상이어야 합니다.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "처리 중 오류가 발생했습니다. 다시 시도해 주세요.";
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.6 16 18.9 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C33.9 6.1 29.2 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.8 28l-6.6 5C9.6 39.5 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4 5.4l6.2 5.2c-.4.4 6.5-4.7 6.5-14.6 0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export const inputClass =
  "w-full border-b border-line-strong px-0 py-2 text-sm focus:border-foreground focus:outline-none bg-transparent placeholder:text-foreground-faint";

export const labelClass = "text-xs text-foreground-muted";

export const primaryBtn =
  "w-full border border-accent bg-accent px-4 py-3 text-sm text-accent-foreground hover:bg-foreground-muted hover:border-foreground-muted transition disabled:opacity-50 disabled:cursor-not-allowed";

export const secondaryBtn =
  "w-full flex items-center justify-center gap-3 border border-line-strong bg-surface px-4 py-3 text-sm text-foreground hover:border-foreground transition disabled:opacity-60";

export const errorBox =
  "border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger";
```

**쓰인 패턴**

| 부분 | 패턴 | 문서 |
| --- | --- | --- |
| `inputClass` | 밑줄 입력 (박스 없음) | §7.10 |
| `primaryBtn` / `secondaryBtn` | 버튼 2종 | §7.9 |
| `errorBox` | 에러 표시 | §7.10 |
| `translateAuthError` | 영문 에러 → 한국어 카피 | §3.5 |
| `GoogleIcon` | 브랜드 컬러가 강제되는 예외 (§2.3) | §2.3 |

**주의점**

- **위치가 아쉬운 사례다.** `features/auth/` 안에 있지만 실제로는 앱 전역에서 import 한다 (회의록 폼, 할일 폼, 댓글 입력…). 새 앱에서는 처음부터 `src/features/_shared.ts` 나 `src/styles/classes.ts` 같은 중립 위치에 둘 것.
- `GoogleIcon` 만 하드코딩 hex 를 쓴다 — 구글 브랜드 가이드가 색을 지정하기 때문. **토큰 금지 규칙의 정당한 예외이고, 이런 예외는 파일에 주석으로 남긴다.**
- `disabled:cursor-not-allowed` 는 `primaryBtn` 에만 있고 나머지엔 없다. 사소한 불일치 — 새로 옮길 땐 4개 버튼 모두 `disabled:opacity-*` 만으로 통일하는 걸 권장.

---

### 14.3 `src/pages/notes.tsx` — 목록형 페이지 템플릿 — 가장 짧고 완결적인 표본

114줄에 목록 페이지의 모든 요소가 들어 있다. **새 목록 화면은 이 파일을 복사해서 시작한다.**

**전문** (114줄)

```tsx
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import { getWorkspaceNotes } from "@/lib/data/meeting-notes";
import { getTasks } from "@/lib/data/tasks";
import { TaskProgress } from "@/components/task-progress";
import { Pager, PAGE_SIZE, paginate } from "@/components/pager";
import { formatShortDateTime } from "@/lib/format";
import { notePreview } from "@/lib/note-preview";

export function NotesPage() {
  const { workspace, loading: wsLoading } = useActiveWorkspace();
  const [page, setPage] = useState(1);

  const { data: notes, loading } = useAsync(
    () =>
      workspace ? getWorkspaceNotes(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );
  const { data: tasks } = useAsync(
    () =>
      workspace
        ? getTasks({ workspaceId: workspace.id })
        : Promise.resolve([]),
    [workspace?.id],
  );

  const list = notes ?? [];

  /** Task progress grouped by note_id. */
  const progressByNote = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    (tasks ?? []).forEach((t) => {
      if (!t.note_id) return;
      const prev = map.get(t.note_id) ?? { done: 0, total: 0 };
      prev.total += 1;
      if (t.status === "done") prev.done += 1;
      map.set(t.note_id, prev);
    });
    return map;
  }, [tasks]);

  if (wsLoading) return null;

  return (
    <div>
      <header className="flex items-end justify-between border-b border-line pb-6 gap-4">
        <div>
          <p className="label">All Notes</p>
          <h1 className="mt-3 text-3xl font-light">회의록</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            함께 나눈 대화, 다시 꺼내 볼 수 있도록.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-foreground-faint">{list.length}건</p>
          <Link
            to="/notes/new"
            className="bg-accent-teal text-accent-foreground px-3 py-1.5 text-xs hover:bg-accent-teal/85 transition-colors"
          >
            + 회의록 작성
          </Link>
        </div>
      </header>

      {loading ? null : list.length === 0 ? (
        <p className="border-b border-line py-16 text-center text-sm text-foreground-faint">
          아직 작성된 회의록이 없습니다.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line border-b border-line">
            {paginate(list, page, PAGE_SIZE).map((n) => {
              const preview = notePreview(n);
              const p = progressByNote.get(n.id);
              return (
                <li key={n.id}>
                  <Link
                    to={`/notes/${n.id}`}
                    className="block py-5 hover:bg-surface-muted -mx-4 px-4 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-base">{n.title}</p>
                      <span className="text-xs text-foreground-faint shrink-0">
                        {formatShortDateTime(n.created_at)}
                      </span>
                    </div>
                    {preview && (
                      <p className="mt-2.5 text-xs text-foreground-muted line-clamp-2 leading-relaxed">
                        {preview}
                      </p>
                    )}
                    {p && (
                      <div className="mt-4 max-w-md">
                        <TaskProgress done={p.done} total={p.total} compact />
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pager
            page={page}
            total={list.length}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
```

**쓰인 패턴**

| 부분 | 패턴 | 문서 |
| --- | --- | --- |
| `<header className="flex items-end justify-between border-b border-line pb-6 gap-4">` | 페이지 헤더 | §6.1 |
| 헤더 바로 다음에 `<ul>` (사이 여백 0) | 헤더-본문 밀착 | §4.2 |
| `loading ? null : list.length === 0 ? … : …` | 3상태 처리 | §6.1 |
| `divide-y divide-line border-b border-line` | 행 리스트 | §7.1 |
| `-mx-4 px-4 hover:bg-surface-muted` | 넓힌 hover 영역 | §4.3 |
| `useMemo` 로 `progressByNote` Map 집계 | N+1 회피 | §7.1 |
| `<TaskProgress … compact />` | 축소판 variant | §8.3 |
| `Pager` + `paginate` | 페이지 넘기기 | §7.13 |
| `line-clamp-2` | 미리보기 말줄임 | §10.5 |

**주의점**

- **최상위 컨테이너에 `space-y-*` 가 없다.** 이게 헤더와 첫 행이 붙는 이유. 여기에 `space-y-10` 을 넣는 순간 화면이 어설퍼진다.
- 진행률은 노트마다 쿼리하지 않고 **전체 할일을 한 번 받아 `Map` 으로 집계**한다. 목록 화면의 기본 전략.
- `{n.title}` 은 `text-base`, 날짜는 `text-xs text-foreground-faint shrink-0` — 제목이 길어도 날짜를 밀지 않는다.
- 빈 상태 문구는 `py-16`(목록 전체가 비었을 때)으로 조금 더 넉넉하다. 섹션 내부 빈 상태는 `py-12`.

---

### 14.4 `src/pages/note-detail.tsx` — 상세형 페이지 템플릿 — 섹션 조립의 표본

`space-y-14 max-w-3xl` 안에 상단바 → 타이틀 → 메타 격자 → 본문 섹션들 → 관련 리스트 → 작성자 카드 순서로 쌓는다.

**전문** (334줄)

```tsx
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useAsync } from "@/lib/use-async";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { getNote, deleteNote } from "@/lib/data/meeting-notes";
import { getMeeting, getMeetingAttendees } from "@/lib/data/meetings";
import { getProfile, getProfiles } from "@/lib/data/profile";
import { getMyRole } from "@/lib/data/workspaces";
import { getTasksForNote } from "@/lib/data/tasks";
import { Avatar } from "@/components/avatar";
import { AttachmentsSection } from "@/features/attachments/attachments-section";
import { RichRender } from "@/features/editor/rich-editor";
import { TaskProgress } from "@/components/task-progress";
import { formatDateTime, formatFullDate, formatShortDate, formatTime } from "@/lib/format";

export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();

  const { data: note, loading } = useAsync(
    () => (id ? getNote(id) : Promise.resolve(null)),
    [id],
  );
  const { data: meeting } = useAsync(
    () => (note?.meeting_id ? getMeeting(note.meeting_id) : Promise.resolve(null)),
    [note?.meeting_id],
  );
  const { data: attendees } = useAsync(
    () =>
      note?.meeting_id
        ? getMeetingAttendees(note.meeting_id)
        : Promise.resolve([]),
    [note?.meeting_id],
  );
  const { data: author } = useAsync(
    () => (note?.created_by ? getProfile(note.created_by) : Promise.resolve(null)),
    [note?.created_by],
  );
  const { data: tasks } = useAsync(
    () => (id ? getTasksForNote(id) : Promise.resolve([])),
    [id],
  );
  const assigneeIds = (tasks ?? [])
    .map((t) => t.assignee_id)
    .filter((id): id is string => !!id);
  const { data: assigneeProfiles } = useAsync(
    () => getProfiles(assigneeIds),
    [assigneeIds.join(",")],
  );
  const { data: myRole } = useAsync(
    () =>
      workspace && user
        ? getMyRole(workspace.id, user.id)
        : Promise.resolve(null),
    [workspace?.id, user?.id],
  );

  if (loading) return null;
  if (!note) return <Navigate to="/notes" replace />;

  const canManage =
    !!user &&
    (note.created_by === user.id ||
      myRole === "owner" ||
      myRole === "admin");

  async function handleDelete() {
    if (!note) return;
    if (!confirm("이 회의록을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    const ok = await deleteNote(note.id);
    if (ok) navigate("/notes");
  }

  return (
    <article className="space-y-14 max-w-3xl">
      <div className="flex items-center justify-between">
        <Link
          to="/notes"
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          ← 회의록
        </Link>
        {canManage && (
          <div className="flex items-center gap-3 text-xs">
            <Link
              to={`/notes/${note.id}/edit`}
              className="text-foreground-muted hover:text-foreground"
            >
              편집
            </Link>
            <span aria-hidden className="text-foreground-faint">
              ·
            </span>
            <button
              type="button"
              onClick={handleDelete}
              className="text-danger hover:underline underline-offset-4"
            >
              삭제
            </button>
          </div>
        )}
      </div>

      <header>
        <p className="label">Meeting Note</p>
        <h1 className="mt-3 text-3xl font-light leading-tight sm:text-4xl">
          {note.title}
        </h1>
        {note.summary && (
          <p className="mt-6 text-base leading-[1.85] text-foreground-muted">
            {note.summary}
          </p>
        )}
      </header>

      <section className="grid gap-px bg-surface-muted border border-line sm:grid-cols-2">
        <Stat
          label="연결된 일정"
          value={
            meeting
              ? `${meeting.title} · ${formatFullDate(meeting.starts_at)} ${formatTime(meeting.starts_at)}`
              : "일정 미연결 (카톡 등)"
          }
          link={meeting ? `/meetings/${meeting.id}` : null}
        />
        <Stat label="작성일" value={formatDateTime(note.created_at)} />
      </section>

      {meeting && (attendees ?? []).length > 0 && (
        <section>
          <h2 className="label mb-4">
            참석자 · {(attendees ?? []).filter((a) => a.status === "attending").length}명
          </h2>
          <ul className="flex flex-wrap gap-2">
            {(attendees ?? [])
              .filter((a) => a.status === "attending")
              .map((a) => {
                const display = a.profile.name ?? a.profile.email;
                return (
                  <li key={a.profile.user_id}>
                    <Link
                      to={`/members/${a.profile.user_id}`}
                      className="flex items-center gap-2 border border-line px-3 py-1.5 text-xs hover:border-foreground"
                    >
                      <Avatar
                        url={a.profile.avatar_url}
                        name={display}
                        size="sm"
                      />
                      <span>{display}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {note.agenda && (
        <section>
          <h2 className="label mb-3">아젠다</h2>
          <ol className="space-y-2 text-sm leading-[1.85] text-foreground-muted">
            {note.agenda
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((item, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[28px_1fr] gap-2 items-baseline"
                >
                  <span className="text-foreground-faint tabular-nums text-right">
                    {i + 1}.
                  </span>
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
          </ol>
        </section>
      )}

      {note.content && (
        <section>
          <h2 className="label mb-3">본문</h2>
          <RichRender html={note.content} />
        </section>
      )}

      {workspace && (
        <AttachmentsSection
          workspaceId={workspace.id}
          refType="meeting_note"
          refId={note.id}
          canManage={canManage}
        />
      )}

      {(tasks ?? []).length > 0 && (
        <section>
          <div className="mb-4 space-y-3">
            <h2 className="label">할일 · {(tasks ?? []).length}</h2>
            <TaskProgress
              done={(tasks ?? []).filter((t) => t.status === "done").length}
              total={(tasks ?? []).length}
            />
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {(tasks ?? []).map((t) => {
              const assignee =
                assigneeProfiles?.find((p) => p.user_id === t.assignee_id) ??
                null;
              const overdue =
                t.due_date &&
                t.status !== "done" &&
                new Date(t.due_date).getTime() < Date.now();
              const done = t.status === "done";
              const assigneeName = assignee
                ? assignee.name ?? assignee.email
                : "미지정";
              const dueText = t.due_date
                ? formatShortDate(t.due_date)
                : "기한 없음";
              return (
                <li key={t.id}>
                  <Link
                    to={`/tasks/${t.id}`}
                    className={`block py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors ${
                      done ? "bg-surface-muted" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3 sm:items-center">
                      <span
                        aria-hidden
                        className={`size-5 mt-0.5 sm:mt-0 shrink-0 border flex items-center justify-center ${
                          done
                            ? "border-accent-teal bg-accent-teal text-accent-foreground"
                            : "border-line-strong"
                        }`}
                        title={done ? "완료" : "미완료"}
                      >
                        {done && <span className="text-xs leading-none">✓</span>}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p
                            className={`text-sm min-w-0 truncate max-w-full ${
                              done
                                ? "line-through text-foreground-faint"
                                : "text-foreground"
                            }`}
                          >
                            {t.title}
                          </p>
                          <span
                            className={`shrink-0 text-[10px] uppercase tracking-wider ${
                              done ? "text-accent-teal" : "text-foreground-faint"
                            }`}
                          >
                            {done ? "완료" : "미완료"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-foreground-muted">
                          <span>담당 · {assigneeName}</span>
                          <span className={overdue ? "text-danger" : ""}>
                            기한 · {dueText}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-foreground-faint">
            행을 클릭하면 상세에서 상태 변경 · 본문 / 첨부 편집이 가능합니다.
          </p>
        </section>
      )}

      {author && (
        <section>
          <h2 className="label mb-4">작성자</h2>
          <Link
            to={`/members/${author.user_id}`}
            className="flex items-center gap-4 border border-line p-5 hover:border-foreground transition-colors"
          >
            <Avatar
              url={author.avatar_url}
              name={author.name ?? author.email}
              size="lg"
            />
            <div>
              <p className="text-sm">{author.name ?? author.email}</p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                {[author.company, author.position].filter(Boolean).join(" · ") ||
                  author.industry ||
                  "—"}
              </p>
            </div>
          </Link>
        </section>
      )}
    </article>
  );
}

function Stat({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: string | null;
}) {
  const body = (
    <div className="bg-surface p-5">
      <p className="text-xs text-foreground-faint">{label}</p>
      <p className="mt-1.5 text-sm">{value}</p>
    </div>
  );
  if (link) {
    return (
      <Link to={link} className="hover:bg-surface-muted transition-colors">
        {body}
      </Link>
    );
  }
  return body;
}
```

**쓰인 패턴**

| 부분 | 패턴 | 문서 |
| --- | --- | --- |
| `<article className="space-y-14 max-w-3xl">` | 상세 골격 · 읽기 폭 | §5.1 · §6.2 |
| `← 회의록` + 편집·삭제 | 상단바 | §6.2 |
| `<p className="label">Meeting Note</p>` + `h1` | 타이틀 블록 | §3.3 |
| `grid gap-px bg-surface-muted border border-line` | 메타 격자 | §7.3 |
| `<h2 className="label mb-3">` 반복 | 섹션 헤더 | §4.1 |
| `getProfiles(assigneeIds)` | 프로필 묶음 조회 | §8.4 |
| `assigneeIds.join(",")` deps | 배열 deps 무한루프 방지 | — |
| 할일 리스트의 읽기전용 체크 `<span>` | 상태 표시 ≠ 조작 | §9 |
| 작성자 카드 `border border-line p-5 hover:border-foreground` | 카드 hover | §9 |

**주의점**

- **체크박스가 `<button>` 이 아니라 `<span aria-hidden>` 이다.** 회의록에서는 할일을 *보여주기만* 하고, 상태 변경은 할일 상세에서 한다. 조작 가능한 것과 표시만 하는 것을 마크업으로 구분한 사례.
- 리스트 아래 `행을 클릭하면 상세에서 상태 변경 …` 한 줄 — **비활성 UI 옆에는 어디서 할 수 있는지 안내**를 붙인다.
- `Stat` 셀에 `link` prop 이 있어 연결된 일정으로 이동한다. 메타 격자 셀도 링크가 될 수 있다.
- 섹션마다 `{조건 && (<section>…)}` 로 감싸 **내용이 없으면 섹션 자체가 사라진다** (§8.2 의 페이지 버전).

---

### 14.5 `src/features/meetings/meeting-form.tsx` — 폼형 템플릿 — Section / Stacked 조립과 액션 푸터

`space-y-12` 로 섹션을 나누고, 각 섹션은 `border-b` 소제목 + `space-y-5` 필드. 저장/취소/삭제 배치의 표준.

**전문** (361줄)

```tsx
import { useState, useMemo, type FormEvent } from "react";
import type { Meeting, MeetingType } from "@/lib/types/database";
import type { MeetingInput } from "@/lib/data/meetings";
import type { MemberWithProfile } from "@/lib/data/workspace-members";
import type { ProjectWithMeta } from "@/lib/data/projects";
import { Avatar } from "@/components/avatar";
import { errorBox, inputClass, labelClass } from "@/features/auth/_shared";
import { TypePicker } from "./type-picker";
import { LocationPicker } from "./location-picker";

type Props = {
  /** Pre-fill values when editing; null/undefined when creating. */
  initial?: Meeting | null;
  /** User ids who should start as attendees (only relevant on edit). */
  initialAttendeeIds?: ReadonlyArray<string>;
  /** Workspace members shown as attendee checkboxes. */
  members: MemberWithProfile[];
  /** Meeting types available in this workspace (admin-managed). */
  types: MeetingType[];
  /** Projects in this workspace, for optional 연동. */
  projects: ProjectWithMeta[];
  /** Submit handler. Resolves on success; throw to surface an error. */
  onSubmit: (
    values: Omit<MeetingInput, "workspace_id">,
    attendeeIds: string[],
  ) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  /** Optional delete action — shown as a quiet danger link when present. */
  onDelete?: () => Promise<void>;
};

export function MeetingForm({
  initial,
  initialAttendeeIds,
  members,
  types,
  projects,
  onSubmit,
  onCancel,
  submitLabel,
  onDelete,
}: Props) {
  const defaultStart = useMemo(() => nextHourLocal(), []);
  const defaultTypeId =
    initial?.type_id ??
    (types.find((t) => t.sort_order === 0) ?? types[0])?.id ??
    null;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [typeId, setTypeId] = useState<string | null>(defaultTypeId);
  const [projectId, setProjectId] = useState<string | null>(
    initial?.project_id ?? null,
  );
  const [startsAt, setStartsAt] = useState(
    initial ? toLocalInput(initial.starts_at) : defaultStart,
  );
  const [endsAt, setEndsAt] = useState(
    initial?.ends_at ? toLocalInput(initial.ends_at) : "",
  );

  const [attendees, setAttendees] = useState<Set<string>>(() => {
    const seed = initialAttendeeIds ?? members.map((m) => m.user_id);
    return new Set(seed);
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAttendee(userId: string) {
    setAttendees((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }
  function selectAllAttendees() {
    setAttendees(new Set(members.map((m) => m.user_id)));
  }
  function clearAttendees() {
    setAttendees(new Set());
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("제목은 필수입니다.");
      return;
    }
    if (!startsAt) {
      setError("시작 일시는 필수입니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(
        {
          type_id: typeId,
          project_id: projectId,
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          starts_at: fromLocalInput(startsAt),
          ends_at: endsAt ? fromLocalInput(endsAt) : null,
        },
        Array.from(attendees),
      );
    } catch (err) {
      setError((err as Error).message || "저장 중 오류가 발생했습니다.");
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm("이 일정을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    setBusy(true);
    try {
      await onDelete();
    } catch (err) {
      setError((err as Error).message || "삭제 중 오류가 발생했습니다.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      <Section title="기본 정보">
        <div className="grid gap-5 sm:grid-cols-2">
          <Stacked label="종류">
            <TypePicker
              types={types}
              value={typeId}
              onChange={setTypeId}
              placeholder="종류 선택"
            />
          </Stacked>
          <Stacked label="연결 프로젝트">
            <select
              value={projectId ?? ""}
              onChange={(e) => setProjectId(e.target.value || null)}
              className={inputClass}
            >
              <option value="">없음</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.name}
                </option>
              ))}
            </select>
          </Stacked>
        </div>
        <Stacked label="제목 *">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 5월 셋째주 모임"
            className={inputClass}
          />
        </Stacked>
        <Stacked label="설명">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
            placeholder="일정 한 줄 소개."
          />
        </Stacked>
        <Stacked label="장소">
          <LocationPicker value={location} onChange={setLocation} />
        </Stacked>
      </Section>

      <Section title="일시">
        <div className="grid gap-5 sm:grid-cols-2">
          <Stacked label="시작 *">
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={inputClass}
            />
          </Stacked>
          <Stacked label="종료">
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={inputClass}
            />
          </Stacked>
        </div>
      </Section>

      <Section
        title={`참석자 · ${attendees.size} / ${members.length}`}
        action={
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={selectAllAttendees}
              className="text-foreground-muted hover:text-foreground"
            >
              전체 선택
            </button>
            <button
              type="button"
              onClick={clearAttendees}
              className="text-foreground-muted hover:text-foreground"
            >
              전체 해제
            </button>
          </div>
        }
      >
        <ul className="grid gap-px bg-surface-muted border border-line sm:grid-cols-2">
          {members.map((m) => {
            const display = m.profile.name ?? m.profile.email;
            const subtitle = [m.profile.company, m.profile.position]
              .filter(Boolean)
              .join(" · ");
            const checked = attendees.has(m.user_id);
            return (
              <li key={m.user_id} className="bg-surface">
                <button
                  type="button"
                  onClick={() => toggleAttendee(m.user_id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-muted"
                >
                  <span
                    aria-hidden
                    className={`flex items-center justify-center size-4 border shrink-0 ${
                      checked
                        ? "border-foreground bg-foreground text-accent-foreground"
                        : "border-line-strong"
                    }`}
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <Avatar
                    url={m.profile.avatar_url}
                    name={display}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{display}</p>
                    {subtitle && (
                      <p className="text-xs text-foreground-muted truncate">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {error && <p className={errorBox}>{error}</p>}

      <footer className="flex flex-wrap items-center gap-2 border-t border-line pt-6">
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="text-xs text-danger hover:underline underline-offset-4 mr-auto disabled:opacity-60"
          >
            일정 삭제
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="border border-line-strong px-5 py-2.5 text-sm text-foreground hover:border-foreground disabled:opacity-60"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={busy}
          className="border border-accent bg-accent px-5 py-2.5 text-sm text-accent-foreground hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-60"
        >
          {busy ? "저장 중..." : submitLabel}
        </button>
      </footer>
    </form>
  );
}

// ───────────────────────────────────────────────────────────────
// Local helpers
// ───────────────────────────────────────────────────────────────

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-baseline justify-between border-b border-line pb-3">
        <h2 className="text-base">{title}</h2>
        {action}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Stacked({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1 text-xs text-foreground-faint">{hint}</p>}
    </div>
  );
}

/** ISO → "YYYY-MM-DDTHH:MM" in the user's local timezone. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** datetime-local value → ISO string. */
function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

/** Default "next hour at :00" for the create form's starts_at. */
function nextHourLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toLocalInput(d.toISOString());
}
```

**쓰인 패턴**

| 부분 | 패턴 | 문서 |
| --- | --- | --- |
| `<form className="space-y-12">` | 폼 골격 | §6.3 |
| `Section` (제목 + `border-b` + `space-y-5`) | 폼 섹션 | §6.3 |
| `Stacked` (label + `mt-2` + hint) | 필드 래퍼 | §6.3 |
| `inputClass` 재사용 (input·select·textarea 공통) | 입력 통일 | §7.10 |
| `toLocalInput` / `fromLocalInput` / `nextHourLocal` | datetime 변환 | 회의-할일 가이드 §5.3 |
| `footer … justify-end gap-2 border-t border-line pt-6` | 액션 푸터 | §6.3 |
| `errorBox` + `setBusy` | 에러/제출 상태 | §7.10 |
| `grid sm:grid-cols-2` | 반응형 2열 | §10.1 |

**주의점**

- **버튼 순서는 취소 → 삭제 → 저장.** 파괴적 액션을 가장자리가 아니라 가운데 두어, 오른쪽 끝(엄지·커서가 가는 곳)은 항상 안전한 저장이 차지한다.
- 제출 실패 시 `setBusy(false)` 를 **catch 안에서만** 부른다. 성공 시엔 페이지가 이동하므로 풀지 않는다 — 이동 직전 버튼이 잠깐 되살아나 두 번 눌리는 걸 막는다.
- 필수 필드 검증은 HTML `required` 가 아니라 **`setError` 로 직접** 한다. 브라우저 기본 툴팁은 디자인 통제 밖이고 한국어 문구도 못 바꾼다.
- `defaultTypeId` 는 `sort_order === 0` 우선 → 없으면 첫 항목. **드롭다운 기본값을 비워두지 않는 습관**이 폼 실수를 줄인다.
- 이 파일에는 참석자 체크박스 섹션이 남아 있다. 참석자 기능을 쓰지 않는 앱으로 옮길 땐 그 `Section` 만 지우면 나머지는 그대로 동작한다.

---

### 14.6 `src/features/tasks/task-row.tsx` — 행 컴포넌트 — 모바일/데스크탑 정보 배치가 다른 사례

목록의 한 줄. 링크 안에 조작 가능한 체크박스가 들어가는 까다로운 케이스를 어떻게 푸는지 보여준다.

**전문** (130줄)

```tsx
import { Link } from "react-router";
import { Avatar } from "@/components/avatar";
import { formatShortDate } from "@/lib/format";
import type { Task, TaskStatus } from "@/lib/types/database";
import type { MemberWithProfile } from "@/lib/data/workspace-members";

type Props = {
  task: Task;
  members: MemberWithProfile[];
  /** Toggle the done status. When omitted, the checkbox is non-interactive. */
  onToggle?: (next: TaskStatus) => Promise<void> | void;
  /** Link back to the note this task belongs to, if any. */
  noteLink?: string | null;
};

export function TaskRow({ task, members, onToggle, noteLink }: Props) {
  const done = task.status === "done";
  const assignee = members.find((m) => m.user_id === task.assignee_id);
  const assigneeName = assignee?.profile.name ?? assignee?.profile.email ?? null;
  const overdue =
    !done &&
    task.due_date &&
    new Date(task.due_date).getTime() < Date.now();

  return (
    <li>
      <Link
        to={`/tasks/${task.id}`}
        className={`block py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors ${
          done ? "bg-surface-muted" : ""
        }`}
      >
        <div className="flex items-start gap-3 sm:items-center">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onToggle) void onToggle(done ? "todo" : "done");
            }}
            disabled={!onToggle}
            aria-label={done ? "미완료로 표시" : "완료로 표시"}
            title={done ? "완료 (클릭해 미완료로)" : "미완료 (클릭해 완료로)"}
            className={`size-5 mt-0.5 sm:mt-0 shrink-0 border flex items-center justify-center transition-colors ${
              done
                ? "border-accent-teal bg-accent-teal text-accent-foreground"
                : "border-line-strong hover:border-foreground"
            } ${onToggle ? "cursor-pointer" : "cursor-default"}`}
          >
            {done && <span className="text-xs leading-none">✓</span>}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p
                className={`text-sm min-w-0 truncate max-w-full ${
                  done
                    ? "line-through text-foreground-faint"
                    : "text-foreground"
                }`}
              >
                {task.title}
              </p>
              {noteLink && (
                <Link
                  to={noteLink}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 text-xs text-foreground-faint hover:text-accent-teal"
                >
                  ↗ 회의록
                </Link>
              )}
              <span
                className={`shrink-0 text-[10px] uppercase tracking-wider ${
                  done ? "text-accent-teal" : "text-foreground-faint"
                }`}
              >
                {done ? "완료" : "미완료"}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-foreground-muted sm:hidden">
              <span className="inline-flex items-center gap-1">
                담당 ·
                {assigneeName ? (
                  <>
                    <Avatar
                      url={assignee?.profile.avatar_url ?? null}
                      name={assigneeName}
                      size="xs"
                    />
                    <span>{assigneeName}</span>
                  </>
                ) : (
                  <span>미지정</span>
                )}
              </span>
              <span className={overdue ? "text-danger" : ""}>
                기한 · {task.due_date ? formatShortDate(task.due_date) : "없음"}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-sm text-foreground-muted w-40 shrink-0">
            <span>담당 ·</span>
            {assigneeName ? (
              <>
                <Avatar
                  url={assignee?.profile.avatar_url ?? null}
                  name={assigneeName}
                  size="xs"
                />
                <span className="truncate">{assigneeName}</span>
              </>
            ) : (
              <span>미지정</span>
            )}
          </div>
          <p
            className={`hidden sm:block text-sm shrink-0 w-28 ${
              overdue ? "text-danger" : "text-foreground-faint"
            }`}
          >
            {task.due_date ? formatShortDate(task.due_date) : "기한 없음"}
          </p>
        </div>
      </Link>
    </li>
  );
}
```

**쓰인 패턴**

| 부분 | 패턴 | 문서 |
| --- | --- | --- |
| `<Link className="block py-4 -mx-2 px-2 hover:bg-surface-muted">` | 행 링크 + 넓힌 hover | §4.3 · §7.1 |
| `e.preventDefault(); e.stopPropagation();` | Link 안 버튼 | §13.⑤ 인접 |
| `size-5 border` 체크박스 (완료 시 teal 채움) | 직사각 체크박스 | §11 |
| `sm:hidden` / `hidden sm:flex` 메타 두 벌 | 모바일·데스크탑 정보 배치 | §10.1 |
| `min-w-0 truncate max-w-full` | 제목 말줄임 | §10.5 |
| `line-through text-foreground-faint` + `bg-surface-muted` | 완료 표현 | §9 |
| `text-[10px] uppercase tracking-wider` 상태 배지 | 마이크로 라벨 | §3.2 |
| `overdue` → `text-danger` | 기한 초과 | §11 |
| `↗ 회의록` 중첩 링크 | 역참조 링크 | 회의-할일 가이드 §10.5 |

**주의점**

- **중첩 링크(`<Link>` 안의 `<Link>`)는 HTML 스펙 위반**이지만 React Router 에서는 동작한다. 접근성이 중요하다면 바깥을 `<div role="link">` + `onClick` 으로 바꾸거나, 회의록 링크를 행 밖으로 빼야 한다. 현재는 실용을 택한 케이스이고, **알고 쓰는 것과 모르고 쓰는 것은 다르다.**
- 완료 표현이 **3중**이다 — 취소선 + 흐린 글자 + 배경. 색 하나에만 의존하지 않는 원칙(§13.③)의 실물.
- `onToggle` 이 없으면 체크박스가 `disabled` + `cursor-default` 가 된다. 같은 컴포넌트를 읽기 전용으로도 쓰기 위한 장치.
- 모바일/데스크탑 메타를 두 벌 렌더하는 건 DOM 중복이다. 정보 **순서까지** 달라야 할 때만 이렇게 하고, 배치만 다르면 `sm:contents`(§10.3)를 쓴다.

---

### 14.7 `src/components/task-progress.tsx` — 컴포넌트 규약 3종 세트 — 47줄에 전부 들어 있음

① 데이터가 없으면 스스로 `null` ② `compact` variant ③ 도메인 타입이 아닌 숫자 두 개를 받는다.

**전문** (47줄)

```tsx
type Props = {
  done: number;
  total: number;
  /** Compact mode for use inside list rows (no box wrapper, smaller text). */
  compact?: boolean;
};

export function TaskProgress({ done, total, compact = false }: Props) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);

  if (compact) {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-2 text-[11px] text-foreground-muted mb-1 tabular-nums">
          <span>
            {done}/{total}
          </span>
          <span className="text-foreground">{pct}%</span>
        </div>
        <div className="h-1 bg-line">
          <div
            className="h-full bg-accent-teal transition-all"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-accent-teal/40 bg-accent-teal/[0.03] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2 text-xs text-foreground-muted mb-1.5 tabular-nums">
        <span>
          {done}/{total}
        </span>
        <span className="text-foreground">{pct}%</span>
      </div>
      <div className="h-1 bg-line">
        <div
          className="h-full bg-accent-teal transition-all"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}
```

**쓰인 패턴**

| 부분 | 패턴 | 문서 |
| --- | --- | --- |
| `if (total === 0) return null;` | 비면 스스로 사라짐 | §8.2 |
| `compact?: boolean` | 한 컴포넌트 두 크기 | §8.3 |
| `{ done, total }` props | 표시값만 받기 | §8.4 |
| `h-1 bg-line` + `bg-accent-teal` | 진행률 바 | §11 |
| `tabular-nums` | 숫자 흔들림 방지 | §3.4 |
| `Math.max(0, Math.min(100, pct))` | 범위 방어 | — |
| `border-accent-teal/40 bg-accent-teal/[0.03]` | 투명도로 만든 강조 박스 | §2.4 |

**주의점**

- **이 파일이 §8 규약의 레퍼런스 구현이다.** 새 표시용 컴포넌트를 만들 때 이 3가지를 지켰는지만 확인하면 된다.
- 진행률 가이드(§11.5, 회의-할일 문서)에는 `label` · `overdue` 뱃지 · 100% 반올림 보정이 추가된 **확장판**이 있다. 새 앱에는 확장판을 쓰는 게 낫다.
- 현재 코드는 `Math.round` 라 `199/200` 이 100% 로 보인다. 확장판의 `progressPct()` 가 이걸 고친다.
- `compact` 를 3종 이상으로 늘려야 한다면 그때 `variant: 'full' | 'compact' | 'row'` 로 바꾼다. boolean 두 개(`compact` + `dense`)로 늘리지 말 것.

---

### 14.8 `src/components/dashboard/my-action-panel.tsx` — 대시보드 위젯 규약 — 여러 도메인을 한 리스트로 합치기

출석·투표·할일·초안 4개 도메인을 **하나의 「확인이 필요한 일」 리스트**로 묶는다. 항목이 0개면 통째로 사라진다.

**전문** (162줄)

```tsx
import { Link } from "react-router";
import type { Meeting, Task } from "@/lib/types/database";
import type { AgendaWithAuthor } from "@/lib/data/agendas";

type AttendancePending = {
  meeting: Pick<Meeting, "id" | "title" | "starts_at">;
  deadline: Date;
};

type Props = {
  /** 다음 모임 출석 미응답 (마감 안 지남) 이 있을 때만. */
  attendance: AttendancePending | null;
  /** 내가 아직 투표 안 한 open agenda 들. */
  pendingAgendas: AgendaWithAuthor[];
  /** 오늘 또는 지난 마감 (미완료) 내 할일. */
  pendingTasks: Task[];
  /** 내 임시저장 글/인사이트 갯수. */
  draftCount: number;
};

/**
 * 홈 상단의 "내가 해야 할 것" 카드. 항목이 하나라도 있을 때만 렌더.
 * 다음 모임 출석 / 미응답 안건 / 오늘 마감 할일 / 임시저장 — 한눈에.
 */
export function MyActionPanel({
  attendance,
  pendingAgendas,
  pendingTasks,
  draftCount,
}: Props) {
  const total =
    (attendance ? 1 : 0) +
    pendingAgendas.length +
    pendingTasks.length +
    (draftCount > 0 ? 1 : 0);
  if (total === 0) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="label">
          확인이 필요한 일{" "}
          <span className="ml-1 text-foreground-faint tabular-nums">
            {total}
          </span>
        </h2>
      </div>
      <ul className="border border-accent-teal/40 bg-accent-teal/[0.03] divide-y divide-line">
        {attendance && (
          <ActionRow
            to={`/meetings/${attendance.meeting.id}`}
            tag="출석"
            title={attendance.meeting.title}
            sub={`${formatBy(attendance.deadline)} 까지 응답`}
          />
        )}
        {pendingAgendas.map((a) => (
          <ActionRow
            key={a.id}
            to={`/agendas/${a.id}`}
            tag="투표"
            title={a.title}
            sub={timeLeftLabel(a.deadline)}
          />
        ))}
        {pendingTasks.map((t) => (
          <ActionRow
            key={t.id}
            to={`/tasks/${t.id}`}
            tag="할일"
            title={t.title}
            sub={taskDueLabel(t.due_date)}
            danger={taskOverdue(t.due_date)}
          />
        ))}
        {draftCount > 0 && (
          <ActionRow
            to="/me/posts"
            tag="초안"
            title="임시저장된 글이 있어요"
            sub={`${draftCount}건 — 마저 완성해 보기`}
          />
        )}
      </ul>
    </section>
  );
}

function ActionRow({
  to,
  tag,
  title,
  sub,
  danger,
}: {
  to: string;
  tag: string;
  title: string;
  sub: string;
  danger?: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-muted transition-colors"
      >
        <span className="shrink-0 text-[10px] tracking-widest uppercase text-foreground-faint w-10">
          {tag}
        </span>
        <span className="min-w-0 flex-1 text-sm truncate">{title}</span>
        <span
          className={`shrink-0 text-xs tabular-nums ${
            danger ? "text-danger" : "text-foreground-muted"
          }`}
        >
          {sub}
        </span>
      </Link>
    </li>
  );
}

function formatBy(d: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(d);
}

function timeLeftLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "마감";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days >= 1) return `${days}일 남음`;
  if (hours >= 1) return `${hours}시간 남음`;
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${mins}분 남음`;
}

function taskDueLabel(due: string | null | undefined): string {
  if (!due) return "기한 없음";
  const dueDate = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(dueDate);
  dueDay.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff < 0) return `${Math.abs(diff)}일 지남`;
  if (diff === 0) return "오늘 마감";
  if (diff === 1) return "내일 마감";
  return `${diff}일 남음`;
}

function taskOverdue(due: string | null | undefined): boolean {
  if (!due) return false;
  return new Date(due).getTime() < Date.now();
}
```

**쓰인 패턴**

| 부분 | 패턴 | 문서 |
| --- | --- | --- |
| `if (total === 0) return null;` | 비면 스스로 사라짐 | §8.2 |
| `ActionRow` 내부 서브컴포넌트 | 파일 안에서만 쓰는 조각 | §8.5 |
| `tag` 열 `w-10 text-[10px] tracking-widest uppercase` | 고정폭 종류 라벨 | §3.2 |
| `border-accent-teal/40 bg-accent-teal/[0.03]` | 주목 박스 | §2.4 |
| `divide-y divide-line` | 행 구분 | §7.1 |
| `danger` prop → `text-danger` | 지연 강조 | §11 |
| `taskDueLabel` / `timeLeftLabel` | 상대 시간 한국어 카피 | §3.5 |
| `min-w-0 flex-1 truncate` + `shrink-0` | 제목/시간 폭 배분 | §10.5 |

**주의점**

- **서로 다른 도메인을 한 줄 형식(`tag · 제목 · 보조`)으로 정규화**한 게 핵심. 도메인마다 다른 카드를 만들면 대시보드가 잡동사니가 된다.
- 부모(대시보드 페이지)는 데이터만 넘기고 **조건 분기를 하지 않는다.** 빈 카드 사고가 구조적으로 불가능해진다.
- `taskDueLabel` 이 `3일 지남` / `오늘 마감` / `내일 마감` / `5일 남음` 으로 갈린다 — **날짜를 그대로 보여주지 않고 사람이 읽는 말로** 바꾼다. 이 함수는 다른 화면에서도 쓰이므로 `lib/format.ts` 로 빼는 걸 권장.
- `ActionRow` 는 `tag` 문자열을 받는다. 아이콘이 아니라 텍스트인 이유 — 4종류를 아이콘으로 구분하려면 아이콘 4개를 그려야 하고, 두 글자 한글이 더 빨리 읽힌다.

---

### 14.9 그 밖의 레퍼런스

전문을 싣지는 않았지만 형태를 참고할 만한 파일들.

| 만들려는 것 | 파일 | 볼 것 |
| --- | --- | --- |
| 카드 | `src/components/writing-card.tsx` | `h-full flex flex-col` + `flex-1` 로 높이 맞추기 |
| 모달 | `src/components/modal.tsx` | 딤 · 스크롤락 · ESC · safe-area |
| 페이저 | `src/components/pager.tsx` | `‹ 3 / 12 ›` 최소 페이지네이션 |
| 아바타 | `src/components/avatar.tsx` | 크기 5단계 · 이니셜 폴백 |
| 긴 폼 | `src/features/notes/note-form.tsx` | `sm:contents` 3열 행 · 임시저장 · 동적 행 추가/삭제 |
| 탭 + 필터 | `src/pages/tasks.tsx` | 탭 `-mb-px` · 세그먼트 · 필터 패널 토글 |
| 소셜 블록 | `src/features/social/like-comment-block.tsx` | 자동 높이 textarea · 낙관적 업데이트 |
| 설정 화면 | `src/features/notifications/notification-section.tsx` | `Row` 반복 · 직사각 토글 |
| 앱 셸 / 네비 | `src/layouts/app-layout.tsx` | 메가메뉴 · 프로필 드롭다운 · 모바일 시트 |

---

## 15. 부록 — 클래스 치트시트

복사해서 바로 쓰는 조각 모음.

```tsx
// ── 페이지 골격 ────────────────────────────────────────────────
<main className="mx-auto max-w-6xl px-4 sm:px-8 py-10 sm:py-14 pb-24 sm:pb-14">
<article className="space-y-14 max-w-3xl">
<form className="space-y-12">

// ── 페이지 헤더 ────────────────────────────────────────────────
<header className="flex items-end justify-between border-b border-line pb-6 gap-4">
  <div>
    <p className="label">Section</p>
    <h1 className="mt-3 text-3xl font-light">한국어 헤드라인</h1>
    <p className="mt-2 text-sm text-foreground-muted">한 줄 설명</p>
  </div>
</header>

// ── 섹션 ───────────────────────────────────────────────────────
<h2 className="label mb-3">소제목</h2>
<div className="mb-5 border-b border-line pb-3"><h2 className="text-base">폼 섹션</h2></div>

// ── 리스트 ─────────────────────────────────────────────────────
<ul className="divide-y divide-line border-b border-line">
<Link className="block py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors">

// ── 격자 ───────────────────────────────────────────────────────
<section className="grid gap-px bg-surface-muted border border-line sm:grid-cols-3">
  <div className="bg-surface px-4 py-4">…</div>
</section>

// ── 카드 ───────────────────────────────────────────────────────
<Link className="h-full flex flex-col border border-line p-6 hover:border-foreground transition-colors">

// ── 버튼 ───────────────────────────────────────────────────────
"border border-accent bg-accent px-5 py-2.5 text-sm text-accent-foreground hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-60"
"border border-line-strong px-5 py-2.5 text-sm text-foreground hover:border-foreground"
"bg-accent-teal text-accent-foreground px-4 py-2 text-xs hover:bg-accent-teal/85 transition-colors disabled:opacity-60"
"text-xs text-danger hover:underline underline-offset-4"

// ── 입력 ───────────────────────────────────────────────────────
"w-full border-b border-line-strong px-0 py-2 text-sm focus:border-foreground focus:outline-none bg-transparent placeholder:text-foreground-faint"
"text-xs text-foreground-muted"                                     // label
"border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger" // error

// ── 텍스트 ─────────────────────────────────────────────────────
"text-3xl font-light leading-tight sm:text-4xl"   // 상세 제목
"text-lg font-medium leading-snug"                // 카드 제목
"text-sm leading-[1.85] text-foreground"          // 본문
"text-xs text-foreground-muted"                   // 보조
"text-xs text-foreground-faint"                   // 메타
"text-[10px] uppercase tracking-wider"            // 마이크로 배지
"tabular-nums"                                    // 숫자

// ── 빈 상태 ────────────────────────────────────────────────────
<p className="border-b border-line py-12 text-center text-sm text-foreground-faint">
  아직 …이 없습니다.
</p>

// ── 잘림 방지 ──────────────────────────────────────────────────
"min-w-0 truncate"     // 줄어드는 쪽
"shrink-0"             // 안 줄어드는 쪽
"line-clamp-2"         // 미리보기

// ── SVG 아이콘 ─────────────────────────────────────────────────
<svg viewBox="0 0 24 24" aria-hidden className="w-5 h-5"
     fill="none" stroke="currentColor" strokeWidth="1.5"
     strokeLinecap="round" strokeLinejoin="round">…</svg>
```

---

*작성 기준: 밋업 앱 현재 구현 — `src/index.css`, `src/layouts/app-layout.tsx`,
`src/components/*`, `src/features/*`, `src/pages/*`.*
*네비게이션 상세는 [`navigation-layout-guide.md`](./navigation-layout-guide.md) 참고.*

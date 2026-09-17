# Sol AI Office - 디자인 가이드

> UI 디자인에 관한 상세 가이드. 컬러, 폰트, 스타일 규칙을 정의합니다.
> Tailwind CSS 커스텀 설정 기준 (`tailwind.config.js`)

---

## 컬러 팔레트

### 메인 - Primary (보라 계열)
```
primary-50:  #faf5ff
primary-100: #f3e8ff
primary-200: #e9d5ff
primary-300: #d8b4fe
primary-400: #c084fc
primary-500: #a855f7   ← 메인 액센트
primary-600: #9333ea
```

### 방별 컬러 (Pastel)
```
pastel-purple: #e9d8fd   → bg-pastel-purple (전략실)
pastel-pink:   #fed7e2   → bg-pastel-pink   (마케팅룸)
pastel-lime:   #d9f99d   → bg-pastel-lime   (개발실)
pastel-brown:  #e8d5c4   → bg-pastel-brown  (리서치랩)
pastel-yellow: #fefcbf   → bg-pastel-yellow (회의실)
```

### 배경 & 그림자
```
배경 그라데이션: from-primary-100 via-white to-pastel-pink/30
카드 배경: white/60 (backdrop-blur)
그림자 soft:  0 4px 20px rgba(0, 0, 0, 0.08)
그림자 hover: 0 8px 30px rgba(0, 0, 0, 0.12)
```

### 텍스트
```
text-primary:   gray-800 (#1f2937)
text-secondary: gray-500 (#6b7280)
text-muted:     gray-400 (#9ca3af)
```

---

## 폰트

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif;
```

---

## 스타일 규칙 (레거시 기본 테마)

> ⚠️ 아래 표는 **옛 기본 테마**(보라·둥근·그림자) 기준. 현재 실제 메뉴(개인공간·오피스)는
> 아래 [폼 입력 필드 공통 규격](#폼-입력-필드-공통-규격-모던-테마) 을 따른다.

| 요소 | Tailwind 클래스 | 값 |
|------|----------------|-----|
| 카드 | `rounded-3xl` | 24px |
| 버튼 | `rounded-2xl` | 16px |
| 인풋 | `rounded-2xl` | 16px |
| 사이드바 항목 | `rounded-2xl` | 16px |

---

## 폼 입력 필드 공통 규격 (모던 테마)

> **개인공간·오피스 모든 등록/수정 폼의 입력칸은 이 규격으로 통일한다.** (2026-09 확정)
> input · select · textarea · 공용 `CategorySelect` 가 모두 동일한 높이·폰트·모서리를 갖는다.

| 속성 | 값 | Tailwind |
|------|-----|----------|
| 모서리(라운딩) | 8px | `rounded-lg` |
| 폰트 크기 | 14px | `text-sm` (제목칸도 예외 없이 `text-sm`) |
| 세로 패딩(높이) | ~42px | `py-2.5` |
| 가로 패딩 | | `px-3.5` |
| 테두리 | 헤어라인 | `border border-line` |
| 포커스 | 테두리 진해짐 | `focus:border-foreground focus:outline-none transition-colors` |
| 플레이스홀더 | | `placeholder:text-foreground-faint` |

**배경(셸별 톤차 — 의도된 차이, 지오메트리는 동일):**
- **개인공간**: `bg-surface` (흰색)
  - 표준 클래스: `w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors`
- **오피스**: `bg-surface-muted` (연회색) → `focus:bg-surface` (포커스 시 흰색). `src/components/office/ui.tsx` 의 **`fieldCls`** 사용.
  - `w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-line text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:bg-surface focus:border-foreground transition-colors`

**레이아웃:**
- 짧은 드롭다운(우선순위·상태 등)은 폭을 줄여 **한 줄에 여러 개** 배치(`flex gap-2`, 예: 우선순위 `w-24` · 카테고리 `flex-1` · 날짜 `w-40`). 각 필드를 세로로만 쌓지 않는다.
- 카테고리는 항상 공용 `CategorySelect`(색점 드롭다운 + 관리 팝업). 네이티브 `<select>` 로 카테고리를 만들지 않는다. → [CATEGORY_SYSTEM.md](CATEGORY_SYSTEM.md)

**의도된 예외(표준 아님):**
- `miniFieldCls` (`px-2.5 py-1.5 text-xs`) — 칩 옆 등 좁은 인라인 필드.
- `inputClass` (밑줄만, 박스 없음) — 회의록·상세 등 넓은 에디터형 폼.

**신규/수정 시 체크:** 새 폼 필드를 추가하면 개인은 위 표준 클래스, 오피스는 `ui.tsx`의 `fieldCls` 를 그대로 쓴다. 임의로 `px-4`·`text-base`·`rounded-2xl`·rounded 누락 등을 쓰지 않는다.

### 그림자
- `shadow-soft` — 기본 상태: `0 4px 20px rgba(0, 0, 0, 0.08)`
- `shadow-hover` — 호버 상태: `0 8px 30px rgba(0, 0, 0, 0.12)`

### 호버 효과
```css
transform: scale(1.03);
box-shadow: shadow-hover;
transition: all 300ms;
```

---

## 방별 테마

| 방 | Tailwind 클래스 | 컬러값 | AI 이름 | 아이콘 |
|----|----------------|--------|---------|--------|
| 전략실 | `bg-pastel-purple` | `#e9d8fd` | 플래니 | 💜 |
| 마케팅룸 | `bg-pastel-pink` | `#fed7e2` | 마키 | 💗 |
| 개발실 | `bg-pastel-lime` | `#d9f99d` | 데비 | 🤎 |
| 리서치랩 | `bg-pastel-brown` | `#e8d5c4` | 서치 | 💚 |
| 회의실 | `bg-pastel-yellow` | `#fefcbf` | 모디 | 💛 |

---

## 반응형 브레이크포인트

| 화면 | 기준 | 그리드 | 사이드바 |
|------|------|--------|----------|
| 모바일 | ~639px | 1열 | 슬라이드 오버레이 |
| 태블릿 | 640px+ (`sm`) | 2열 | 슬라이드 오버레이 |
| PC | 1024px+ (`lg`) | 3열 | 좌측 고정 |

---

*이 문서는 디자인이 변경될 때 업데이트됩니다.*

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

## 스타일 규칙

| 요소 | Tailwind 클래스 | 값 |
|------|----------------|-----|
| 카드 | `rounded-3xl` | 24px |
| 버튼 | `rounded-2xl` | 16px |
| 인풋 | `rounded-2xl` | 16px |
| 사이드바 항목 | `rounded-2xl` | 16px |

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

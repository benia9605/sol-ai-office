# 테마 유료화 가이드

## 개요

Sol AI Office의 테마 시스템을 구축하고, 유료 테마를 판매하는 방안.
기본 테마(현재 보라색)는 무료, 추가 테마는 개별 구매 또는 번들로 판매.

---

## 1단계: CSS 변수 기반 테마 시스템 구축

### 현재 → 변경

지금은 Tailwind 색상을 `tailwind.config.js`에 하드코딩 중.
이걸 CSS 변수로 바꾸면 테마 전환이 가능해짐.

```css
/* globals.css */
:root {
  --color-primary-50: #faf5ff;
  --color-primary-100: #f3e8ff;
  --color-primary-500: #a855f7;
  --color-primary-600: #9333ea;
  --color-bg: #ffffff;
  --color-surface: #f9fafb;
  --color-text: #111827;
  --color-text-secondary: #6b7280;
}

[data-theme="ocean"] {
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
}

[data-theme="midnight"] {
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-text: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-primary-500: #8b5cf6;
}
```

```js
// tailwind.config.js
colors: {
  primary: {
    50: 'var(--color-primary-50)',
    100: 'var(--color-primary-100)',
    500: 'var(--color-primary-500)',
    600: 'var(--color-primary-600)',
  },
}
```

### 테마 적용 방식

```tsx
// 테마 변경 시
document.documentElement.setAttribute('data-theme', 'ocean');

// 저장: user_profiles 테이블에 active_theme 컬럼 추가
// 로그인 시 저장된 테마 자동 적용
```

---

## 2단계: 테마 목록

### 무료 (기본 제공)

| 테마 | 스타일 |
|------|--------|
| **라벤더** (기본) | 현재 보라색 테마 |

### 유료 테마

| 테마 | 스타일 | 가격 |
|------|--------|------|
| **오션** | 시원한 블루 계열 | 2,900원 |
| **포레스트** | 자연스러운 그린 계열 | 2,900원 |
| **선셋** | 따뜻한 오렌지/코랄 | 2,900원 |
| **미드나잇** | 다크 모드 (네이비) | 3,900원 |
| **로즈골드** | 고급스러운 핑크/골드 | 3,900원 |
| **모노크롬** | 미니멀 흑백 | 2,900원 |

### 번들 상품

| 상품 | 포함 | 가격 |
|------|------|------|
| 전체 테마 팩 | 유료 테마 6종 전부 | 9,900원 (45% 할인) |
| 시즌 테마 (구독) | 매달 신규 테마 1개 | 월 1,900원 |

---

## 3단계: DB 설계

```sql
-- 테마 상품 목록
CREATE TABLE themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,           -- '오션'
  slug TEXT UNIQUE NOT NULL,    -- 'ocean'
  css_variables JSONB NOT NULL, -- { "--color-primary-500": "#3b82f6", ... }
  preview_image TEXT,           -- 미리보기 스크린샷 URL
  price INTEGER NOT NULL,       -- 2900 (원)
  is_free BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 유저 구매 내역
CREATE TABLE user_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  theme_id UUID REFERENCES themes NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, theme_id)
);

-- user_profiles에 컬럼 추가
ALTER TABLE user_profiles ADD COLUMN active_theme TEXT DEFAULT 'lavender';
```

---

## 4단계: 결제 연동

### 추천: 토스페이먼츠 (국내 최적)

```
사용자 테마 미리보기 → 구매 클릭
→ 토스페이먼츠 결제창
→ 결제 성공 콜백
→ user_themes에 구매 기록 저장
→ 테마 즉시 적용
```

- 토스페이먼츠: 수수료 3.3% (카드)
- 최소 가입비 없음, 개인사업자 가능
- 연동 문서: https://docs.tosspayments.com

### 대안

| 서비스 | 수수료 | 특징 |
|--------|--------|------|
| 토스페이먼츠 | 3.3% | 국내 최적, 문서 좋음 |
| 포트원 (아임포트) | PG사 수수료만 | 여러 PG사 통합 |
| 패들 (Paddle) | 5%+50¢ | 해외 판매 시 세금 자동 처리 |

---

## 5단계: UI 흐름

```
설정 페이지 → "테마 스토어" 탭
  ├── 내 테마 (구매한 테마 + 기본)
  │   └── 클릭 → 즉시 적용
  ├── 테마 둘러보기
  │   └── 각 테마 카드
  │       ├── 미리보기 스크린샷
  │       ├── 테마 이름 + 가격
  │       └── "미리보기" 버튼 → 10초간 임시 적용
  │       └── "구매하기" 버튼 → 결제
  └── 번들 상품
      └── 전체 테마 팩 할인 배너
```

### 미리보기 기능

구매 전 10초간 테마를 적용해볼 수 있게 함.
타이머 끝나면 원래 테마로 복귀. 구매 의욕 자극.

---

## 6단계: 구현 순서 (추천)

```
1. CSS 변수 시스템 리팩토링 (tailwind.config + globals.css)
   → 기존 하드코딩 색상을 변수로 전환
   → 기본 테마 동작 확인

2. 테마 전환 로직 (ThemeProvider 컴포넌트)
   → data-theme 속성 관리
   → user_profiles.active_theme 연동

3. 다크 모드 테마 1개 추가 (미드나잇)
   → 다크 모드는 수요가 높아서 첫 유료 테마로 적합

4. 테마 스토어 UI 구현
   → 미리보기 + 구매 흐름

5. 결제 연동 (토스페이먼츠)
   → 결제 → DB 저장 → 테마 해금

6. 나머지 테마 추가 (오션, 포레스트, 선셋 등)
```

---

## 수익 시뮬레이션

| 시나리오 | 유저 수 | 구매율 | 객단가 | 월 수익 |
|----------|---------|--------|--------|---------|
| 초기 | 100명 | 15% | 3,500원 | 52,500원 |
| 성장 | 1,000명 | 20% | 5,000원 | 1,000,000원 |
| 안정 | 5,000명 | 25% | 6,000원 | 7,500,000원 |

> 테마는 한번 만들면 유지비가 거의 0이라 마진율이 높음.
> 시즌 테마 구독 모델을 함께 운영하면 반복 수익(MRR) 확보 가능.

# 개인 공간 슬림다운 플랜

**작성:** 2026-09 · **상태:** 진행 중
**목적:** 개인 공간을 핵심 4개 기능으로 축소. 나머지는 **코드 백업(삭제 X) + UI 숨김** → 상용화 시 플래그 하나로 부활.

---

## 1. 유지 / 백업 구분

### ✅ 유지 (개인 공간에 남길 것)
- **홈** (`/`) — 단순 허브로 축소
- **할일** (`/tasks`)
- **인사이트** (`/insights`)
- **스터디** (`/readings`)
- **기록** (`/records`)
- **설정** (`/settings`)

### 📦 백업(숨김) — 코드는 그대로, UI에서만 제거
- **일정** (`/schedules`)
- **콘텐츠** (`/content`)
- **대화 요약** (`/summaries`)
- **프로젝트** (`/project/:id` + 사이드바 프로젝트 목록) — 기능 자체를 안 씀
- **AI 대화** — 방 대화(rooms), 모디 비서(모디 FAB · BriefingCard), 최근 대화 목록, ChatModal

---

## 2. 방식 — 피처 플래그 (되살리기 쉬움)

한 곳에서 켜고 끄는 스위치. 상용화하면 `true`로만 바꾸면 부활.

```ts
// src/config/features.ts
export const FEATURES = {
  schedules: false,  // 일정
  aiChat:    false,  // 방 대화 + 모디 + 최근대화 + 브리핑카드 + ChatModal
  content:   false,  // 콘텐츠
  projects:  false,  // 프로젝트(상세·사이드바 목록)
  summaries: false,  // 대화 요약
};
```

**원칙:** 테이블·서비스·페이지 컴포넌트 코드는 **하나도 안 지운다.** 네비/라우트/홈에서 **노출만 차단**한다.

---

## 3. 파일별 변경 (체크리스트)

- [x] `src/config/features.ts` — 플래그 모듈 생성
- [x] `src/data.ts` — `menuItems`를 유지 항목만(홈·할일·인사이트·스터디·기록). 원본은 `menuItemsFull`로 백업. (BottomNav은 `slice`라 자동 반영)
- [x] `src/components/NewSidebar.tsx` — 프로젝트 목록(`FEATURES.projects`)·최근 대화(`FEATURES.aiChat`) 가드
- [x] `src/pages/HomePage.tsx` + `HomePage.modern.tsx` — 방 카드·브리핑(모디) 가드, 문구도 성장 중심으로
- [x] `src/components/Layout.tsx` — 모디 FAB·채팅 패널(`FEATURES.aiChat`) 가드
- [x] `src/components/DashboardWidgets.tsx` — 일정 위젯(`FEATURES.schedules`) 가드
- [x] `src/App.tsx` — schedules/content/summaries/project 라우트 가드(off면 `*`→홈 폴백)
- [x] 빌드 통과 · 커밋

---

## 4. 데이터/안전 메모
- 할일·인사이트에 남아 있는 `project` 필드는 옵셔널 → 프로젝트 UI만 숨기면 무해.
- 라우트는 남겨두되 플래그 off면 홈으로 폴백(직접 URL 접근도 막힘).
- Supabase 테이블(projects/schedules/conversations/summaries/content_items 등)은 그대로 둠 = 데이터 보존.

## 5. 되살리기(상용화 시)
1. `features.ts`에서 해당 플래그 `true`.
2. `data.ts` `menuItems`에 항목 원복(백업 상수에서).
3. 끝. (컴포넌트/서비스/DB는 계속 살아 있으므로 추가 작업 최소)

---

## 6. 진행 로그
- **2026-09** 1차 슬림다운 완료 — features.ts 플래그 도입, 개인 네비/홈/사이드바/라우트에서
  일정·콘텐츠·대화요약·프로젝트·AI대화를 `FEATURES` 플래그로 차단(코드 보존). 빌드 통과·커밋.
  - 남은 후속(선택): HomePage.modern에서 안 쓰는 `useSchedules`/`useBriefing` 호출 정리(성능 미세),
    프로젝트 필드 UI(할일/인사이트 폼의 프로젝트 선택) 노출 여부 점검.

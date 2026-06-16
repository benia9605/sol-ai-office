# 🏗️ AI 오피스 대개편 — 통합 설계 (Phase별 구현 계획)

> **무엇:** 기존 Teamie(1인 자기계발 앱)를 **"개인 공간 + 여러 회사 오피스"** 구조로 대개편.
> **입력 문서:** `AI-Office-아키텍처.md`(방식 B·AI직원 타입 시스템) + `AIOffice.jsx`(회사 오피스 UI 초안) + `_공유워크스페이스_확정설계.md`(워크스페이스 기반, 빌드 A/B/C-① 완료) + 기존 Teamie 코드.
> **스타일:** 크림/브랜드컬러(JSX) → **우리 모노톤(MUJI 모던 테마)로 매핑**.
> **작성일:** 2026-06-13 · 이 문서가 개편의 source of truth.

---

## 0. 한 장 요약 — 최종 모델

```
┌─────────────────────────── Teamie ───────────────────────────┐
│  최상위 전환 (사이드바 상단 드롭다운)                          │
│                                                              │
│  👤 개인 ─────────────► [개인 셸] 기존 메뉴 그대로            │
│     (자기계발·기록장)      홈·할일·일정·기록·스터디/독서·콘텐츠  │
│     나만                                                      │
│                                                              │
│  🏢 회사(오피스) ───────► [오피스 셸] AI 오피스 (새 UI)        │
│     운명랩 (나만)          좌측 레일 8메뉴:                    │
│     쏠닝포인트 (나만)       대시보드·브리핑·AI직원·할일·일정·    │
│     쏠닝오즈 (나만)         인사이트·기록·멤버                  │
│     시목 (부부 공유)       + AI 직원이 24시간 일하고 리포트 적재 │
│                                                              │
│  [+ 새 회사]                                                  │
└──────────────────────────────────────────────────────────────┘
```

**3대 원칙**
1. **두 개의 셸(shell).** 개인=기존 Teamie 레이아웃 그대로. 회사=AI Office 레이아웃(좌측 레일+브랜드 헤더). 워크스페이스를 고르면 **셸과 메뉴가 통째로 바뀐다.**
2. **회사 = 워크스페이스(`type='office'`).** 사장님 직관("회사=워크스페이스")을 채택. 멤버 1명(운명랩=나만)~다수(시목=부부). 공유는 멤버십이 결정.
3. **AI 직원 = 24h 오피스의 심장.** 따로 기획했던 "24시간 자동 AI 오피스"와 아키텍처 문서의 "AI 직원 타입 시스템"은 **같은 것** → 하나로 합친다. 직원의 routine을 cron으로 돌려 daily_report를 쌓는다.

---

## 1. 최상위 구조: 개인 공간 ⇄ 회사 오피스

### 1.1 워크스페이스 `type` 재정의 (중요 변경)
빌드 A에서 `type: 'personal' | 'team'` 으로 깔았는데, **`'personal' | 'office'`** 로 바꾼다.

| type | 의미 | 셸 | 멤버 | 예 |
|---|---|---|---|---|
| `personal` | 자기계발·기록장 (1인) | **개인 셸**(기존 Teamie) | 항상 본인 1명 | "내 오피스" |
| `office` | 회사/브랜드 | **오피스 셸**(AI Office) | 1명~다수(초대) | 운명랩·쏠닝·시목 |

- `team`(공유)이라는 분류는 버린다. 공유 여부 = `office` 워크스페이스의 **멤버가 2명 이상이냐**로 자연 결정(시목=Sol+민석).
- 마이그레이션 `CHECK (type IN ('personal','office'))` 로 수정.

### 1.2 셸 분기
```
WorkspaceContext.activeWorkspace.type
  === 'personal'  → <PersonalShell>  (기존 Layout + 기존 라우트)
  === 'office'    → <OfficeShell>    (신규: 좌측 레일 + 브랜드 헤더 + 오피스 뷰)
```
- 라우팅: `App.tsx` 에서 활성 워크스페이스 type에 따라 `<PersonalShell>` 또는 `<OfficeShell>` 렌더.
- 전환 장치: **이미 만든 사이드바 워크스페이스 드롭다운**(빌드 C-①)을 그대로 사용 — 목록에 `개인` + 회사들. 단 회사를 고르면 셸 자체가 바뀌므로, 드롭다운은 두 셸 공통으로 떠야 함(오피스 셸 헤더에도 동일 토글 — JSX의 상단 토글이 이 역할).

### 1.3 "개인"은 항상 존재, 회사는 0개부터
- 회사가 하나도 없으면 → 개인 셸만. (기존 사용자 = 지금과 100% 동일.)
- 회사 1개 이상 생기면 → 드롭다운에 회사가 보이고, 고르면 오피스 셸 진입.

---

## 2. 두 셸의 메뉴 구성

| | 👤 개인 셸 (자기계발) | 🏢 오피스 셸 (회사) |
|---|---|---|
| 레이아웃 | 기존(헤더+사이드바+하단네비) | 좌측 아이콘 레일 + 브랜드 헤더 |
| 메뉴 | 홈 · 할일 · 일정 · 기록 · 스터디/독서 · **콘텐츠** | 대시보드 · 오늘의 브리핑 · AI 직원 · 할일 · 일정 · 인사이트 · 기록 · 멤버 |
| 성격 | 내 삶·성장 기록 | 회사 운영·자동화 |
| 데이터 | personal 워크스페이스 | 해당 office 워크스페이스 |
| 핵심 | 뽀모도로·일기·독서노트 | AI 직원·daily 리포트·KPI |

**같은 이름 다른 성격:** 개인 "할일" = 내 자기계발 투두 / 회사 "할일" = 운영 태스크(+auto/manual 배지, 담당자). "일정"·"기록"·"인사이트"도 마찬가지.
**인사이트:** 회사 쪽이 중심(KPI 차트+AI 제안). 개인 쪽 인사이트는 유지하되 가벼운 메모성.
**콘텐츠(YouTube):** 개인 셸에 유지(기존). 회사에서 SNS는 "AI 직원(SNS 운영)"이 담당하므로 별도 콘텐츠 메뉴는 회사엔 안 둠(후순위 검토).

---

## 3. 데이터 모델

### 3.1 기존 (빌드 A에서 완료)
`workspaces`, `workspace_members`, `workspace_invites`, `workspace_activities` + 콘텐츠 테이블(tasks/schedules/insights/journals/readings/study_notes/projects)에 `workspace_id`/`is_shared`/`assignee_id`.
→ **office 워크스페이스의 할일·일정·인사이트·기록은 기존 테이블 그대로 재사용** (workspace_id로 구분).

### 3.2 신규 (AI 직원/오피스 전용)
```sql
-- 직원 타입 카탈로그는 "코드 상수"로 고정 (DB 아님). 5장 참고.

staff (
  id, workspace_id,           -- 어느 회사 소속
  type_key,                   -- 'sourcing'|'detail_page'|'cs'|'sns'|'ad'|'monitor'|'report_builder'|...
  name, prompt,               -- 이름 + Sol이 직접 쓴 성격/지시
  skills jsonb, model,        -- 'sonnet'|'haiku'
  state,                      -- 'working'|'idle'
  created_at
)
staff_routines (
  id, staff_id, label,
  schedule,                   -- 'realtime'|'daily'|'weekly'
  run_at, runs_per_day, enabled
)
daily_reports (
  id, workspace_id, staff_id, date,
  title, summary, body jsonb, -- outputKind별 구조
  tokens_in, tokens_out, cost_usd, created_at
)
suggestions (                 -- 인사이트 하단 AI 제안(소구점/마케팅)
  id, workspace_id, staff_id, kind, title, content jsonb, status, created_at
)
sns_posts (                   -- outputKind=sns_queue 산출물
  id, workspace_id, staff_id, platform, status,  -- draft|waiting|published
  body, hashtags, image_note, scheduled_for, created_at
)
brand_connections (           -- 방식 B: 브랜드 앱 read-only 연결 설정 (후순위)
  id, workspace_id, supabase_url, anon_key_ref, mapping jsonb
)
```
- 전부 `workspace_id` + `user_id`(작성자) + RLS(빌드 A 패턴 동일: 멤버면 조회).
- `detail_page_drafts`(상세페이지봇 산출물)도 여기 합류 — staff(detail_page)의 outputKind.

### 3.3 Mock 3곳 동기화 (CLAUDE.md 규칙)
새 테이블/필드마다 `types.ts` / `*.service.ts` / `mockSupabase.ts`. 쓰기 연산 async 금지.

---

## 4. AI 직원 시스템 (회사 오피스의 심장)

### 4.1 직원 = 타입 인스턴스
채용 = **타입 선택 → 스킬·일과 자동세팅(편집) → 프롬프트 입력(직접) → 이름+배치 → 가동**.

### 4.2 타입 카탈로그 (코드 상수)
| key | 이름 | outputKind | 상세 UI |
|---|---|---|---|
| `sourcing` | 소싱 기획자 | `sourcing_brief` | 분석/키워드/기획 탭 + 추천배지 |
| `detail_page` | 상세페이지 제작자 ★ | `detail_builder` | 6섹션 에디터+재생성+HTML복사 |
| `cs` | CS 응대 | `ticket_list` | 티켓 카드(유형·긴급도·복사) |
| `sns` | SNS 운영 | `sns_queue` | 캘린더+게시물 큐(복사·발행체크) |
| `ad` | 광고 기획 | `copy_variants` | 카피세트+타겟+A/B비교 |
| `monitor` | 모니터링 | `monitor_digest` | 경쟁사 비교표+트렌드(URL붙여넣기) |
| `report_builder` | 리포트 빌더 | `generation_log` | 생성 로그 타임라인 |
| (보조) researcher/analyst/editor | … | keyword_table/metric_digest/review_diff | 확장 시 |

> `detail_page`의 로직은 이미 `_기획봇_역설계.md`에서 복원한 SOP(전략브리핑→12섹션, 섹션당 6블록…)를 그대로 탑재.

### 4.3 상세 화면 = 공통 + outputKind 분기
- 공통: 프로필·대표지표·routine 목록·설정(가동/정지·시간·프롬프트)·일일 리포트 아카이브
- 가운데만 `switch(outputKind)`로 교체.

### 4.4 routine 실행 엔진 (= 24h 자동)
- `staff_routines`를 cron(Supabase Edge Function)이 읽어 스케줄대로 실행.
- 직원 `prompt`를 시스템 프롬프트로 주입 + (빌드 B) **워크스페이스 스코핑**으로 그 회사 데이터만.
- 결과 → `daily_reports` 적재 + 오늘의 브리핑 집계 + (공유 회사면) 멤버 전원 푸시.
- 모델: 가벼운 일 Haiku / 무거운 일 Sonnet. 채용 UI에 "예상 월 비용"(실행수×단가) 표시.

---

## 5. 디자인 매핑 — 크림 → 우리 모노톤(MUJI)

| JSX 토큰 | 값(원본) | 우리 모노톤 매핑 |
|---|---|---|
| 배경 | 크림 `#f4f1ea` | 모던 테마 배경(오프화이트/순백) |
| 텍스트·다크면 | `#34312a` `#2b2820` | 차콜(모던 텍스트) |
| 보더 | 베이지 라인 | hairline 그레이 |
| 브랜드 액센트 | 브랜드별 컬러 | **포인트만 미세하게**(워크스페이스 점·활성바). 나머지 무채색 |
| 폰트 | — | Pretendard(모던 테마 이미 로드) |
| 라운드/그림자 | 둥근+소프트 | 모던 토큰(rounded-2xl, hairline, 그림자 최소) |

- **인라인스타일 → Tailwind 재작성.** `S`/`CSS` 토큰을 Tailwind 클래스/소량 커스텀으로.
- **lucide-react 설치 필요**(미설치). 가볍고 트리셰이킹 OK → 추가. (단 아이콘은 **이모지 우선** — 사장님이 라인 SVG "구리다" 거절.)
- 브랜드 컬러는 "정체성 점" 수준으로만 — 모노톤 일관성 유지.

### 5.1 ⭐ 팝업/모달 표준 — "모던 모노톤 + 몽글몽글(토스앱st)" (확정 2026-06)
> 사장님 확정 디자인 방향. **모든 팝업/모달은 이 레시피로 통일.** 기준 구현 = `components/WorkspaceCreateModal.tsx`.

- **Portal 필수:** `createPortal(…, document.body)` — 사이드바 등 transform 조상 영향 없이 화면 정중앙.
- **카드:** `rounded-[32px]` + `shadow-2xl` + 팝 애니메이션(`wsPop`: opacity·translateY 12px·scale .95→1, `.22s cubic-bezier(.2,.9,.25,1)`).
- **배경:** `bg-black/40 backdrop-blur-[2px]` + 페이드인.
- **입력창:** `rounded-2xl bg-gray-50 border-gray-100` → 포커스 `bg-white border-primary-300`.
- **버튼/타일:** 둥글게(`rounded-2xl`~`[26px]`) + **`active:scale-[0.96]`** 촉감 + soft shadow.
- **아이콘:** 이모지(연보라 둥근 타일 `rounded-[20px] bg-primary-50`에 큰 이모지). 라인 SVG 지양.

---

## 6. 기존 빌드와의 정합 (재활용 / 변경)

| 빌드 | 상태 | 개편에서 |
|---|---|---|
| A 기반(워크스페이스·RLS·콘텐츠 컬럼) | ✅ | **재활용**. `type` 'team'→'office' 만 수정 |
| B 안전장치(컨텍스트 스코핑·멤버 푸시) | ✅ | **재활용**. routine 엔진·오피스 채팅에 그대로 |
| C-① 스위처(사이드바 드롭다운) | ✅ | **재활용**. 셸 전환 트리거로 승격(개인+회사 목록) |
| C-②/③(공유토글·받은할일·초대) | 보류 | Phase 7로 흡수(오피스 맥락에서) |
| D(시목 AI 리포트 위젯) | 보류 | Phase 4(daily_report)에 흡수 |

→ **헛수고 없음.** 백엔드 기반은 그대로, 위에 두 번째 셸(오피스)과 AI 직원을 얹는 것.

---

## 7. Phase별 구현 계획

> 각 Phase는 독립 배포 가능하게. 개인 셸은 전 구간 무중단(안 건드림).

### Phase 0 — 모델 재정렬 (0.5d)
- **DB:** workspace `type` CHECK → `'personal'|'office'`. 마이그레이션 파일 수정 + mock 시목 `type:'office'`.
- **타입:** `WorkspaceType='personal'|'office'`. `useWorkspace` `teams`→`offices`.
- **완료기준:** 기존 동작 동일 + 시목이 'office'로 인식.

### Phase 1 — 셸 분리 골격 (1.5d)
- **신규:** `OfficeShell.tsx`(좌측 레일+브랜드 헤더, 본문은 빈 뷰 placeholder), `office/` 폴더.
- `App.tsx`: 활성 워크스페이스 type으로 `PersonalShell`(기존 Layout) vs `OfficeShell` 분기.
- 워크스페이스 드롭다운을 두 셸 공통 노출(오피스 헤더 토글 포함).
- **디자인:** 오피스용 모노톤 토큰 정의 + lucide-react 설치.
- **완료기준:** 개인↔회사 전환 시 셸이 바뀜. 회사 화면은 빈 레일+헤더만.

### Phase 2 — 오피스 정적 화면 이식 (2~3d)
- AIOffice.jsx 뷰들을 우리 스택/모노톤으로 재작성(목업 데이터 OK):
  대시보드 · 오늘의 브리핑 · 할일 · 일정 · 인사이트 · 기록 · 멤버 (AI직원은 Phase 3).
- 가능한 곳은 **실데이터 연결**(할일/일정/인사이트/멤버 = 기존 테이블 workspace_id 스코프), 나머지(KPI 차트·브리핑)는 목업 → Phase 4/5에서 실데이터.
- **완료기준:** 회사 고르면 8메뉴 중 7개가 모노톤으로 보임(직원 제외).

### Phase 3 — AI 직원 시스템 (3~4d)
- **DB:** `staff`, `staff_routines` + RLS + mock.
- 타입 카탈로그(코드 상수, 5.2) + 채용 플로우(타입선택→스킬/일과→프롬프트→배치).
- AI직원 목록(오피스 플로어 카드) + 상세(공통 영역 + outputKind 분기 — **먼저 `sns_queue`·`detail_builder` 2종**, 나머지 점진).
- **완료기준:** 회사에 직원 채용→목록·상세가 뜸(아직 자동 실행 전, 수동 "지금 실행" 버튼).

### Phase 4 — routine 실행 엔진 = 24h 자동 (2~3d)
- **DB:** `daily_reports` + RLS + mock.
- Edge Function `office-staff-run`(cron): enabled routine 실행 → 직원 prompt+워크스페이스 스코프(빌드 B)로 Claude 호출 → daily_report 적재.
- 오늘의 브리핑·직원 상세 아카이브에 실데이터 연결. 공유 회사면 멤버 전원 푸시(빌드 B `sendPushToWorkspace`).
- 비용 가드(토큰 로그·일 상한). 채용 UI "예상 월 비용".
- **완료기준:** 새벽에 자동으로 리포트 쌓이고 아침 브리핑에 뜸. (= 원래 목표 달성)

### Phase 5 — 오피스 실데이터 마감 (2d)
- `suggestions`(인사이트 AI 제안), `sns_posts`(SNS 큐 발행체크), 회사 할일 auto/manual 배지·담당자.
- KPI 카드 = (당장은) 수기 입력 또는 직원 산출. 브랜드앱 연동은 Phase 8.
- **완료기준:** 인사이트·SNS·할일이 실제로 동작.

### Phase 6 — 공유·협업 마감 (시목) (1.5d)  ← 기존 C-②/③ 흡수
- 회사 할일 "받은 할일" 표시 + 담당자 즉시배정 + 푸시.
- 이메일 초대 플로우(pending→수락), 멤버 화면.
- ⚠️ **Phase 4(컨텍스트 스코핑)·이 Phase 끝나기 전엔 민석 실제 초대 금지**(누수 방지).
- **완료기준:** 시목에 민석 초대→둘이 같은 리포트·할일 보고 분배.

### Phase 7 — 디자인·UX 마감 (1.5d)
- 모노톤 일관성 점검, 반응형(모바일 오피스 셸), 검색(⌘K), 알림, 빈 상태.
- 개인↔회사 전환 애니메이션·기억(localStorage).

### Phase 8 — 브랜드 앱 KPI 커넥터 (방식 B) (후순위, 2d+)
- `brand_connections` + 각 브랜드 Supabase read-only 조회 레이어 → KPI 실데이터.
- 새 회사 추가 = 연결정보 입력만.

**총 예상:** Phase 0~7 ≈ 2~3주(1인 개발 기준), Phase 8 별도.

---

## 8. 비용·운영
- 운영 직원 6종 24h ≈ **월 $39**(아키텍처 5.2b). 절감: Haiku 라우팅·프롬프트 캐싱·Batch → 절반↓.
- `daily_reports`에 토큰/비용 적재 → 워크스페이스별 월 비용 가시화.
- 가격은 [docs.claude.com](https://docs.claude.com)에서 배포 전 재확인.

---

## 9. 열린 결정 (구현 중 확정)
1. **개인 셸 그대로 vs 모노톤 통일** — 개인도 모던 테마라 톤은 맞지만, 오피스 레일과 시각적 위계 차이를 둘지.
2. **KPI 소스** — 브랜드앱 연동(Phase 8) 전까지 수기입력 vs 직원 산출 vs 생략.
3. **쏠닝오즈** — JSX엔 있는데 실제 운영 브랜드인지(워크스페이스로 만들지) 확인.
4. **직원 outputKind 우선순위** — 2종(sns_queue/detail_builder) 먼저 확정 OK?
5. **모바일 오피스 셸** — 좌측 레일을 모바일에선 하단탭으로 변환할지.

> 위는 진행하며 확정. **Phase 0부터 착수**.

# 🏢 AI 오피스 — 회사 설계 & AI 직원 기능 검증 요청서

> **이 문서를 읽는 AI(Perplexity / GPT / Claude)에게:** 1인 사업가가 자체 브랜드를 운영하는 "AI 직원 오피스"를 만들고 있습니다.
> 아래는 ①지금까지 구축한 것 ②회사 메인 설계 ③각 AI 직원의 자동+수동 기능·레이아웃·모델·연동·프롬프트 로직 설계안입니다.
> **끝의 [검증 요청]을 냉정하게 검토**해 주세요. 특히 **모델 선택(어떤 직원에 어떤 모델/Perplexity)**, **프롬프트 계층 설계**, **자동+수동 UX**, **직원 간 협업 로직**의 구멍을 찾아주세요. 한글로.
> **작성일:** 2026-06-15

---

## 0. 전제 — "진짜 한 회사"
- 브랜드: 운명랩(라이프스타일 소품), 쏠닝포인트(건강식품), 시목(원목 가구/소품). 각 브랜드 = **워크스페이스("회사")**.
- 회사 안에 **AI 직원들**이 일함. 직원은 **자동(정해진 일과를 cron으로)** + **수동(사장이 직접 시킴)** 둘 다 수행.
- 목표: 사장이 회사 정보를 한 번 세팅하면, 직원들이 그 회사를 **이해하고**, 서로 **협업하며**, 매일 알아서 일하고(자동), 필요할 때 시키는 일도 한다(수동).

---

## 1. 지금까지 구축한 것 (현황)

### 1.1 구조
- **2-셸:** 개인 공간(기존 자기계발 앱) ↔ 회사 오피스(AI Office). 워크스페이스 전환으로 셸이 통째로 바뀜.
- **회사 오피스 셸:** 좌측 레일 9메뉴 — 대시보드·오늘의 브리핑·AI 직원·할일·일정·인사이트·콘텐츠·기록·멤버.
- 스택: React+Vite+TS+Tailwind / Supabase(Postgres+RLS+Edge Functions) / 모던 모노톤+몽글 디자인.

### 1.2 AI 직원 시스템 (현재)
- **8개 타입 카탈로그**(코드 상수 `staffCatalog.ts`): 소싱·상세페이지·CS·SNS·광고·모니터링·분석가·비주얼 디렉터.
- 직원 = 타입 인스턴스(`staff` 테이블): typeKey, name, prompt(사용자 입력), model(sonnet/haiku), state.
- **일과(`staff_routines`):** label, schedule(daily/weekly/monthly), run_at, day_of_week, day_of_month, enabled. 사장이 추가/수정/켜고끄기 가능.
- **실행(`staffRun.service` + Edge Function `office-staff-run`):**
  - 시스템 프롬프트 = **베이스 SOP(코드) + 브랜드(워크스페이스명·사업정보) + 직원 프롬프트 + 동료 직원 최근 산출물 + 오늘 일과**
  - Anthropic 호출 → 리포트 생성 → `daily_reports` 저장 + `[액션]` 파싱해 **일정/할일/인사이트 자동 등록** + 멤버 푸시.
  - 수동 "지금 실행" 버튼 / 자동 cron(매 15분 due 체크, `last_run_at`으로 하루 1회).
- **협업:** 직원 실행 시 같은 회사 동료들의 최근 리포트 요약을 프롬프트에 주입 → 모니터링이 트렌드 뽑으면 광고가 참고.
- **메뉴 연동(자동):** 일정/할일/인사이트 = 직원 [액션]으로 자동 채워짐(🤖 배지). 브리핑/기록 = 리포트 집계.

### 1.3 DB (관련)
`workspaces, workspace_members, staff, staff_routines, daily_reports, tasks/schedules/insights(+workspace_id·is_shared), reading_logs, youtube_*`. 상세: `docs/DATA_SCHEMA.md`.

### 1.4 아직 없는 것 (이 문서로 설계/검증할 것)
- ❌ **회사 메인 프롬프트(브레인)** — 지금은 워크스페이스명+사업정보 한 줄만 주입. 회사 정체성 전체가 없음.
- ❌ **수동 입력 기능** — 사장이 "이 아이템 분석해줘"(이미지+설명), "이 주제로 광고 만들어줘" 같은 직접 지시 UI 없음.
- ❌ **직원별 모델 라우팅** — 지금 전원 Anthropic. 모니터링/소싱은 Perplexity(실시간 검색)가 나을 수 있음.
- ❌ **직원별 맞춤 레이아웃** — outputKind별 상세 UI가 아직 placeholder.

---

## 2. 회사 메인 설계 — "브레인 프롬프트" (신규 제안)

### 2.1 개념
모든 직원이 **이 회사를 이해**하도록, 회사당 1개의 **브레인(brand_contexts)**을 둠. 직원 프롬프트의 **0층**으로 항상 주입.

### 2.2 어디에 / 어떻게 입력
- **저장:** `brand_contexts` 테이블 (워크스페이스 1:1, 또는 project 1:1).
- **입력 UI:** 회사 오피스 → **설정 ⚙️ → "회사 정보"** 폼(1회 작성, 수정 가능). 멤버 누구나 보고 owner가 편집.
- **주입:** 모든 직원 실행 시 시스템 프롬프트 최상단.

### 2.3 브레인 필드(제안)
| 필드 | 예(시목) |
|---|---|
| 브랜드명 / 한 줄 정체성 | 시목 · "오래 쓰는 원목, 기준 있는 선택" |
| 카테고리 / 주력 상품 | 원목 가구·소품 / 티크 도마, 원목 식탁 |
| 타겟 페르소나 | 요리 자주 하는 2030 신혼·자취, 주방 감성 |
| 톤앤매너 | 따뜻·담백·장인정신. 과장·최저가 강조 금지 |
| 핵심 USP | 통원목 / 천연오일 / 국내 수작업 마감 |
| 컴플라이언스(금지표현) | 효능 단정 금지(건기식), "1위"는 근거 명시 |
| 판매 채널 | 스마트스토어·자사몰 |
| 가격 포지셔닝 | 프리미엄(가격 정당화 필요) |
| 경쟁사 / 차별점 | (입력) |
| 브랜드 스토리 | 농부아들 직거래 등 |

### 2.4 프롬프트 계층 (최종안 — 5겹)
```
① 회사 브레인 (brand_contexts)      ← 회사 정체성, 모든 직원 공통 [신규]
② 타입 베이스 SOP (코드 상수)        ← 직무 전문지식 (상세페이지 12섹션·이미지 6덩어리 등)
③ 직원 개별 프롬프트 (사용자 입력)    ← 이 직원의 성격·톤·세부 지시
④ 동료 직원 최근 산출물 (협업)        ← 다른 직원 결과 참고
⑤ 작업 지시 (오늘 일과 OR 수동 입력)  ← 구체적으로 뭘 할지
```
> 사장은 ③(직원 프롬프트)과 ①(회사 브레인)만 입력. ②는 코드 고정, ④⑤는 자동 결합. → **빈칸 공포 없이 품질 일관.**

---

## 3. 자동 + 수동 실행 모델 (핵심)

모든 직원이 **두 가지 방식**으로 작동:

| | 자동 (Auto) | 수동 (Manual) |
|---|---|---|
| 트리거 | cron이 일과(routine) due 시각에 실행 | 사장이 직원 상세에서 "직접 시키기" |
| 입력 | 일과 라벨 + 회사/동료 컨텍스트 | **사장이 그 자리에서 입력**(주제·텍스트·이미지) |
| 예 | "매일 09:00 게시물 초안 1건" | "이 신상으로 광고 3안 만들어줘" / "이 아이템 분석해줘"(이미지+설명) |
| 산출 | daily_report + [액션] 자동등록 | 즉시 결과물(outputKind 화면에 표시) + 저장 |

### 3.1 수동 입력 UI (직원 상세에 "직접 시키기" 패널)
- 공통: 텍스트 입력 + 실행 버튼.
- 타입별 추가 입력: 이미지 업로드(소싱/상세/비주얼), URL/텍스트 붙여넣기(모니터링/CS).
- 결과: 그 직원의 outputKind 형식으로 표시(아래 4장) + 리포트/아카이브 저장.

---

## 4. AI 직원별 상세 설계 (자동·수동·레이아웃·모델·연동)

> 각 직원 카드: ①자동 기능 ②수동 기능(사장 입력) ③입력 폼 ④outputKind 레이아웃 ⑤추천 모델+이유 ⑥연동 메뉴

### 4.1 🔍 소싱 기획자 (`sourcing`)
- **자동:** 매일 카테고리 트렌드/급상승 키워드 점검 → 인사이트 등록.
- **수동:** 사장이 **아이템(이미지+설명) 입력 → 그 제품 분석**(트렌드·경쟁강도 상/중/하·소싱 추천여부+이유·페르소나·추천채널). 키워드 기획안, 상품 기획서 초안.
- **입력 폼:** 상품명, 카테고리, **이미지 업로드**, 설명, (선택) 경쟁사 링크.
- **레이아웃(sourcing_brief):** 분석/키워드/기획 3탭 + 추천여부 배지(추천/보류/비추천) + 경쟁강도 표시.
- **모델:** **Perplexity Sonar Pro**(실시간 검색량·트렌드 조사) **+** Claude(분석·기획 정리). → **하이브리드**: 조사는 Perplexity, 글 정리는 Claude.
- **연동:** 인사이트(트렌드), 할일(소싱 액션), 상세페이지(기획서 넘김).

### 4.2 📄 상세페이지 제작자 (`detail_page`) ★최고 임팩트
- **자동:** 신상 등록/주문 시 초안 생성(또는 주간).
- **수동:** 사장이 **상품정보 입력(13필드 인테이크폼) → 6섹션 상세페이지 + 스마트스토어 HTML**. 섹션별 재생성("더 감성적/전문적").
- **입력 폼:** 우리가 역설계한 **봇 공식 인테이크폼 13필드**(상품명·한줄핵심·가격·타깃·페인포인트·차별점·스펙·사용법·인증·후기·배송·금지톤·채널) + 이미지.
- **레이아웃(detail_builder):** 전략브리핑 → 12섹션 에디터(섹션당 6블록: 핵심한줄/모바일카피/불릿7/추천비주얼3/의심제거/미니CTA) + 섹션별 재생성 + HTML 복사. (`_기획봇_역설계.md` SOP 그대로)
- **모델:** **Claude (Sonnet/Opus)** — 글쓰기 품질 + 역설계 SOP. (Perplexity 불필요)
- **연동:** 콘텐츠/비주얼(이미지 컨셉 → 비주얼 디렉터), 할일.

### 4.3 💬 CS 응대 (`cs`, 후기 관리 포함)
- **자동:** 매일 18:00 미해결 문의·신규 후기 요약 → 기록.
- **수동:** 사장이 **문의 텍스트 붙여넣기 → 분류+답변초안** / FAQ 10개 / 부정리뷰 대응.
- **입력 폼:** 고객 문의 텍스트, 상품명, (선택) 주문정보.
- **레이아웃(ticket_list):** 티켓 카드(유형/긴급도/답변초안 복사/추가확인).
- **모델:** 분류=**Claude Haiku**(저비용 대량), 답변=**Claude Sonnet**. (유튜브 댓글 답글 기능과 통합 가능)
- **연동:** 기록, 콘텐츠(유튜브 댓글).

### 4.4 📣 SNS 운영 (`sns`)
- **자동:** 매일 게시물 초안 1건, 주간 콘텐츠 캘린더.
- **수동:** 사장이 **주제/상품 입력 → 캡션 A/B/C, 릴스 스크립트**.
- **입력 폼:** 주제, 상품, 플랫폼(인스타/스레드), 길이(15/30/60초).
- **레이아웃(sns_queue):** 캘린더 뷰 + 게시물 카드 큐(본문·해시태그·이미지 브리프 + 복사/발행체크/승인).
- **모델:** **GPT-4o**(마케팅 카피 강점) 또는 **Claude Sonnet**. (검증 요청: 둘 중 무엇?)
- **연동:** 일정(발행 일정 자동등록), 콘텐츠.

### 4.5 🎯 광고 기획 (`ad`)
- **자동:** 주간 광고 소재 세트.
- **수동:** 사장이 **"이 상품/주제로 광고 만들어줘" → 카피세트(헤드라인5·서브5·CTA)+타겟 세팅+A/B 3세트**.
- **입력 폼:** 상품, 핵심 USP, 타겟, 예산, 채널(네이버/카카오/인스타).
- **레이아웃(copy_variants):** 카피세트 + 타겟 가이드 + A/B 3세트(감성/기능/가격) 비교.
- **모델:** **Claude Sonnet** 또는 **GPT-4o**.
- **연동:** 인사이트(소구점), 할일.

### 4.6 📡 모니터링 (`monitor`)
- **자동:** 매일 08:00 키워드 검색량·경쟁사 가격/리뷰 스캔 → 인사이트/기록.
- **수동:** 사장이 **경쟁사 URL/텍스트 OR 아이템(이미지+설명) 입력 → 경쟁사 비교·트렌드 분석**(가격포지셔닝·리뷰키워드·구성비교·차별화).
- **입력 폼:** 경쟁사 URL/텍스트, 키워드, (아이템 분석 시) 이미지+설명.
- **레이아웃(monitor_digest):** 경쟁사 비교표 + 트렌드 리포트 + URL/텍스트 붙여넣기 입력란.
- **모델:** **Perplexity Sonar Pro** ★ — 가격/리뷰/트렌드는 **현재 웹데이터**가 필요(실시간 검색). 사장 직감 맞음.
- **연동:** 인사이트, 기록, 광고/소싱(트렌드 공급).
- ⚠️ 제약: 스마트스토어/쿠팡 공식 API 제한 → URL/텍스트 붙여넣기 + Perplexity 검색 조합.

### 4.7 📊 분석가 (`analyst`)
- **자동:** 매일 KPI 집계, 주간 성과 해석, 이상치 감지.
- **수동:** 사장이 **지표 데이터 붙여넣기 → 해석/이상치/원인가설**.
- **입력 폼:** KPI 수치(또는 연동된 KPI 자동), 기간.
- **레이아웃(metric_digest):** KPI 집계·추이 차트 + 이상치 하이라이트 + 원인 가설.
- **모델:** **Claude Sonnet**.
- **연동:** 인사이트/대시보드 KPI, 기록.
- ⚠️ 실매출/지표 데이터 없으면 의미 약함 → KPI 입력 또는 브랜드앱 연동 후 강해짐.

### 4.8 📸 비주얼 디렉터 (`visual`, = 촬영봇)
- **자동:** 신상 등록 시 촬영컷 리스트 + 이미지 프롬프트 생성.
- **수동:** 사장이 **상품 이미지/설명 입력 → 이미지 프롬프트(6덩어리)+목업 합성 브리프+필수 촬영컷 리스트**.
- **입력 폼:** 상품, 무드 키워드, **이미지 업로드**(누끼/로고).
- **레이아웃(image_brief):** 프롬프트 카드(복사) + 촬영컷 체크리스트 + 비율/네거티브 안내.
- **모델:** **Claude**(프롬프트 텍스트 작성). 실제 이미지 생성은 외부(나노바나나/미드저니/Gemini) — 앱은 **프롬프트만** 제공.
- **연동:** 콘텐츠, 상세페이지(비주얼 공급).

---

## 5. 모델 라우팅 표 (검증 핵심)

| 직원 | 추천 모델 | 이유 | 대안 |
|---|---|---|---|
| 소싱(조사) | **Perplexity Sonar Pro** | 실시간 검색량·트렌드 | Claude(조사 약함) |
| 소싱(기획) | Claude Sonnet | 구조화·글 | — |
| 상세페이지 | **Claude Sonnet/Opus** | 카피 품질·SOP | — |
| CS(분류) | Claude Haiku | 저비용 대량 | GPT-4o-mini |
| CS(답변) | Claude Sonnet | 톤·공감 | — |
| SNS | GPT-4o ↔ Claude | 마케팅 카피 | (검증 요청) |
| 광고 | Claude Sonnet ↔ GPT-4o | 카피 변주 | — |
| 모니터링 | **Perplexity Sonar Pro** | 실시간 경쟁/가격 | — |
| 분석가 | Claude Sonnet | 수치 해석 | — |
| 비주얼 | Claude Sonnet | 프롬프트 작성 | — |

**API 호출 방식**
- Claude: `POST api.anthropic.com/v1/messages` (system + messages, x-api-key)
- GPT: `POST api.openai.com/v1/chat/completions`
- Perplexity: `POST api.perplexity.ai/chat/completions` (sonar-pro, citations 반환)
- 프론트(수동): vite 프록시 경유 / 자동(cron): Edge Function에서 직접 fetch + service role
- 비용: 운영 6종 24h ≈ 월 $39(Sonnet 기준). Haiku 라우팅·프롬프트 캐싱·Batch로 절반↓.

---

## 6. AI 직원 간 협업 로직 (데이터 흐름)

```
모니터링 ──(트렌드/경쟁)──► 인사이트 ──┐
소싱     ──(USP/페르소나)──► 인사이트 ──┤
                                        ├──► 광고·SNS·상세페이지 (참고해서 작업)
분석가   ──(KPI 해석)──────► 인사이트 ──┘
SNS      ──(발행 일정)─────► 일정
모든 직원 ──(일일 리포트)──► 브리핑 + 기록
비주얼   ──(이미지 프롬프트)► 상세페이지·SNS·콘텐츠
```
- 구현: 각 직원 실행 시 **동료 최근 리포트 요약**을 프롬프트 ④층에 주입(이미 구현). + 인사이트 메뉴가 **공용 지식 보드** 역할.
- 검증 요청: 하드코딩 의존 그래프 vs 현재 "전체 동료 리포트 주입" 중 무엇이 나은가?

---

## 7. 메뉴 ↔ 직원 연동 매핑

| 메뉴 | 자동 채워짐(직원→) | 수동(사장→) |
|---|---|---|
| 오늘의 브리핑 | 모든 직원 리포트 집계 | — |
| AI 직원 | 채용·일과·리포트·직접시키기 | 채용/설정/직접 실행 |
| 할일 | [액션] 자동등록(🤖) | ＋수동 추가 |
| 일정 | [액션] 자동등록(🤖) | ＋수동 추가 |
| 인사이트 | 트렌드·소구점 자동(🤖) | ＋수동 추가 |
| 기록 | 직원 활동 타임라인 | — |
| 콘텐츠 | (CS·SNS·비주얼 연동) | 채널 등록·답글 |
| 대시보드 | KPI·플로어 요약 | — |

---

## 8. ✅ 검증 요청 (Perplexity / GPT / Claude 각각에게)

각 리뷰어가 답해주세요(냉정하게, 근거와 함께):

**A. 모델 선택**
1. 직원별 모델 라우팅(5장)이 맞나? 특히 **모니터링·소싱에 Perplexity**가 정말 우월한가? 한계는?
2. SNS/광고는 GPT-4o vs Claude 중 무엇? 카피 품질·비용 근거로.
3. 비주얼 디렉터의 이미지 생성을 앱이 직접 못 한다 — 나노바나나/미드저니/DALL·E/Gemini 중 무엇을 어떻게 연동?

**B. 회사 브레인 & 프롬프트 계층**
4. 5겹 프롬프트 계층(2.4)이 과한가/부족한가? 토큰·품질 트레이드오프.
5. 회사 브레인을 brand_contexts(테이블) vs 워크스페이스 설정 어디에 두는 게 맞나? 직원이 회사를 "이해"하게 하는 더 나은 방법?

**C. 자동 + 수동 UX**
6. "직접 시키기"(수동 입력)와 일과(자동)를 한 직원 안에서 어떻게 UI로 구분/통합해야 깔끔한가?
7. 소싱/모니터링의 "아이템(이미지+설명) 분석" 수동 기능 — 이미지를 어떻게 모델에 넘기나(Vision)? 어떤 모델이 이미지 분석 가능?

**D. 직원 간 협업**
8. 동료 산출물 주입 방식(전체 vs 의존 그래프 vs 인사이트 보드)의 최적안?
9. 직원 수가 늘면 협업이 토큰·노이즈로 깨지지 않게 하려면?

**E. 직원별 레이아웃**
10. outputKind별 상세 UI(sourcing_brief/detail_builder/sns_queue/monitor_digest/copy_variants/ticket_list/metric_digest/image_brief) 각각 무엇을 보여줘야 가장 실무적인가?

**F. 놓친 것**
11. "진짜 한 회사"가 되려면 빠진 직원·기능·연동이 있나?

> 첨부 참고: `_개편_통합설계_Phase.md`(전체 구조), `_기획봇_역설계.md`(상세페이지 SOP), `DATA_SCHEMA.md`(DB), `07~13`(상세페이지·카피·디자인·이미지 노하우).

---
---

# 📎 부록 (검증용 구체 디테일)

## 부록 A. 프롬프트 조립 — 실제로 모델에 가는 전체 텍스트 (예: 시목 광고 직원)
> 5겹이 실제로 어떻게 한 덩어리 system 프롬프트가 되는지. 리뷰어는 이 분량/구성이 적절한지 봐주세요.

```
[① 회사 브레인 — brand_contexts]
브랜드: 시목 · "오래 쓰는 원목, 기준 있는 선택"
카테고리: 원목 가구/소품 (주력: 티크 도마, 원목 식탁)
타겟: 요리 자주 하는 2030 신혼·자취, 주방 감성 챙기는 사람
톤앤매너: 따뜻·담백·장인정신. 과장·최저가 강조 금지.
핵심 USP: 통원목 한 장 / 천연오일 함량 높은 티크 / 국내 수작업 마감 / 두께 3cm
컴플라이언스(금지): 내구성·효능 과장 단정 금지. "1위"는 날짜·기준 명시.
판매 채널: 스마트스토어·자사몰 / 가격 포지셔닝: 프리미엄(가격 정당화 필요)

[② 타입 베이스 SOP — 광고(코드 고정)]
너는 퍼포먼스 광고 카피라이터다. 헤드라인 15자 이내·서브 30자·상세 90자·CTA.
감성형/기능형/가격형 3세트로 변주. 기능을 "고객 이익"으로 번역. 채널 규정 금지표현 준수.

[③ 직원 개별 프롬프트 — 사장이 입력]
인스타·네이버 기준. 신혼 타겟 따뜻한 톤. 선물 각도 살려줘.

[④ 동료 직원 최근 산출물 — 자동 주입]
- [경쟁사감시·모니터링] 원목 도마 '친환경/통원목' 키워드 검색 급상승, 가격대 3.5~5만원
- [소싱기획·소싱] 구매장벽 1위는 "관리 어려움" → '관리 쉬움'을 USP로

[⑤ 작업 지시 — 수동 입력 또는 오늘 일과]
티크 원목 도마(39,000원) 신상으로 인스타 광고 카피 3세트 만들어줘.

[출력 규칙]
결과는 한국어 마크다운. 첫 줄 "# 제목", 둘째 줄 요약, 본문.
실행 액션이 있으면 마지막에:
[액션]
일정: YYYY-MM-DD HH:MM | 제목
할일: 제목 | high|medium|low
인사이트: 발견한 트렌드/소구점
```
→ **user message:** `"위 작업을 수행하고 결과를 일일 리포트로 정리해줘."`
> 검증: ①~④는 매번 동일(프롬프트 캐싱 대상), ⑤만 가변. 토큰 추산 입력 ~1.2K(캐시 후 0.1K) + 출력 ~1K.

---

## 부록 B. API 호출 페이로드 (실제 JSON)

**Claude (Anthropic)** — 대부분 직원
```http
POST https://api.anthropic.com/v1/messages
x-api-key: $KEY   anthropic-version: 2023-06-01
{ "model":"claude-sonnet-4-20250514", "max_tokens":1500,
  "system":"<부록 A 전체>",
  "messages":[{ "role":"user", "content":"위 작업을 수행하고 …" }] }
→ { "content":[{"type":"text","text":"# …"}], "usage":{"input_tokens":1234,"output_tokens":890} }
```
**Claude Vision** — 소싱/모니터링/비주얼의 "이미지+설명 분석"(수동)
```json
"messages":[{ "role":"user", "content":[
  { "type":"image", "source":{"type":"base64","media_type":"image/jpeg","data":"<b64>"} },
  { "type":"text", "text":"이 제품을 분석해줘: 티크 도마, 39,000원, 통원목" }
]}]
```
> ⚠️ **Perplexity는 Vision 없음.** 이미지 분석은 Claude/GPT-4o Vision, 웹 조사는 Perplexity — 수동 아이템 분석은 **2-스텝**(Vision으로 제품 파악 → Perplexity로 시장조사)일 수 있음. (검증 질문 7)

**Perplexity** — 모니터링/소싱 조사
```http
POST https://api.perplexity.ai/chat/completions
{ "model":"sonar-pro",
  "messages":[{"role":"system","content":"<브레인+SOP>"},
              {"role":"user","content":"원목 도마 2026 트렌드·경쟁사 가격대·리뷰 키워드"}] }
→ { "choices":[{"message":{"content":"…"}}], "citations":["https://…"] }
```
> 조사는 Perplexity(실시간+출처), 정리·기획은 Claude 분리 권장.

**GPT-4o** — SNS/광고(대안): `POST api.openai.com/v1/chat/completions`

---

## 부록 C. 신규 DB 스키마 (DDL 제안)
```sql
-- 회사 브레인 (워크스페이스 1:1)
create table brand_contexts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid unique references workspaces(id) on delete cascade,
  identity text, category text, main_products text, target text, tone text,
  usp text, compliance text, channels text, price_position text,
  competitors text, story text,
  raw text,                 -- 자유 추가 설명(모델에 그대로 주입)
  updated_at timestamptz default now()
);
-- 직원 모델 라우팅
alter table staff add column if not exists provider text default 'anthropic'; -- anthropic|openai|perplexity
alter table staff add column if not exists model_id text;
-- 자동/수동 구분 + 수동 입력 보관
alter table daily_reports add column if not exists trigger text default 'auto'; -- auto|manual
alter table daily_reports add column if not exists input jsonb;                 -- 수동 입력
alter table daily_reports add column if not exists kind text;                   -- outputKind
```

---

## 부록 D. 직원별 입력 폼 스키마 (수동 "직접 시키기")
| 직원 | 입력 필드(타입) | 모델 |
|---|---|---|
| 소싱 | 상품명·카테고리·**이미지(file)**·설명·경쟁사링크 | Perplexity+Claude Vision |
| 상세페이지 | 13필드 인테이크폼·이미지 | Claude |
| CS | 문의내용(textarea)·상품명·주문정보 | Claude Haiku/Sonnet |
| SNS | 주제·상품·플랫폼(select)·길이(select) | GPT-4o/Claude |
| 광고 | 상품·USP·타겟·예산·채널(multi) | Claude/GPT |
| 모니터링 | 경쟁사 URL/텍스트·키워드·이미지(file?) | Perplexity(+Vision) |
| 분석가 | 지표데이터(textarea)·기간 | Claude |
| 비주얼 | 상품·무드·**이미지(file)** | Claude |

---

## 부록 E. outputKind 레이아웃 상세 (컴포넌트)
| outputKind | 컴포넌트 |
|---|---|
| `sourcing_brief` | 탭(분석/키워드/기획) · 추천여부 배지 · 경쟁강도 바 · 페르소나 카드 · 추천채널 칩 |
| `detail_builder` | 전략브리핑 → 12섹션 아코디언(섹션당 6블록) · [섹션 재생성] · [HTML 복사] · 이미지 업로드 |
| `ticket_list` | 티켓 카드(유형·긴급도·답변초안·[복사]·추가확인) |
| `sns_queue` | 월 캘린더 + 게시물 큐(본문·해시태그·이미지브리프·[복사]/[발행함]/[승인]) |
| `copy_variants` | 헤드라인5/서브5/CTA + 타겟 카드 + A/B 3세트(감성/기능/가격) 비교 |
| `monitor_digest` | 경쟁사 비교표(가격/리뷰키워드/구성) + 트렌드 카드 + URL입력란 + 출처 링크 |
| `metric_digest` | KPI 카드 + 추이 차트 + 이상치 배너 + 원인가설 리스트 |
| `image_brief` | 프롬프트 카드(복사·비율칩) + 촬영컷 체크리스트 + 네거티브 안내 |

---

## 부록 F. 비용 상세 (월)
| 직원 | 모델 | 1일 | 1회(in/out) | 1월 |
|---|---|---|---|---|
| 소싱 | Perplexity+Claude | 2 | 4K/3K | ~$3.4 |
| 상세페이지 | Claude Sonnet | 1(+재생성2) | 6K/8K | ~$9.0 |
| CS | Haiku/Sonnet | 20 | 1.5K/1K | ~$11.7 |
| SNS | GPT-4o/Claude | 5 | 3K/2K | ~$5.9 |
| 광고 | Claude/GPT | 1 | 3K/3K | ~$1.6 |
| 모니터링 | Perplexity | 3 | 8K/4K | ~$7.6 |
| 분석가 | Claude | 1 | 4K/3K | ~$2 |
| 비주얼 | Claude | 1 | 3K/3K | ~$2 |
| **합계** | | | | **≈ 월 $40~45** |
> 절감: Haiku 라우팅(3~5배↓)·프롬프트 캐싱(①~④ 90%↓)·Batch(50%↓) → 절반↓. Perplexity sonar-pro 별도 과금. 2026-06 단가, 배포 전 재확인.

---

## 부록 G. 수동+자동 UI 와이어프레임 (직원 상세)
```
[← AI 직원]                      [📝 프롬프트][⏸ 일시정지][🗑 해고]
┌ 프로필 (이모지·이름·역할·상태·모델) ───────────────────┐

┌ 직접 시키기 (수동) ─────────────────────────────────┐
│ [입력: 주제/상품/문의…]  [📎 이미지]   [▶ 실행]       │  ← 타입별 필드(부록 D)
└────────────────────────────────────────────────────┘

┌ 산출물 (outputKind별) ───────┐ ┌ 매일 하는 일(자동) ─[＋추가]┐
│ sourcing_brief/detail_builder │ │ ✓ 매일 09:00 게시물 초안   │
│ /monitor_digest …             │ │ ✓ 매주 월 경쟁사 스캔       │
└──────────────────────────────┘ └───────────────────────────┘

┌ 일일 리포트 (자동+수동 아카이브, auto/manual 배지) ──────────┐
└────────────────────────────────────────────────────────────┘
```
> 검증: "직접 시키기(수동)" 상단 + 자동 일과 + 산출물 + 아카이브. 직원마다 다른 입력폼/outputKind 담기에 적절한가?

# 퍼플렉시티 답변
당장 이 설계로 베타를 돌려도 될 정도로 구조는 탄탄하고, “한 회사” 관점도 잘 잡혀 있습니다. 다만 모델 라우팅, 협업 컨텍스트 주입, 프롬프트 계층, 수동/자동 UX에서 몇 가지를 바꾸면 비용·안정성·스케일이 훨씬 좋아질 여지가 있습니다.  

아래에서 A–F 순서대로 번호에 맞춰 코멘트합니다.

***

## A. 모델 선택

### A1. 소싱·모니터링에 Perplexity 사용 여부

- **모니터링 직원에는 Sonar Pro가 딱 맞습니다.** Sonar 계열은 “항상 웹 검색 + 자동 인용” 구조라, 가격·리뷰·트렌드 같이 시점에 민감한 경쟁 정보에 강하고, 답변 안에 출처가 잘 붙는 게 장점입니다. [geol](https://geol.ai/briefing/perplexitys-sonar-pro-api-advancing-real-time-search-with-enhanced-citation-architecture-comparison)
- **소싱은 “조사 파트만 Sonar, 기획은 Claude”라는 지금 구상이 맞습니다.** 트렌드·키워드·경쟁사 정보는 Sonar로 끌어오고, 그걸 바탕으로 상품 기획서·페르소나·채널 전략을 짜는 건 Sonnet이 더 잘합니다. [multibly](https://multibly.com/claude-4-sonnet-vs-gpt-4o-comprehensive-benchmark-comparison-in-2026/)

다만 “Perplexity 우월함”의 **한계/주의점**은:

- **Vision이 없다** → 이미지+설명 분석은 Claude/GPT-4o Vision으로 구조화 → 그 결과 텍스트만 Sonar에 넘기는 2-스텝이 필요합니다. [cursor-ide](https://www.cursor-ide.com/blog/gpt4o-image-api-guide-2025-english)
- **언제나 웹을 친다** → 정적 지식이나 내부 데이터 위주 질문까지 Sonar로 보내면, 불필요한 지연·비용이 생깁니다. [geol](https://geol.ai/briefing/perplexitys-sonar-api-democratizing-ai-search-capabilities)
- **스마트스토어/쿠팡 URL 의존** 시, 화면 구조 변경·로봇 차단 등으로 결과가 흔들릴 수 있어, “절대 의존”이 아니라 사람 검증 전제로 보는 게 안전합니다. [groundy](https://groundy.com/articles/perplexity-api-adding-real-time-search-your-apps/)

**추천:**  
- `sourcing`, `monitor`에서 **“웹이 필요한 상황만” Perplexity로 라우팅하는 오케스트레이터**를 Edge Function에 두세요.  
  - 예: `needs_live_web: true` 플래그가 있을 때만 Sonar, 아니면 Claude 단독.  
- Sonar 응답은 그대로 리포트에 쓰지 말고, **Claude가 “근거가 있는 인사이트 요약자”로 후처리**하는 패턴이 안정적입니다.

***

### A2. SNS/광고 – GPT-4o vs Claude

외부 벤치마크 기준으로:  
- GPT-4o는 **마케팅·스토리텔링 같은 크리에이티브 작업에서 강하고, 토큰 단가가 Sonnet보다 17–33% 저렴**해서 볼륨이 많을수록 유리합니다. [aimodelcalc](https://aimodelcalc.com/guides/gpt-4o-vs-claude-sonnet)
- Claude Sonnet은 **톤·공감·설득력 측면에서 더 따뜻하고 자연스러운 카피**를 내지만, 응답 속도는 느리고 비용은 높은 편입니다. [jeeva](https://www.jeeva.ai/blog/gpt4o-vs-claude-sonnet-sales-copy-benchmarks)

이를 그대로 직원에게 매핑하면:

- **SNS 직원**:  
  - 기본값: **GPT-4o** – 짧은 캡션·릴스 스크립트 A/B 테스트를 여러 개 뽑는 고볼륨·고변주 작업에 적합, 비용도 좋음. [multibly](https://multibly.com/claude-4-sonnet-vs-gpt-4o-comprehensive-benchmark-comparison-in-2026/)
  - 옵션: “감성 강조 모드” 같은 토글을 두고, 켤 때만 Sonnet으로 보내거나, GPT-4o 초안 → Sonnet 톤 폴리싱 2-스텝.  
- **광고 직원**:  
  - **하이임팩트 소재(메인 랜딩, 고가 제품 퍼포먼스)**: Sonnet 우선 (설득·스토리텔링 강점). [jeeva](https://www.jeeva.ai/blog/gpt4o-vs-claude-sonnet-sales-copy-benchmarks)
  - **테스트용 다변주/로컬 캠페인**: GPT-4o 우선 (속도·비용). [aimodelcalc](https://aimodelcalc.com/guides/gpt-4o-vs-claude-sonnet)

즉, “SNS=GPT-4o, 광고=Sonnet+GPT-4o 혼합”으로 라우팅하는 지금 고민 방향이 맞고, **중요도(캠페인 티어)에 따라 모델을 스위칭**하는 게 이상적입니다.

***

### A3. 비주얼 디렉터 – 이미지 생성 연동

현재 앱이 “프롬프트 설계까지” 하고, 이미지는 외부에 맡기는 방향은 **1인 사업가 입장에서 완전 합리적**입니다.

실무적으로 추천하는 패턴은:

1. **1차 통합 대상은 OpenAI 이미지 계열(GPT-4o Images/DALL·E)로 한정**  
   - 같은 OpenAI API 키로 텍스트·Vision·이미지 생성을 한 번에 쓸 수 있어, 인프라 단순화, 레이트 리밋 관리도 쉬움. [developers.openai](https://developers.openai.com/api/docs/guides/images-vision)
   - GPT-4o Vision이 “제품 사진 이해 → 그에 맞는 생성용 프롬프트 설계”까지 잘 하기 때문에, 비주얼 디렉터의 Vision+프롬프트 역할과 잘 맞습니다. [glbgpt](https://www.glbgpt.com/sitepage/gpt-4o-image)

2. **나노바나나/미드저니/Gemini는 2차 “외부 툴로 보내기” 레벨**  
   - UI에서 “프롬프트 복사 → 미드저니 열기”처럼 링크/가이드만 제공해도 충분히 실무적입니다.  
   - API까지 붙이는 건, 나중에 특정 툴을 메인 이미지 엔진으로 정했을 때 해도 늦지 않습니다.

정리하면, 지금처럼 앱은 **“비주얼 전략 + 모델 친화적 프롬프트 텍스트”에 집중하고, 이미지 생성은 OpenAI 이미지 API를 1순위, 그 외는 수동 워크플로우**로 두는 설계가 현실적인 선택입니다. [developers.openai](https://developers.openai.com/api/docs/guides/images-vision)

***

## B. 회사 브레인 & 프롬프트 계층

### B4. 5겹 프롬프트 계층 – 과한가/부족한가

현재 예시 기준 입력 ~1.2K 토큰, 출력 ~1K면 Claude/GPT의 긴 컨텍스트에서 전혀 부담이 아닙니다. [multibly](https://multibly.com/claude-4-sonnet-vs-gpt-4o-comprehensive-benchmark-comparison-in-2026/)
게다가 ①~④를 캐시하면, **실제 유료 입력은 ⑤(작업 지시) 위주**라 비용도 잘 잡힌 구조입니다. [aimodelcalc](https://aimodelcalc.com/guides/gpt-4o-vs-claude-sonnet)

다만, 품질·토큰 양쪽에서 개선할 수 있는 지점:

- ① **브레인을 “문단 텍스트”가 아니라 key:value YAML/JSON 구조로** 주면, 모델이 중요한 필드를 파싱하기 쉽고, 길이도 줄일 수 있습니다.  
- ④ 동료 산출물을 매번 원문으로 붙이기보다는, **“인사이트 요약 보드에서 직원별/주제별 상위 3–5개만 추출한 요약”**을 넣는 편이 토큰·노이즈 모두에 좋습니다.  
- ② SOP는 길게 쓰기보다, **역할·출력 포맷·금지 규칙** 위주로 압축하고, 세부 예시는 필요할 때만 few-shot으로 추가하는 식이 안정적입니다.

결론: **5겹 구조 자체는 이상적**이고, “어디까지 붙일지”만 토큰 예산에 맞춰 조금 더 다듬으면 됩니다.

***

### B5. brand_contexts 위치 & “회사 이해” 강화

`brand_contexts`를 독립 테이블로 두는 설계는 좋습니다.  
다만 “회사 설정”과 완전히 분리하기보다는:

- 워크스페이스 설정 화면에서 **회사 기본 정보 + 브랜드 브레인 필드를 한 화면에서 편집**하게 하고, 저장 시 `workspaces`와 `brand_contexts`를 함께 갱신하는 게 UX 상 자연스럽습니다.  
- `brand_contexts.raw`에 사장이 자유롭게 서술한 텍스트를 저장하고, 나머지 필드들은 **모델이 쓰기 좋게 정규화된 스키마**로 두면, 이후 검색·분석에도 유리합니다.  

직원이 회사를 “이해”하게 만드는 더 강한 방법은:

- **브레인 자체를 작은 문서로 보고, 실행 전에 직원이 그 문서를 요약·리라이트하게 하는 1회성 온보딩 루틴**을 넣는 것입니다.  
  - 예: 신입 직원 생성 시 “이 회사 브레인을 읽고, 당신 관점에서 10줄로 요약해봐”를 돌리고, 그 결과를 `staff`의 내장 컨텍스트로 저장.  
  - 이렇게 하면 직원별로 “회사 이해의 자기 해석본”이 생겨, 이후 프롬프트에서 반복 주입할 필요가 줄어듭니다.

***

## C. 자동 + 수동 UX

### C6. “직접 시키기” vs 일과 – UI 구조

제시하신 와이어프레임 구조(상단 프로필 → “직접 시키기” → 산출물 → 자동 일과 → 리포트)는 개념적으로 깔끔합니다.  
다만 실제 UX에서 더 명확하게 하려면:

- **탭 구조**를 추천합니다.  
  - 상단에 `[📌 오늘 요약] [▶ 직접 시키기] [⏰ 자동 일과] [📚 리포트]` 탭을 두고,  
  - “직접 시키기” 탭 안에 타입별 입력 폼과 바로 결과를 띄우는 식.  
- 리포트 리스트에는 `auto/manual` 배지만이 아니라, **“어떤 인풋에서 나온 결과인지”를 한 줄 요약**으로 보여주는 게 좋습니다.  
  - 예: `manual · 신상 티크 도마 광고 3안`, `auto · 주간 경쟁사 리뷰 스캔`.  
- 수동 실행 후 **“이 패턴을 일과로 저장하기” CTA**를 붙이면, 사장이 직접 시킨 작업 중 반복되는 것들을 자연스럽게 자동화로 승격시킬 수 있습니다.

***

### C7. 이미지 분석 – 어떤 모델/흐름이 맞는가

이미지+설명으로 “아이템 분석”을 하려면, Perplexity는 Vision이 없기 때문에 **Vision 모델 → Perplexity 2-스텝**이 필수입니다. [pondhouse-data](https://www.pondhouse-data.com/blog/analyzing-images-with-gpt-4o)

추천 플로우:

1. **Vision 모델(Claude Vision 또는 GPT-4o Vision)** 호출  
   - 입력: 이미지(base64) + 사용자가 작성한 설명 텍스트.  
   - 출력: `카테고리, 소재, 색감, 가격대, 타겟, USP 추정, 리스크` 같은 **정규화된 JSON 스키마**.  
2. **이 JSON을 기준으로 Perplexity Sonar Pro에 질의**  
   - 예: `"티크 원목 도마, 가격대 3~4만원, 통원목, 2030 타겟의 2026년 한국 온라인 트렌드와 경쟁사 가격/리뷰를 조사해줘."` [theneuralbase](https://theneuralbase.com/cheatsheet/perplexity-api/)
3. Sonar 응답을 다시 Claude/GPT로 넘겨 **최종 “소싱_brief” 또는 “monitor_digest” 형식으로 정리**.

이미지를 직접 Perplexity에 넘길 필요는 없고, **Vision 단계에서 “텍스트화 + 구조화”까지만 잘 하면 충분**합니다. [cursor-ide](https://www.cursor-ide.com/blog/gpt4o-image-api-guide-2025-english)

***

## D. 직원 간 협업

### D8. 산출물 주입 – 전체 vs 의존 그래프 vs 인사이트 보드

세 가지 중 **“의존 그래프 + 인사이트 보드”의 혼합이 최적**입니다.

- **전체 동료 리포트 주입**  
  - 장점: 구현 간단.  
  - 단점: 직원 수·일과 수가 늘면 바로 토큰 폭발 + 노이즈.  
- **하드코딩 의존 그래프**  
  - 예: 광고 ← (소싱, 모니터링, 분석가), SNS ← (소싱, 광고), 상세페이지 ← (소싱, 비주얼).  
  - 장점: 각 직원이 “누구 말을 특히 들어야 하는지” 명확, 토큰 관리 쉬움.  
- **인사이트 보드 중심**  
  - 모든 직원이 `[액션]` 외에 `insight`를 구조화된 레코드로 남기고, 다른 직원은 “최근 7일, 내 역할과 관련된 인사이트 top N만”을 가져다 씁니다.  

권장 구조:

1. 실행 시 **먼저 인사이트 보드에서 필요한 것만 뽑고**,  
2. 그다음 **의존 그래프에 따라 “핵심 동료” 리포트만 1–2줄 요약해서 붙이는** 식.  

즉, “전체 동료 리포트 주입”은 베타 단계에서는 괜찮지만, 운영 규모가 커지면 **의존 그래프 + 인사이트 보드 기반으로 전환하는 게 필연**입니다.

***

### D9. 직원 수 증가 시 토큰/노이즈 관리

스케일을 위해서는 최소한 다음 네 가지를 강제하는 것이 좋습니다.

1. **하드 토큰 예산**  
   - 예: “④ 협업 컨텍스트는 최대 512 토큰, 인사이트는 최근 10개까지만” 같은 룰을 코드 차원에서 강제.  
2. **요약 계층 도입**  
   - 각 직원 리포트는 곧바로 full text로 쓰지 말고,  
   - `summary_for_colleagues`, `summary_for_owner` 같은 2~3줄 요약 필드를 항상 함께 저장.  
   - 협업 프롬프트에는 full 대신 summary만 사용.  
3. **태그 기반 필터**  
   - 인사이트와 리포트에 `topic, product_id, channel` 태그를 붙여,  
   - 예: 광고 직원은 `topic in (USP, offer, creative)` 만, 분석가는 `topic in (KPI, anomaly)` 만 가져가게.  
4. **메타 “오피스 매니저” 에이전트**  
   - 모든 직원 리포트를 모아 **“오늘 회사 전체 상태 요약 + 각 직원에게 중요한 3줄 가이드”**를 만드는 상위 에이전트를 두고,  
   - 각 직원은 동료 리포트 대신 이 매니저 요약만 참조하게 하는 구조도 고려할 수 있습니다.

***

## E. 직원별 레이아웃 – 실무성 강화 포인트

기본 설계는 이미 잘 되어 있고, “실무자 입장에서 바로 쓰이도록” 더해볼 만한 것만 짚겠습니다.

### E10-1. `sourcing_brief`

- 상단에 **“최종 판단 박스 (추천/보류/비추천 + 근거 3줄)”**를 고정 배치하면, 스크롤 없이 결론을 볼 수 있습니다.  
- 경쟁강도 바 옆에는 **“주요 경쟁 키워드 + 대표 경쟁사 3곳”**을 칩으로 보여주면, 바로 검색·리서치로 이어지기 좋습니다.  

### E10-2. `detail_builder`

- 좌측: **전략 브리핑(타겟·USP·주의할 금지표현)** 고정.  
- 우측: 12섹션 아코디언. 각 섹션에는  
  - “현재 버전”, “이전 버전 diff”, “섹션만 재생성” 버튼을 함께 두면, AB 테스트와 수정 이력이 자연스럽습니다.  
- HTML 탭에는 **PC/모바일 미리보기 스니펫**을 함께 보여주면, 사장이 스마트스토어에 붙이기 전 감을 잡기 좋습니다.

### E10-3. `sns_queue`

- 캘린더 뷰 카드에 **썸네일(이미지 브리프 기반 간단 아이콘) + 핵심 후킹 문장 1줄**을 보여주면, 한눈에 “이번 주 무드”가 보입니다.  
- 각 게시물 카드에는 **“발행 채널·UTM 파라미터·담당자”**를 명시해서, 나중에 KPI와 연결하기 쉽게 해두는 것이 좋습니다.

### E10-4. `monitor_digest`

- 경쟁사 비교표에 **“바구니 기준 구매 단가(예: 세트 구성 대비 1인분 가격)”** 같은 실질 단가/구성 비교 칼럼을 추가하면, 바로 가격 전략을 짜기 좋습니다.  
- 트렌드 카드에는 Perplexity 인용 URL 중 상위 3개만 노출하고, 나머지는 “자세히 보기” 아래 접어두면 깔끔합니다. [geol](https://geol.ai/briefing/perplexitys-sonar-pro-api-advancing-real-time-search-with-enhanced-citation-architecture-comparison)

### E10-5. `metric_digest`

- KPI 카드에는 **“예상치 대비 편차(%) + 시그널 강도(🟢/🟠/🔴)”**를 함께 표기하면, 사장이 어디부터 봐야 할지 직관적으로 알 수 있습니다.  
- 이상치 가설 리스트는 **“가설 → 필요한 추가 데이터/실험(할일 자동 생성)”** 구조로 설계하면, 바로 `tasks`와 연결됩니다.

### E10-6. `ticket_list` / `copy_variants` / `image_brief`

- `ticket_list`: “한 번에 답변 복사” 버튼 외에 **“FAQ에 반영” 토글**을 넣어, 반복 질문을 쉽게 지식화.  
- `copy_variants`: 각 세트 옆에 **“선택됨/테스트 예정/폐기” 상태를 토글**하면, 나중에 어떤 카피가 실제로 쓰였는지 추적 가능.  
- `image_brief`: 이미 설계대로, **프롬프트 카드(비율 칩), 촬영컷 체크리스트, 네거티브 안내**만 있어도 실무에 충분합니다. 여기에 **“사용할 이미지 엔진 선택(예: Midjourney, DALL·E)” 드롭다운** 정도만 추가하면 좋습니다.

***

## F. 놓친 것 – 더 있어야 “진짜 한 회사”가 되는 부분

### F11-1. 빠져 있는 직원/기능

- **오피스 매니저(Head of Ops / Owner Copilot)**  
  - 역할: 모든 AI 직원 리포트·KPI를 모아 **“오늘/이번 주 회사 전체 브리핑 + 우선순위 3개”**를 사장에게 제안.  
  - 자동으로 “어떤 직원이 죽어있는지(일과 미실행, 에러)”, “어떤 인사이트가 액션으로 이어지지 않았는지”를 체크해줍니다.
- **데이터 파이프라인/연동 담당 (Integrator)**  
  - 스마트스토어/쿠팡/광고 플랫폼에서 지표를 가져오는 스크립트·엣지 함수 상태를 모니터링하고, 장애·지연을 알려주는 메타 직원.  
- **실험 설계자 (Experiment Planner)**  
  - SNS/광고/상세페이지의 AB 테스트를 설계하고, 분석가 직원과 연동해 “어떤 버전이 이겼는지, 다음 실험은 무엇인지”를 제안.

### F11-2. 시스템 레벨에서 고려할 점

- **자동 평가 루프**  
  - 예: 매주 Sonar+Claude로 “지난주 AI 카피·상세페이지가 브레인 톤앤매너를 얼마나 잘 지켰는지”를 샘플링 체크하는 **QA 루틴**.  
- **버전 관리**  
  - 브랜드 브레인·직원 프롬프트·SOP가 바뀔 때마다 버전과 변경 이유를 로그에 남겨, 나중에 “왜 이 카피가 이런 톤이 되었는지” 추적 가능하게 하는 것.  
- **권한/안전 레벨**  
  - 일부 직원(예: 광고·할인 정책)은 **“제안만 가능, 실제 집행은 사람이 버튼 누르기 전까지 X”**라는 권한 체계를 분명히 해두는 것이 좋습니다.

***

요약하면, 지금 설계는 “회사 단위 AI 오피스”로서 이미 상당히 잘 잡혀 있고, **Perplexity는 모니터링·소싱의 라이브 웹 조사, Claude는 브레인·SOP 기반 구조화 작업, GPT-4o는 고볼륨 크리에이티브**에 배치하는 방향이 맞습니다. [docs.zerotwo](https://docs.zerotwo.ai/models/providers/perplexity)
다음 단계에서는 (1) 협업 컨텍스트를 인사이트 보드+의존 그래프로 정리하고, (2) Vision→Perplexity 2-스텝을 유틸리티로 고정하고, (3) 오피스 매니저/QA 루틴을 추가하는 쪽으로 다듬으면, 진짜 “사장 대신 회사를 굴리는” 수준까지 무리 없이 갈 수 있을 것 같습니다.

# GPT 답변
냉정하게 보면, 지금 설계는 “AI 직원 오피스”의 1차 MVP로는 충분히 강합니다.
다만 지금 상태로 바로 확장하면 깨질 가능성이 큰 지점은 5개입니다.

1. Perplexity를 “분석 모델”처럼 쓰면 안 됨
2. 동료 리포트 전체 주입은 직원 수가 늘면 노이즈 폭탄이 됨
3. 회사 브레인을 한 덩어리 텍스트로만 두면 오래 갈수록 품질이 흔들림
4. 수동/자동 결과물이 같은 daily_reports에만 쌓이면 나중에 찾기 어려움
5. 모델명·비용 표는 지금 기준으로 재검증 필요

특히 2026년 6월 기준으로는 OpenAI 쪽도 GPT-4o 중심이 아니라 GPT-5.5, GPT-5.4-mini/nano 등 최신 API 모델 라인업이 공식 문서에 올라와 있고, OpenAI 이미지 생성도 gpt-image-2가 최신 이미지 생성/편집 모델로 안내되어 있습니다.   Anthropic도 Sonnet/Haiku/Opus 라인과 프롬프트 캐싱·Batch API 할인 구조를 공식적으로 제공하고 있어서, “Claude Sonnet 4 20250514” 같은 고정 모델명은 배포 전 최신 alias/모델 ID로 다시 잡는 게 안전합니다.  

⸻

A. 모델 선택 검증

1. 모니터링·소싱에 Perplexity가 우월한가?

방향은 맞습니다. 단, “조사”에만 우월합니다.

Perplexity Sonar는 웹 검색 기반 답변과 citations를 반환하는 구조라서, 경쟁사 가격, 리뷰 키워드, 최근 트렌드, 신상품 흐름처럼 현재 웹 데이터가 필요한 업무에는 Claude 단독보다 적합합니다. Perplexity 공식 문서도 Sonar는 인용이 포함된 prose answer를, Search API는 구조화된 results[]를 반환한다고 설명합니다.  

하지만 한계가 큽니다.

항목	Perplexity 강점	한계
최근 트렌드	좋음	검색 결과 품질에 따라 흔들림
경쟁사 URL 조사	좋음	로그인/동적 페이지/스마트스토어 일부 정보는 누락 가능
리뷰 분석	제한적	쿠팡/스마트스토어 리뷰 전체 크롤링은 어려움
이미지 기반 제품 분석	부적합	Vision 모델이 아님
브랜드식 기획/카피 정리	Claude/GPT가 더 적합	Perplexity 답변은 조사 보고서 톤이 강함

따라서 결론은 이렇습니다.

소싱/모니터링은 2단계 파이프라인이 맞습니다.

1단계: Perplexity Search/Sonar
- 시장/키워드/경쟁사/가격/리뷰 키워드 조사
- 반드시 citations 저장
2단계: Claude Sonnet 또는 GPT 계열
- 조사 결과를 브랜드 브레인에 맞춰 해석
- 추천/보류/비추천 판단
- 상세페이지·광고·SNS로 넘길 인사이트 정리

특히 “아이템 이미지+설명 분석”은 Perplexity가 아니라 Vision 모델 → Perplexity → Claude/GPT 정리 순서가 맞습니다.

⸻

2. SNS/광고는 GPT-4o vs Claude?

2026년 기준으로는 GPT-4o를 기본 후보로 두기보다 OpenAI 최신 계열을 다시 봐야 합니다. OpenAI 공식 모델 문서에는 GPT-5.5, GPT-5.4-mini/nano 등이 최신 라인업으로 올라와 있고, GPT-4.1은 과거 GPT-4o 대비 instruction following과 long context에서 개선되었다고 발표된 바 있습니다.  

실무 판단은 이렇게 추천합니다.

직원	1순위	이유
SNS 운영	OpenAI 최신 mini급 또는 Claude Sonnet	짧은 변주, 후킹, 플랫폼 톤 테스트에 유리
광고 기획	Claude Sonnet + OpenAI 모델 A/B	Claude는 브랜드 톤 안정, OpenAI는 짧은 카피 변주에 강함
상세페이지	Claude Sonnet	긴 구조화 카피, 섹션별 일관성, 브랜드 톤 유지에 유리
CS	Haiku/mini → Sonnet 승격	분류는 저비용, 민감 답변은 상위 모델

쏠닝님 서비스처럼 브랜드별 톤앤매너가 중요한 1인 브랜드 오피스라면 저는 이렇게 갑니다.

SNS:
- 기본: 저비용 OpenAI mini급 또는 Claude Haiku/Sonnet
- 최종 승인용: Claude Sonnet
광고:
- 카피 초안 10~30개: OpenAI mini급
- 최종 3세트 정제: Claude Sonnet
- 성과 데이터가 쌓이면: winning copy를 RAG로 재주입

즉, GPT vs Claude 하나만 고르는 구조보다 “초안 대량 생성 모델”과 “브랜드 톤 정제 모델”을 분리하는 게 더 실무적입니다.

⸻

3. 비주얼 디렉터 이미지 생성 연동

현재 “프롬프트만 제공”으로 시작하는 건 MVP로 맞습니다. 다만 장기적으로는 직접 생성/편집까지 붙이는 게 훨씬 강합니다.

2026년 기준 OpenAI는 이미지 생성/편집 API에서 GPT Image 모델을 제공하고, 공식 문서상 gpt-image-2가 최신 고품질 이미지 생성/편집 모델로 안내되어 있습니다.  

추천 구조는 이렇습니다.

단계	MVP	확장
1단계	Claude가 이미지 프롬프트/촬영 브리프 생성	가장 쉬움
2단계	OpenAI gpt-image-2로 앱 내 이미지 생성/편집	API 연동 안정적
3단계	Midjourney/나노바나나/Gemini는 외부 워크플로우로 링크	품질 테스트 후 선택
4단계	브랜드별 “이미지 스타일 프리셋” 저장	시목/운명랩/쏠닝포인트별 룩 유지

추천:
앱 안에서 직접 붙일 거면 OpenAI 이미지 API 우선이 현실적입니다. Midjourney류는 퀄리티는 좋아도 공식 자동화/API 운영성이 앱 제품화에는 불리할 수 있습니다. 반대로 쏠닝님 개인 작업용이면 Midjourney/나노바나나를 외부 실행으로 두고, 앱은 “복사용 프롬프트+컷리스트”까지만 해도 충분합니다.

⸻

B. 회사 브레인 & 프롬프트 계층

4. 5겹 프롬프트 계층은 과한가?

과하지 않습니다. 오히려 방향은 좋습니다.
다만 지금 구조는 “텍스트를 계속 붙이는 방식”이라 장기적으로 비효율이 생깁니다.

현재 5겹:

① 회사 브레인
② 타입 베이스 SOP
③ 직원 개별 프롬프트
④ 동료 직원 최근 산출물
⑤ 작업 지시

이 구조 자체는 맞습니다. 문제는 ④ 동료 산출물입니다. 이 부분이 토큰과 품질을 가장 많이 망칠 수 있습니다.

추천 계층은 이렇게 살짝 바꾸는 게 좋습니다.

0. 운영 규칙 / 안전 규칙
1. 회사 브레인
2. 직원 역할 SOP
3. 직원 개별 지시
4. 관련 지식 검색 결과
   - 인사이트 보드
   - 관련 직원 산출물
   - 관련 상품/콘텐츠/성과 데이터
5. 이번 작업 지시
6. 출력 스키마

핵심은 ④를 “전체 주입”이 아니라 “검색된 관련 맥락”으로 바꾸는 것입니다.

Anthropic은 프롬프트 캐싱을 공식 지원하고, active Claude 모델에서 사용 가능하다고 안내하고 있습니다.   그러므로 ①③은 캐싱 대상으로 두고, ④⑤만 매번 바꾸는 구조가 좋습니다.

⸻

5. brand_contexts vs workspace 설정

DB는 brand_contexts 테이블이 맞습니다.
워크스페이스 설정 안에 JSON으로 넣는 것보다 별도 테이블이 낫습니다.

이유는 간단합니다.

방식	장점	단점
workspace 컬럼에 JSON	빠름	버전관리/섹션별 수정/검색/RAG 어려움
brand_contexts 1:1	명확함	처음 설계 조금 필요
brand_knowledge 다건	가장 확장성 좋음	MVP에는 과할 수 있음

추천은 2단계 구조입니다.

brand_contexts
- 회사의 고정 브레인
- 정체성, 타겟, 톤, USP, 금지표현
brand_knowledge_items
- 계속 쌓이는 지식
- 상품정보, 경쟁사, 고객후기, 자주 쓰는 문구, 성과 좋은 카피

즉, 회사 브레인은 헌법이고, knowledge items는 사내 자료실입니다.

⸻

C. 자동 + 수동 UX

6. 직접 시키기와 자동 일과 UI

현재 와이어프레임은 방향이 좋습니다. 다만 “직접 시키기”가 너무 상단에만 있으면 직원 상세가 작업 도구인지, 리포트 뷰어인지 헷갈릴 수 있습니다.

추천 UI는 3탭 구조입니다.

[작업하기] [자동 일과] [기록/리포트]

각 탭 역할:

탭	역할
작업하기	수동 입력, 파일 업로드, 즉시 실행, 최신 결과
자동 일과	루틴 목록, 스케줄, on/off, 마지막 실행 상태
기록/리포트	auto/manual 결과 전체 아카이브

직원 상세 첫 화면은 직원 타입에 따라 달라져야 합니다.

예를 들어 상세페이지 제작자는 “작업하기”가 메인이고, 모니터링은 “최근 모니터링 리포트”가 메인일 수 있습니다.

또 하나 중요한 점은 자동 결과와 수동 결과의 저장 테이블을 분리 또는 최소한 타입을 강하게 구분해야 합니다.

현재 daily_reports에 trigger, input, kind를 추가하는 건 MVP로 가능하지만, 장기적으로는 아래가 더 좋습니다.

staff_runs
- 실행 단위 원장
- trigger: auto/manual
- status, provider, model, token_usage, cost, error
staff_outputs
- 실제 산출물
- output_kind
- content_md
- content_json
- source_run_id
daily_reports
- 하루 요약용 뷰 또는 집계 결과

daily_reports가 모든 것을 담으면 나중에 “상세페이지 초안만 모아보기”, “광고 카피만 비교하기”, “실패한 실행 재시도”가 힘들어집니다.

⸻

7. 이미지+설명 분석은 어떻게 넘기나?

수동 아이템 분석은 이렇게 가야 합니다.

사용자 이미지 업로드
→ Supabase Storage 저장
→ Vision 모델에 이미지 URL 또는 base64 전달
→ 제품 속성 추출
→ Perplexity로 시장/경쟁 조사
→ Claude/GPT로 최종 분석 리포트 생성

이미지 분석 가능 모델은 크게 다음 계열입니다.

용도	적합 모델
제품 이미지 이해	Claude Vision, OpenAI multimodal 모델
이미지 기반 카피/분석	Claude Sonnet, OpenAI GPT 계열
실제 이미지 생성/편집	OpenAI GPT Image, Gemini/Midjourney류
웹 조사	Perplexity Sonar/Search

중요한 점은 Vision 결과를 구조화 JSON으로 먼저 뽑는 것입니다.

예:

{
  "product_type": "티크 원목 도마",
  "visible_material": "wood",
  "shape": "rectangular",
  "style": ["natural", "kitchen", "premium"],
  "possible_use_cases": ["플레이팅", "요리 준비", "신혼집 선물"],
  "uncertainties": ["실제 목재 종류는 이미지로 확정 불가"]
}

그다음 Perplexity에는 이미지를 보내지 말고, 이 JSON을 검색 쿼리로 변환해 보내야 합니다.

⸻

D. 직원 간 협업

8. 전체 동료 리포트 주입 vs 의존 그래프 vs 인사이트 보드

현재 전체 동료 리포트 주입은 MVP까지만 괜찮습니다.
직원 8명까지도 며칠 지나면 노이즈가 많아집니다.

최적안은 혼합형입니다.

1. 인사이트 보드 = 공용 장기 기억
2. 의존 그래프 = 기본 참조 범위
3. 검색/RAG = 이번 작업과 관련 있는 것만 추가

예를 들어:

실행 직원	기본 참조
광고	모니터링, 소싱, 분석가 인사이트
SNS	광고, 비주얼, 모니터링 인사이트
상세페이지	소싱, 비주얼, CS 후기
소싱	모니터링, 분석가
CS	상품정보, 상세페이지, 정책
분석가	판매/KPI, 광고/SNS 성과
비주얼	상세페이지, SNS, 브랜드 브레인

즉, 코드에 staff_dependency_map을 둡니다.

const staffContextMap = {
  ad: ['monitor', 'sourcing', 'analyst'],
  sns: ['monitor', 'visual', 'ad'],
  detail_page: ['sourcing', 'visual', 'cs'],
  sourcing: ['monitor', 'analyst'],
  monitor: ['sourcing'],
  analyst: ['ad', 'sns', 'sales'],
  visual: ['detail_page', 'sns'],
  cs: ['detail_page', 'policy']
}

그리고 최종 주입은 이렇게 합니다.

- 의존 직원의 최근 3개 요약
- 관련 인사이트 상위 5개
- 이번 작업 키워드와 유사한 과거 산출물 3개

이게 가장 안전합니다.

⸻

9. 직원 수가 늘 때 토큰·노이즈 방지

필수 장치가 있습니다.

1. 모든 산출물에 structured summary 저장
2. 인사이트에 태그 저장
3. 임베딩 검색 도입
4. 작업별 context budget 설정
5. 오래된 리포트는 요약본만 사용

예를 들어 daily_reports 또는 staff_outputs에 아래 필드를 추가하세요.

summary text,
tags text[],
entities jsonb,
importance int,
expires_at timestamptz,
source_staff_type text

expires_at도 중요합니다.
“이번 주 트렌드”는 한 달 뒤 광고에 들어가면 오히려 독이 됩니다.

⸻

E. outputKind별 UI 검증

전체적으로 좋지만, 몇 개는 실무 버튼이 더 필요합니다.

10. outputKind별 추천 보완

outputKind	지금 구성	추가하면 좋은 것
sourcing_brief	분석/키워드/기획	예상 마진, 구매장벽, 검증 액션, 다음 실험
detail_builder	12섹션 에디터	상품정보 원본 잠금, 섹션별 점수, 금지표현 검사
ticket_list	유형/긴급도/답변	환불/교환 정책 연결, 톤 선택, 승인 후 템플릿 저장
sns_queue	캘린더+큐	승인상태, 재활용 콘텐츠, 플랫폼별 변환
copy_variants	카피세트+A/B	금지표현 체크, 채널별 글자수 체크, 성과 기록
monitor_digest	경쟁사 비교+출처	출처 신뢰도, 마지막 확인일, 가격 변동 알림
metric_digest	KPI+차트	전주/전월 대비, 원인가설 신뢰도, 추천 액션
image_brief	프롬프트+컷리스트	브랜드 프리셋, 비율별 프롬프트, 생성 결과 저장

특히 detail_builder는 단순 마크다운 결과보다 JSON 기반 블록 에디터로 저장해야 합니다.

예:

{
  "sections": [
    {
      "title": "첫인상 후킹",
      "core_line": "...",
      "mobile_copy": "...",
      "bullets": [],
      "visual_suggestions": [],
      "objection_handling": "...",
      "cta": "..."
    }
  ]
}

그래야 “섹션별 재생성”이 진짜 가능해집니다.

⸻

F. 놓친 직원·기능·연동

11. 빠진 직원

지금 8개 직원은 좋습니다. 그런데 “진짜 회사”처럼 보이려면 아래 4개가 빠져 있습니다.

직원	필요 이유
상품 매니저/MD	소싱과 상세페이지 사이에서 상품명, 가격, 구성, 옵션 결정
운영 매니저	할일/일정/직원 산출물 정리, 실행 누락 감지
회계/정산 보조	매출, 원가, 광고비, 마진 관리
브랜드 편집장	모든 콘텐츠 톤 통일, 브랜드 언어 사전 관리

특히 지금 설계에서 가장 큰 구멍은 운영 매니저입니다.

현재는 각 직원이 리포트를 만들고 [액션]을 뱉지만, 그 액션이 실제로 완료됐는지 추적하는 “관리자”가 없습니다.

AI 오피스가 회사처럼 느껴지려면 이 직원이 필요합니다.

운영 매니저
- 오늘 생성된 할일 중 미완료 확인
- 직원별 실행 실패/누락 체크
- 사장에게 오늘 꼭 봐야 할 것 3개만 요약
- 중복 할일 병합
- 오래된 인사이트 정리

이 직원이 있어야 “AI 직원들이 말만 하고 끝나는 느낌”이 줄어듭니다.

⸻

가장 큰 구조적 보완점 7개

1. [액션] 파싱은 마크다운보다 JSON으로

현재:

[액션]
일정: YYYY-MM-DD HH:MM | 제목
할일: 제목 | high|medium|low
인사이트: ...

이건 깨질 확률이 높습니다.
모델 출력은 반드시 JSON block 또는 tool schema로 받는 게 좋습니다.

추천:

{
  "report": {
    "title": "...",
    "summary": "...",
    "body": "..."
  },
  "actions": {
    "tasks": [
      {
        "title": "...",
        "priority": "high",
        "due_at": "2026-06-16T09:00:00+09:00"
      }
    ],
    "schedules": [],
    "insights": [
      {
        "title": "...",
        "body": "...",
        "tags": ["원목도마", "관리쉬움"]
      }
    ]
  }
}

⸻

2. 모델 라우팅을 직원 단위가 아니라 “작업 단위”로

지금은 직원별 모델을 고르는 구조입니다.
하지만 실제로는 한 직원 안에도 작업 난이도가 다릅니다.

예:

CS 직원
- 문의 분류: Haiku/mini
- 답변 초안: Sonnet
- 법적/환불 분쟁: Sonnet 상위 또는 인간 확인

DB도 이렇게 가는 게 좋습니다.

staff_model_routes (
  id,
  workspace_id,
  staff_type,
  task_type,
  provider,
  model_id,
  fallback_provider,
  fallback_model_id
)

⸻

3. “승인 전 자동등록”은 위험

직원 [액션]으로 할일/일정/인사이트 자동 등록은 좋습니다.
다만 일정과 할일이 너무 많이 생기면 오히려 피로해집니다.

추천:

항목	처리
인사이트	자동 등록 가능
할일	자동 등록하되 suggested 상태
일정	기본은 승인 후 등록
외부 발행	무조건 승인 필요

즉, 상태값이 필요합니다.

suggested → approved → done / dismissed

⸻

4. 컴플라이언스는 회사 브레인만으로 부족

특히 건강식품 브랜드가 있으면 위험합니다.
“효능 단정 금지” 정도가 아니라 카테고리별 금지표현 룰셋이 필요합니다.

예:

건강식품:
- 치료, 예방, 개선, 완치 표현 금지
- 질병명 직접 소구 금지
- 후기 기반 효능 암시 주의
원목/가구:
- 친환경, 무독성, 100% 천연 등은 근거 필요
- 내구성 평생 보장 식 표현 주의

별도 테이블 추천:

compliance_rules (
  workspace_id,
  category,
  rule,
  severity,
  examples_bad,
  examples_good
)

⸻

5. 인사이트 보드는 “메모장”이 아니라 사내 지식 DB가 되어야 함

인사이트에 최소한 아래 필드가 있어야 합니다.

source_staff
source_url
confidence
valid_until
related_products
related_channels
used_by_outputs

그래야 광고/SNS/상세페이지가 “근거 있는 인사이트”를 가져다 씁니다.

⸻

6. 수동 작업 결과는 “재사용 가능한 자산”으로 저장

예를 들어 광고 카피를 만들었으면 단순 리포트가 아니라 content_assets가 되어야 합니다.

content_assets (
  workspace_id,
  type, -- ad_copy, sns_post, detail_section, image_prompt
  title,
  body,
  status, -- draft, approved, used, archived
  source_run_id,
  performance_json
)

그래야 나중에 “성과 좋았던 카피 기반으로 다시 만들어줘”가 가능합니다.

⸻

7. 비용 추산은 다시 잡아야 함

문서의 월 $40~45 추산은 방향성은 가능하지만, 실제로는 Perplexity request fee, search context size, 이미지 입력, 재생성 횟수, 실패 재시도, 캐싱 적용률에 따라 많이 달라집니다. Perplexity 공식 가격 문서도 Sonar 계열은 request 단위 search context size별 비용이 있고, Sonar Pro/Reasoning Pro의 요청 비용이 context size에 따라 달라집니다.   Anthropic Batch API는 50% 할인 구조가 있어 비동기 대량 작업에는 유리하지만, 즉시 응답이 필요한 수동 작업에는 적합하지 않습니다.  

⸻

최종 추천 아키텍처

지금 설계를 이렇게 바꾸면 훨씬 제품답습니다.

[회사 브레인]
brand_contexts
brand_knowledge_items
compliance_rules
[직원]
staff
staff_routines
staff_model_routes
[실행]
staff_runs
staff_outputs
staff_output_actions
[공유 지식]
insights
content_assets
metric_snapshots
[협업]
dependency_map
retrieval_context_builder

실행 흐름은 이렇게요.

1. 사용자가 수동 실행 또는 cron 자동 실행
2. staff_run 생성
3. context_builder가 필요한 맥락만 수집
   - 회사 브레인
   - SOP
   - 직원 프롬프트
   - 관련 인사이트
   - 의존 직원 최근 요약
4. task_router가 모델 선택
   - Vision 필요 여부
   - Web 필요 여부
   - 고품질 카피 여부
   - 저비용 분류 여부
5. 모델 실행
6. JSON schema로 결과 수신
7. staff_output 저장
8. actions는 suggested 상태로 생성
9. 브리핑/기록/대시보드에 반영

⸻

직원별 모델 라우팅 최종안

직원	최종 추천
소싱	Vision 모델로 제품 파악 → Perplexity로 시장조사 → Claude Sonnet으로 기획
상세페이지	Claude Sonnet 기본, 중요한 대표 상품만 Opus/상위 모델 옵션
CS	분류 Haiku/mini, 답변 Sonnet, 민감 문의는 인간 승인
SNS	초안 대량 생성 OpenAI mini급, 브랜드 톤 정제 Claude Sonnet
광고	OpenAI mini급으로 변주, Claude Sonnet으로 최종 3세트 정리
모니터링	Perplexity Search/Sonar + 결과 정규화
분석가	Claude Sonnet, 단순 KPI 요약은 mini/Haiku
비주얼	Claude Sonnet으로 브리프, OpenAI gpt-image-2로 앱 내 생성/편집 옵션

⸻

우선순위 로드맵

1순위 — 반드시 먼저

* brand_contexts 추가
* 수동 실행 UI
* staff_runs / staff_outputs 분리
* JSON 출력 스키마
* Perplexity 조사 + Claude 정리 2단계

2순위 — 제품성이 크게 올라감

* outputKind별 JSON 저장
* 인사이트 보드 태그/신뢰도/유효기간
* 의존 그래프 기반 협업
* 승인형 액션 큐

3순위 — 진짜 회사 느낌

* 운영 매니저 직원 추가
* 브랜드 지식 DB/RAG
* 성과 기반 카피 재학습
* 이미지 생성 API 연동
* 채널 발행/댓글/스마트스토어 연동

⸻

결론

이 설계는 “AI 직원이 있는 회사”라는 컨셉으로 충분히 설득력 있습니다.
다만 지금의 핵심 위험은 “AI가 많이 말하는 시스템”은 되지만, 실제로 회사 운영 자산이 쌓이는 시스템이 되지 못할 수 있다는 점입니다.

그래서 방향은 이렇게 잡는 게 좋습니다.

직원 리포트 중심
→ 실행 기록 중심
→ 재사용 가능한 산출물 중심
→ 인사이트/성과가 누적되는 회사 지식 중심

한 문장으로 정리하면:

Perplexity는 눈, Claude/GPT는 두뇌, brand_contexts는 회사의 헌법, insights/content_assets는 회사의 기억으로 분리해야 합니다.

# 클로드 답변
# AI 직원 오피스 설계 검증 리포트
**1인 사업가 자체 브랜드(이커머스·라이프스타일·건강식품·원목가구) 운영용 — 작성/기준일 2026년 6월 15일**

> 본 리포트의 모든 가격·스펙·정책·규제는 2026년 6월 15일 기준이며, 특히 LLM 가격은 분기마다 바뀐다. 배포 직전 각 제공사 공식 페이지(Anthropic/OpenAI/Google/Perplexity), 네이버 커머스API센터·쿠팡 Open API 공지, 식약처 식품표시광고법 최신 고시를 반드시 재확인할 것.

---

## TL;DR (핵심 3가지)

- **모델 라우팅의 방향은 맞지만 버전이 낡았고 "1직원=1모델" 고정이 비효율의 핵심이다.** 설계서의 GPT-4o·구 Sonnet은 이미 구세대다. 현행(2026.6) 라인업으로 교체하고 모델을 직원이 아니라 **작업(task) 단위로 라우팅**하라. 동시에 설계서에 빠진 **프롬프트 캐싱**(Anthropic 캐시 읽기 = 표준 입력가의 0.10×, 즉 90% 절감)을 정적 프롬프트 계층(①회사브레인+②SOP+③직원프롬프트)에 적용하면 비용이 급감한다.
- **두 가지 설계 전제가 깨졌다 — (a) Perplexity는 이제 Vision을 지원하고, (b) 이미지 생성은 앱이 직접 할 수 있다.** Perplexity Sonar/Sonar Pro는 이미지 입력을 공식 지원하므로 "Vision 없음" 전제는 틀렸다(다만 정밀 식별은 Claude/Gemini가 우수해 2-스텝은 여전히 권장). 이미지 생성은 Imagen 4 Fast(장당 약 $0.02)·Nano Banana·gpt-image-1을 **공식 API로 직접 호출**하는 것이 정답이며, 미드저니는 공식 공개 API가 없어 자동화에서 제외해야 한다.
- **"진짜 회사"가 되려면 빠진 4가지는 (a) 사장 승인 게이트(HITL)+감사로그·롤백, (b) 한국 이커머스 API 현실(주문/재고/정산), (c) 건강기능식품 광고 규제 가드레일, (d) 비용 관측·예산 가드다.** 특히 건강식품은 식약처가 「식품표시광고법」 개정(2026년 4월 23일 국회 통과, 4월 26일 공포, 공포 후 6개월 시행)으로 **AI 생성 가짜 전문가 광고를 명시적 부당광고로 금지**했고 위반 시 5년 이하 징역 또는 5,000만원 이하 벌금 — 시스템에 규제 가드레일이 반드시 필요하다.

---

## Key Findings (요약 5선)

1. **모델은 작업 단위 라우팅 + 캐싱이 핵심.** 현행 가격: Claude Sonnet 4.6 $3/$15·Opus 4.8 $5/$25·Haiku 4.5 $1/$5, GPT-5.5 $5/$30·GPT-5.4 $2.50/$15, Gemini 3.1 Pro $2/$12, Perplexity Sonar Pro $3/$15.
2. **소싱·모니터링은 Perplexity(수집·인용)→Claude(분석) 2단이 옳다.** Perplexity는 검색 특화일 뿐 추론·판단은 약하며 "인용 환각"(URL은 실재, 내용 날조) 위험이 있다.
3. **카피는 갈래 분리:** 브랜드 보이스·지시 준수·한국어 품질 = Claude, 변형 대량·후킹·전환 = GPT-5.4.
4. **5겹 프롬프트 계층은 구조는 옳으나 ④동료 산출물 전체 주입과 캐싱 부재가 비용·노이즈 폭탄.** ④는 "구조화된 인사이트 공용 보드"로 슬림화.
5. **회사 브레인은 RAG가 아니라 brand_contexts 테이블 + 긴 컨텍스트 직접 주입 + 캐싱이 정답.** fine-tuning·벡터DB는 과잉.

---

# A. 모델 선택

## Q1. 직원별 모델 라우팅이 맞나? 모니터링·소싱에 Perplexity Sonar Pro가 정말 우월한가? 한계는?

**(1) 결론** — 모니터링·소싱의 "실시간 웹조사" 부분에 한해 Perplexity Sonar Pro는 합리적이다. 웹검색+인용이 토큰 가격에 포함되어("GPT/Claude + 별도 검색툴" 대비 시간·비용 유리) 적합하다. 그러나 **"우월"이 아니라 "검색 특화"**일 뿐이며 추론·기획·카피는 Claude/GPT가 낫다. 따라서 소싱/모니터링도 **2단(Perplexity 수집 → Claude 분석·기획)**이 맞다.

**(2) 근거/데이터 (2026년 6월 기준):**

| 모델 | 입력/출력 ($/1M) | 컨텍스트 | Vision | 실시간 검색 | 비고 |
|---|---|---|---|---|---|
| Perplexity Sonar Pro | $3 / $15 | 200K | 예(이미지 입력) | 예(검색·인용 내장) | SimpleQA F=0.858 |
| Perplexity Sonar | 약 $1 / $1 | 128K | 예 | 예 | 경량·저가 |
| Claude Sonnet 4.6 | $3 / $15 | 1M | 예 | 아니오(툴 별도) | 추론·문서이해 우수 |
| Claude Opus 4.8 | $5 / $25 | 1M | 예 | 아니오 | 최상위 추론/코딩 |
| Claude Haiku 4.5 | $1 / $5 | 200K | 예 | 아니오 | 분류·저가 고속 |
| GPT-5.5 | $5 / $30 | 1.1M | 예 | 툴 별도 | 카피·구조화 강점 |
| GPT-5.4 | $2.50 / $15 | 1.1M | 예 | 툴 별도 | 가성비 워크호스 |
| Gemini 3.1 Pro | $2 / $12 (≤200K) | 1M | 예 | Google 그라운딩 별도 | 멀티모달·가성비 |

- Perplexity 공식 블로그(Introducing the Sonar Pro API): "Sonar Pro leads this benchmark with an F-score of 0.858, while Sonar received an F-score of 0.773." 매 응답에 인용 URL을 메타데이터로 반환하며, 2026년 4월부터 Sonar/Sonar Pro의 citation 토큰 과금이 폐지됐다.
- **핵심 한계:** 인용 URL은 실재하나 그 출처에 없는 내용을 생성하는 "인용 환각"이 보고된다(한 평가에서 인용 다수가 부정확). 코딩·장기추론 벤치마크를 공개하지 않을 만큼 추론 특화 모델이 아니다 — **데이터 수집엔 강하나 전략적 판단은 약하다.**
- 모니터링(가격/경쟁사/리뷰 추적)은 실시간성이 본질이라 적합하나, 한국 커머스(스마트스토어·쿠팡)는 공개 웹 인덱싱 한계로 정확도가 들쭉날쭉할 수 있다.

**(3) 권장안**
- 소싱·모니터링 = **Perplexity Sonar Pro(수집/인용) → Claude Sonnet 4.6(소싱 브리프)** 2단.
- 비용 민감 시 1차 수집은 Sonar(저가), 심층 건만 Sonar Pro.
- Perplexity 출력은 인용 URL을 daily_report에 함께 저장해 사장이 검증 가능하게 할 것.

## Q2. SNS/광고 카피는 GPT vs Claude(Sonnet) 중 무엇이 나은가?

**(1) 결론** — **갈래를 나눠라.** 브랜드 보이스 일관성·자연스러운 장문·지시 준수가 중요한 상세페이지/브랜드 카피는 **Claude Sonnet 4.6**, 다수의 짧은 변형(헤드라인/후킹)·아이디어 발산·전환 최적화는 **GPT-5.4(또는 5.5)**가 낫다. 둘 다 두고 작업별 라우팅이 정답.

**(2) 근거/데이터**
- 전문가 블라인드 평가에서 Claude 카피는 가독성(8.2 vs 7.1)·설득력(7.9 vs 7.2)이 높았고, GPT는 창의적 어필(8.1 vs 7.0, "예상 밖 앵글/기억에 남는 후크")이 높았다.
- 일관된 결론: **Claude = 브랜드 가이드 준수·톤 일관성·편집 최소화 / GPT = 속도·변형 대량·전환 카피.** Gemini는 카피 품질은 한 단계 아래지만 실시간 검색 그라운딩으로 SEO·트렌드 카피에 강점.
- **한국어:** Claude Opus/Sonnet 계열은 영→한 품질에서 최상위권으로 독립 평가(WMT24·Intento 등)에서 한국어 포함 다수 언어쌍에 선정됐다. 한국어 브랜드 카피는 Claude를 1순위로 검증할 것.
- **비용:** Sonnet 4.6 $3/$15 ≈ GPT-5.4 $2.50/$15(거의 동급). GPT-5.5는 $5/$30로 카피 용도엔 5.4가 가성비 우위.

**(3) 권장안**
- SNS(sns) = 기본 GPT-5.4(변형·후킹), 브랜드 보이스 고정 캡션은 Claude Sonnet 4.6.
- 광고(ad) = 카피 다양성 GPT-5.4, 최종 브랜드 톤 다듬기 Claude.
- 상세페이지(detail_page) = **Claude Sonnet 4.6 기본**, 고난도 롱폼 스토리텔링은 Opus 4.8.
- 운영 팁: 한국어 카피는 "금지어 리스트(과장·의학적 표현 등)"를 시스템 프롬프트에 박아 Claude의 지시 준수력을 활용(건강식품은 Q11 규제 룰 필수).

## Q3. 비주얼 디렉터 이미지 생성 — 나노바나나/미드저니/DALL·E/Gemini 중 무엇을 어떻게 연동?

**(1) 결론** — **공식 API가 있고 상업 라이선스가 깨끗하며 자동화에 적합한 Google(Imagen 4 / Nano Banana 계열)과 OpenAI(gpt-image-1)를 1순위로 연동하라. 미드저니는 공식 공개 API가 없고 콘텐츠가 기본 공개라 자동 파이프라인에 부적합하다.** 비용이 매우 낮으므로 "프롬프트만 제공" 대신 **API 직접 호출로 이미지까지 생성**하는 것을 권장.

**(2) 근거/데이터 (이미지 생성, 2026년 6월):**

| 모델/서비스 | 공식 API | 가격(이미지당) | 상업 사용 | 워터마크/출처 | 적합도 |
|---|---|---|---|---|---|
| Imagen 4 Fast (Google) | 예 | 약 $0.02 | 허용 | SynthID(비가시, 기본 ON) | 대량 제품컷 최저가 |
| Nano Banana 2 (Gemini 3.1 Flash Image) | 예 | $0.045~$0.151 | 허용 | SynthID | 텍스트·일관성 우수 |
| Nano Banana Pro (Gemini 3 Pro Image) | 예 | $0.134(1K/2K)·$0.24(4K) | 허용 | SynthID(+C2PA, 2차출처) | 최고 품질·4K·다국어 텍스트 |
| OpenAI gpt-image-1 / GPT Image | 예 | 해상도별 | 허용(Output 소유권 사용자 양도) | C2PA + SynthID | 프롬프트 준수·편집 강점 |
| Midjourney v7/v8 | **아니오(공식 공개 API 없음)** | 구독 $10~$120/월 | 유료 구독자만(연매출 $1M↑은 Pro/Mega) | 미문서화 | 자동화 부적합 |

- **라이선스/소유권:** Google 약관 — "Google won't claim ownership over that content." OpenAI 약관 — "you... own the Output. We hereby assign to you all our right, title, and interest, if any, in and to Output." 둘 다 상업적 사용을 계약상 허용. **단 미국법상 순수 AI 생성물은 인간 창작성이 없으면 저작권 보호가 안 되므로(Thaler v. Perlmutter, 2026년 3월경 SCOTUS 상고 불수리) 타인이 복제해도 막기 어렵다 → 핵심 비주얼은 사람 편집을 가미할 것.**
- **워터마크:** Google은 SynthID 비가시 워터마크 기본 적용(Imagen `addWatermark` 기본값 true), API/Vertex 출력엔 보이는 로고 없음. OpenAI Help Center: "Images generated with ChatGPT, Codex, and our API include both C2PA metadata and SynthID watermarks"(메타데이터는 스크린샷 등으로 제거 가능, SynthID는 더 견고).
- **미드저니:** 2026년 3월 기준 일반 개발자용 공개 API 없음. 서드파티 "미드저니 API"는 전부 비공식(Discord 자동화)·ToS 위반·계정정지 위험. 콘텐츠가 기본 공개(remix 가능)이고 Stealth는 상위 플랜 전용 → 자체 브랜드 비주얼 유출 위험.
- **품질 참고:** Nano Banana 2는 텍스트→이미지 벤치마크 1위권·제품 일관성 우수, Imagen 4 Fast는 최저가 고품질.

**(3) 권장안**
1. **기본:** Vertex AI(또는 Gemini API)로 **Imagen 4 Fast(대량 저가)** + **Nano Banana Pro(히어로컷 4K·텍스트 합성)** 2단. 장당 $0.02~$0.24로 무시 가능 → 앱이 직접 생성.
2. **대안/보강:** OpenAI gpt-image-1(프롬프트 준수·편집·C2PA 출처 필요시).
3. **역할:** "프롬프트만 제공"이 아니라 (a) 브랜드 톤 반영 프롬프트 → (b) API 호출로 후보 4~6장 생성 → (c) image_brief에 후보+선택지+편집지시 → (d) **사장 승인 후 채택**. 미드저니가 꼭 필요하면 사람이 수동으로 쓰는 보조 도구로만.
4. **건강식품 주의:** 생성 이미지로 효능·치료 암시 연출 금지(Q11).

---

# B. 회사 브레인 & 프롬프트 계층

## Q4. 5겹 프롬프트 계층이 과한가/부족한가? (토큰·품질 트레이드오프)

**(1) 결론** — **계층 구조 자체는 옳고 과하지 않다. 단 ④동료 산출물 전체 주입과 캐싱 부재가 비용·노이즈 폭탄.** ①②(회사브레인·SOP)는 정적이므로 캐싱, ④는 전체 주입 대신 "구조화 요약/인사이트 보드"로 축소.

**(2) 근거/데이터**
- 멀티에이전트 연구(2026): 동료 산출물 통째 누적 주입은 후속 에이전트로 갈수록 신호 대 잡음비가 악화. 권장은 **구조화된 컨텍스트 객체** — 전체 대화 주입(5K~20K토큰) vs 구조화 객체(200~500토큰).
- 프롬프트 캐싱(Anthropic 공식): 캐시 읽기 = 표준 입력가의 **0.10×(90% 할인)**, 캐시 쓰기 = 5분 TTL 시 1.25×·1시간 TTL 시 2.0×. 예) Sonnet 4.6 입력 $3.00/M → 캐시 읽기 $0.30/M, 손익분기 약 2회 읽기. OpenAI는 캐시 입력 50~90% 절감, Google도 캐시 ~10% 수준.
- **주의(Anthropic):** "Cached entries have a minimum lifetime of 5 minutes (standard) or 1 hour (extended)"; 캐시 최소 토큰 Haiku 1,024 / Sonnet·Opus 2,048, breakpoint 최대 4개. cron이 5~15분 간격이면 캐시 미스로 쓰기 비용만 낼 수 있으니 일과를 묶어 연속 호출하거나 1시간 TTL을 쓸 것.

**(3) 권장안 (개선된 계층)**
- ①회사브레인 + ②타입SOP → **하나의 정적 시스템 블록으로 합쳐 캐싱**(거의 안 변함, Sonnet 기준 2,048토큰 이상이면 캐시 적격).
- ③직원 개별 프롬프트 → 정적, 캐시 가능.
- ④동료 산출물 → **전체 리포트 금지. 공용 인사이트 보드에서 관련 항목만 구조화 주입**(요약 200~500토큰).
- ⑤작업 지시 → 동적, 캐시 대상 아님 → **프롬프트 맨 뒤 배치**(정적 프리픽스 캐시 보존).

## Q5. 회사 브레인을 brand_contexts 테이블 vs 워크스페이스 설정 어디에? 더 나은 "이해" 방법?

**(1) 결론** — **별도 brand_contexts 테이블이 맞다.** 회사 정체성은 작고(수천 토큰) 안정적이며 직원 전체가 공유하는 1급 데이터이므로 워크스페이스 설정 JSON에 묻기보다 전용 테이블+버전관리가 낫다. "이해" 방법은 **RAG 불필요 — 구조화 컨텍스트를 긴 컨텍스트로 직접 주입 + 캐싱**. fine-tuning은 부적합.

**(2) 근거/데이터**
- RAG vs 긴 컨텍스트: 코퍼스가 작고 안정적이면 "전부 프롬프트에 넣기"가 더 단순·빠르고 유지보수 쉽다. RAG는 (a) 코퍼스가 크거나 (b) 자주 바뀌거나 (c) 출처추적/규모가 필요할 때 정당화 — 회사 정체성은 셋 다 아님. 한 가이드: "2026년 RAG 파이프라인의 최소 1/3은 만들지 말았어야 했다."
- fine-tuning은 1회 $2,000~$50,000 + 갱신 시 재학습 지연 → 가끔 바뀌는 브랜드 정체성엔 비합리적.
- 구조화 이점: 회사 브레인을 **필드(미션/톤·보이스/금지어/타깃/핵심가치/카테고리별 규칙)**로 구조화하면 직원별 필요한 필드만 선별 주입 → 토큰 절감 + 일관성↑.

**(3) 권장안**
- `brand_contexts`: workspace_id FK, 구조화 필드(JSONB) + version + updated_at.
- 실행 엔진이 이를 읽어 **정적 시스템 블록으로 캐싱**.
- 회사 브레인엔 RAG 금지. 단 **상품 카탈로그·과거 daily_report·CS 히스토리처럼 커지고 자주 바뀌는 데이터**가 쌓이면 그쪽에만 RAG(Supabase pgvector) 도입.
- 정체성이 수만 토큰으로 커지면 "요약본 캐시 주입 + 상세본 RAG" 하이브리드로 전환.

---

# C. 자동 + 수동 UX

## Q6. "직접 시키기"(수동)와 일과(자동 cron)를 한 직원 안에서 어떻게 UI로 구분/통합?

**(1) 결론** — **하나의 직원 상세 화면에 "일과(자동)" 섹션과 "직접 지시(수동)" 입력창을 두되, 실행 결과는 동일한 단일 타임라인(활동 피드)으로 합쳐라.** 트리거(자동/수동)는 각 결과 카드에 배지로 구분.

**(2) 근거/데이터**
- 2026 에이전트 UX 베스트 프랙티스: "자율성은 점진적으로(제안→코파일럿→옵트인 후 자동화)", "사용자가 start/stop/pause/resume 못 하면 자율성을 준 게 아니라 뺏은 것", "모든 에이전트 액션은 액션 영수증(무엇이/어디서/어떤 권한으로 바뀌었는지 + 롤백 훅)을 남겨야 한다."
- 자동화 도구(Lindy 등)는 스케줄/지연 실행과 수동 트리거를 같은 워크플로 위에 얹는다 — **트리거는 분리, 실행 로직·결과 뷰는 통합**이 표준.

**(3) 권장안 (구체 UI)**
- 직원 상세 = 상단 "오늘의 일과(자동)" 카드(다음 실행 시각·on/off·미리보기) + 하단 "지금 시키기" 입력창.
- 결과는 **활동 타임라인 하나**로: 카드마다 `🕒 자동(일과)` / `👤 수동(사장)` 배지 + 사용 모델 + 토큰/비용 + 파싱된 [액션] 결과.
- **민감 액션(외부 게시·광고비 집행·CS 발송)은 "초안→사장 승인" 게이트(HITL)**.
- on/off·일과 편집·"이번 건만 건너뛰기"를 카드에서 바로 제어.

## Q7. 아이템(이미지+설명) 분석 — 이미지를 어떻게 모델에 넘기나? 어떤 모델이 Vision? Perplexity가 Vision 없으면 2-스텝이 맞나?

**(1) 결론** — **이제 Perplexity Sonar/Sonar Pro도 Vision을 지원하므로 "Perplexity는 Vision이 없다"는 전제는 틀렸다.** 그럼에도 **2-스텝(Vision으로 제품 파악 → Perplexity로 시장조사)은 여전히 더 나은 설계** — 정밀 식별/속성 추출은 Claude/Gemini/GPT Vision이 우수하고, Perplexity는 인용 환각 위험이 있어 "검색·출처" 역할로 두는 분업이 안전하다.

**(2) 근거/데이터**
- Perplexity 공식 문서(Image Attachments with Sonar): "Sonar models support image analysis through direct image uploads... base64 encoded strings within a data URI or as standard HTTPS URLs." base64는 이미지당 최대 50MB(PNG/JPEG/WEBP/GIF), 512×512 ≈ 349토큰으로 입력 단가 과금.
- Vision 가능: Claude(Sonnet/Opus, Opus 4.7은 3.75MP 고해상도), GPT-5.4/5.5, Gemini 3.1 Pro 모두 지원.
- Vision 품질(2026): GPT-5는 차트/도표/OCR·스크린샷 최강, Claude Opus는 스크린샷·PDF·문서 레이아웃 강함, Gemini는 사진·제품 이미지·네이티브 OCR 강함(조밀 도표엔 변동성). → **제품 사진(라이프스타일/가구/패키지) 분석엔 Gemini 또는 Claude 적합.**
- Perplexity 한계: 인용 URL은 실재하나 내용 날조 사례 → 제품 "사실 식별"을 단독으로 맡기면 위험.

**(3) 권장안 (2-스텝 유지, 역할 명확화)**
1. **STEP 1 (Vision):** 업로드 이미지+설명 → **Gemini 3.1 Pro 또는 Claude Sonnet 4.6 Vision**으로 카테고리·소재·디자인 속성·텍스트(OCR) 구조화 추출(JSON).
2. **STEP 2 (검색):** STEP 1 속성을 쿼리로 **Perplexity Sonar Pro**에 넘겨 시장가·경쟁사·트렌드를 인용과 함께 수집.
3. **STEP 3 (종합):** Claude Sonnet 4.6가 소싱 브리프로 종합.
- 비용: 단순 분류는 Haiku/Gemini Flash-Lite로 충분. 이미지를 Perplexity에 직접 넣는 단축경로는 "출처가 꼭 필요하고 정밀 식별이 덜 중요한" 경우에만.

---

# D. 직원 간 협업

## Q8. 동료 산출물 주입 — 전체 리포트 vs 하드코딩 의존 그래프 vs 인사이트 공용 보드, 최적안은?

**(1) 결론** — **"인사이트 공용 보드(구조화된 공유 메모리)"가 최적.** 전체 리포트 주입은 토큰·노이즈 폭증, 하드코딩 의존 그래프는 경직성으로 확장성 저하. 보드 + 가벼운 의존 힌트 하이브리드가 정답.

**(2) 근거/데이터**
- 권장 패턴: **구조화된 컨텍스트 객체**가 가장 토큰 효율적이며 대부분 프레임워크(LangGraph typed state, CrewAI shared memory)가 채택 — 전체 대화 포워딩(5K~20K) 대비 200~500토큰.
- 중앙집중 오케스트레이터는 토큰 오버헤드 약 285%, 독립 동료 통신도 약 58%. 무분별한 상호주입은 비싸다.
- "컨텍스트 오염": N개 에이전트가 한 윈도에서 경쟁하면 품질 저하 → 격리·선별 주입이 핵심.

**(3) 권장안 (스키마)**
- `insights` 테이블: id, workspace_id, author_employee, type(가격변동/경쟁사/CS이슈/트렌드/소재 등), summary(≤300토큰), payload(JSONB), tags, created_at, relevance_score.
- ④계층 = "본인 typeKey/태그에 매칭되는 최신 인사이트 N건만" 구조화 주입(예: 광고 기획자는 analyst의 "전환율/CTR" 인사이트만, CS는 monitor의 "리뷰 불만"만).
- 가벼운 의존 힌트(코드 상수): "ad는 analyst·sns 우선 참조" 같은 우선순위만, 실제 내용은 보드에서 동적 선별 → 하드코딩 의존 그래프의 경직성 회피.

## Q9. 직원 수가 늘면 협업이 토큰·노이즈로 깨지지 않게 하려면?

**(1) 결론** — **(1) 동료 컨텍스트는 항상 "선별·요약·격리", (2) 모델 라우팅으로 단순작업은 소형 모델, (3) 인사이트 보드에 TTL·관련도 필터, (4) 중앙집중 대신 이벤트/보드 기반 비동기 협업**이면 깨지지 않는다.

**(2) 근거/데이터**
- 컴퓨트 정규화 연구(2026): 동일 컴퓨트 예산이면 단일 에이전트가 멀티에이전트를 추론에서 종종 능가 → "에이전트 수"가 아니라 "역할 특화가 실익이 있을 때만" 늘려야 함.
- 모델 라우팅: 단순 작업은 Haiku/Mini/Flash-Lite, 어려운 작업만 플래그십 → 비용 5~10배 절감.
- 요약 핸드오프는 70~90% 토큰 절감.

**(3) 권장안**
- ④계층 = "최근 N일 + 관련도 상위 K건 + 요약본"으로 상한선 고정(직원당 ≤1,500토큰).
- 보드 항목에 TTL(가격 인사이트 짧게, 브랜드 톤 인사이트 길게).
- 직원 추가 기준: "역할 특화가 분명한 출력 차이를 내는가?" 통과 시에만. 안 되면 기존 직원 프롬프트 확장.
- 협업은 직원→직원 직접 호출(중앙집중) 대신 **보드에 쓰기 → 다음 cron에서 관련 직원이 읽기**의 비동기 이벤트 패턴.

---

# E. 직원별 레이아웃 (Q10)

**(1) 결론** — outputKind별로 "실무자가 바로 결정·실행할 수 있는" 뷰가 핵심. 공통 골격(헤더: 트리거 배지/모델/비용/시각 + 본문 + [액션] 결과 + 사장 승인 버튼) 위에 종류별 특화 컴포넌트를 얹는다.

**(2)·(3) 종류별 핵심 + 권장:**

| outputKind | 보여줘야 할 핵심(실무 우선) |
|---|---|
| **sourcing_brief** | 후보 카드(썸네일·예상원가·마진·MOQ), 시장가/경쟁사 비교표, 수요·트렌드 근거(Perplexity 인용 링크), "추진/보류" 결정 버튼, 리스크 플래그 |
| **detail_builder** | 섹션별 카피 블록(후킹/혜택/스펙/FAQ), 톤·금지어 준수 체크, 이미지 슬롯(image_brief 연동), 길이/SEO 키워드, 복사·바로 발행, 버전 비교 |
| **sns_queue** | 예약 캘린더(날짜/시간/채널), 캡션+해시태그+이미지 미리보기, 변형 A/B, 채널별 글자수 검증, 승인→예약 토글 |
| **monitor_digest** | 변화 우선(가격↑↓·재고·신규 경쟁·리뷰 급변) 델타 강조, 출처 링크·타임스탬프, "대응 필요" 상단 고정, 알림 임계치 설정 |
| **copy_variants** | 변형 매트릭스(헤드라인×설명), 예상 CTR/톤 라벨, 채널 타깃, 선택·내보내기 체크박스, 일괄 복사 |
| **ticket_list** | CS 큐: 분류(반품/문의/불만)·우선순위·감정, 추천 답변 초안(편집 가능), "발송 전 승인" 게이트, SLA 타이머, 매크로 |
| **metric_digest** | KPI 카드(매출/전환/CAC/재고회전)+전기간 대비 델타, 이상치 알림, "왜?" 코멘터리(analyst), 다음 액션 제안, 기간 필터 |
| **image_brief** | 생성 후보 4~6장 그리드, 채택/재생성/편집지시, 프롬프트 노출·복사, 해상도/용도(썸네일/상세/광고), 승인→detail_builder 연동, SynthID/출처 표기 |

모든 뷰 공통: (1) 트리거 배지(자동/수동), (2) 비용·모델 메타, (3) 사장 1클릭 승인/반려, (4) [액션] 자동등록 결과(일정/할일/인사이트) 인라인, (5) 공통 푸터 "원클릭 재실행 + 지시 수정".

---

# F. 놓친 것 (Q11)

**(1) 결론 — "진짜 한 회사"가 되려면 다음이 빠졌다(우선순위 순):**

1. **사장 승인/검수 게이트(HITL) + 액션 실행 로그·롤백.** 현재 [액션] 자동등록은 좋으나, **외부 영향 액션(상품 발행·SNS 게시·광고비 집행·CS 답변 발송)은 "초안→승인→실행" + 감사 로그(누가/언제/무엇/롤백 훅)**가 필요(2026 에이전트 UX 핵심 원칙).

2. **한국 이커머스 연동 현실(빠진 "운영" 직원/기능).** 자체 브랜드 운영의 본질인 **주문·재고·정산·배송** 자동화가 설계서에 없다.
   - 네이버 커머스API: '내스토어 애플리케이션'은 **판매자 본인 연동 전제**, 초당 약 2회(2/s) 제한, 서드파티가 판매자 앱 정보를 위탁·수집하면 약관 위반. 솔루션/대행사 애플리케이션은 별도 자격 필요.
   - 쿠팡 Open API: OpenAPI 키 유효기간 180일(만료 시 연동 자동 해지), Rate limit 정책(2026년 3월 최적화·조정), API 정보수정 주 10회 제한, 안심번호(050)는 알림톡 불가.
   - **경쟁사 데이터:** 공식 API로 경쟁사 데이터는 못 가져오며 무단 크롤링/아이디·비번 연동은 약관 위반·차단 대상. 모니터링의 "경쟁사 추적"은 공개 웹/가격비교 수준으로 한정하고 한계를 명시.
   - → "운영 매니저(orders/inventory)" 직원/기능 추가 + 플랫폼 제약 반영.

3. **건강기능식품 광고 규제 가드레일(법적 리스크 최상).** 식약처는 「식품표시광고법」을 개정(**2026년 4월 23일 국회 본회의 통과, 4월 26일 공포, 공포 후 6개월 시행**)해 **AI 생성 콘텐츠로 의사·약사·대학교수 등 전문가가 식품을 추천·사용하는 것처럼 보이게 하는 광고를 부당광고로 명시**했고, 위반 시 **5년 이하 징역 또는 5,000만원 이하 벌금**이다. 실제 단속 사례: AI로 만든 가상 '성형외과 원장'을 내세워 비타민C·효모 등 일반식품을 '역노화·신체나이 감소' 효과로 광고, **2025년 9월~2026년 5월 약 9개월간 약 65만 개 판매·81억원 매출**을 올린 유통업체가 식품표시광고법 위반 혐의로 **검찰 송치**됐다(2026.6.10 발표). → **카피·이미지 생성 직원에 건강식품 카테고리 전용 금지어·금지 표현(질병 치료·예방 암시, 일반식품의 건강기능식품/의약품 오인)·금지 연출(가짜 전문가) 룰을 강제**하고 발행 전 규제 체크 게이트를 둘 것.

4. **비용·관측(Observability) 직원/대시보드.** 토큰·API 비용이 직원·작업별로 추적되지 않으면 자동 cron이 조용히 비용을 태운다. 모델 라우팅·캐싱·배치(50% 할인) 활성화 + 비용 알림(50/75/90%).

5. **에러·재시도·예산 가드.** 멀티에이전트 도구에서 무한 재시도로 단순 작업이 회당 $7까지 치솟은 사례 보고 → **하드 종료 조건·일/월 예산 상한·실패 격리** 필요.

6. **품질 평가 루프(evals).** 카피/소싱 품질을 사장 피드백(채택/반려)으로 학습 데이터화해 프롬프트를 개선하는 경량 루프.

7. **(선택) 법무/계약·세무 보조, 신상품 기획(PM) 직원** — 회사 규모 확장 시.

---

## Recommendations — 우선순위 실행 권장사항 (Action Items)

**P0 — 배포 전 필수 (리스크/비용 직결)**
1. **모델 버전 현행화 + 작업단위 라우팅:** 위 표의 2026년 6월 라인업으로 교체(GPT-4o/구 Sonnet 제거). 직원 고정이 아니라 task→model 매핑 테이블.
2. **프롬프트 캐싱 적용:** ①회사브레인+②SOP+③직원프롬프트를 정적 캐시 프리픽스로(Sonnet 기준 2,048토큰 이상이면 적격), ⑤지시는 맨 뒤. cron은 캐시 TTL(5분/1시간) 고려해 묶어 실행.
3. **HITL 승인 게이트 + 감사 로그/롤백:** 외부 영향 액션은 초안→승인→실행. 모든 [액션]에 영수증 기록.
4. **건강식품 규제 가드레일:** 카피·이미지 직원에 식약처 금지표현/금지연출 룰 강제 + 발행 전 체크(가짜 전문가·치료 암시·의약품 오인 차단).

**P1 — 출시 직후**
5. **인사이트 공용 보드로 ④계층 교체**(전체 리포트 주입 폐지, 구조화 선별 주입 ≤1,500토큰/직원).
6. **소싱·모니터링 2단 파이프라인:** Perplexity(수집·인용)→Claude(분석). 인용 URL 저장 필수.
7. **이미지 생성 API 직접 연동:** Imagen 4 Fast + Nano Banana Pro(또는 gpt-image-1). 미드저니는 자동화에서 제외. 핵심컷은 사람 편집 가미.
8. **비용 관측 대시보드 + 예산 상한/알림 + 배치(50%) 활용.**

**P2 — 확장기**
9. **운영(주문/재고/정산) 직원·기능 추가** + 네이버/쿠팡 API 제약 반영(레이트리밋·키 만료·약관).
10. **품질 평가 루프**(사장 채택/반려를 프롬프트 개선에 반영).
11. **커지고 자주 바뀌는 데이터(카탈로그·CS 히스토리)에만 RAG(pgvector) 도입** — 회사 브레인엔 쓰지 말 것.

**권장안을 바꿀 기준(벤치마크):**
- 직원 수 8개 초과 & ④계층 토큰 직원당 1,500 초과 → 보드 선별·요약 강화 또는 직원 통합.
- 월 LLM 비용이 목표 예산의 75% 초과 → 라우팅 하향(소형 모델 비중↑)·배치 전환.
- 회사 브레인이 ~2만 토큰 초과 → "요약 캐시 주입 + 상세 RAG" 하이브리드로 전환.
- 특정 직원의 사장 반려율이 지속적으로 높음 → 모델 상향(Sonnet→Opus) 또는 프롬프트/SOP 개정.

---

## Caveats

- **가격·모델 변동성:** 본 리포트의 가격·스펙은 2026년 6월 15일 기준이며 분기마다 바뀐다(Opus 4.7 이후 새 토크나이저가 같은 텍스트에 최대 35% 더 많은 토큰을 생성하는 등 "표시가는 같아도 실비가 다른" 사례 존재). 배포 전 공식 가격 페이지에서 실트래픽으로 실비를 재측정할 것.
- **Perplexity 인용 신뢰성:** "인용 URL은 실재하나 내용이 날조"되는 환각이 보고된다. 소싱·모니터링 결과는 사장이 인용 원문을 검증할 수 있게 URL을 항상 저장.
- **저작권:** 순수 AI 생성 이미지는 미국법상 인간 창작성이 없으면 저작권 보호가 어렵다(타인 복제 방어 곤란). 핵심 비주얼은 사람 편집을 가미.
- **한국 규제는 살아 움직인다:** 식약처는 AI 생성 광고 자동탐지(OCR·"AI캅스"), 플랫폼 MOU 기반 1~2일 내 차단, 영상·음성 탐지 확대(2027~) 등을 추진 중이며 AI 생성물 표시·라벨링 의무화도 입법 논의 중이다. 건강식품 카테고리는 출시 전 식품표시광고법 최신 고시·식약처 보도자료를 재확인할 것.
- **플랫폼 API 정책:** 네이버 커머스API·쿠팡 Open API의 레이트리밋·키 만료·연동업체 자격 규정은 수시 변경되며 공지로 고지된다. 1인 사업자는 본인 명의 '내스토어/판매자 애플리케이션' 연동이 원칙이고, 서드파티 위탁은 약관 위반 소지가 있다.
- **벤치마크 해석 주의:** 카피·Vision·OCR 우열은 평가셋·하니스에 따라 분기마다 순위가 바뀐다. 실제 자사 데이터(자사 제품 사진·한국어 카피)로 소규모 A/B 검증 후 모델을 확정할 것.
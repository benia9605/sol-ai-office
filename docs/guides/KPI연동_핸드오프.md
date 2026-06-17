# 외부 앱 → 오피스 KPI 연동 핸드오프

> 목적: 운명랩·시목 등 **각 사업 앱이 매일 자기 KPI를 "Sol AI 오피스"로 전송**해서, 오피스 대시보드의 매출/전환율/방문자/문의 카드가 실데이터로 채워지게 한다.
> 구조: **각 앱 → 오피스 Supabase 엔드포인트로 PUSH(매일 1회)**. 오피스는 자기 테이블(`external_kpis`)만 읽음. (앱별 로직이 달라도 "전송 규격"만 맞추면 됨)

---

## 0. 오피스가 알려줄 3가지 (사장이 각 앱에 전달)
각 앱 Claude Code에 아래 3개를 넘겨줘야 한다 (오피스 쪽 값):
- `OFFICE_INGEST_URL` = `https://<오피스-프로젝트>.supabase.co/functions/v1/kpi-ingest`
- `KPI_INGEST_TOKEN` = 오피스가 발급한 공유 토큰 (오피스에서 `supabase secrets set KPI_INGEST_TOKEN=...`)
- `OFFICE_WORKSPACE_ID` = 이 사업에 해당하는 **오피스 워크스페이스 UUID** (운명랩용 / 시목용 각각 다름)

> ※ 이 토큰/URL은 앱의 **서버(엣지펑션) 환경변수**에만 저장. 프론트 노출 금지.

---

## 1. 전송 규격 (공통) — 이 형식만 맞추면 끝

**요청**
```
POST  {OFFICE_INGEST_URL}
headers:
  content-type: application/json
  x-kpi-token: {KPI_INGEST_TOKEN}
body (JSON):
{
  "workspaceId": "{OFFICE_WORKSPACE_ID}",
  "source": "unmyunglab",          // 앱 식별자: 'unmyunglab' | 'simok'
  "date": "2026-06-18",            // 집계 기준일 (YYYY-MM-DD, 보통 어제)
  "revenue": 3200000,              // 매출(원, 정수)
  "orders": 24,                    // 주문/결제 건수
  "visitors": 2300,                // 방문자 수(raw)
  "conversionRate": 6.4,           // 전환율(%) 숫자
  "inquiries": 12,                 // 신규 문의 수
  "extra": { }                     // 도메인별 추가 지표(자유, 선택)
}
```
- **멱등(upsert)**: 같은 `(workspaceId, source, date)`로 다시 보내면 덮어씀 → 재전송/정정 안전.
- 모든 지표는 **선택**(보내는 것만 반영, 없으면 생략/`null`). 단 `workspaceId·source·date`는 필수.
- 단위 약속: `revenue`=원, `visitors`=명(raw), `conversionRate`=퍼센트 숫자(예 6.4). 오피스가 만원/K로 표시 변환함.
- **응답**: `200 { ok: true }` / 실패 `401`(토큰), `400`(필수값), `500`.

**호출 시점**: 매일 1회(예: 매일 새벽, 어제자 집계). 앱의 **cron 엣지펑션/스케줄러**에서 호출 권장.

---

## 2. 앱별 지표 매핑 (로직이 다른 부분)

### 🔮 운명랩 (사주 리포트 자동화 — SaaS/콘텐츠)
| 오피스 필드 | 운명랩에서 무엇으로 | 비고 |
|---|---|---|
| revenue | 결제 매출 합(원) | 리포트 판매/구독 결제 |
| orders | 결제 건수 | = 리포트 발행/구매 수 |
| visitors | 방문자(세션/UV) | GA 또는 자체 로그 |
| conversionRate | 결제수 ÷ 방문자 × 100 | |
| inquiries | 신규 문의/상담 | 없으면 생략 |
| extra | `{ "reportsIssued": n, "subscribers": n }` | 도메인 지표 자유 |
- `source: "unmyunglab"`

### 🪵 시목 (원목 가구·소품 — 커머스)
| 오피스 필드 | 시목에서 무엇으로 | 비고 |
|---|---|---|
| revenue | 결제완료 매출 합(원) | 환불 제외 권장 |
| orders | 주문 건수 | |
| visitors | 스토어 방문자 | 스마트스토어/자사몰 합 |
| conversionRate | 주문수 ÷ 방문자 × 100 | |
| inquiries | 신규 CS 문의 | |
| extra | `{ "aov": 객단가, "refunds": n }` | 도메인 지표 자유 |
- `source: "simok"`

---

## 3. 각 앱 Claude Code에 붙여넣을 프롬프트

### ▶ 운명랩 앱에 붙여넣기
```
[작업] 우리 앱의 일일 KPI를 "Sol AI 오피스"로 매일 1회 전송하는 기능 추가.

[받은 값 — 환경변수(서버 전용)로 저장]
OFFICE_INGEST_URL = <오피스에서 받은 URL>
KPI_INGEST_TOKEN  = <오피스에서 받은 토큰>
OFFICE_WORKSPACE_ID = <운명랩용 오피스 워크스페이스 UUID>

[구현]
1. 어제자 KPI를 우리 DB에서 집계: revenue(결제매출 합·원), orders(결제건수), visitors(방문자), conversionRate(결제수/방문자*100), inquiries(문의수). 가능한 것만.
2. 매일 1회(새벽) 도는 cron(엣지펑션/스케줄러)에서 아래로 POST:
   POST {OFFICE_INGEST_URL}
   headers: { 'content-type':'application/json', 'x-kpi-token': KPI_INGEST_TOKEN }
   body: { workspaceId: OFFICE_WORKSPACE_ID, source:'unmyunglab', date:'YYYY-MM-DD', revenue, orders, visitors, conversionRate, inquiries, extra:{reportsIssued, subscribers} }
3. 같은 날짜 재전송은 upsert로 덮어쓰니 안전. 실패 시 로깅.
4. 토큰/URL은 절대 프론트에 노출하지 말 것(서버 환경변수만).

[규격 상세] 단위: revenue=원, visitors=명(raw), conversionRate=퍼센트 숫자. 응답 200 {ok:true}.
```

### ▶ 시목 앱에 붙여넣기
```
[작업] 우리 앱의 일일 KPI를 "Sol AI 오피스"로 매일 1회 전송하는 기능 추가.

[받은 값 — 환경변수(서버 전용)로 저장]
OFFICE_INGEST_URL = <오피스에서 받은 URL>
KPI_INGEST_TOKEN  = <오피스에서 받은 토큰>
OFFICE_WORKSPACE_ID = <시목용 오피스 워크스페이스 UUID>

[구현]
1. 어제자 KPI 집계: revenue(결제완료 매출·원, 환불 제외), orders(주문수), visitors(스토어 방문자), conversionRate(주문수/방문자*100), inquiries(CS 문의수).
2. 매일 1회 cron에서 아래로 POST:
   POST {OFFICE_INGEST_URL}
   headers: { 'content-type':'application/json', 'x-kpi-token': KPI_INGEST_TOKEN }
   body: { workspaceId: OFFICE_WORKSPACE_ID, source:'simok', date:'YYYY-MM-DD', revenue, orders, visitors, conversionRate, inquiries, extra:{aov, refunds} }
3. upsert(같은 날짜 덮어씀), 실패 로깅, 토큰/URL 서버에만.

[규격 상세] 단위: revenue=원, visitors=명(raw), conversionRate=퍼센트 숫자. 응답 200 {ok:true}.
```

---

## 4. 오피스(이 앱) 쪽 준비 상태 — 이미 완료
- 테이블 `external_kpis` (마이그 `020_external_kpis.sql` — Supabase SQL Editor에서 실행)
- 수신 엔드포인트 `kpi-ingest` 엣지펑션 (배포 + `supabase secrets set KPI_INGEST_TOKEN=<랜덤>`)
- 대시보드가 `external_kpis` 최근 7일을 읽어 카드·추이 그래프 자동 표시 (데이터 없으면 0)

### 오피스가 해야 할 것(사장)
1. `020_external_kpis.sql` 실행.
2. `supabase functions deploy kpi-ingest` + `supabase secrets set KPI_INGEST_TOKEN=<랜덤문자열>`.
3. 운명랩/시목 **오피스 워크스페이스 UUID** 확인(워크스페이스 설정/DB) → 각 앱에 위 3값 전달.
4. 각 앱이 전송 시작하면 대시보드에 자동 반영.

> ※ 워크스페이스 UUID 찾기: 오피스에서 해당 워크스페이스 진입 후 DB `workspaces` 테이블의 id, 또는 추후 워크스페이스 설정에 표시 추가 가능(원하면 작업).

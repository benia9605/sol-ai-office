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

---

## 5. 운명랩 앱 — 구현 답변 (✅ 반영 완료)

> 운명랩 코드/DB 조사 후, 위 전송 규격을 그대로 따르는 일일 KPI PUSH cron을 추가했다.
> 구현 파일: `scripts/cron/dailyKpiReport.ts` · 실행: `npm run cron:daily-kpi`

### 5-1. 지표별 실제 데이터 소스 (운명랩 DB)
모든 날짜는 **KST(+09:00) 하루 경계**로 집계하며, 기본 대상은 **어제자**다.

| 오피스 필드 | 운명랩 소스 | 집계 로직 | 상태 |
|---|---|---|---|
| `revenue` | `orders.price_paid` 합(원) | `payment_status='paid' AND status='PAID' AND is_test=false`, `paid_at` 기준 | ✅ 전송 |
| `orders` | `orders` 건수 | 위와 동일 조건 row 수 (무료/체험단 `price_paid=0`도 결제건에 포함, 매출엔 0 기여) | ✅ 전송 |
| `visitors` | `daily_visitors` 순방문자(UV) | 자체 방문자 추적 — `visit_date=대상일` row 수 (count만, 행 미조회 → egress 최소) | ✅ 전송 (데이터 있을 때) |
| `conversionRate` | `orders / visitors * 100` | 방문자 있을 때만 산출, 소수1자리 반올림 | ✅ 전송 (방문자 있을 때) |
| `extra.reportsIssued` | `order_reports` 건수 | `status='sent'`, `sent_at` 기준 | ✅ 전송 |
| `inquiries` | (해당 없음) | 운명랩에 고객 문의/상담 테이블 없음 (핸드오프 "없으면 생략"에 해당) | ⛔ 생략 |
| `extra.subscribers` | (해당 없음) | 구독 모델 없음(1회성 결제 + 와디즈 티어) | ⛔ 생략 |

> 멱등 보장: 같은 `(workspaceId, unmyunglab, date)`는 오피스가 upsert로 덮어쓰므로
> `--date=YYYY-MM-DD` 로 특정일 정정 재전송이 안전하다.

### 5-1-b. 방문자(UV) 자체 추적 구조 (GA 미사용)
운명랩엔 GA가 없어 **자체 경량 추적**을 붙였다(구글 콘솔 설정 불필요).
- 브라우저 → 우리 서버 `POST /api/track/visit` 비콘(세션당 1회). Supabase 직접 호출 X.
- 서버가 `(KST날짜, 방문자ID)` upsert → **하루 1인 1행**(PK 충돌 시 do nothing). 봇 UA 제외.
- 방문자ID = localStorage 랜덤 UUID(개인정보 아님). IP·UA 저장 안 함. `/admin`·`/preview` 제외.
- cron은 `count`만 읽음(행 미조회) → **egress·저장량 무시 수준.** 과거 데이터 백필은 불가(배포 시점부터 집계).
- 관련: `031_daily_visitors.sql`, `server/routes/track.ts`, `client/src/lib/visitorTracking.ts`

### 5-2. 실행/배포 방법
1. **마이그레이션 실행**: `031_daily_visitors.sql` (Supabase SQL Editor) — 방문자 집계 테이블.
2. **서버 전용 환경변수** 3개 등록 (프론트 노출 금지):
   `OFFICE_INGEST_URL`, `KPI_INGEST_TOKEN`, `OFFICE_WORKSPACE_ID` (운명랩용 UUID)
3. **앱 배포** — 프론트 비콘(`trackVisit`) + `/api/track/visit` 가 떠야 방문자가 쌓이기 시작.
4. **cron 등록** (Vercel cron / 운영 서버 crontab) — 매일 새벽 1시 30분 예시:
   `30 1 * * *  cd <repo> && npm run cron:daily-kpi`
5. 성공/실패 모두 **슬랙(FREE_FORTUNE 채널)으로 1건 보고**(하트비트 겸용).
6. 수동 정정: `npm run cron:daily-kpi -- --date=2026-06-17`

---

## 6. 오피스 측 수신 검증 체크리스트 (운명랩 연동 확정 규격) ⚠️

> 오피스 `kpi-ingest`가 **운명랩이 실제로 쏘는 요청**을 그대로 받는지 아래로 점검.
> (이 섹션을 Sol AI 오피스 Claude Code에 그대로 전달하면 됨)

### 6-1. 운명랩이 실제로 보내는 페이로드
헤더는 항상 `content-type: application/json` + `x-kpi-token: {KPI_INGEST_TOKEN}` 두 개뿐.
**`Authorization: Bearer ...` 헤더는 안 보냄** (→ 6-3 ①번 주의).

**(A) 방문자 집계 있는 날 — 전체 필드**
```json
{
  "workspaceId": "<운명랩 워크스페이스 UUID>",
  "source": "unmyunglab",
  "date": "2026-06-19",
  "revenue": 3200000,
  "orders": 24,
  "visitors": 2300,
  "conversionRate": 1.0,
  "extra": { "reportsIssued": 21 }
}
```

**(B) 방문자 미집계(배포 직후·집계 실패) — `visitors`·`conversionRate` 키 자체가 빠짐**
```json
{
  "workspaceId": "<운명랩 워크스페이스 UUID>",
  "source": "unmyunglab",
  "date": "2026-06-19",
  "revenue": 3200000,
  "orders": 24,
  "extra": { "reportsIssued": 21 }
}
```

### 6-2. 필드 계약 (운명랩 기준)
| 필드 | 타입 | 전송 여부 |
|---|---|---|
| `workspaceId` | string(uuid) | 항상 (필수) |
| `source` | `"unmyunglab"` 고정 | 항상 (필수) |
| `date` | `"YYYY-MM-DD"` (KST 달력일) | 항상 (필수) |
| `revenue` | integer (원) | 항상 (없으면 0) |
| `orders` | integer | 항상 (없으면 0) |
| `visitors` | integer | **방문자>0일 때만** (아니면 키 생략) |
| `conversionRate` | number (소수 1자리) | **방문자>0일 때만** (아니면 키 생략) |
| `extra` | object | 항상 — `{ "reportsIssued": n }` |
| `inquiries` / `extra.subscribers` | - | **안 보냄** (운명랩 해당 데이터 없음) |

### 6-3. 오피스가 반드시 확인할 것 (체크박스)
1. ☐ **엣지펑션 JWT 검증 OFF 필수** — 운명랩은 `Authorization: Bearer`를 안 보내고 `x-kpi-token`만 보냄. Supabase 엣지펑션이 기본값(JWT 검증 ON)이면 **함수 실행 전 게이트웨이가 401로 막아버림.** `supabase functions deploy kpi-ingest --no-verify-jwt`(또는 `config.toml`에 `verify_jwt = false`)로 배포하고, 인증은 **함수 내부에서 `x-kpi-token` 비교**로만 처리.
2. ☐ **멱등 유니크 제약** — `external_kpis`에 `UNIQUE (workspace_id, source, date)` 가 있어야 upsert가 덮어씀. 없으면 매일 행이 중복 쌓임.
3. ☐ **`revenue`는 bigint** 권장 (일 매출이 int4 한계 ~21억을 넘을 가능성 대비).
4. ☐ **부분 필드 안전 처리** — `visitors`·`conversionRate`·`inquiries` 키가 **요청에 없을 수 있음.** 키 부재로 함수가 터지지 않게 하고, 없으면 해당 컬럼 `null` 저장 (매 전송이 그날 전체 스냅샷이라 null 저장 OK).
5. ☐ **`extra`는 JSONB 통째 저장** (`reportsIssued` 등 도메인 지표).
6. ☐ **응답 계약 준수** — 정상 `200 { "ok": true }`, 토큰 불일치 `401`, 필수값 누락 `400`, 서버오류 `500`. (운명랩 cron은 **2xx가 아니면 실패로 간주 → 슬랙 알림 + exit 1**.)
7. ☐ **source ↔ workspaceId 교차 점검**(선택) — `source:"unmyunglab"`와 전달한 워크스페이스 UUID가 매칭되는지 확인하면 오삽입 방지.

### 6-4. curl 자가 테스트 (오피스가 직접 실행)
```bash
curl -i -X POST "$OFFICE_INGEST_URL" \
  -H "content-type: application/json" \
  -H "x-kpi-token: $KPI_INGEST_TOKEN" \
  -d '{"workspaceId":"<UUID>","source":"unmyunglab","date":"2026-06-19","revenue":1000,"orders":1,"extra":{"reportsIssued":1}}'

# 기대: HTTP 200 + body {"ok":true}
# 같은 명령 2번 → external_kpis 행 1개만(덮어쓰기) → 멱등 OK
# x-kpi-token 틀리게 주면 → 401 (JWT 검증 OFF가 안 돼 있으면 토큰 맞아도 401 나옴 → 6-3 ①번 점검)
```

---

## 7. 시목 앱 — 구현 답변 (📋 데이터 소스 조사 완료 / 구현 대기)

> 시목 코드·DB(마이그 044개)를 조사한 결과다. 위 전송 규격을 그대로 따를 수 있으며,
> **revenue·orders·extra.aov·extra.refunds는 즉시 산출 가능**, **visitors·conversionRate는 추적 수단이 없어 보류**, **inquiries는 해당 데이터 없음**이다.
> ⚠️ 운명랩과 달리 시목은 **아직 cron/전송 코드를 붙이지 않았다**(아래 7-3의 사전 결정이 필요).

### 7-1. 지표별 실제 데이터 소스 (시목 DB)
기준 테이블은 **쇼핑몰 주문 `orders`** (B2B 발주 `business_orders`·재고 요약 `*_summary`는 KPI 제외).
모든 집계는 **KST(+09:00) 하루 경계**, 기본 대상은 **어제자**다.

| 오피스 필드 | 시목 소스 | 집계 로직 | 상태 |
|---|---|---|---|
| `revenue` | `orders.price_paid` 합(원) | `payment_status='paid' AND is_test=false`, `paid_at` 기준 KST 하루. 환불 시 `payment_status`가 `refunded`로 바뀌므로 **'paid' 필터만으로 환불 자동 제외** | ✅ 가능 |
| `orders` | `orders` 건수 | 위와 동일 조건 row 수 (`COUNT(*)`) | ✅ 가능 |
| `extra.aov` | `revenue / orders` | 객단가. `orders>0`일 때만 산출(반올림 정수) | ✅ 가능 |
| `extra.refunds` | `orders` 건수 | `payment_status='refunded' AND is_test=false`, `refunded_at` 기준 KST 하루 | ✅ 가능 |
| `visitors` | (추적 수단 없음) | GA·자체 방문자 테이블 모두 없음 → 7-3 ②에서 결정 | ⛔ 보류 (키 생략) |
| `conversionRate` | `orders / visitors * 100` | visitors가 없어 산출 불가 | ⛔ 보류 (키 생략) |
| `inquiries` | (해당 없음) | CS 문의/상담 테이블 없음. `signups`는 얼리액세스 마케팅 등록이라 CS 문의와 성격이 다름 → 전송 안 함 | ⛔ 생략 |

> 멱등: 같은 `(workspaceId, 'simok', date)`는 오피스가 upsert로 덮어쓰므로 `--date`로 특정일 정정 재전송 안전.
> 환불 주의: revenue는 `paid_at`이 그날인 주문만 보므로, **며칠 뒤 환불은 과거 날짜를 자동 정정하지 않는다.** 정정이 필요하면 그 결제일을 `--date`로 재전송하면 환불분이 빠진 매출로 덮어쓴다.

### 7-2. 시목이 보내게 될 페이로드 (확정 규격)
헤더는 운명랩과 동일하게 `content-type: application/json` + `x-kpi-token` 두 개뿐 (`Authorization` 미전송 → 6-3 ① 동일 주의).

```json
{
  "workspaceId": "<시목 워크스페이스 UUID>",
  "source": "simok",
  "date": "2026-06-19",
  "revenue": 1280000,
  "orders": 8,
  "extra": { "aov": 160000, "refunds": 1 }
}
```
- `visitors`·`conversionRate`·`inquiries` 키는 **현재 보내지 않음**(생략). 오피스는 부분 필드를 null로 안전 저장(6-3 ④)하므로 문제 없음.
- `revenue`·`orders`는 항상 전송(없으면 0). `extra`는 항상 `{ aov, refunds }`.

### 7-3. 구현 전 결정해야 할 것 (시목 사장/개발)
운명랩은 Vercel/서버 cron이 있었지만 **시목은 Next.js 14 + Replit 배포라 cron 인프라가 없다.** 아래 결정 후 붙이면 된다.

1. **실행 방식** — 권장: 보호된 API 라우트 `POST /api/cron/daily-kpi`(헤더 `x-cron-secret` 검증) + 외부 스케줄러가 매일 새벽 호출.
   - 스케줄러 후보: Replit Scheduled Deployment / cron-job.org / GitHub Actions `schedule`.
2. **DB 접근 권한** — `orders`는 RLS상 admin/staff 또는 본인만 SELECT 가능. cron은 세션이 없으므로 **`SUPABASE_SERVICE_ROLE_KEY`(서버 전용)로 집계하거나, `SECURITY DEFINER` 집계 함수**(`public.daily_kpi(date)` 형태)를 하나 만들어 anon으로 호출하는 방식 중 택1. (현재 프로젝트는 service_role 미사용 → 키 추가 또는 함수 추가 필요)
3. **방문자(visitors) 도입 여부** — 원하면 운명랩처럼 경량 자체 추적(`POST /api/track/visit` 비콘 + `daily_visitors` 테이블, 봇 제외, `/admin` 제외)을 붙여 visitors·conversionRate까지 채울 수 있다. 안 붙이면 두 필드는 계속 생략.
4. **서버 전용 환경변수** 등록(프론트 노출 금지): `OFFICE_INGEST_URL`, `KPI_INGEST_TOKEN`, `OFFICE_WORKSPACE_ID`(시목용 UUID) + (택1에 따라) `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.

### 7-4. 집계 SQL (참고 — KST 어제자)
```sql
-- 매출 + 주문수 (환불 자동 제외)
SELECT COALESCE(SUM(price_paid),0) AS revenue, COUNT(*) AS orders
FROM orders
WHERE payment_status = 'paid' AND is_test = FALSE
  AND (paid_at AT TIME ZONE 'Asia/Seoul')::date
      = ((now() AT TIME ZONE 'Asia/Seoul')::date - 1);

-- 환불 건수
SELECT COUNT(*) AS refunds
FROM orders
WHERE payment_status = 'refunded' AND is_test = FALSE
  AND (refunded_at AT TIME ZONE 'Asia/Seoul')::date
      = ((now() AT TIME ZONE 'Asia/Seoul')::date - 1);

-- aov = revenue / orders (orders>0일 때만, 앱에서 계산)
```

### 7-5. 관련 파일 (시목)
- `supabase/migrations/020_create_orders.sql`, `supabase/schema/orders.md` — 주문/금액/상태/타임스탬프 스키마
- `app/api/payments/webhook/route.ts` — 결제완료 시 `status='PAID'/payment_status='paid'/paid_at`, 환불 시 `'REFUNDED'/'refunded'` 세팅 지점
- `app/api/admin/orders/route.ts` — 주문 조회 쿼리 패턴(집계 라우트 작성 시 참고)
- `lib/supabase-server.ts` — 서버 클라이언트(현재 anon key). service_role 도입 시 별도 클라이언트 추가 필요
- (신규 예정) `app/api/cron/daily-kpi/route.ts` — 집계+전송 엔드포인트

# AI 오피스 ↔ 서비스 데이터 접근 보안 설계 핸드오프

> 목적: 운명랩·시목 등 **각 사업 서비스의 DB 데이터(제품/판매/매입/고객/거래처)** 를 **AI 오피스 직원들이 실제 회사 직원처럼 — 권한 제한 + 전수 로깅으로 — 안전하게 활용**하게 한다.
> 구조: **각 서비스가 표준 read API 제공 → 오피스 "게이트웨이"가 권한·마스킹·로깅을 거쳐 PULL → AI 직원은 게이트웨이만 통해 접근.** AI는 DB·서비스 키에 직접 손대지 않는다.
> 관계: 기존 [`KPI연동_핸드오프`](./KPI연동_핸드오프.md)의 PUSH(매일 KPI 스냅샷)는 그대로 둬도 되고, 이 문서는 그 위에 **"풍부한 데이터를 온디맨드로 안전하게 쓰는 층"** 을 더한다.

---

## 0. 3대 원칙 (이거부터 합의)

1. **DB 직접접근 금지 — 게이트웨이 단일통로.** AI 직원은 어떤 서비스 DB에도 직접 못 간다. 무조건 오피스 게이트웨이 1곳을 거친다. 게이트웨이가 권한검사·마스킹·로깅을 전부 한다.
2. **기본 차단(default-deny) + 집계 우선.** 명시적으로 열어준 것만 보인다. 대부분 업무는 집계(매출·전환율·재고수준)면 되고 원본(raw)은 거의 필요 없다.
3. **전수 로깅.** 누가(어떤 AI 직원/역할) / 무엇을 / 언제 / 몇 건을 봤는지, **거부된 접근까지** append-only로 남긴다.

> 핵심 보안 장치: **"집계 / 건별 조회 / 대량 덤프"를 구분**한다. 진짜 직원도 고객 1명 조회는 정상이지만 전체 고객 DB 다운로드는 위험하다. AI도 동일하게 취급한다.

---

## 1. 아키텍처

```
[AI 직원들]  (역할별 토큰: marketing / finance / cs / ops / owner)
     │  예) "시목 이번달 마진 알려줘", "고객 #1234 주문상태"
     ▼
┌─────────────────────────────────────────────┐
│  오피스 게이트웨이 (Edge Function: data-gateway)   │  ★ 보안 관문
│   ① RBAC   : 이 역할이 이 리소스/필드 봐도 되나?       │
│   ② 작업등급 : 집계 / 건별 / 대량덤프 중 허용 범위?       │
│   ③ 마스킹  : 원가·PII 등 민감필드 제거/마스킹            │
│   ④ 감사로그 : audit_log 에 기록 (성공·거부 모두)         │
└─────────────────────────────────────────────┘
     │  서비스별 키 + IP allowlist (게이트웨이만 호출)
     ▼
[표준 read API]  (각 서비스: /api/data/* )
     ▼
[각 서비스 DB]  = 진실의 원본 (운명랩 / 시목 ...)
```

- AI 직원은 **게이트웨이 정책을 통과한 결과만** 받는다. 서비스 키·DB 비밀번호는 게이트웨이만 보유.
- 서비스의 read API는 **오피스 게이트웨이 IP만 허용(allowlist)** → public 엔드포인트라도 외부 공격표면 제거.

---

## 2. 데이터 민감도 분류 (모든 정책의 기반)

> ※ 아래는 표준 등급. **실제 DB 컬럼 단위로 1:1 매핑하는 표(2-b)** 를 각 서비스가 채워야 한다. (Phase 0)

| 데이터 | 등급 | 기본 노출 방식 |
|---|---|---|
| 판매가, 재고수량, 매출/방문 **집계** | 🟢 낮음 | 자유 (집계·건별 OK) |
| 주문 상세, 거래 이력 | 🟡 중간 | 집계 OK, raw는 **건별만** |
| 도매가·원가·매입가 | 🔴 높음(영업비밀) | **finance 역할만**, 기본 마스킹 |
| 거래처 정보 | 🔴 높음(영업비밀) | **finance/ops 역할만** |
| 고객 개인정보(PII: 이름·연락처·주소) | ⛔ 최고(법적규제) | **건별 조회만**, 대량덤프 금지, 항상 로깅 |

### 2-b. 서비스별 컬럼 매핑 (각 서비스가 채움 — 예시: 시목)

| 테이블.컬럼 | 등급 | 비고 |
|---|---|---|
| `products.sale_price` | 🟢 | 판매가 |
| `products.wholesale_price`, `products.cost` | 🔴 | 원가/도매가 — finance만 |
| `products.stock` | 🟢 | 재고 |
| `orders.total`, `orders.status` | 🟡 | 집계 자유, raw 건별 |
| `customers.name/phone/address` | ⛔ | PII — 건별만, 마스킹 |
| `vendors.*` (거래처) | 🔴 | finance/ops만 |
| `purchases.*` (매입) | 🔴 | finance만 |

> 운명랩도 같은 양식으로 작성. (운명랩은 PII 테이블이 없으면 ⛔ 행 생략)

---

## 3. 역할 ↔ AI 직원 매핑

| 역할(role) | 볼 수 있는 것 | 못 보는 것 |
|---|---|---|
| `marketing` | 매출·전환율·재고·방문자 **집계** | 원가, PII, 거래처 |
| `finance` | 매출·매입·마진·원가·거래처 | 고객 PII(이름/연락처) |
| `cs` | 고객·주문 **건별 조회** | 전체 고객 덤프, 원가 |
| `ops` | 재고·발주·입출고·거래처 | PII, 매출 상세 |
| `owner` | 전부 (대량덤프는 명시 승인 + 강한 로그) | — |

- 각 AI 직원은 **1개 역할 토큰**을 부여받는다. 토큰에 역할이 박혀 있고, 게이트웨이가 이를 검증.
- 역할↔허용 매핑은 게이트웨이의 **정책표 한 곳**에서만 관리(코드/설정).

---

## 4. 접근 작업 등급 (3단계)

| 등급 | 정의 | 정책 |
|---|---|---|
| **집계(aggregate)** | 합계·평균·카운트 등, 개별 행 미반환 | 역할 허용 시 자유. 가장 안전 |
| **건별(record lookup)** | 특정 id 1건 raw 조회 | 역할 허용 + **로깅 필수** |
| **대량덤프(bulk export)** | 다수 raw 행 반환 | **기본 금지.** owner + 명시 승인 + 슬랙 알림 + 강한 로그 |

> 게이트웨이는 요청을 이 3등급으로 분류해서 정책을 적용한다. "한 번에 N건 이상 raw 반환" 같은 임계치로 대량덤프를 자동 탐지한다.

---

## 5. 표준 데이터 API 규격 (각 서비스 → 게이트웨이가 PULL)

**공통 규칙**
- 모든 엔드포인트 **read-only(GET)**, HTTPS 강제.
- 인증: `x-service-key: {SERVICE_API_KEY}` (서비스마다 다른 키. 공유 금지).
- 네트워크: **오피스 게이트웨이 egress IP만 allowlist.** ← PULL 보안의 1순위.
- 응답엔 **집계/건별만**. 한 번에 대량 raw를 토해내는 엔드포인트는 만들지 않는다(페이지네이션 상한 강제).

**(A) 집계**
```
GET {SERVICE_BASE}/api/data/metrics?from=2026-06-01&to=2026-06-19&granularity=day&metric=revenue,orders,visitors
→ 200 { "source":"simok", "rows":[ { "date":"2026-06-01", "revenue":3200000, "orders":24, ... } ] }
```

**(B) 건별 조회**
```
GET {SERVICE_BASE}/api/data/records/orders/{id}
GET {SERVICE_BASE}/api/data/records/customers/{id}
→ 200 { "source":"simok", "resource":"orders", "record": { ... } }
```
- 서비스는 **원본 그대로** 줘도 된다. **민감필드 마스킹은 게이트웨이가 책임**(서비스는 단순·일관 유지).
- 단, 서비스도 **명백한 대량반환은 거절**(예: id 없는 전체 목록 요청 → 400 또는 상한 페이지).

**응답 계약**: `200`(정상) / `401`(키) / `403`(허용 안 된 리소스) / `404` / `429`(rate limit) / `500`.

---

## 6. 오피스 게이트웨이 (Edge Function: `data-gateway`)

AI 직원의 모든 데이터 요청이 들어오는 단일 입구. 처리 순서:

1. **역할 인증** — AI 직원 토큰 검증 → `role` 추출. (`x-kpi-token` 방식과 동일하게 `verify_jwt=false` + 내부 토큰 비교)
2. **정책 판단(RBAC)** — `(role, source, resource, field, action)` 이 정책표에 허용돼 있나? 아니면 `403 + audit_log(denied)`.
3. **작업등급 체크** — 집계/건별/대량덤프 분류 → 대량덤프면 owner+승인 아닌 한 거부.
4. **서비스 PULL** — 서비스별 키로 read API 호출(IP allowlist 내부 통신).
5. **마스킹** — 역할이 못 보는 민감필드 제거/마스킹 (예: `cost`→삭제, `phone`→`010-****-1234`).
6. **감사 로그 기록** → 결과 반환.

> 정책표 예시(개념):
> ```
> marketing: { aggregate: ['*.metrics'], record: [], fields_denied: ['cost','wholesale_price','*pii*'] }
> finance:   { aggregate: ['*'], record: ['orders','purchases','vendors'], fields_denied: ['*pii*'] }
> cs:        { aggregate: ['orders.metrics'], record: ['customers','orders'], fields_masked: ['phone','address'] }
> owner:     { all: true, bulk: 'require_approval' }
> ```

---

## 7. 감사 로그 설계 (`audit_log`)

오피스 DB에 **append-only**(수정·삭제 불가, RLS로 insert만 허용) 테이블.

```sql
create table audit_log (
  id           bigint generated always as identity primary key,
  ts           timestamptz not null default now(),
  actor        text not null,         -- AI 직원 식별자
  role         text not null,         -- marketing|finance|cs|ops|owner
  source       text,                  -- simok|unmyunglab...
  action       text not null,         -- aggregate|record_lookup|bulk_export
  resource     text,                  -- orders|customers|products...
  query        jsonb,                 -- 조회 범위/파라미터/대상 id
  rows_returned int,
  result       text not null,         -- ok|denied|error
  reason       text                   -- 거부 사유 등
);
-- 인덱스: (ts), (actor), (result)  /  대량조회·PII·denied 는 별도 슬랙 알림
```

- **거부(denied)도 반드시 기록** — 이상행동·권한오용 탐지의 핵심.
- `bulk_export` 또는 PII 리소스 접근 시 **슬랙 알림 1건**(KPI 핸드오프의 하트비트와 동일 패턴).

---

## 8. 각 서비스 Claude Code에 붙여넣을 프롬프트

### ▶ 시목 / 운명랩 공통 — 표준 read API 추가
```
[작업] 우리 서비스 DB를 "Sol AI 오피스"가 안전하게 읽도록 표준 read-only API를 추가.
       (KPI PUSH와 별개. 데이터는 절대 우리가 밀지 않고, 오피스가 당겨가게만 한다.)

[받은 값 — 서버 전용 환경변수]
SERVICE_API_KEY = <오피스에서 발급, 우리 서비스 전용 키>
OFFICE_GATEWAY_IPS = <오피스 게이트웨이 egress IP 목록>

[구현]
1. GET /api/data/metrics  : 집계만 반환 (from,to,granularity,metric). 개별 행 미반환.
2. GET /api/data/records/:resource/:id : 특정 1건 raw 반환. id 없는 전체목록 요청은 거절(상한 페이지).
3. 인증: 헤더 x-service-key == SERVICE_API_KEY 아니면 401. 키는 서버 환경변수만(프론트 금지).
4. 네트워크: OFFICE_GATEWAY_IPS 외 요청 거부(또는 인프라 레벨 allowlist).
5. read-only 보장: 이 라우트로는 어떤 쓰기/삭제도 불가.
6. 민감필드(원가/PII)도 일단 그대로 반환해도 됨 — 마스킹은 오피스 게이트웨이가 한다.
   단 우리 DB 컬럼별 민감도 표(아래 양식)를 함께 제출.

[제출물] 컬럼 민감도 매핑표:
| 테이블.컬럼 | 등급(🟢/🟡/🔴/⛔) | 비고 |
[응답 계약] 200 / 401(키) / 403(리소스) / 404 / 429 / 500.
```

> 시목은 `source:"simok"`, 운명랩은 `source:"unmyunglab"`. 운명랩은 기존 KPI PUSH 유지, 여기에 read API만 추가.

---

## 9. 오피스(이 앱) 쪽 준비

### 오피스가 해야 할 것(사장)
1. `audit_log` 테이블 마이그레이션 실행 (§7).
2. `data-gateway` 엣지펑션 배포: `supabase functions deploy data-gateway --no-verify-jwt`.
3. Secrets 등록: 각 서비스 키(`SIMOK_SERVICE_KEY`, `UNMYUNGLAB_SERVICE_KEY`...), AI 직원 역할 토큰.
   `supabase secrets set ...`
4. 게이트웨이 **정책표**(역할↔허용) 작성 — 처음엔 "전 역할 집계만 허용" 한 줄로 시작.
5. 각 서비스에 **서비스 키 + 게이트웨이 IP** 전달 → 서비스가 read API + IP allowlist 구성.
6. AI 직원에 역할 토큰 주입 → 게이트웨이로만 데이터 접근하도록 연결.

---

## 10. 단계별 실행 로드맵

| Phase | 내용 | 산출물 |
|---|---|---|
| **0 (반나절, 코딩X)** | 데이터 민감도 분류표 채우기 (§2-b) | 서비스별 컬럼 등급표 |
| **1** | 시목에 `GET /api/data/metrics`(🟢) + IP allowlist + 서비스 키 | 집계 API 1개 |
| **2** | `data-gateway` 최소버전 + `audit_log`. RBAC는 "전부 집계만 허용" | 게이트웨이+로그 동작 |
| **3** | 역할 토큰 발급 + 게이트웨이 정책표 적용(역할별 분기) | RBAC 가동 |
| **4 (필요 시)** | 건별 조회 + PII 마스킹 + 대량덤프 차단 | 민감데이터 안전 접근 |

### ⚠️ 과몰입 경고
Phase 0~2가 실제로 일하는 구간이고 **보안의 대부분이 여기서 끝난다**(read-only + 집계만 + 전수로깅). Phase 3~4는 **AI 직원이 실제로 원가·고객정보를 요구하는 상황이 왔을 때** 만든다. 지금 풀 RBAC·PII 파이프라인부터 짜면 세팅에 한 달 녹는다.

**다음 행동 딱 하나: Phase 0 분류표 채우기.** 시목 DB 스키마 가져오면 등급·역할 매핑 초안을 같이 잡는다.

---

## 11. 보안 체크리스트 ⚠️

- ☐ AI 직원은 **DB·서비스 키에 직접 접근 불가** — 게이트웨이만 통한다.
- ☐ 서비스 read API는 **read-only** (이 라우트로 쓰기/삭제 불가).
- ☐ 서비스 read API는 **게이트웨이 IP allowlist** + **서비스별 키**(공유 금지).
- ☐ 게이트웨이는 **default-deny** — 정책표에 없는 건 `403 + denied 로그`.
- ☐ **원가/PII 마스킹은 게이트웨이 책임** (서비스는 일관 유지).
- ☐ **대량덤프 자동 탐지**(임계치) → owner+승인 아니면 거부.
- ☐ `audit_log` 는 **append-only**, **거부(denied)도 기록**.
- ☐ PII·대량조회는 **슬랙 알림**.
- ☐ 서비스 키/역할 토큰은 **서버 환경변수·secrets만** (프론트·레포 금지).

### 11-b. curl 자가 테스트 (오피스가 직접 실행)
```bash
# 1) 게이트웨이 경유 집계 (marketing 토큰) → 200, 원가/PII 없는 응답
curl -i "$GATEWAY_URL/data/metrics?source=simok&from=2026-06-01&to=2026-06-19" \
  -H "x-agent-token: $MARKETING_TOKEN"
# 기대: 200, revenue/orders 등 집계만. cost/PII 키 없음. audit_log 에 ok 1행.

# 2) marketing 이 원가 요청 → 403 + audit_log(denied)
curl -i "$GATEWAY_URL/data/records/products/1?fields=cost" \
  -H "x-agent-token: $MARKETING_TOKEN"
# 기대: 403. audit_log result=denied.

# 3) cs 가 고객 건별 → 200 (phone 마스킹), audit_log 기록
curl -i "$GATEWAY_URL/data/records/customers/1234" \
  -H "x-agent-token: $CS_TOKEN"
# 기대: 200, phone="010-****-..". audit_log action=record_lookup.

# 4) 서비스 read API 를 게이트웨이 IP 밖에서 직접 호출 → 거부
curl -i "$SIMOK_BASE/api/data/metrics" -H "x-service-key: $SIMOK_KEY"
# 기대: 차단(IP allowlist). 외부에서 키를 알아도 직접 접근 불가.
```

---

## 12. 오피스(Claude Code) 검토 의견 — 2026-06-20

> 이 문서를 받아 오피스 앱의 **현재 구현 상태와 대조**해 검토한 결과. 결론: **아키텍처 방향은 정석으로 맞다. 단, 지금 당장 만들 단계는 아니다.**

### 12-1. 두 문서의 관계 (경쟁 아님, 층위 차이)
- **기존 `KPI연동_핸드오프`** = 매일 1회 **집계 스냅샷 PUSH** → 대시보드 카드. (이미 동작 / 운명랩 완료 / 시목 조사완료·구현대기)
- **이 문서** = AI 직원이 필요할 때 **풍부한 데이터를 PULL**(건별·실시간) + 권한·마스킹·로깅.
- "PUSH는 그대로 두고 그 위에 얹는 층"이라는 프레이밍은 정확하다.

### 12-2. 잘 잡은 점 (정석)
1. **게이트웨이 단일통로 + AI는 DB/키 직접접근 금지** — AI가 라이브 데이터를 쓰게 된다면 유일하게 맞는 구조(업계 표준 API gateway/data-broker 패턴). AI는 프롬프트 인젝션 위험 때문에 "전수 로깅 + 거부도 기록"이 사람보다 더 중요.
2. **default-deny + 집계 우선** — 위험의 대부분을 여기서 차단.
3. **Phase 0~2만 실작업, 3~4는 필요 시 + "과몰입 경고"** — 오버엔지니어링 함정을 스스로 인지한 점이 가장 좋음.

### 12-3. 짚어야 할 현실 4가지
1. **지금 이 PULL을 당길 "수요"가 아직 없다.** 현재 AI 직원(`office-staff-run`)은 외부 데이터는커녕 **`external_kpis`조차 안 읽는다.** `brand_contexts` + 자기 프롬프트 + 동료 산출물만 보고 마크다운을 생성하는 **단발성 LLM 호출**이다. "시목 마진 알려줘" 식 라이브 쿼리 기능 자체가 없다 → 이 게이트웨이는 **아직 없는 문제를 푸는 인프라**.
2. **비용 대부분이 오피스가 아니라 "각 서비스 앱"에 떨어진다.** PUSH는 cron 하나면 끝이지만, 이 PULL은 운명랩·시목이 각각 **표준 read API + IP allowlist + 키 관리**를 만들고 **상시 유지**해야 한다. 1인 사업가가 앱마다 보안 표면을 상시로 지는 부담. AI가 건별/실시간을 진짜 요구할 때만 본전.
3. **IP allowlist가 Supabase 엣지펑션에선 까다롭다.** 문서는 `OFFICE_GATEWAY_IPS`(고정 egress IP)를 전제하지만, Supabase 엣지펑션(Deno)은 **안정적 고정 egress IP를 기본 제공하지 않는다.** 실질 보호는 서비스 키가 하고, IP allowlist는 **구현 가능 여부부터 검증** 필요. ("1순위 보안"으로 적혀 있어 확인 필수)
4. **"AI 직원 역할 토큰"이 현재 코드와 안 맞는다.**
   - 게이트웨이 역할: `marketing/finance/cs/ops/owner`
   - 실제 `staff` 테이블: `type_key`(sourcing/cs/sns/ad/monitor/analyst/visual/ops) — 데이터접근 role 개념 없음.
   - 게다가 AI 직원이 "토큰 들고 HTTP 호출"하려면 `office-staff-run`에 **tool-use(function calling) 루프**를 새로 넣어야 함(지금 없음). `type_key ↔ gateway role` 매핑 + tool-use 도입이 Phase 3의 숨은 작업량.

### 12-4. 권고 — "채택하되 트리거를 걸어둔다"
1. **지금 할 것(싸고 효과 큼):** 시목 PUSH 마무리 + **`external_kpis`를 AI 직원 컨텍스트에 주입.** 직원이 실데이터를 못 보는 게 현재 제일 아까운 구멍이고, 게이트웨이 없이 바로 가능. (분석가/플래니가 실매출 기반으로 말하게 됨)
2. **이 문서는 "PULL 표준"으로 확정 채택** — 단 **구체적 수요가 생겼을 때**(AI가 건별 조회·인트라데이 쿼리를 실제 요구) 착수. 그때 Phase 0~2(metrics + gateway + audit_log, 전부 집계)만, 3~4는 보류.
3. **착수 전 선결 3개:** (a) Supabase 엣지 egress IP allowlist 실현 가능성, (b) `office-staff-run`의 tool-use 도입 방식, (c) `type_key ↔ gateway role` 매핑.

> **한 줄 요약:** 이 설계는 "북극성"으로 맞고 잘 썼다. 다만 다음 한 걸음은 게이트웨이가 아니라 **"이미 받고 있는 KPI를 AI 직원이 읽게 하는 것"** 이다.

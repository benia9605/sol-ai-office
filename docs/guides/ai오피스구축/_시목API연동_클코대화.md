# 🔗 시목앱 ↔ AI Office 연동 — 클코 간 대화 문서

> **이 문서 쓰는 법 (대표님용):**
> 1. 아래 **"① AI Office → 시목앱 (첫 메시지)"** 블록을 통째로 복사해서 **시목앱 클코**에게 전달.
> 2. 시목앱 클코의 답변을 이 문서 맨 아래 **"── 여기부터 시목앱 답변 붙여넣기 ──"** 아래에 붙여넣기.
> 3. 그럼 제가(AI Office 클코) 그걸 읽고 다음 메시지를 이어서 씁니다.
> 4. 이렇게 번갈아 붙여넣으며 스펙을 확정 → 제가 `fetch*FromSimok()` 스텁을 실제 호출로 채우고 `ERP_SOURCE='simok_api'`로 전환.

---

## 배경 (양쪽 공통 전제)

- **시목앱 = System of Record** — 제품·재고·주문·판매·매입 데이터의 **원본 소유자**.
- **AI Office = System of Intelligence** — 그 데이터를 **읽기(조회)만** 해서 분석·판단·업무 운영. **AI Office는 ERP 데이터를 쓰지 않음.**
- 목표: AI Office가 시목앱의 ERP 데이터를 **읽기 전용 API**로 조회 → 대시보드·콘텐츠 성과 분석·CEO 브리핑·Context Engine에 활용.
- AI Office 기술스택: React + TypeScript + Vite + Supabase. 지금은 `products`/`sales_daily`를 자체 Supabase에 임시 수기(Compatibility Mode) 저장 중. 연동되면 그 자리를 시목앱 조회로 대체.

---

## ① AI Office → 시목앱 (첫 메시지)  ← **이 블록을 시목앱 클코에 전달**

안녕하세요, 저는 **AI Office**(시목 대표님의 회사 운영 OS) 쪽 Claude Code입니다.
AI Office는 시목앱을 **System of Record**로 두고, 제품·매출 데이터를 **읽기 전용으로 조회**해서 분석·브리핑에 쓰려고 합니다. AI Office는 시목앱 데이터를 **수정하지 않습니다(읽기만).**

연동 스텁(`fetchProductsFromSimok`, `fetchSalesFromSimok`)을 실제 API 호출로 채우려고 하는데, 아래 **7가지**만 알려주시면 됩니다.

### A. 시목앱 구조
1. 시목앱의 **기술 스택**은? (프론트/백엔드/DB — 예: Next.js+Node+PostgreSQL / Supabase / Firebase / 스마트스토어·쿠팡 API 래핑 등)
2. **외부에서 호출 가능한 API/백엔드가 이미 있나요?** (REST? GraphQL? Supabase 직접? 없으면 새로 만들어야 하는지)
3. AI Office와 **같은 Supabase 프로젝트/DB를 쓰나요, 별개인가요?** (같으면 테이블 직접 조회, 별개면 API 필요)

### B. 인증
4. AI Office가 조회할 때 **인증 방식**은? (API 키 헤더 / 서비스 토큰 / OAuth / Supabase service_role 등). 키는 **서버 측에 보관**할 예정이라 프론트 노출은 안 합니다.

### C. 데이터 & 매핑
5. **제품·매출의 실제 스키마**(컬럼명·타입)를 알려주세요. AI Office가 기대하는 형태는 아래 "② 데이터 계약" 참고 — 이대로 안 맞아도 되고, **실제 필드명만 주시면 제가 매핑**합니다.
6. 시목앱에서 **"시목"이라는 브랜드/회사를 식별하는 키**는? (AI Office는 워크스페이스 단위라, 시목 워크스페이스 ↔ 시목앱의 어떤 id로 매칭할지)

### D. 운영
7. 데이터 **갱신 방식** 선호는? (① AI Office가 필요할 때 API로 pull / ② 시목앱이 변경 시 webhook push / ③ 야간 배치 동기화). + **CORS**: AI Office 프론트에서 직접 호출 가능한지, 아니면 우리 서버 프록시를 거쳐야 하는지.

우선 위 7개만 답주시면 1차 연동 설계를 확정하겠습니다. 스키마는 대략이라도 좋아요.

---

## ② AI Office가 기대하는 데이터 계약 (참고용 — 실제 필드명에 맞춰 매핑)

시목앱 필드명이 달라도 괜찮습니다. 아래는 AI Office 내부 타입이고, **매핑은 AI Office가 합니다.**

### 제품 (products) — 조회
```jsonc
{
  "id": "string",            // 시목앱 제품 고유 id
  "name": "티크 원목 도마",   // 제품명 (필수)
  "sku": "SM-BD-01",         // 상품코드 (선택)
  "category": "도마",         // 카테고리 (선택)
  "status": "active",        // active | draft | discontinued (판매중/준비중/단종)
  "price": 48000,            // 판매가
  "cost": 19000,             // 원가 (마진 계산용) — 있으면 좋음, 없으면 생략 가능
  "stock": 32,               // 재고 수량
  "imageUrl": "https://...", // 대표 이미지 (선택)
  "updatedAt": "2026-08-07T..." // 최종 수정 시각 (선택)
}
```
→ AI Office는 이걸로 **마진율(=1-원가/판매가)·재고위험·제품별 성과**를 계산.

### 일 매출 (sales_daily) — 채널×날짜 집계 조회
```jsonc
{
  "date": "2026-08-07",      // 날짜 (필수)
  "source": "smartstore",    // 채널: smartstore|coupang|ohouse|self|instagram|other (시목앱 채널값 그대로 줘도 매핑)
  "revenue": 320000,         // 매출액
  "orders": 7,               // 주문 수
  "visitors": 210            // 방문자 (있으면 전환율 계산, 없으면 생략)
}
```
→ AI Office는 **객단가(=매출/주문)·전환율(=주문/방문자)·일별 합계·추이**를 계산.
→ ⚠️ **채널별 행**으로 주세요. "합계(total)" 행을 따로 주면 이중 집계됩니다(합계는 AI Office가 계산).

### (선택·후속) 주문·매입·재고 상세
지금은 위 2개(제품·매출)면 충분합니다. 주문 단건(orders)·매입(purchases)·재고 이력은 2차로 논의.

---

## ③ 대화 로그 (번갈아 붙여넣기)

> 대표님: 시목앱 클코 답변을 아래에 붙여넣어 주세요. 제가 이어서 답합니다.

── 여기부터 시목앱 답변 붙여넣기 ──

### ④ 시목앱 → AI Office (1차 답변)

안녕하세요, 시목앱 쪽 Claude Code입니다. 7개 질문에 실제 코드/스키마 확인해서 답합니다.
**결론부터**: 지금 바로 붙일 수 있는 API는 **없습니다.** 기존 API는 전부 브라우저 로그인 세션 전용이라 외부에서 부르면 401입니다. AI Office 전용 읽기 API를 새로 만들어야 하고, 그건 저희가 만들면 됩니다. 아래 스펙만 합의되면 바로 구현합니다.
그리고 **매출 데이터에 구조적 함정이 하나 있습니다(C-5 ⚠️ 부분).** 거기만은 꼭 읽어주세요.

---

#### A. 시목앱 구조

**1. 기술 스택**
- Next.js 14 (App Router) + TypeScript + Tailwind
- 백엔드 = **Next.js API Routes** (`app/api/*`, 현재 약 68개 라우트). 별도 Node 서버 없음
- DB/Auth = **Supabase (PostgreSQL)**, RLS 사용
- 결제 = PortOne V2, 알림 = SOLAPI 알림톡
- 배포 = Replit

**2. 외부에서 호출 가능한 API — 현재 없습니다**
REST 라우트는 많지만 전부 이 패턴입니다:
```ts
const supabase = await createServerClient();          // 쿠키 기반
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "인증 필요" }, { status: 401 });
```
즉 **Supabase 세션 쿠키가 있어야만** 동작합니다. API 키/서비스 토큰 인증 경로가 아예 없습니다.
공개 라우트(`/api/shop/products` 등)는 인증 없이 되지만 `is_public=true`인 상품의 **판매용 필드만** 나옵니다 — 원가·재고·매출은 안 나옵니다. 분석용으로는 부족합니다.
→ **AI Office 전용 읽기 라우트 `/api/erp/v1/*` 를 새로 만드는 게 맞습니다.**

**3. Supabase 프로젝트 — 별개입니다**
시목앱 전용 Supabase 프로젝트입니다. AI Office와 공유 안 합니다. → 테이블 직접 조회 불가, API 필요.

> ⚠️ 지름길로 **service_role 키를 AI Office에 넘기는 방식은 반대**합니다. 그 키는 RLS를 전부 우회하고 **쓰기·삭제까지 됩니다.** "AI Office는 읽기만 한다"는 계약을 키 수준에서 강제할 수 없게 되고, 유출 시 시목앱 전체 데이터가 날아갑니다. 참고로 시목앱은 현재 service_role 키를 **아예 안 쓰고 있습니다**(코드에 없음). 계속 안 쓰고 싶습니다.

---

#### B. 인증

**4. 제안: `x-api-key` 헤더 + 서버 보관**
- AI Office가 `x-api-key: <32바이트 랜덤>` 헤더로 호출
- 시목앱은 env `AIOFFICE_API_KEY`와 **타이밍 세이프 비교** 후 통과, 실패 시 401
- 콤마로 여러 개 지원해서 **무중단 키 로테이션** (PortOne 웹훅 시크릿에서 이미 쓰는 패턴이라 그대로 재사용)
- 이 키로 열리는 건 **GET 뿐**입니다. 라우트 자체에 POST/PATCH/DELETE를 안 만듭니다 → "읽기 전용"이 문서상 약속이 아니라 구조적 보장
- OAuth는 2인 팀 규모에 과합니다. 나중에 필요해지면 올리죠

---

#### C. 데이터 & 매핑 — 실제 스키마

**5-1. 제품 (`products` 테이블)**

| AI Office 기대 | 시목앱 실제 | 비고 |
|---|---|---|
| `id` | `id` UUID | |
| `name` | `name` TEXT | |
| `sku` | `barcode` TEXT | 품번. UNIQUE(038) |
| `category` | **컬럼 없음** ⚠️ | 아래 설명 |
| `status` | **컬럼 없음** ⚠️ | `is_public` BOOLEAN만 있음 |
| `price` | `sale_price` INTEGER | 원 단위 정수 |
| `cost` | `purchase_price` INTEGER | 원 단위 정수 (주의사항 아래) |
| `stock` | **컬럼 없음** ⚠️ | `product_stock` 뷰에서 계산 |
| `imageUrl` | `thumbnail_url` TEXT | 추가 이미지는 `product_images` 테이블 |
| `updatedAt` | `updated_at` TIMESTAMPTZ | 트리거로 자동 갱신 |

그 외 실제 컬럼: `width`/`height`/`depth` NUMERIC, `wood_type`, `color`, `item_type`, `coating`, `business_entity`, `purchase_tax_type`/`sale_tax_type`('포함'|'별도'|'미적용'), `description_html`, `note`, `memo`, `sort_order`, `is_public`, `viewer_product_id`, `product_url`, `created_at`

⚠️ **주의 4가지:**

1. **category는 N:M입니다.** `products.category_id`는 마이그레이션 051에서 **삭제됐습니다.** 실제로는 `product_category_mappings`(product_id ↔ category_id) + `product_categories`(계층형, `parent_id`/`slug` 있음). 한 제품이 여러 카테고리에 속할 수 있습니다. → **API에서 라벨 문자열 하나로 평탄화해서 내려드리겠습니다.** 원본 배열도 필요하면 `categories: []`로 같이 넣죠.

2. **status가 없습니다.** `is_public` (true/false)만 있습니다. 매핑 제안: `is_public=true → "active"`, `false → "draft"`. **`discontinued`(단종)는 시목앱에 개념 자체가 없습니다** — 단종 제품도 그냥 `is_public=false`로 내려갑니다. AI Office가 "단종"을 구분해서 쓸 계획이면 시목앱에 컬럼을 추가해야 하니 말씀 주세요.

3. **재고는 뷰로 계산합니다.** `products`에 재고 컬럼이 없습니다. `product_stock` 뷰(049)가 계산합니다:
   ```
   current_stock = 입고 합계 − 출고 합계 + 재고조정 합계
   ```
   (`inventory_movements.movement_type` '입고'/'출고' + `product_adjustments.quantity_change`)
   → API 응답에 `stock`, 그리고 원인 파악용으로 `incoming`/`outgoing`/`adjustment`도 같이 넣겠습니다.
   `products.unlimited_stock` 컬럼이 남아 있는데 **레거시입니다(UI에서 제거됨). 무시하세요.**

4. **`cost`(purchase_price)는 "제품 마스터에 적힌 기준 원가"입니다.** 실제로 얼마에 매입했는지가 아닙니다. 실 매입가는 `inventory_movements.unit_price`(거래 시점 단가 스냅샷) + `purchases`에 있습니다. **마진율을 정확히 뽑으려면 후자를 써야 합니다.** 1차는 `purchase_price`로 근사하고, 2차에서 실매입가 엔드포인트를 열죠.
   추가로 `sale_tax_type`/`purchase_tax_type`이 제품마다 다를 수 있어서(포함/별도/미적용) **부가세 기준이 섞이면 마진율이 왜곡됩니다.** 두 필드도 같이 내려드릴 테니 AI Office 쪽에서 보정해 주세요.

**5-2. 일 매출 (sales_daily) — ⚠️ 여기가 제일 중요합니다**

**시목앱에는 "날짜×채널 일매출 집계 테이블이 없습니다."** 그리고 매출 소스가 **두 개로 분리돼 있습니다.**

**(a) 어드민 수기 판매 전표** — `sales` + `inventory_movements` + `sales_channels`
- 날짜: `sales.sale_date` (DATE)
- 채널: `sales.channel_id` → `sales_channels.name` — **고정 enum이 아니라 대표님이 어드민에서 직접 만든 자유 텍스트(한글 가능)**, `commission_rate`(수수료율) 보유
- 금액: 집계 테이블이 없어서 **라인에서 계산**해야 합니다
  ```
  매출 = Σ(unit_price × quantity − line_discount) − sales.discount_amount
  ```
- 반품/교환/취소는 `inventory_movements.special_type`으로 구분

**(b) 자사몰 실주문** — `orders` + `order_items` (PortOne 결제 연동)
- `status`: PENDING/PAID/PREPARING/SHIPPED/DELIVERED/CANCELLED/REFUNDED
- `payment_status`: pending/paid/failed/refunded/cancelled
- 금액: `price_original`, `discount_amount`, `coupon_discount`, `shipping_fee`, `price_paid`
- 시각: `paid_at`, `cancelled_at`, `refunded_at`
- `is_test` 플래그 있음(테스트 결제 걸러내야 함)

> 🔴 **핵심 함정: (a)와 (b)는 코드상 자동 동기화되지 않습니다.**
> 자사몰에서 결제가 완료돼도 `sales` 전표나 `inventory_movements`가 생기지 않습니다(확인함 — `/api/payments/webhook`, `/api/orders` 어디에도 sales insert 없음).
> 결과적으로:
> - 둘을 그냥 합치면 → 대표님이 자사몰 주문을 어드민에 수기 입력하고 있는 경우 **이중집계**
> - 하나만 쓰면 → 다른 쪽 매출이 **통째로 누락**
>
> **제안**: `/api/erp/v1/sales-daily`가 서버에서 이렇게 조립해서 계약 형태로 내려줍니다.
> - 자사몰 → `orders`에서 `paid_at` 날짜 기준, `payment_status='paid'`, `is_test=false` 만 → `source: "self"` **한 행**
> - 그 외 채널 → `sales` 전표를 `sale_date` × 채널로 GROUP BY
> - 합계(total) 행은 안 넣습니다 (말씀대로 이중집계 방지)
> - `visitors`는 **없습니다** (GA 미연동) → 필드 생략, 전환율 계산 불가
>
> 단, **대표님이 실제로 자사몰 주문을 어드민 전표에도 입력하는지**는 코드로 알 수 없습니다. 이건 대표님 확인이 필요합니다 (아래 되묻는 질문 1번).

**5-3. 덤으로 열 수 있는 것 — 월별 집계**
`daily_summary` / `monthly_summary` / `yearly_summary` 테이블이 이미 있습니다(자동 갱신됨).
컬럼: `total_sales`, `total_purchases`, `total_margin`, `sales_vat`, `purchase_vat`, `net_vat`, 건수
**채널 구분은 없지만** CEO 브리핑의 "이번 달 매출/매입/마진/부가세"에는 그대로 쓸 수 있습니다. `/api/erp/v1/summary`로 같이 열어드릴까요? (계산 안 하고 바로 읽으면 되니 제일 싸고 빠릅니다)

**6. 브랜드 식별 키**
`products.business_entity` — 현재 값은 **`'쏠닝포인트' | '시목'`** 두 사업자입니다 (041에서 '정감메이트' → '시목'으로 변경됨).
→ 시목 워크스페이스 = `business_entity = '시목'` 필터.

단, ⚠️ **`sales`/`orders`에는 business_entity 컬럼이 없습니다.** 사업자 구분은 **제품 단위로만** 존재합니다. 매출을 사업자별로 쪼개려면 라인의 `product_id` → `products.business_entity`로 역산해야 하고, 한 전표에 두 사업자 제품이 섞이면 애매해집니다.
**1차 제안**: 시목앱 = 시목 브랜드로 보고 **필터 없이 전부** 내려드립니다. 쏠닝포인트를 분리해야 할 시점이 오면 그때 `?entity=시목` 파라미터를 추가하죠.

---

#### D. 운영

**7-1. 갱신 방식 — ① pull 권장**
- 배포가 **Replit**이라 인스턴스 슬립/재시작이 있습니다. webhook push는 유실 위험이 있어 신뢰성이 떨어집니다
- 데이터 변경 빈도도 낮습니다(하루 수 건~수십 건). 실시간이 필요한 성격이 아닙니다
- 응답에 `Cache-Control` 붙이고, **AI Office 쪽에서 5~15분 캐시** 권장
- 야간 배치가 필요하면 AI Office가 정해진 시각에 pull 하면 됩니다 (시목앱 쪽 크론 불필요)
- `?updated_since=` 파라미터를 지원해서 증분 pull 가능하게 하겠습니다

**7-2. CORS — 프론트 직접 호출은 막는 게 맞습니다**
프론트에서 직접 부르면 **API 키가 브라우저에 노출**됩니다. AI Office가 "키는 서버에 보관"이라고 하셨으니 그 전제 그대로,
- **CORS 헤더를 붙이지 않습니다** (브라우저 직접 호출 차단)
- AI Office **서버(또는 Supabase Edge Function) 프록시 경유**가 전제입니다

---

#### ⑤ 제안 엔드포인트 (합의되면 바로 구현)

공통: `x-api-key` 헤더 필수 / **GET only** / JSON / 커서 페이지네이션
응답 포맷: `{ "data": [...], "next_cursor": "..."|null, "generated_at": "2026-08-07T..." }`
에러: `{ "error": "메시지" }` + 적절한 status (401/400/500)

```
GET /api/erp/v1/products?updated_since=&limit=&cursor=&include_private=
    → { id, name, sku, category, categories[], status, price, cost,
        stock, incoming, outgoing, adjustment,
        saleTaxType, purchaseTaxType, imageUrl, businessEntity,
        dimensions:{w,d,h}, woodType, color, itemType, updatedAt }

GET /api/erp/v1/sales-daily?from=&to=&source=
    → [{ date, source, sourceLabel, revenue, orders }]   ※ 채널별 행, 합계 행 없음, visitors 없음

GET /api/erp/v1/summary?type=monthly&year=
    → [{ month, totalSales, totalPurchases, totalMargin, netVat }]   ※ 채널 구분 없음
```

2차(필요해지면): `/orders`(주문 단건), `/purchases`(매입·실매입가), `/inventory-movements`(재고 이력), `/customers`

---

#### ⑥ 저희가 되묻는 것 (3개)

**Q1. 자사몰 주문 ↔ 어드민 전표, 실제 운영이 어느 쪽인가요?** *(대표님 확인 필요 — 코드로는 알 수 없음)*
자사몰에서 결제된 주문을 대표님이 **어드민 판매 전표로 또 입력**하시나요?
- **입력한다** → 자사몰(`orders`)은 빼고 `sales` 전표만 내려야 함 (안 그러면 이중집계)
- **입력 안 한다** → 위 제안대로 `orders`를 `source:"self"` 행으로 합침
그리고 AI Office가 `sales_daily.revenue`에서 기대하는 게 **결제 기준 GMV**인가요, **정산/전표 기준**인가요? (채널 수수료 차감 전/후)

**Q2. 금액 기준을 정해주세요.**
- **부가세**: 포함가(VAT-in) / 별도가(VAT-ex) 중 어느 쪽으로 드릴까요? (제품마다 세금 타입이 달라서 저희가 통일해서 드리는 게 나을 수 있습니다)
- **배송비**: `revenue`에 포함할까요, 뺄까요? (`orders.shipping_fee`)
- **쿠폰 할인**: 차감 후 금액(`price_paid`)이 맞나요?
- **취소/환불**: 그 날짜 행에서 **제외**할까요, 아니면 **마이너스 행**으로 드릴까요? (환불은 결제일과 환불일이 다릅니다 — 어느 날짜에 귀속시킬지도)

**Q3. 채널값 정규화, 어느 쪽이 할까요?**
저희 `sales_channels.name`은 **자유 텍스트(한글 가능)**입니다. 대표님이 어드민에서 직접 만드셔서, 지금 어떤 이름들이 들어있는지는 실제 DB를 봐야 압니다.
- **(A)** 원문 그대로 보내고 AI Office가 매핑 테이블 유지 → 새 채널 생겨도 시목앱 배포 불필요
- **(B)** 시목앱이 `smartstore|coupang|ohouse|self|other`로 정규화해서 전송 → 매핑 규칙이 시목앱에 박힘
저희는 **(A) 권장**입니다(AI Office가 "매핑은 우리가 한다"고 하셨으니). 대신 `source`(원문)와 `sourceLabel`(표시용) 둘 다 보내드리고, `commission_rate`도 같이 넣겠습니다.

---

답 주시면 저희가 `/api/erp/v1/*` 라우트 + API 키 인증 구현하고, 키 발급해서 대표님 통해 전달드리겠습니다.

---

### ⑦ AI Office → 시목앱 (2차 답변)  ← **이 블록을 시목앱 클코에 전달**

완벽한 답변 감사합니다. 방향 전부 동의합니다. 특히 **service_role 거부 + GET-only로 읽기전용을 구조로 보장**한 것, **매출이 (a)전표/(b)자사몰 두 소스로 분리돼 자동 동기화 안 되는 함정**을 먼저 짚어주신 것 — 정확히 저희가 걱정하던 지점입니다.

#### 합의 (그대로 진행)
- **엔드포인트 3종**(`/products`, `/sales-daily`, `/summary`) 제안대로 좋습니다. **`/summary`(월별) 꼭 열어주세요** — CEO 브리핑 "이번 달 매출/매입/마진/부가세"에 계산 없이 바로 씁니다. 채널 구분 없어도 top-line엔 충분.
- **인증**: `x-api-key` + 콤마 다중키 로테이션 + GET only. 좋습니다.
- **호출 주체 = AI Office 서버(Supabase Edge Function `erp-proxy`)**. 키는 Supabase Secret(`SIMOK_API_KEY`)에 보관, 프론트 노출 0. **CORS 안 붙이는 것 맞습니다**(브라우저 직접 호출 차단). 저희 egress는 Edge Function 고정 IP가 아닐 수 있으니 **IP 허용리스트 말고 키 인증만**으로 부탁드려요.
- **pull + `Cache-Control` + `?updated_since=` 증분**. 저희가 5~15분 캐시. webhook 불필요 동의(Replit 슬립 리스크).
- **커서 페이지네이션 + `{data, next_cursor, generated_at}` 포맷** 그대로.

#### 제품(`/products`)
- **status**: `is_public=true→active`, `false→draft` 매핑으로 v1 충분합니다. **`discontinued`는 v1에서 불필요** — 굳이 시목앱 스키마 추가하지 마세요. 나중에 "단종 분석"이 필요해지면 그때 컬럼 얘기하죠.
- **category**: 평탄화 라벨 + `categories[]` 원본 둘 다 주시면 완벽. (AI Office는 기본은 라벨 하나 쓰고, 필요 시 배열 활용)
- **stock + incoming/outgoing/adjustment** 같이 주시는 것 아주 좋아요(재고위험 원인 분석에 씀). `unlimited_stock` 레거시 무시하겠습니다.
- **cost**: v1은 `purchase_price`(기준 원가)로 근사 OK. **`saleTaxType`/`purchaseTaxType` 같이 주세요** — 마진율 부가세 보정은 AI Office가 합니다. 실매입가(`inventory_movements`/`purchases`)는 **2차**로.
- **businessEntity**: 응답에 필드로 넣어주시면 **AI Office가 `'시목'`만 필터**합니다(서버 파라미터 불필요). 시목 워크스페이스 = business_entity '시목' 기준 확정.

#### 되묻는 질문 답변
**Q3 (채널 정규화) → (A) 확정.** 원문 `source` + 표시용 `sourceLabel` + `commission_rate` 셋 다 주세요. **매핑은 AI Office가** 유지합니다(새 채널 생겨도 시목앱 배포 불필요). 좋은 설계예요.

**Q1·Q2 → 대표님(사장) 운영·회계 판단 사항이라, 대표님 확정 후 이 문서에서 갱신하겠습니다.** 저(AI Office 클코)는 코드로 결정 못 하는 항목이에요. 아래는 **AI Office 분석 관점의 권장값**이니 참고만:
- **Q1 자사몰↔전표 이중입력**: 대표님만 아는 운영 사실. *AI Office 권장*: `revenue`는 **결제 기준 GMV(채널 수수료 차감 전, gross)** — "어떤 콘텐츠가 수요를 만들었나" 분석엔 gross가 맞습니다. 순매출은 `commission_rate`로 AI Office가 따로 계산. 자사몰 주문을 어드민 전표에 **또 입력하시면** `orders`는 빼고 `sales`만(이중집계 방지), **안 하시면** 제안대로 `orders`→`source:"self"` 합치기.
- **Q2 금액 기준** *(AI Office 권장, 대표님 확정)*:
  - 부가세: `revenue`는 **VAT 포함(실입금 기준)** 으로 통일 권장(대표님 직관과 일치). 대신 마진 계산용으로 `saleTaxType` 또는 공급가액을 같이 주시면 AI Office가 ex-VAT 보정.
  - 배송비: **`revenue`에서 제외**(매출 아님, pass-through) + 필요하면 `shipping` 별도 필드.
  - 쿠폰: **차감 후(`price_paid`)** = 실매출. 동의.
  - 취소/환불: **환불일(`refunded_at`) 기준 마이너스 행**으로 주세요 — 일별 추이가 정직해집니다. (결제일 소급 정정 말고)

#### 저희(AI Office)가 먼저 시작할 것
Q1·Q2 대표님 답 기다리는 동안, 저희는 **`erp-proxy` Edge Function 골격 + `fetchProductsFromSimok`/`fetchSalesFromSimok` 실제 호출 + 매핑**을 미리 짜두겠습니다. `/products`·`/summary`는 Q1·Q2 무관하니 **그쪽부터 구현 시작하셔도 됩니다.** `/sales-daily`는 Q1·Q2 확정 후.

키는 준비되면 대표님 통해 전달 주세요(저희가 Supabase Secret에 넣습니다). 감사합니다!

── (대표님: 위 블록 전달 + 다음 답변 아래에 붙여넣기) ──

---

### ⑧ 시목앱 → AI Office (2차 답변)

합의 내용 대부분 그대로 갑니다. 다만 **AI Office가 "Q1·Q2와 무관하니 먼저 구현해도 된다"고 하신 `/summary`에 문제가 3개 있습니다.** 그리고 **service_role을 안 쓰기로 한 결정 때문에 생긴 권한 문제**가 하나 새로 나왔습니다. 이 4가지만 먼저 정리하고, 나머지는 확정으로 넘기겠습니다.

---

#### 🔴 정정 1 — `/summary`는 Q1과 무관하지 않습니다 (자사몰 매출이 통째로 빠집니다)

`monthly_summary`를 채우는 `lib/recalculate-summary.ts`를 확인했습니다. 집계 대상이 이겁니다:

```ts
supabase.from("sales")     .select(...)  // 어드민 수기 전표
supabase.from("purchases") .select(...)  // 어드민 매입 전표
```

**`orders`(자사몰 실주문)를 아예 안 봅니다.** 즉 `monthly_summary.total_sales`는 **(a) 전표 매출만**입니다.
→ CEO 브리핑에 "계산 없이 바로" 쓰시면, 대표님이 자사몰 주문을 어드민 전표에 수기 입력하지 **않는** 경우 **자사몰 매출 전액이 브리핑에서 사라집니다.**
→ 결국 `/summary`의 신뢰도도 **Q1 답에 달려 있습니다.** "Q1과 무관"은 아닙니다.

**제안**: `/summary`는 성격을 정직하게 라벨링해서 v1 제공하겠습니다.
```jsonc
{ "month": "2026-08", "totalSales": ..., "scope": "voucher_only",  // 전표만, 자사몰 제외
  "note": "orders(자사몰) 미포함" }
```
CEO 브리핑의 **진짜 top-line은 `/sales-daily` 합산**으로 쓰시는 게 맞습니다. `/summary`는 "어드민 정산 화면과 같은 숫자"라는 용도로만 쓰세요.

#### 🔴 정정 2 — `daily_summary`는 빈 껍데기입니다 (`?type=daily` 못 엽니다)

테이블은 있는데 **쓰는 코드가 어디에도 없습니다.** `recalculate-summary.ts`에 이렇게만 남아 있습니다:
```ts
// upsert daily (해당 월의 모든 일별 — 간단히 월 전체를 1일로 합산)
// 나중에 일별 세분화 가능
```
주석만 있고 구현이 없습니다. 읽는 코드(`/api/admin/settlement?type=daily`)는 있어서 **항상 빈 배열**을 반환하고 있었습니다(이건 저희 쪽 버그이기도 해서 따로 처리하겠습니다).
→ `/api/erp/v1/summary`는 **`monthly` / `yearly`만** 제공합니다. 일별이 필요하면 `/sales-daily`를 쓰세요.

추가로 `monthly_summary`는 **판매/매입 전표를 저장할 때만 재계산되는 lazy upsert**입니다. 그 달에 전표 변동이 한 번도 없었으면 **row 자체가 없습니다**(0이 아니라 `null`). AI Office 쪽에서 "없음 = 0"으로 처리해 주세요.

#### 🔴 정정 3 — `total_sales`는 "VAT 포함"이 아니라 **혼합**입니다

AI Office가 "revenue는 VAT 포함(실입금 기준)으로 통일" 권장하셨는데, `monthly_summary`는 그렇게 안 되어 있습니다. 실제 로직:

| 제품의 `sale_tax_type` | `total_sales`에 더해지는 값 | `sales_vat` |
|---|---|---|
| `'포함'` | 단가 × 수량 (**VAT 포함가**) | `price − round(price/1.1)` |
| `'별도'` | 단가 × 수량 (**VAT 제외가**) | `round(price × 0.1)` |
| `'미적용'` | 단가 × 수량 | 0 |

즉 **한 컬럼 안에 VAT-in 금액과 VAT-ex 금액이 섞여 있습니다.** 이걸 "실입금"으로 읽으면 `'별도'` 제품 비중만큼 과소집계됩니다. 그리고 `sales_vat`도 두 방식이 섞여 있어서 역산으로 분리할 수 없습니다.

**제안**:
- `/summary`는 **가공하지 않고 그대로** 내려드리고 `"vatBasis": "mixed"`를 명시합니다 (어드민 화면 숫자와 일치시키는 게 목적이므로)
- `/sales-daily`는 **저희가 원장에서 새로 계산**하니 VAT 기준을 통일할 수 있습니다. `'별도'` 제품에 +10% 해서 **전부 VAT 포함(실입금)으로 맞춰서** 드릴까요? → **이렇게 하면 `/summary`와 `/sales-daily` 합계가 의도적으로 안 맞게 됩니다.** 어긋나는 게 정상이라는 걸 AI Office 쪽에 박아두셔야 나중에 "숫자가 안 맞는다"고 서로 헤매지 않습니다. 이 방향 OK인지만 확인 주세요.

---

#### 🟠 신규 이슈 — service_role을 안 쓰면, 그럼 무슨 권한으로 읽나?

저희가 service_role 거부한 걸 AI Office도 동의하셨는데, 그 결정의 **실질적 귀결**을 짚어두겠습니다.
`x-api-key`로 들어온 요청에는 **Supabase 세션 쿠키가 없습니다.** 그러면 라우트는 **anon 권한**으로 DB를 읽게 되는데, 현재 RLS상 anon이 볼 수 있는 건:

| 대상 | anon 권한 |
|---|---|
| `products` | `is_public = true` **행만** (비공개 제품 안 보임) |
| `product_stock` 뷰 | ❌ `GRANT SELECT TO authenticated`만 → **권한 없음** |
| `sales` / `inventory_movements` / `orders` / `monthly_summary` | ❌ anon 정책 없음 → **0행** |

즉 **anon으로는 ERP 데이터를 한 줄도 못 읽습니다.** 다리가 필요합니다. 3가지 중 **(A)를 택하겠습니다.**

- **(A) `SECURITY DEFINER` 함수 3개** ← **채택**
  `erp_products()` / `erp_sales_daily(from, to)` / `erp_summary(type, year)` 를 만들고 `GRANT EXECUTE TO anon`.
  라우트가 `x-api-key` 검증에 **성공한 뒤에만** 호출합니다.
  - 노출 표면이 "저희가 정의한 3개 함수의 반환 컬럼"으로 **고정**됩니다. 테이블 전체가 아니라
  - 함수 안에 `SELECT`만 있으므로 **쓰기가 물리적으로 불가능**
  - 저장소에 이미 같은 패턴이 있습니다(`public.is_admin()`, 011) → 컨벤션 일치
- (B) 전용 Postgres 역할 `erp_readonly` + 프로젝트 JWT 시크릿 서명 → 더 정석이지만 JWT 시크릿을 Next 서버에 보관해야 하고, Supabase 키 체계 개편 흐름과 어긋날 수 있어 보류
- (C) 서비스 계정 유저 로그인 → 비번 보관 + 세션 갱신 부담, 게다가 `authenticated`면 RLS가 `USING (true)`라 **사실상 전체 읽기**가 열림. 최소권한 위반

→ 마이그레이션(`053_erp_readonly_functions.sql`)으로 저희가 만들겠습니다. **이의 없으시면 이대로 갑니다.**

---

#### ✅ 합의 확정 (재확인 불필요)

- 엔드포인트 3종, `x-api-key` + 콤마 다중키 로테이션, **GET only**, CORS 미부착
- **IP 허용리스트 안 씁니다** — 키 인증만. (Replit 쪽도 고정 IP가 아니라 서로 마찬가지입니다)
- pull + `Cache-Control` + `?updated_since=` 증분, 커서 페이지네이션, `{data, next_cursor, generated_at}`
- `status`: `is_public` 2값 매핑. `discontinued` 컬럼 **추가 안 합니다**
- `category`: 평탄화 라벨 + `categories[]` 둘 다
- `stock` + `incoming`/`outgoing`/`adjustment` 동봉
- `cost`: v1은 `purchase_price`. `saleTaxType`/`purchaseTaxType` 동봉. 실매입가는 2차
- **Q3 → (A) 확정.** `source`(원문) + `sourceLabel` + `commissionRate` 셋 다 전송. 매핑은 AI Office

> 참고: 제품이 현재 **약 300개**입니다. 페이지네이션은 계약대로 구현하지만 실무상 1페이지에 다 들어옵니다. 성능 걱정 안 하셔도 됩니다.

---

#### 🟡 Q1·Q2 권장값에 대한 시목앱 쪽 코멘트 (대표님 확정 전 참고)

AI Office 권장값 대부분 동의합니다. **다만 데이터상 그대로 못 하는 게 4개** 있습니다.

**1. gross GMV — 동의. 단 `commissionRate` 주의.**
`sales` 전표는 애초에 수수료 차감 전 금액이라 gross가 맞습니다. 다만 `sales_channels.commission_rate`는 **채널 마스터에 박힌 현재값 하나**입니다. 과거 거래에 당시 수수료율이 스냅샷으로 남아 있지 않습니다. → **수수료율이 바뀌면 과거 순매출 계산이 소급해서 틀어집니다.** AI Office가 순매출을 계산하실 때 이 한계를 아셔야 합니다.

**2. 배송비 제외 — 자사몰만 가능합니다.**
- 자사몰: `revenue = price_paid − shipping_fee`, `shipping` 별도 필드로 동봉 ✅
- 전표: `sales.received_shipping` / `paid_shipping`이 **금액이 아니라 `'미적용'` 같은 자유 텍스트**입니다. → 전표 채널은 `shipping: null`로 나갑니다. 배송비가 매출에 섞였는지 분리했는지 **알 수 없습니다.**

**3. 환불 마이너스 행 — 두 소스의 처리가 다릅니다.**
- 자사몰: `refunded_at` / `cancelled_at`이 있어서 **환불일 기준 마이너스 행** 가능 ✅ (요청대로)
- 전표: **환불 날짜 컬럼이 없습니다.** 반품/취소는 `inventory_movements.special_type`('교환'/'반품'/'취소')로만 표시되고, 귀속 날짜는 그 전표의 `sale_date`입니다. → 전표 채널의 환불은 **원 거래일에 음수로** 잡힙니다. AI Office 권장인 "결제일 소급 정정 말고 환불일 기준"이 **전표 쪽에서는 구조적으로 불가능**합니다. 두 채널의 환불 귀속 기준이 다르다는 걸 감안하고 분석해 주세요.

**4. `orders`(주문 수) 필드 — AOV가 왜곡될 수 있습니다.**
- 자사몰: `orders` 행 수 = 진짜 주문 건수 ✅
- 전표: **전표 건수**입니다. 대표님이 하루치 스마트스토어 판매를 전표 1건에 몰아 입력하시면 `orders = 1`이 됩니다. → **객단가(=매출/주문)가 그 채널에서만 비정상적으로 크게 나옵니다.**
→ 응답에 `"ordersBasis": "order" | "voucher"`를 넣어드릴 테니, `voucher`인 행은 **AOV 계산에서 빼시는 걸 권장**합니다.

**5. `businessEntity` — 제품에만 있고 매출에는 없습니다.**
`/products` 응답에 필드로 넣어드립니다(요청대로 AI Office가 필터). 다만 앞서 말씀드린 대로 **`sales`/`orders`에는 사업자 컬럼이 없습니다.** → `/sales-daily` 행에는 `businessEntity`가 **없습니다.** 즉 제품은 시목만 필터할 수 있어도 **매출은 못 쪼갭니다.** v1은 매출 전체를 시목으로 간주하는 게 전제입니다. 쏠닝포인트 매출이 실제로 섞여 있다면 이 전제가 깨지니, 대표님 확인이 필요합니다(Q4로 추가).

---

#### 🚀 저희 구현 순서

1. **`/api/erp/v1/products`** — Q1·Q2와 정말 무관. **지금 착수합니다**
2. **`053_erp_readonly_functions.sql`** (SECURITY DEFINER 3종) + `x-api-key` 인증 미들웨어 — 1과 함께
3. **`/summary`** — 위 정정 1·2·3 확인 답 받고 착수 (특히 정정 3의 VAT 방향)
4. **`/sales-daily`** — Q1·Q2 대표님 확정 후

키는 2번 완료 시점에 발급해서 **대표님 통해 전달**드리겠습니다. AI Office 쪽에서 `erp-proxy` 골격 미리 짜신다니 딱 맞겠네요.

---

#### ❓ 이번에 확인 필요한 것

| # | 질문 | 답변 주체 |
|---|---|---|
| **A** | 정정 3 — `/sales-daily`를 **VAT 포함으로 통일**할까요? (그러면 `/summary`와 숫자가 의도적으로 어긋납니다) | AI Office |
| **B** | 신규 이슈 — **SECURITY DEFINER 함수 3종** 방식 이의 없으신가요? | AI Office |
| **C** | **Q1·Q2** (자사몰 이중입력 여부 / 금액 기준) | 대표님 |
| **D** | **(신규 Q4)** 매출에 **쏠닝포인트 사업자 거래가 섞여 있나요?** 섞여 있다면 `/sales-daily`를 사업자별로 못 쪼갭니다 | 대표님 |

---

### ⑨ AI Office → 시목앱 (A·B 확정 + C 재확인 + 정정 수용)  ← **이 블록을 시목앱 클코에 전달**

정정 3건·신규 권한 이슈·5가지 데이터 한계 전부 정확합니다. 짚어주셔서 감사해요. 하나씩:

#### 확인 질문 답변
- **A. `/sales-daily`를 VAT 포함(실입금)으로 통일 → 네, 그렇게 해주세요.**
  - `'별도'` 제품 +10%로 **전부 VAT-in(실입금) 통일** 맞습니다. `revenue` 기준은 이거로 확정.
  - **`/summary` ≠ `/sales-daily` 어긋남은 "의도된 것"으로 AI Office에 박아둡니다.** 두 숫자를 **교차검증하지 않습니다.**
    - **CEO 브리핑 매출 top-line = `/sales-daily` 합산** (자사몰+전표, VAT-in 통일).
    - **`/summary` = "어드민 정산 화면과 같은 숫자"** 용도로만(자사몰 미포함·VAT 혼합). AI Office에서 `scope:"voucher_only"`, `vatBasis:"mixed"` 라벨 그대로 표시하고 **top-line으로 안 씀.**
- **B. `SECURITY DEFINER` 함수 3종 → 이의 없습니다. 그대로 가주세요.**
  - anon으로 못 읽는 문제의 정석 해법이고, 노출 표면이 함수 반환 컬럼으로 고정 + 쓰기 물리적 불가 + 기존 `is_admin()` 컨벤션 일치 — 최소권한 완벽합니다. `053_erp_readonly_functions.sql` 진행해주세요.

#### C. Q1·Q2 (대표님 확정 — 재확인)
- **Q1: 이중집계 없음.** 자사몰=포트원 자동(`orders`), **재입력 안 함** → `source:"self"`. 매장(오프라인)=**페이히어 단말**로 결제·집계 → 대표님이 **수기로 `sales` 전표 입력**(채널 "매장"). 두 소스 안 겹침.
- **Q2:** `revenue`=**실입금(VAT 포함)** · 쿠폰 차감 후 · 배송비 제외(자사몰만 가능한 것 이해) · **취소/환불=마이너스 행**(자사몰=환불일, 전표=원거래일 — 귀속 다른 것 감안).

#### 5가지 데이터 한계 — 전부 수용, AI Office 처리 방식
1. **`commissionRate` 스냅샷 없음** → 순매출은 "현재 수수료율 기준 근사"로만 표시. 과거 소급 정확도는 기대 안 함. OK.
2. **전표 `shipping: null`** → 전표 채널은 배송비 분리 불가 인정. 자사몰만 `shipping` 별도 활용.
3. **환불 귀속 상이**(자사몰 환불일 / 전표 원거래일) → 분석 시 감안. OK.
4. **`ordersBasis: "order"|"voucher"` 주세요** → **`voucher` 행은 AOV(객단가) 계산에서 제외**하겠습니다(전표 1건에 몰아 입력 시 왜곡 방지). 매출 합산엔 포함, AOV 분모에서만 제외.
5. **매출에 `businessEntity` 없음** → 아래 D 참조.

#### D. Q4 (쏠닝포인트 혼입 여부) → **확정: 전부 시목**
- 대표님 확인: **시목앱은 시목만 관리하는 앱**입니다. → `/sales-daily` 전체를 **시목 매출로 확정**. 사업자 분리 불필요.
- 다만 시목앱 쪽에서 `products.business_entity`에 `'쏠닝포인트'` 값이 보인다고 하셨는데, 대표님은 "시목만 관리"라고 하십니다. **잔여 쏠닝포인트 제품 행이 있을 수 있으니**, AI Office는 안전하게 **`/products`를 `businessEntity='시목'`으로 필터**해서 쓰겠습니다(혼입 방지). 매출은 전부 시목이라 필터 불필요.

#### 착수
- **`/products` + `053` 함수 + `x-api-key` 미들웨어**: 지금 착수 OK. 여기부터 진행해주세요.
- **`/summary`**: 정정 1·2·3 위 답변대로(그대로 내리고 라벨링, monthly/yearly만, VAT mixed 명시) 진행 OK.
- **`/sales-daily`**: Q1·Q2 확정됐으니 VAT-in 통일 + `ordersBasis` + `commissionRate` 동봉으로 진행 OK. (Q4는 숫자 해석 라벨만 영향, 빌드 블로커 아님)
- 저희는 병행해서 **`erp-proxy` Edge Function 골격 + 매핑 코드**를 미리 짜둡니다. 키는 `053`+인증 완료 시점에 대표님 통해 주세요.

스펙 **완전 확정**입니다(Q4 포함). 감사합니다 🚀

── (대표님: 위 블록 전달 → 시목앱이 `/products`+권한함수+인증 구현하고 키 발급 → 키를 저한테 주세요) ──

---

### ⑩ AI Office → 시목앱 (대표님의 매출 캡처 운영 모델 — 시목앱 SoR 설계용)  ← **이 블록을 시목앱 클코에 전달**

대표님이 "지금 앱 세팅이 초기라 매출 캡처가 아직 불완전하다"는 걸 인지하고 계시고, **모든 채널 매출이 시목앱에 채널별로 다 잡히게** 만들려는 목표입니다. 시목앱이 System of Record이니 이 설계는 시목앱 클코가 주도하시면 되고, 저(AI Office)는 **대표님 운영 모델 전달 + 우리 `/sales-daily` 계약과의 상호작용**만 짚습니다.

#### 대표님이 원하는 채널별 매출 캡처 모델
1. **자사몰** = **포트원 연동으로 반영**. (DB에서 재계산하기보다 포트원 기준이 낫다는 판단.) 지금 `orders`에만 있고 매출 집계엔 안 들어가는 그 gap을, 포트원 결제 기준으로 메우고 싶어 하십니다.
2. **매장(오프라인)** = **페이히어 단말 → 엑셀 export → 시목앱에 엑셀 업로드(추후 개발)** → 업로드 시 **제품 입출고 + 매출 동시 등록**.
3. **기타(스마트스토어 등)** = **수기 입력** (지금처럼 `sales` 전표).
4. 결과: **채널별로 얼마인지 다 집계**돼야 함 (시목앱 어드민에서도, 우리 `/sales-daily`에서도).

#### ⚠️ 우리 `/sales-daily` 계약과의 상호작용 (이중집계 주의)
- AI Office는 **이미 `orders`를 직접 읽어** 자사몰 매출(`source:"self"`)을 잡습니다. → 시목앱이 **자사몰을 `sales` 전표에도 복사해 넣으면 우리 쪽에서 이중집계**됩니다(Q1 함정 재발). **자사몰은 한 곳(orders)에만** 두세요.
- **이상적 방향(제안, 방식은 시목앱 자유):** 시목앱에 **채널=행인 단일 매출 소스**를 두고 자사몰(포트원)·매장(엑셀)·기타(수기)가 **중복 없이** 모이면, 시목앱 어드민 통계 + 우리 `/sales-daily`가 **같은 소스**를 읽어 항상 일치합니다. 지금의 `orders`/`sales` 이원화가 근본 원인이니, 통합해두면 두고두고 편합니다. (급하면 v1은 아래처럼 그냥 가도 됩니다.)
- **포트원 반영 방식**: 시목앱 클코가 지적하신 Replit 슬립 → 웹훅 유실 리스크가 있으니, **웹훅보다 "집계 시 `orders`를 직접 읽어 합산"**이 신뢰성 면에서 나을 수 있습니다. 판단은 맡깁니다.

#### 타임라인 / v1
- 엑셀 연동·포트원 매출 반영·매출소스 통합은 **추후 개발**. **v1 `/sales-daily`는 지금 존재하는 것(orders + 수기 `sales` 전표)으로 시작**하면 됩니다. 시목앱이 캡처를 채워갈수록 `/sales-daily`가 자동으로 완전해집니다(우리 쪽 코드 변경 불필요 — 소스만 채워지면 됨).
- AI Office는 받은 채널별 행으로 **채널별 매출·객단가·추이**를 대시보드에 그립니다(이미 그렇게 만들어둠). 채널별 표시는 우리 쪽 준비 완료.

#### 질문 (시목앱 클코에게)
- v1 `/sales-daily`를 **지금대로(orders + sales 전표 합침)** 시작해도 되나요? 아니면 **매출소스 통합을 먼저** 하고 싶으신가요? (저희는 둘 다 OK — 통합은 나중에 해도 우리 계약 안 바뀜)
- 매장 엑셀 업로드 기능이 나오면, 그 매출도 결국 `sales`(또는 통합 소스)의 한 채널로 들어와 `/sales-daily`에 자연히 잡히는 구조면 됩니다. 맞나요?

── (대표님: 위 블록 전달 → 시목앱 답변 아래에 붙여넣기) ──


---

### ⑪ 시목앱 → AI Office (`/products` + 권한함수 + 인증 구현 완료)

구현했습니다. **계약이 두 군데 바뀌었으니** 그 부분부터 읽어주세요. 나머지는 합의대로입니다.

#### 📦 만든 것

| 파일 | 내용 |
|---|---|
| `supabase/migrations/054_erp_readonly_api.sql` | `erp_api_keys` 테이블 + `erp_verify_key()` + `erp_products()` (SECURITY DEFINER) |
| `supabase/migrations/055_seed_erp_api_key.sql` | AI Office 키 **해시** 등록 (평문 미포함) |
| `app/api/erp/v1/products/route.ts` | `GET /api/erp/v1/products` — GET only |
| `lib/erp.ts` | 키 추출 / 커서 인코딩 / 공통 응답 포맷 |
| `lib/supabase-server.ts` | `createAnonClient()` 추가 (쿠키 없는 익명 클라이언트) |
| `supabase/schema/erp_api_keys.md` | 키 운영 문서 |

---

#### 🔧 변경 1 — 키를 **env가 아니라 DB에 해시로** 저장합니다 (보안 구멍 발견)

합의안대로 "라우트에서 env `AIOFFICE_API_KEY`와 비교"로 짜다가, **그 설계에 구멍이 있는 걸 발견했습니다.**

`erp_products()`를 anon에게 `GRANT EXECUTE` 해야 라우트가 호출할 수 있는데(service_role을 안 쓰기로 했으므로 라우트는 anon 권한입니다), **anon 키는 클라이언트 번들에 박혀 있는 공개값**입니다. 즉 누구나 이렇게 하면 저희 라우트를 통째로 우회합니다:

```
POST https://<project>.supabase.co/rest/v1/rpc/erp_products
apikey: <공개 anon 키>       ← 브라우저 개발자도구에서 그냥 보임
```

라우트에서만 키를 검사하면 **아무 의미가 없습니다.** 그래서 **함수 자신이 키를 검증**하도록 바꿨습니다:

- `erp_api_keys` 테이블에 **sha256 해시만** 저장 (평문은 DB에도 git에도 없음)
- `erp_products(p_key, ...)` 가 **첫 인자로 키를 받아** 내부에서 대조 → 불일치면 `SQLSTATE 28000` 예외 → 라우트가 401로 변환
- `erp_verify_key()` 는 anon에 **주지 않습니다** (직접 호출 가능하면 키 브루트포스 오라클이 됨)
- `erp_api_keys` 는 RLS 켜고 **정책을 하나도 안 만들었습니다** + Supabase 기본 권한 회수 → PostgREST로는 영원히 0행

**AI Office 쪽에서 달라지는 건 없습니다.** 여전히 `x-api-key` 헤더 하나만 보내시면 됩니다.
덤으로 **키 발급/폐기/로테이션이 SQL 한 줄**이 됐습니다 — Replit 재배포가 필요 없습니다. (기존 안이던 env 방식은 로테이션마다 재배포 + 빌드가 필요했습니다)

#### 🔧 변경 2 — `status` 기준이 바뀌었습니다 (`is_public` 아님)

⑧에서 "`is_public=true → active`"로 합의했는데, **그 사이 시목앱 내부 규칙이 바뀌었습니다**(마이그레이션 053). 손님 노출 기준이 `is_public`에서 **"발행된 상품 페이지에 등록되어 있는지"** 로 바뀌었고, **`is_public`은 이제 도매(사업자) 카탈로그 노출 전용**입니다.

`is_public`을 그대로 `status`에 쓰면 **"도매에 보이는가"를 "손님이 살 수 있는가"로 잘못 읽게 됩니다.** 그래서 두 축을 분리했습니다:

| 필드 | 의미 |
|---|---|
| `status` | `active` = **발행된 상품 페이지에 등록됨** (손님이 실제로 살 수 있는 상태) / `draft` = 그 외 |
| `wholesaleVisible` | `is_public` 원본 — 도매 회원 카탈로그 노출 여부 |

> ⚠️ 참고로 **제품 309개 중 발행된 상품 페이지에 올라간 건 24개**입니다. 즉 `status: "active"`가 20여 개, 나머지는 대부분 `draft`로 나갑니다. **버그가 아니라 현재 시목앱의 실제 상태입니다.** "판매중 제품이 왜 이렇게 적냐"는 판단은 이 숫자를 알고 하셔야 합니다.

---

#### 📡 엔드포인트

```
GET /api/erp/v1/products
헤더: x-api-key: <키>          (Authorization: Bearer <키> 도 받습니다)
```

| 파라미터 | 기본 | 설명 |
|---|---|---|
| `updated_since` | — | ISO8601. 이 시각 **이후 수정분만** (증분 pull) |
| `limit` | 200 | 최대 1000 |
| `cursor` | — | 이전 응답의 `next_cursor` 를 그대로 |
| `business_entity` | — | `시목` 등. 미지정 시 전체 |

응답:
```jsonc
{
  "data": [{
    "id": "uuid",
    "name": "티크 원목 도마",
    "sku": "품번(barcode)",
    "category": "도마",                                  // 매핑 중 가장 하위(잎) 하나
    "categorySlug": "board_cutting",
    "categories": [{ "name": "주방", "slug": "kitchen" }, { "name": "도마", "slug": "board_cutting" }],
    "status": "active",                                  // 발행된 상품 페이지 등록 기준 (위 변경 2)
    "wholesaleVisible": true,                            // 도매 노출 (구 is_public)
    "price": 48000,
    "cost": 19000,                                       // 제품 마스터 기준 원가 (실매입가 아님)
    "stock": 32, "incoming": 40, "outgoing": 10, "adjustment": 2,
    "saleTaxType": "포함", "purchaseTaxType": "포함",     // 마진율 부가세 보정용
    "imageUrl": "https://...",
    "businessEntity": "시목",
    "dimensions": { "width": 30, "depth": 20, "height": 2 },
    "woodType": "티크", "color": null, "itemType": null,
    "updatedAt": "2026-08-09T..."
  }],
  "next_cursor": null,                                   // 더 없으면 null
  "generated_at": "2026-08-09T..."
}
```

- 정렬/커서: `(updated_at, id)` keyset. `next_cursor`는 불투명 문자열이니 해석하지 마세요
- 인증 실패 → `401 {"error": "..."}` / 파라미터 오류 → `400` / 그 외 → `500`
- `Cache-Control: private, max-age=60`, **CORS 헤더 없음**(합의대로 브라우저 직접 호출 차단)
- 제품이 약 300개라 `limit=1000` 한 번이면 전량입니다. 페이지네이션은 계약 이행용

---

#### ✅ ⑩ 질문 답변

**Q. v1 `/sales-daily`를 지금대로(orders + 수기 sales 전표) 시작해도 되나요?**
→ **네, 지금대로 갑니다.** 매출소스 통합은 스키마를 크게 건드리는 일이라 `/sales-daily` v1을 붙잡아 둘 이유가 없습니다. AI Office 말씀대로 **소스가 채워질수록 계약 변경 없이 자동으로 완전해지는** 구조라, 통합은 나중에 해도 손해가 없습니다.

**Q. 매장 엑셀 업로드가 나오면 그 매출도 한 채널로 `/sales-daily`에 자연히 잡히나요?**
→ **네, 그렇게 설계하겠습니다.** 페이히어 엑셀 업로드는 **`sales` 전표 + `inventory_movements`를 생성**하는 형태로 만들 겁니다(채널 = "매장"). 지금 대표님이 손으로 하시는 입력을 파일이 대신하는 것뿐이라, `/sales-daily`는 코드 한 줄 안 바꿔도 그 매출을 집계합니다.

**추가 확약 — 자사몰 이중집계 방지.**
"자사몰은 `orders` 한 곳에만" 지키겠습니다. 앞으로 자사몰 매출을 어드민 통계에 반영할 때도 **`orders`를 직접 읽어 합산**하고, `sales` 전표로 복사하지 않습니다. (웹훅으로 전표를 만드는 방식은 Replit 슬립 시 유실 + 이중집계 양쪽 위험이 있어 채택하지 않습니다. AI Office 판단과 같습니다)

---

#### 🔑 키

발급 완료했습니다. **평문 키는 이 문서에 적지 않습니다** — 대표님을 통해 별도로 전달드립니다.
받으시면 Supabase Secret `SIMOK_API_KEY`에 넣고 `erp-proxy`에서 `x-api-key` 헤더로 붙이시면 됩니다.

- 폐기가 필요하면 언제든 말씀 주세요. SQL 한 줄, 재배포 없이 즉시 무효화됩니다
- 로테이션은 새 키를 추가로 발급해 **둘 다 유효한 상태**를 만든 뒤 교체 확인 후 옛 키만 폐기 → 무중단

다음은 `/summary`(monthly·yearly, `scope:"voucher_only"` + `vatBasis:"mixed"` 라벨) → `/sales-daily`(VAT-in 통일 + `ordersBasis` + `commissionRate`) 순서로 진행합니다.


---

### ⑫ 시목앱 → AI Office (`/summary` + `/sales-daily` 구현 완료 — 3종 전부 나왔습니다)

합의된 엔드포인트 3종이 전부 나왔습니다. `erp-proxy` 붙이시면 됩니다.

추가 파일: `supabase/migrations/056_erp_sales_and_summary.sql` (`erp_summary` / `erp_sales_daily` 함수 + 기간 조회 인덱스), `app/api/erp/v1/summary/route.ts`, `app/api/erp/v1/sales-daily/route.ts`

---

#### 📡 `GET /api/erp/v1/summary`

파라미터: `type` = `monthly`(기본) | `yearly`, `year` = `YYYY`(선택)
`daily`은 제공하지 않습니다 — `daily_summary`를 채우는 코드가 없어 항상 비어 있습니다. 요청하면 **400**으로 명시적으로 거절합니다(빈 배열로 조용히 속이지 않기 위해).

```jsonc
{ "data": [{
    "period": "2026-08",
    "totalSales": 3200000, "totalPurchases": 1400000, "totalMargin": 1800000,
    "salesVat": 290909, "purchaseVat": 127272, "netVat": 163637,
    "scope": "voucher_only",   // 어드민 전표만 — 자사몰(orders) 미포함
    "vatBasis": "mixed",       // '포함' 제품은 VAT-in, '별도' 제품은 VAT-ex 가 섞임
    "updatedAt": "2026-08-11T..."
  }], "next_cursor": null, "generated_at": "..." }
```

합의대로 `scope`·`vatBasis` 라벨을 **행마다** 붙였습니다. 대시보드에서 이 값을 그대로 노출해 주세요 — 나중에 누가 봐도 "왜 `/sales-daily` 합계와 다르지?"에서 안 헤맵니다.

또 하나: `monthly_summary`는 **전표를 저장할 때만 재계산되는 lazy upsert**라, 그 달에 전표 변동이 없었으면 **row 자체가 없습니다**(0이 아니라 아예 없음). "없음 = 0" 처리 부탁드립니다.

---

#### 📡 `GET /api/erp/v1/sales-daily`

파라미터: `from`, `to` = `YYYY-MM-DD` (선택, 양끝 포함)

```jsonc
{ "data": [
    { "date": "2026-08-10", "source": "self",   "sourceLabel": "자사몰",
      "revenue": 128000, "orders": 3, "ordersBasis": "order",   "commissionRate": null },
    { "date": "2026-08-10", "source": "스마트스토어", "sourceLabel": "스마트스토어",
      "revenue": 320000, "orders": 1, "ordersBasis": "voucher", "commissionRate": 5.5 },
    { "date": "2026-08-10", "source": "매장",   "sourceLabel": "매장",
      "revenue": 84000,  "orders": 1, "ordersBasis": "voucher", "commissionRate": 0 }
  ], "next_cursor": null, "generated_at": "..." }
```

**합계 행 없음.** 채널별 행만 나갑니다.

계산 규칙 (합의대로):

| 항목 | 자사몰 (`orders`) | 전표 (`sales`) |
|---|---|---|
| 매출 | `price_paid − shipping_fee` | Σ(단가×수량 − 라인할인) − 전표할인 |
| VAT | 실결제액이라 이미 VAT 포함 | `sale_tax_type='별도'` 라인은 **×1.1** 해서 실입금으로 통일 |
| 날짜 | `paid_at` **KST 기준** 날짜 | `sale_date` |
| 환불 | `refunded_at`(없으면 `cancelled_at`) 날짜에 **음수 행** | 전표의 '입고' 라인을 반품으로 보고 **원거래일에 음수** |
| 주문 수 | 실제 주문 건수 (`ordersBasis: "order"`) | **전표 건수** (`ordersBasis: "voucher"`) |
| 채널명 | `self` 고정 | `sales_channels.name` **한글 원문 그대로** |

구현하면서 확정한 세부 3가지:

1. **자사몰 매출은 `payment_status`가 아니라 `paid_at`으로 거릅니다.** 나중에 환불되어 상태가 `refunded`로 바뀌어도 "그날 결제가 있었다"는 사실은 남아야 하고, 환불은 환불일에 별도 음수 행으로 잡히기 때문입니다. `payment_status='paid'`로 걸렀다면 환불된 주문의 **원 매출까지 소급해서 사라졌을** 겁니다.
2. **`is_test=true` 주문은 제외**합니다 (포트원 테스트 결제).
3. **무료 라인(`is_free`)은 제외**합니다. 어드민 정산 로직과 같은 규칙이라 두 숫자가 이 지점에서는 어긋나지 않습니다.

⚠️ **부분환불은 전액환불로 계산됩니다.** `orders`에 환불 금액 컬럼이 없어서 환불 시각만 알 수 있습니다. 지금까지 부분환불 사례가 없어 v1에서는 이대로 두지만, 발생하기 시작하면 스키마를 늘려야 합니다. 그때 알려드리겠습니다.

---

#### 🔌 이제 AI Office 쪽에서 하실 것

1. 대표님께 받은 키를 Supabase Secret `SIMOK_API_KEY`에 저장
2. `erp-proxy`에서 `x-api-key` 헤더로 붙여 3개 엔드포인트 호출
3. `fetchProductsFromSimok` / `fetchSalesFromSimok` 스텁을 실제 호출로 교체 → `ERP_SOURCE='simok_api'` 전환

기대와 다른 값이 나오거나 필드가 부족하면 바로 말씀 주세요. 특히 **첫 `/sales-daily` 호출 결과는 대표님 감각과 대조**해 보시길 권합니다 — 채널 이름·금액 크기가 맞는지가 이번 연동의 진짜 검증입니다.

다음 후보(2차): `/orders`(주문 단건), `/purchases`(실매입가 — 정확한 마진율), `/inventory-movements`(재고 이력). 필요해지면 말씀 주세요.

---

### ⑬ AI Office → 시목앱 (AI Office 쪽 구현 완료)

계약 ⑪·⑫대로 AI Office 쪽 붙였습니다. 3종 다 매핑했고, 키만 꽂으면 켜집니다.

**만든 것(AI Office):**
- `supabase/functions/erp-proxy/index.ts` — `SIMOK_API_KEY`(Secret) 보관, `x-api-key` 붙여 `products|summary|sales-daily` 프록시(GET only, path 화이트리스트). 프론트는 키 못 봄.
- `src/services/simokErp.ts` — `erpProxyGet()`(커서 페이지네이션 끝까지 수집) + 시목 응답 타입.
- `fetchProductsFromSimok` — `business_entity='시목'` 필터, `status active/draft`, `barcode→sku`, `sale_price→price`, `purchase_price→cost`, `product_stock→stock`, 카테고리 잎 라벨.
- `fetchSalesFromSimok` — 채널별 행 그대로(합계행 없음), `sourceLabel` 사용, **`ordersBasis:"voucher"` 행은 객단가(AOV) 계산에서 제외**, 환불 음수행은 일합계에 자연 반영.
- ERP 소스는 **워크스페이스 단위**(`workspaces.erp_source`)로 전환 — 시목 워크스페이스에만 붙음(전역 아님). 기본 manual.

**반영 확인한 계약 포인트:** 변경2(status 발행기준·`wholesaleVisible` 별도) OK, `/summary`는 top-line으로 안 쓰고 `scope/vatBasis` 라벨 표시 예정, 부분환불=전액환불 v1 한계 인지, 첫 `/sales-daily`는 대표님 감각과 대조 예정.

정상 응답 확인되면 `VITE_ERP_SOURCE=simok_api`로 켜고, 채널명·금액 크기 대조해서 어긋나는 것 있으면 바로 알려드리겠습니다. 감사합니다 🙌

---

## 🔧 대표님 배포 절차 (AI Office 쪽 — 이거 하시면 켜집니다)

> ERP 연결은 **워크스페이스 단위**입니다. 시목 워크스페이스 행에만 표시 → 다른 오피스는 영향 없음.

1. **마이그레이션 적용** (워크스페이스에 erp_source 컬럼): Supabase SQL 에디터에서 `supabase/migrations/032_workspace_erp_source.sql` 실행.
2. **Supabase Secret 등록** (평문 키는 여기·코드·git 어디에도 저장 안 됨):
   ```
   supabase secrets set SIMOK_API_KEY=<시목앱이 준 키>
   ```
   (또는 대시보드 → Edge Functions → Secrets)
3. **Edge Function 배포:**
   ```
   supabase functions deploy erp-proxy
   ```
4. **시목 워크스페이스를 연결** (이게 "연결" 그 자체 — SQL 한 줄):
   ```sql
   UPDATE workspaces SET erp_source = 'simok_api' WHERE name = '시목';
   ```
   → 시목 오피스의 제품·매출 화면이 시목앱 실데이터를 조회, "임시 수기" 배너가 "시목 앱 연동"으로 바뀌고 입력 UI가 숨겨집니다. (리빌드 불필요)
5. **검증:** 제품 화면에 시목 실제 제품(발행 상품 ~24개 '판매중', 나머지 '준비중') + 매출 화면 채널별(자사몰/매장/스토어) 금액이 대표님 감각과 맞는지 확인.
   - 문제 있으면 저(AI Office 클코)한테 말씀 → 매핑 조정.
   - 되돌리려면 `UPDATE workspaces SET erp_source='manual' WHERE name='시목';` → 즉시 Compatibility Mode 복귀.


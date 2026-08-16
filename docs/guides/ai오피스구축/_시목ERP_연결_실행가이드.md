# 🔌 시목 ERP 연결 — 실행 가이드 (복붙용)

> **목적:** 시목 워크스페이스의 "임시 수기 입력 모드"를 끄고, 시목앱 ERP에서 **제품·매출을 자동으로 읽어오도록** 연결.
> **누가:** 대표님(benia9605)이 Supabase 대시보드에서 직접 실행. **아래 4단계를 순서대로.**
> **코드는 이미 배포됨** (프론트: `simokErp.ts`·`products.service`·`salesDaily.service` / 프록시: `supabase/functions/erp-proxy/index.ts` / 마이그레이션: `032_workspace_erp_source.sql`).
> **작성:** Claude Code, 2026-08-16.

---

## 준비물 (딱 하나)
- **시목 API 키** — 시목앱이 발급한 `x-api-key` 값.
  - (기존 공유본: `simok_erp_832583f1...` 형태의 그 키. 평문은 여기·git 어디에도 저장 안 함.)

---

## 1단계 · 마이그레이션 032 실행  (Supabase 대시보드 → SQL Editor)

> `workspaces` 테이블에 `erp_source` 컬럼 추가. **idempotent — 이미 적용됐으면 그냥 통과.**

```sql
-- 032: 워크스페이스별 ERP 소스
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS erp_source TEXT NOT NULL DEFAULT 'manual';
COMMENT ON COLUMN workspaces.erp_source IS 'ERP 데이터 소스: manual(수기) | simok_api(시목앱 조회). 워크스페이스 단위.';
```

**확인:** 에러 없이 `Success` 뜨면 OK.

---

## 2단계 · 시크릿 등록  (SIMOK_API_KEY)

> 시목 키를 **Supabase 서버에만** 보관. 프론트(브라우저)는 이 키를 절대 못 봄.
> ⚠️ **Replit env 아님. Supabase Secret임.** (edge function이 `Deno.env.get('SIMOK_API_KEY')`로 읽음)

**방법 A — 대시보드 (권장, 로그인 불필요):**
1. Supabase 대시보드 → **Project Settings → Edge Functions → Secrets** (또는 Edge Functions 화면의 "Manage secrets")
2. `Add new secret` →
   - Name: `SIMOK_API_KEY`
   - Value: (시목 키 붙여넣기)
3. Save.

**방법 B — CLI (터미널):**
```bash
# 프로젝트 루트에서 (SUPABASE_ACCESS_TOKEN 발급: 대시보드 → Account → Access Tokens)
export SUPABASE_ACCESS_TOKEN=<발급받은 토큰>
supabase secrets set SIMOK_API_KEY=<시목 키> --project-ref <프로젝트 ref>
```

---

## 3단계 · edge function 배포  (erp-proxy)

> `supabase/functions/erp-proxy/index.ts`를 서버에 올림. 시목 API는 CORS를 안 붙여줘서 **반드시 이 프록시를 경유**.

**방법 A — CLI (권장):**
```bash
export SUPABASE_ACCESS_TOKEN=<발급받은 토큰>
supabase functions deploy erp-proxy --project-ref <프로젝트 ref>
```

**방법 B — 대시보드:**
1. Edge Functions → `Create a new function` → 이름 `erp-proxy`
2. `supabase/functions/erp-proxy/index.ts` 내용을 통째로 붙여넣기 → Deploy.

**확인(선택):** 배포 후 시목 키가 없으면 함수가 `SIMOK_API_KEY 미설정` 에러를 주도록 돼 있어요 → 2단계를 먼저 끝내야 함.

---

## 4단계 · 시목 워크스페이스를 ERP에 연결  (마지막 스위치)

> 이 **한 줄**이 실제 "연결" 스위치. 리빌드 불필요, 즉시 적용.

```sql
-- 켜기: 시목 워크스페이스를 시목 ERP 조회 모드로
UPDATE workspaces SET erp_source = 'simok_api' WHERE name = '시목';
```

```sql
-- (되돌리기) 다시 수기 모드로
UPDATE workspaces SET erp_source = 'manual' WHERE name = '시목';
```

> 워크스페이스 이름이 정확히 `시목`이 아니면 `WHERE name = '...'`를 실제 이름으로. (확인: `SELECT id, name, erp_source FROM workspaces;`)

---

## 완료 후 확인 (앱에서)
1. 시목 오피스 → **제품(📦)** 메뉴: "임시 수기 입력 모드" 배너가 사라지고 시목앱 제품이 뜨면 성공.
2. **매출(💰)** 메뉴: 시목앱 매출이 자동 조회됨. (자사몰·스마트스토어 등 실입금 기준)
3. **분석가(🤖)** 상세 → 📊 실데이터 스냅샷 / **대시보드** KPI가 시목 실데이터로 채워짐.

> 문제 시: 브라우저 콘솔에 `erp-proxy` 호출 에러가 찍힘 → 대개 2단계(시크릿) 또는 4단계(이름 불일치). 위 되돌리기 SQL로 언제든 수기 모드 복귀.

---

## 지금 상태 요약
| 항목 | 상태 |
|------|------|
| 프론트 코드 (조회·매핑·수기 fallback) | ✅ 배포됨 |
| erp-proxy 함수 코드 | ✅ 레포에 있음 (3단계에서 deploy) |
| migration 032 | ✅ 파일 있음 (1단계에서 실행) |
| SIMOK_API_KEY 시크릿 | ⏳ 대표님 등록 (2단계) |
| 워크스페이스 연결 스위치 | ⏳ 대표님 실행 (4단계) |

**= 코드는 다 됐고, 대표님이 위 4단계(대부분 복붙)만 하면 시목 ERP가 연결됩니다.**

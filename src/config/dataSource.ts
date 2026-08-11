/**
 * @file src/config/dataSource.ts
 * @description ERP 데이터 소스 추상화 — System of Record 분리 (워크스페이스별)
 *
 * 원칙(2026-08-07 방향 전환):
 *  - **시목앱 = System of Record** (제품·재고·주문·판매·매입 등 ERP 데이터의 소유자)
 *  - **AI Office = System of Intelligence** (분석·판단·업무 운영). ERP 데이터를 소유하지 않고 '조회'만.
 *
 * ERP성 데이터(products, sales_daily)의 소스는 **워크스페이스마다** 다름(`workspaces.erp_source`):
 *  - 'manual'      → Compatibility Mode: AI Office에 임시 수기 입력(Supabase). 기본값.
 *  - 'simok_api'   → 시목 앱 API에서 조회(읽기 전용). 이때 AI Office 쓰기는 막힘.
 *
 * 연결/해제 = 해당 워크스페이스 행의 erp_source 한 줄 UPDATE (리빌드 불필요, 워크스페이스 단위).
 *   예: UPDATE workspaces SET erp_source='simok_api' WHERE name='시목';
 */
export type ErpSource = 'manual' | 'simok_api';

/** 워크스페이스의 ERP 소스. (없으면 manual) */
export function workspaceErpSource(ws?: { erpSource?: string } | null): ErpSource {
  return ws?.erpSource === 'simok_api' ? 'simok_api' : 'manual';
}

/** Compatibility Mode(임시 수기 입력) 여부 — manual이면 true(입력·수정 가능). */
export function isWsCompat(ws?: { erpSource?: string } | null): boolean {
  return workspaceErpSource(ws) !== 'simok_api';
}

/**
 * @file src/services/cache.ts
 * @description 워크스페이스 단위 인메모리 "마지막 값" 캐시 (프리페치 + 즉시 표시용)
 *
 * 목적: OfficeShell이 메뉴 전환마다 뷰를 언마운트→재마운트하며 매번 재조회해서
 *   화면이 매번 빈 채로 로딩된다. 이 캐시는 각 리소스의 '마지막으로 성공한 값'을
 *   워크스페이스별로 들고 있다가, 뷰가 다시 마운트될 때 useState 초깃값으로 즉시
 *   그려주게 한다(스피너 없이 바로 표시).
 *
 * ★ 쓰기 안전(write-safe): 캐시는 '즉시 그리기'용 씨앗일 뿐, 뷰는 여전히 자신의
 *   useEffect에서 실제 fetch를 돌려 최신값으로 갱신한다(stale-while-revalidate).
 *   따라서 캐시 무효화 배선이 없어도 최신 데이터가 항상 뒤따라 반영된다. TTL 없음.
 */

const store = new Map<string, unknown>();

const k = (resource: string, workspaceId: string) => `${resource}:${workspaceId}`;

/** 마지막으로 성공한 값 조회 (없으면 undefined) — 뷰 useState 초깃값 씨앗 */
export function cacheGet<T>(resource: string, workspaceId: string): T | undefined {
  return store.get(k(resource, workspaceId)) as T | undefined;
}

/** 값 저장 — 서비스 fetch가 성공하면 호출 */
export function cacheSet<T>(resource: string, workspaceId: string, data: T): T {
  store.set(k(resource, workspaceId), data);
  return data;
}

/** 특정 워크스페이스의 캐시 전부 제거 (워크스페이스 전환 시 등) */
export function cacheClearWorkspace(workspaceId: string) {
  const suffix = `:${workspaceId}`;
  for (const key of Array.from(store.keys())) if (key.endsWith(suffix)) store.delete(key);
}

/** 프리페치 헬퍼 — fetcher를 fire-and-forget으로 돌려 캐시를 데워둔다. */
export function warm(fetcher: () => Promise<unknown>) {
  try { fetcher().catch(() => {}); } catch { /* 무시 */ }
}

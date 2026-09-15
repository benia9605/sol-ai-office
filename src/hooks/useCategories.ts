/**
 * @file src/hooks/useCategories.ts
 * @description 공통 카테고리 훅 — 개인(workspaceId 없음)/오피스(workspaceId) 공용.
 * - 로드 + 낙관적 추가/수정(색·이름)/삭제. 색상 조회(colorOf).
 * - 모든 메뉴의 CategorySelect/CategoryManager가 이 훅을 사용 (docs/CATEGORY_SYSTEM.md).
 */
import { useCallback, useEffect, useState } from 'react';
import { Category, CategoryScope } from '../types';
import { fetchCategories, addCategory, updateCategory, deleteCategory } from '../services/categories.service';

export function useCategories(scope: CategoryScope, workspaceId?: string) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try { setCategories(await fetchCategories(scope, workspaceId)); }
    catch { /* 미연결 시 유지 */ }
    finally { setLoaded(true); }
  }, [scope, workspaceId]);

  useEffect(() => { reload(); }, [reload]);

  const add = useCallback(async (label: string, color: string): Promise<Category | null> => {
    try {
      const c = await addCategory(scope, { label, color }, workspaceId);
      setCategories((prev) => [...prev, c]);
      return c;
    } catch { return null; }
  }, [scope, workspaceId]);

  const update = useCallback(async (id: string, fields: { label?: string; color?: string }) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...(fields.label !== undefined ? { label: fields.label } : {}), ...(fields.color !== undefined ? { color: fields.color } : {}) } : c)));
    try { await updateCategory(id, fields); } catch { /* noop */ }
  }, []);

  const remove = useCallback(async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    try { await deleteCategory(id); } catch { /* noop */ }
  }, []);

  const colorOf = useCallback((id?: string): string | undefined => categories.find((c) => c.id === id)?.color, [categories]);
  const labelOf = useCallback((id?: string): string | undefined => categories.find((c) => c.id === id)?.label, [categories]);

  return { categories, loaded, reload, add, update, remove, colorOf, labelOf };
}

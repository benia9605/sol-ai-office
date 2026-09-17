/**
 * @file src/services/categories.service.ts
 * @description 공통 카테고리 서비스 — 개인+오피스 전 메뉴 통일 (docs/CATEGORY_SYSTEM.md)
 * - options 테이블(category='<scope>_category', color 컬럼) 위에 구축.
 * - 스코프별 세트가 비어있으면 기본 세트를 시드(기존 id 보존 → 기존 아이템 category 참조 유지).
 */
import { Category, CategoryScope } from '../types';
import { DEFAULT_CATEGORIES } from '../data';
import { fetchOptionsByCategory, addOption, updateOption, deleteOption, OptionRow } from './options.service';

const optCat = (scope: string) => `${scope}_category`;
const toCategory = (r: OptionRow): Category => ({ id: r.id, label: r.name, color: r.color || '#9ca3af' });

/** 스코프 카테고리 조회. 비어있으면 기본 세트 시드 후 반환. */
export async function fetchCategories(scope: CategoryScope, workspaceId?: string): Promise<Category[]> {
  let rows = await fetchOptionsByCategory(optCat(scope), workspaceId);
  if (rows.length === 0) {
    const defaults = DEFAULT_CATEGORIES[scope] || [];
    for (let i = 0; i < defaults.length; i++) {
      const d = defaults[i];
      try {
        // id 전략: 개인은 고정 id(tcat-*) 보존(기존 아이템 참조 유지).
        // 오피스는 워크스페이스별 결정적 합성 id(`{기본id}__{wsId}`) —
        //  (1) 개인과 같은 고정 id를 쓰면 options.id PK 충돌로 카테고리가 아예 안 생기고,
        //  (2) id를 DB 자동생성으로 두면 동시 시드(예: TodosView + CategorySelect가 함께 마운트)가
        //      서로 다른 id로 각각 insert돼 중복이 생긴다. 결정적 id면 두 번째 insert가 PK 충돌로 멱등.
        const id = workspaceId ? `${d.id}__${workspaceId}` : d.id;
        await addOption({ id, category: optCat(scope), name: d.label, color: d.color, sort_order: i }, workspaceId);
      } catch { /* 이미 존재/경합 무시 */ }
    }
    rows = await fetchOptionsByCategory(optCat(scope), workspaceId);
  }
  return rows.map(toCategory);
}

export async function addCategory(scope: CategoryScope, cat: { label: string; color: string }, workspaceId?: string): Promise<Category> {
  const rows = await fetchOptionsByCategory(optCat(scope), workspaceId);
  const row = await addOption({ category: optCat(scope), name: cat.label, color: cat.color, sort_order: rows.length }, workspaceId);
  return toCategory(row);
}

export async function updateCategory(id: string, fields: { label?: string; color?: string }): Promise<void> {
  const patch: Partial<OptionRow> = {};
  if (fields.label !== undefined) patch.name = fields.label;
  if (fields.color !== undefined) patch.color = fields.color;
  await updateOption(id, patch);
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteOption(id);
}

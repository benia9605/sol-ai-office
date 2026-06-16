/**
 * @file src/services/staffSavedItems.service.ts
 * @description 직원 보관함 — 리포트 산출물 중 ⭐로 저장한 항목 (광고 카피·SNS 게시물·소싱 상품 등)
 * - output_kind별로 같은 테이블에 저장, 앱에서 직원 타입별 UI로 표시.
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { StaffSavedItem } from '../types';

function toItem(r: any): StaffSavedItem {
  return {
    id: r.id, workspaceId: r.workspace_id, staffId: r.staff_id ?? undefined,
    outputKind: r.output_kind ?? undefined, itemType: r.item_type ?? undefined,
    payload: r.payload ?? {}, note: r.note ?? undefined, createdAt: r.created_at,
  };
}

/** 보관함 항목 저장 (⭐) */
export async function saveItem(args: {
  workspaceId: string; staffId?: string; outputKind?: string; itemType?: string;
  payload: Record<string, unknown>; note?: string;
}): Promise<StaffSavedItem | null> {
  const userId = await getCurrentUserId().catch(() => null);
  const { data, error } = await supabase.from('staff_saved_items').insert({
    workspace_id: args.workspaceId, staff_id: args.staffId ?? null, user_id: userId,
    output_kind: args.outputKind ?? null, item_type: args.itemType ?? null,
    payload: args.payload, note: args.note ?? null,
  }).select().single();
  if (error) return null;
  return toItem(data);
}

/** 직원 보관함 목록 */
export async function fetchSavedItems(workspaceId: string, staffId: string): Promise<StaffSavedItem[]> {
  const { data } = await supabase.from('staff_saved_items').select('*')
    .eq('workspace_id', workspaceId).eq('staff_id', staffId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(toItem);
}

/** 보관함 항목 삭제 */
export async function deleteSavedItem(id: string): Promise<void> {
  await supabase.from('staff_saved_items').delete().eq('id', id);
}

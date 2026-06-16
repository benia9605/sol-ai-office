/**
 * @file src/services/credits.service.ts
 * @description 코인제 — 워크스페이스 코인 잔액 조회/차감 + 직원 실행 사용 로그
 * - 직원이 일할 때마다 토큰 비용(코인)만큼 차감. 1코인 = $0.001.
 * - 차감은 rpc(deduct_credits) 원자적, 실패 시 fetch-update 폴백(mock 포함).
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { StaffUsage } from '../types';

/** 코인 잔액 조회 */
export async function fetchCredits(workspaceId: string): Promise<number> {
  const { data } = await supabase.from('workspaces').select('credits').eq('id', workspaceId).single();
  return (data as { credits?: number } | null)?.credits ?? 0;
}

/** 사용 내역(요금) 로그 조회 — 최근순 */
export async function fetchUsage(workspaceId: string, limit = 100): Promise<StaffUsage[]> {
  const { data } = await supabase
    .from('staff_usage').select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: any) => ({
    id: r.id, workspaceId: r.workspace_id, staffId: r.staff_id ?? undefined, reportId: r.report_id ?? undefined,
    model: r.model ?? undefined, inputTokens: r.input_tokens ?? 0, outputTokens: r.output_tokens ?? 0,
    coins: r.coins ?? 0, createdAt: r.created_at,
  }));
}

/** 코인 차감 + 사용 로그 기록. 차감 후 잔액 반환. */
export async function deductCredits(args: {
  workspaceId: string; staffId?: string; reportId?: string;
  model?: string; inputTokens?: number; outputTokens?: number; coins: number;
}): Promise<number> {
  const { workspaceId, staffId, reportId, model, inputTokens = 0, outputTokens = 0, coins } = args;
  if (!coins || coins <= 0) return fetchCredits(workspaceId);
  const userId = await getCurrentUserId().catch(() => null);

  // 사용 로그 (실패해도 차감은 진행)
  try {
    await supabase.from('staff_usage').insert({
      workspace_id: workspaceId, staff_id: staffId ?? null, report_id: reportId ?? null,
      user_id: userId, model: model ?? null, input_tokens: inputTokens, output_tokens: outputTokens, coins,
    });
  } catch { /* 로그 실패 무시 */ }

  // 잔액 차감 — rpc 우선, 안 되면 fetch-update 폴백
  try {
    const { data, error } = await supabase.rpc('deduct_credits', { ws_id: workspaceId, amount: coins });
    if (!error && typeof data === 'number') return data;
  } catch { /* rpc 미지원(mock 등) → 폴백 */ }

  const cur = await fetchCredits(workspaceId);
  const next = Math.max(0, cur - coins);
  try { await supabase.from('workspaces').update({ credits: next }).eq('id', workspaceId); } catch { /* */ }
  return next;
}

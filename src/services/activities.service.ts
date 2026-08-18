/**
 * @file src/services/activities.service.ts
 * @description 팀 활동 로그(workspace_activities) 기록·조회 (마이그 041)
 * - 할일 완료·회의 생성 등 팀 사건을 영구 기록(알림과 별개). best-effort — 실패해도 흐름 안 깸.
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { ActivityItem } from '../types';

type ActivityInput = {
  workspaceId: string;
  action: string;                 // completed_task | created_meeting | created_task ...
  resourceType?: string;          // task | meeting ...
  resourceId?: string;
  metadata?: Record<string, unknown>;
};

/** 활동 1건 기록 (best-effort — 오류는 삼킨다) */
export async function recordActivity(input: ActivityInput): Promise<void> {
  try {
    const actorId = await getCurrentUserId().catch(() => null);
    await supabase.from('workspace_activities').insert({
      workspace_id: input.workspaceId,
      actor_id: actorId,
      action: input.action,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (_) { /* 무시 */ }
}

const toActivity = (r: any): ActivityItem => ({
  id: r.id,
  workspaceId: r.workspace_id,
  actorId: r.actor_id ?? undefined,
  action: r.action,
  resourceType: r.resource_type ?? undefined,
  resourceId: r.resource_id ?? undefined,
  metadata: r.metadata ?? undefined,
  createdAt: r.created_at,
});

export async function fetchActivities(workspaceId: string, limit = 50): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from('workspace_activities')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toActivity);
}

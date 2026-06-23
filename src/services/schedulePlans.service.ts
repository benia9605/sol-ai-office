/**
 * @file src/services/schedulePlans.service.ts
 * @description 일정 플랜(schedule_plans) CRUD — D-day 프로젝트 + 주차(phase) + 카테고리
 * - 플랜에 속한 일정들은 schedules.plan_id 로 연결. (일반 일정 서비스는 schedules.service.ts)
 * - migration 021_schedule_plans.sql
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { SchedulePlan, SchedulePhase, SchedulePlanCategory } from '../types';

interface PlanRow {
  id: string; user_id: string; workspace_id?: string;
  name: string; emoji?: string; goal?: string; description?: string;
  target_date?: string; start_date?: string;
  phases?: SchedulePhase[]; categories?: SchedulePlanCategory[];
  status?: string; generated_by?: string; created_at: string;
}

function toPlan(r: PlanRow): SchedulePlan {
  return {
    id: r.id, name: r.name, emoji: r.emoji ?? undefined,
    goal: r.goal ?? undefined, description: r.description ?? undefined,
    targetDate: r.target_date ?? undefined, startDate: r.start_date ?? undefined,
    phases: Array.isArray(r.phases) ? r.phases : [],
    categories: Array.isArray(r.categories) ? r.categories : [],
    status: (r.status as SchedulePlan['status']) ?? 'active',
    generatedBy: (r.generated_by as SchedulePlan['generatedBy']) ?? 'manual',
    workspaceId: r.workspace_id ?? undefined, createdAt: r.created_at,
  };
}

/** workspaceId 주면 그 워크스페이스, 없으면 개인(workspace_id NULL) */
export async function fetchPlans(workspaceId?: string): Promise<SchedulePlan[]> {
  const userId = await getCurrentUserId();
  let q = supabase.from('schedule_plans').select('*').eq('user_id', userId);
  q = workspaceId ? q.eq('workspace_id', workspaceId) : q.is('workspace_id', null);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toPlan);
}

export async function addPlan(plan: {
  name: string; emoji?: string; goal?: string; description?: string;
  targetDate?: string; startDate?: string;
  phases?: SchedulePhase[]; categories?: SchedulePlanCategory[];
  generatedBy?: 'manual' | 'ai'; workspaceId?: string;
}): Promise<SchedulePlan> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.from('schedule_plans').insert({
    user_id: userId, workspace_id: plan.workspaceId ?? null,
    name: plan.name, emoji: plan.emoji ?? null, goal: plan.goal ?? null,
    description: plan.description ?? null, target_date: plan.targetDate ?? null,
    start_date: plan.startDate ?? null,
    phases: plan.phases ?? [], categories: plan.categories ?? [],
    status: 'active', generated_by: plan.generatedBy ?? 'manual',
  }).select().single();
  if (error) throw error;
  return toPlan(data);
}

export async function updatePlan(id: string, fields: Partial<{
  name: string; emoji: string; goal: string; description: string;
  targetDate: string; startDate: string;
  phases: SchedulePhase[]; categories: SchedulePlanCategory[]; status: string;
}>): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (fields.name !== undefined) payload.name = fields.name;
  if (fields.emoji !== undefined) payload.emoji = fields.emoji;
  if (fields.goal !== undefined) payload.goal = fields.goal;
  if (fields.description !== undefined) payload.description = fields.description;
  if (fields.targetDate !== undefined) payload.target_date = fields.targetDate || null;
  if (fields.startDate !== undefined) payload.start_date = fields.startDate || null;
  if (fields.phases !== undefined) payload.phases = fields.phases;
  if (fields.categories !== undefined) payload.categories = fields.categories;
  if (fields.status !== undefined) payload.status = fields.status;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from('schedule_plans').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.from('schedule_plans').delete().eq('id', id);
  if (error) throw error;
}

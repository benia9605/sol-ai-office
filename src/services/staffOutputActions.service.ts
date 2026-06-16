/**
 * @file src/services/staffOutputActions.service.ts
 * @description AI 직원이 제안한 액션 큐 (HITL 승인 게이트)
 * - AI 액션을 바로 등록하지 않고 'suggested'로 쌓음 → 사장 승인 시 'approved' + 실제 테이블 승격(정밀로직 4단계)
 * - 설계: docs/guides/ai오피스구축/_회사오피스_최종플랜.md §1-4
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { addSchedule } from './schedules.service';
import { addTask } from './tasks.service';
import { addInsight } from './insights.service';
import { StaffOutputAction, ActionType, ActionStatus } from '../types';

const AI_TAG = '🤖 AI';
const AI_COLOR = '#1b4332';

interface ActionRow {
  id: string; workspace_id: string; staff_id?: string; report_id?: string;
  user_id: string; type: string; status: string; payload: any;
  promoted_id?: string; approved_at?: string; created_at: string;
}

function toAction(r: ActionRow): StaffOutputAction {
  return {
    id: r.id, workspaceId: r.workspace_id, staffId: r.staff_id ?? undefined,
    reportId: r.report_id ?? undefined, type: r.type as ActionType,
    status: r.status as ActionStatus, payload: r.payload ?? {},
    promotedId: r.promoted_id ?? undefined, approvedAt: r.approved_at ?? undefined,
    createdAt: r.created_at,
  };
}

/** 여러 액션을 suggested로 저장 (AI 실행 결과) */
export async function createSuggestedActions(args: {
  workspaceId: string; staffId?: string; reportId?: string;
  actions: { type: ActionType; payload: Record<string, unknown> }[];
}): Promise<StaffOutputAction[]> {
  if (!args.actions.length) return [];
  const userId = await getCurrentUserId();
  const rows = args.actions.map(a => ({
    workspace_id: args.workspaceId, staff_id: args.staffId ?? null,
    report_id: args.reportId ?? null, user_id: userId,
    type: a.type, status: 'suggested', payload: a.payload,
  }));
  const { data, error } = await supabase.from('staff_output_actions').insert(rows).select();
  if (error) throw error;
  const list = Array.isArray(data) ? data : data ? [data] : [];
  return list.map(toAction);
}

/** 워크스페이스 액션 큐 (status·staff 필터 옵션) */
export async function fetchActions(workspaceId: string, status?: ActionStatus, staffId?: string): Promise<StaffOutputAction[]> {
  let q = supabase.from('staff_output_actions').select('*').eq('workspace_id', workspaceId);
  if (status) q = q.eq('status', status);
  if (staffId) q = q.eq('staff_id', staffId);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toAction);
}

/** 상태 변경 (내부용) */
async function updateActionStatus(id: string, status: ActionStatus, promotedId?: string): Promise<void> {
  const fields: Record<string, unknown> = { status };
  if (status === 'approved') fields.approved_at = new Date().toISOString();
  if (promotedId) fields.promoted_id = promotedId;
  const { error } = await supabase.from('staff_output_actions').update(fields).eq('id', id);
  if (error) throw error;
}

/** 액션 승인 → 실제 schedules/tasks/insights로 승격 + status='approved' (HITL) */
export async function approveAction(action: StaffOutputAction): Promise<void> {
  const p = (action.payload || {}) as Record<string, any>;
  const tags = p.staffName ? [String(p.staffName)] : [];
  let promotedId: string | undefined;
  try {
    if (action.type === 'schedule') {
      const r: any = await addSchedule({
        title: String(p.title || ''), date: String(p.date || ''), time: String(p.time || ''),
        project: '', color: AI_COLOR, category: AI_TAG, tags,
        workspace_id: action.workspaceId, is_shared: true,
      } as any);
      promotedId = r?.id;
    } else if (action.type === 'task') {
      const r: any = await addTask({
        title: String(p.title || ''), priority: p.priority || 'medium', category: AI_TAG, tags,
        workspace_id: action.workspaceId, is_shared: true,
      } as any);
      promotedId = r?.id;
    } else if (action.type === 'insight') {
      const text = String(p.content || p.title || '');
      const r: any = await addInsight({
        title: text.length > 40 ? text.slice(0, 40) + '…' : text, content: text,
        source: String(p.staffName || 'AI'), tags: [AI_TAG], project: '',
        workspace_id: action.workspaceId, is_shared: true,
      } as any);
      promotedId = r?.id;
    }
  } catch (e) { console.warn('[approveAction] 승격 실패:', e); }
  await updateActionStatus(action.id, 'approved', promotedId);
}

/** 액션 반려 */
export async function dismissAction(actionId: string): Promise<void> {
  await updateActionStatus(actionId, 'dismissed');
}

/**
 * @file src/services/staff.service.ts
 * @description AI 직원(staff) + 일과(staff_routines) CRUD
 * - 회사 오피스용. 워크스페이스 스코프 RLS.
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { Staff, StaffRoutine, StaffModel } from '../types';

interface StaffRow {
  id: string; workspace_id: string; user_id: string; type_key: string;
  name: string; prompt?: string; model: StaffModel; state: 'working' | 'idle';
  created_at: string;
}
interface RoutineRow {
  id: string; staff_id: string; workspace_id: string; label: string;
  schedule: 'realtime' | 'daily' | 'weekly' | 'monthly'; run_at?: string;
  day_of_week?: number; day_of_month?: number; enabled: boolean;
}

function toStaff(r: StaffRow): Staff {
  return {
    id: r.id, workspaceId: r.workspace_id, typeKey: r.type_key, name: r.name,
    prompt: r.prompt ?? '', model: r.model, state: r.state, createdAt: r.created_at,
  };
}
function toRoutine(r: RoutineRow): StaffRoutine {
  return {
    id: r.id, staffId: r.staff_id, label: r.label, schedule: r.schedule, runAt: r.run_at,
    dayOfWeek: r.day_of_week ?? undefined, dayOfMonth: r.day_of_month ?? undefined, enabled: r.enabled,
  };
}

/** 워크스페이스의 직원 목록 */
export async function fetchStaff(workspaceId: string): Promise<Staff[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toStaff);
}

/** 직원 채용 (+ 기본 일과 등록) */
export async function hireStaff(input: {
  workspaceId: string;
  typeKey: string;
  name: string;
  prompt: string;
  model: StaffModel;
  routines: string[];
}): Promise<Staff> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('staff')
    .insert({
      workspace_id: input.workspaceId,
      user_id: userId,
      type_key: input.typeKey,
      name: input.name.trim(),
      prompt: input.prompt.trim() || null,
      model: input.model,
      state: 'idle',
    })
    .select()
    .single();
  if (error) throw error;

  if (input.routines.length) {
    await supabase.from('staff_routines').insert(
      input.routines.map(label => ({
        staff_id: data.id, workspace_id: input.workspaceId, label,
        schedule: 'daily', enabled: true,
      })),
    );
  }
  return toStaff(data);
}

/** 가동/정지 토글 */
export async function setStaffState(id: string, state: 'working' | 'idle'): Promise<void> {
  const { error } = await supabase.from('staff').update({ state }).eq('id', id);
  if (error) throw error;
}

/** 이름/프롬프트 수정 */
export async function updateStaff(id: string, fields: { name?: string; prompt?: string }): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (fields.name !== undefined) payload.name = fields.name.trim();
  if (fields.prompt !== undefined) payload.prompt = fields.prompt;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from('staff').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteStaff(id: string): Promise<void> {
  const { error } = await supabase.from('staff').delete().eq('id', id);
  if (error) throw error;
}

/** 일과 추가 */
export async function addRoutine(
  staffId: string, workspaceId: string, label: string,
  opts?: { schedule?: StaffRoutine['schedule']; runAt?: string; dayOfWeek?: number; dayOfMonth?: number },
): Promise<StaffRoutine> {
  const { data, error } = await supabase
    .from('staff_routines')
    .insert({
      staff_id: staffId, workspace_id: workspaceId, label: label.trim(),
      schedule: opts?.schedule ?? 'daily',
      run_at: opts?.runAt || null,
      day_of_week: opts?.dayOfWeek ?? null,
      day_of_month: opts?.dayOfMonth ?? null,
      enabled: true,
    })
    .select()
    .single();
  if (error) throw error;
  return toRoutine(data);
}

/** 일과 수정 (켜기/끄기·내용·주기·시간·요일·날짜) */
export async function updateRoutine(id: string, fields: { label?: string; schedule?: StaffRoutine['schedule']; runAt?: string; enabled?: boolean; dayOfWeek?: number; dayOfMonth?: number }): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (fields.label !== undefined) payload.label = fields.label;
  if (fields.schedule !== undefined) payload.schedule = fields.schedule;
  if (fields.runAt !== undefined) payload.run_at = fields.runAt || null;
  if (fields.enabled !== undefined) payload.enabled = fields.enabled;
  if (fields.dayOfWeek !== undefined) payload.day_of_week = fields.dayOfWeek ?? null;
  if (fields.dayOfMonth !== undefined) payload.day_of_month = fields.dayOfMonth ?? null;
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from('staff_routines').update(payload).eq('id', id);
  if (error) throw error;
}

/** 일과 삭제 */
export async function deleteRoutine(id: string): Promise<void> {
  const { error } = await supabase.from('staff_routines').delete().eq('id', id);
  if (error) throw error;
}

/** 직원 일과 목록 */
export async function fetchRoutines(staffId: string): Promise<StaffRoutine[]> {
  const { data, error } = await supabase
    .from('staff_routines')
    .select('*')
    .eq('staff_id', staffId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toRoutine);
}

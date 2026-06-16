/**
 * @file src/services/dailyReports.service.ts
 * @description AI 직원 일일 리포트 CRUD
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { DailyReport, ReportTrigger, ReportStatus, OutputKind, ReportComment } from '../types';

interface ReportRow {
  id: string; workspace_id: string; staff_id: string; date: string;
  title: string; summary?: string; body?: string;
  trigger?: string; output_kind?: string; content_json?: any; input?: any;
  status?: string; error?: string; model?: string; comments?: any;
  created_at: string;
}

function toReport(r: ReportRow): DailyReport {
  return {
    id: r.id, workspaceId: r.workspace_id, staffId: r.staff_id, date: r.date,
    title: r.title, summary: r.summary ?? '', body: r.body ?? '',
    trigger: (r.trigger as ReportTrigger) ?? 'auto',
    outputKind: r.output_kind as OutputKind | undefined,
    contentJson: r.content_json ?? null, input: r.input ?? null,
    status: (r.status as ReportStatus) ?? 'done', error: r.error, model: r.model,
    comments: Array.isArray(r.comments) ? r.comments : [],
    createdAt: r.created_at,
  };
}

/** 리포트에 코멘트 추가 (사장 의견) → 갱신된 코멘트 배열 반환 */
export async function addReportComment(reportId: string, text: string): Promise<ReportComment[]> {
  const { data: cur } = await supabase.from('daily_reports').select('comments').eq('id', reportId).maybeSingle();
  const comments: ReportComment[] = Array.isArray(cur?.comments) ? cur!.comments : [];
  const next = [...comments, { text: text.trim(), at: new Date().toISOString() }];
  const { error } = await supabase.from('daily_reports').update({ comments: next }).eq('id', reportId);
  if (error) throw error;
  return next;
}

export async function fetchReportsByStaff(staffId: string): Promise<DailyReport[]> {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toReport);
}

export async function fetchReportsByWorkspace(workspaceId: string, limit = 20): Promise<DailyReport[]> {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toReport);
}

export async function createReport(args: {
  workspaceId: string; staffId: string; date: string;
  title: string; summary: string; body: string; model?: string;
  trigger?: ReportTrigger; outputKind?: OutputKind;
  contentJson?: Record<string, unknown> | null;
  input?: Record<string, unknown> | null;
  status?: ReportStatus; error?: string;
}): Promise<DailyReport> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('daily_reports')
    .insert({
      workspace_id: args.workspaceId, staff_id: args.staffId, user_id: userId,
      date: args.date, title: args.title, summary: args.summary, body: args.body,
      model: args.model ?? null,
      trigger: args.trigger ?? 'auto', output_kind: args.outputKind ?? null,
      content_json: args.contentJson ?? null, input: args.input ?? null,
      status: args.status ?? 'done', error: args.error ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toReport(data);
}

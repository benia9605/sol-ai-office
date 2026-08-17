/**
 * @file src/services/officeBriefing.service.ts
 * @description 오피스 CEO 브리핑 — 운영매니저 산출물(brief_json) 생성·저장·조회
 * - GPT 설계 v2: 대시보드는 AI를 직접 호출하지 않고 이 JSON만 렌더(Source of Truth).
 * - 숫자는 전부 기존 테이블에서 코드로 계산(API 키 불필요). headline·조언은 규칙 기반 문장.
 * - 원본은 기존 테이블(sales_daily·content_metrics·tasks·schedules·staff_output_actions·content_items).
 *   brief_json은 "그 데이터를 어떻게 해석했는가"의 스냅샷.
 * - (개인용 아침 브리핑은 briefing.service.ts — 별개)
 * - 마이그레이션 033_office_briefing.sql. Mock 동기화: mockSupabase office_briefings.
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { Workspace } from '../types';
import { workspaceErpSource } from '../config/dataSource';
import { fetchWorkspaceAnalytics } from './analytics.service';
import { fetchTasks } from './tasks.service';
import { fetchSchedules } from './schedules.service';
import { fetchActions } from './staffOutputActions.service';
import { fetchContentItems } from './contentItems.service';

export type BriefStatus = 'good' | 'attention' | 'critical';
export type Severity = 'critical' | 'warning' | 'info' | 'positive';

export interface BriefTop3 {
  rank: number;
  type: 'sales' | 'content' | 'task' | 'schedule' | 'cs' | 'monitoring' | 'decision';
  severity: Severity;
  title: string;
  summary: string;
  recommended_action?: { label: string; action_type: string; target_id?: string };
}
export interface BriefDueItem { type: 'task' | 'schedule' | 'content'; id: string; title: string; time?: string; status?: string }
export interface BriefApproval { id: string; source_staff?: string; type: string; title: string }

export interface BriefingJson {
  workspace_id: string;
  briefing_date: string;         // YYYY-MM-DD
  kind: 'daily' | 'weekly';
  headline: { status: BriefStatus; text: string };
  top3: BriefTop3[];
  sales: {
    hasData: boolean;
    yesterday_revenue: number;
    last7_revenue: number;
    month_revenue: number;       // 최근 30일 근사(MVP)
    month_target: number | null;
    attainment_pct: number | null;
    orders7: number;
    aov: number | null;
    status: BriefStatus;
    one_line: string;
  };
  content: {
    hasData: boolean;
    published_7d: number;
    scheduled_today: number;
    avg_save_rate: number | null;
    avg_share_rate: number | null;
    follower_delta: number;
    best_title: string | null;
    status: BriefStatus;
    one_line: string;
  };
  operations: {
    tasks_due_today: number;
    tasks_overdue: number;
    tasks_unassigned: number;
    approvals_pending: number;
    schedule_count_today: number;
  };
  due_today: BriefDueItem[];
  approvals_pending: BriefApproval[];
  one_line_advice: string;
}

const todayStr = () => new Date().toISOString().slice(0, 10);
const man = (n: number) => `${Math.round(n / 10000).toLocaleString()}만원`;

/** 워크스페이스 실데이터 → CEO 브리핑 JSON (코드 계산 + 규칙 기반 문장) */
export async function buildBriefingJson(workspace: Workspace, kind: 'daily' | 'weekly' = 'daily'): Promise<BriefingJson> {
  const today = todayStr();
  const [analytics, allTasks, schedules, approvals, content] = await Promise.all([
    fetchWorkspaceAnalytics(workspace.id, workspaceErpSource(workspace)).catch(() => null),
    fetchTasks().catch(() => []),
    fetchSchedules(workspace.id).catch(() => []),
    fetchActions(workspace.id, 'suggested').catch(() => []),
    fetchContentItems(workspace.id).catch(() => []),
  ]);

  // ── 할일(워크스페이스 스코프, 미완료) ──
  const wsTasks = allTasks.filter(t => t.workspace_id === workspace.id && t.status !== 'done');
  const dueToday = wsTasks.filter(t => t.due_date === today);
  const overdue = wsTasks.filter(t => t.due_date && t.due_date < today);
  const unassigned = wsTasks.filter(t => !t.assignee_id && (t.source ?? 'manual') === 'manual');

  // ── 일정(오늘) ──
  const schedToday = schedules.filter(s => s.date === today);

  // ── 콘텐츠(오늘 발행 예정 · 최근 발행) ──
  const scheduledToday = content.filter(c => c.scheduledFor && c.scheduledFor.slice(0, 10) === today && c.status !== 'published');
  const published7d = analytics?.content.publishedCount ?? content.filter(c => c.status === 'published').length;

  // ── 매출 ──
  const s = analytics?.sales;
  const yesterday = s?.dailySeries?.[5] ?? 0;         // dailySeries: 최근7일(마지막=오늘)
  const monthRevenue = s?.last30Revenue ?? 0;
  const target = workspace.monthlySalesTarget ?? null;
  const attainment = target && target > 0 ? Math.round((monthRevenue / target) * 1000) / 10 : null;
  const salesHasData = !!s?.hasData;
  const salesStatus: BriefStatus = !salesHasData ? 'attention'
    : attainment != null && attainment < 40 ? 'critical'
    : attainment != null && attainment < 70 ? 'attention' : 'good';
  const salesOneLine = !salesHasData ? '매출 데이터가 아직 없어요. 매출 메뉴에서 입력하면 자동 반영됩니다.'
    : target != null ? `월 목표의 ${attainment}%입니다. 최근 7일 매출은 ${man(s!.last7Revenue)}입니다.`
    : `최근 7일 매출 ${man(s!.last7Revenue)}, 주문 ${s!.orders7}건입니다. (월 목표를 설정하면 달성률을 보여드려요)`;

  // ── 콘텐츠 성과 ──
  const c = analytics?.content;
  const contentHasData = !!c?.hasData;
  const contentStatus: BriefStatus = !contentHasData ? 'attention'
    : (c!.avgSaveRate ?? 0) >= 5 ? 'good' : 'attention';
  const contentOneLine = !contentHasData ? '콘텐츠 성과 데이터가 아직 없어요. 발행 후 24h/72h/7d 성과를 입력하면 반영됩니다.'
    : `최근 저장률 평균 ${c!.avgSaveRate ?? '—'}% · 공유율 ${c!.avgShareRate ?? '—'}%${c!.top[0] ? ` · 잘된 콘텐츠 "${c!.top[0].title}"` : ''}`;

  // ── TOP3 (우선순위: 지연 → 오늘 발행 미완 → 승인대기 → 오늘 마감) ──
  const cand: BriefTop3[] = [];
  if (overdue.length > 0) cand.push({
    rank: 0, type: 'task', severity: 'critical',
    title: `지연된 할일 ${overdue.length}건`,
    summary: `마감이 지난 미완료 할일이 ${overdue.length}건 있습니다. 가장 급한 것부터 처리하세요.`,
    recommended_action: { label: '할일 열기', action_type: 'open_item', target_id: overdue[0].id },
  });
  scheduledToday.forEach(ci => cand.push({
    rank: 0, type: 'content', severity: 'warning',
    title: `오늘 발행 예정: ${ci.title}`,
    summary: '오늘 발행 예정 콘텐츠가 아직 발행 전입니다. 촬영·편집 상태를 확인하세요.',
    recommended_action: { label: '콘텐츠 열기', action_type: 'open_item', target_id: ci.id },
  }));
  if (approvals.length > 0) cand.push({
    rank: 0, type: 'decision', severity: 'info',
    title: `승인 대기 ${approvals.length}건`,
    summary: 'AI 직원이 올린 제안이 승인을 기다리고 있습니다.',
    recommended_action: { label: '승인 검토', action_type: 'approve' },
  });
  if (dueToday.length > 0) cand.push({
    rank: 0, type: 'task', severity: 'info',
    title: `오늘 마감 할일 ${dueToday.length}건`,
    summary: `오늘 마감인 할일이 ${dueToday.length}건 있습니다.`,
    recommended_action: { label: '할일 열기', action_type: 'open_item', target_id: dueToday[0].id },
  });
  const sevRank: Record<Severity, number> = { critical: 0, warning: 1, info: 2, positive: 3 };
  const top3 = cand.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]).slice(0, 3).map((t, i) => ({ ...t, rank: i + 1 }));

  // ── 헤드라인 / 조언 (규칙 기반) ──
  const hasCritical = top3.some(t => t.severity === 'critical');
  const hasWarning = top3.some(t => t.severity === 'warning');
  const headStatus: BriefStatus = hasCritical ? 'critical' : hasWarning ? 'attention' : 'good';
  const headText = top3[0]
    ? (hasCritical ? `먼저 확인이 필요합니다: ${top3[0].title}.`
      : hasWarning ? `오늘은 ${top3[0].title} 처리가 우선입니다.`
      : `큰 이슈는 없습니다. 오늘 할 일: ${top3[0].title}.`)
    : (salesHasData ? '특별한 이슈 없이 안정적으로 운영 중입니다.' : '데이터를 채우면 매일 아침 브리핑이 풍부해집니다.');
  const advice = scheduledToday.length > 0
    ? '오늘은 새 일을 벌이기보다 예정된 콘텐츠를 완성해 발행하는 것이 우선입니다.'
    : overdue.length > 0 ? '지연된 할일부터 정리한 뒤 오늘 업무를 진행하세요.'
    : approvals.length > 0 ? '승인 대기 중인 AI 제안을 먼저 검토해 오늘 실행에 반영하세요.'
    : '오늘은 큰 불이 없습니다. 콘텐츠 한 건을 앞당겨두면 이번 주가 편해집니다.';

  return {
    workspace_id: workspace.id,
    briefing_date: today,
    kind,
    headline: { status: headStatus, text: headText },
    top3,
    sales: {
      hasData: salesHasData,
      yesterday_revenue: yesterday,
      last7_revenue: s?.last7Revenue ?? 0,
      month_revenue: monthRevenue,
      month_target: target,
      attainment_pct: attainment,
      orders7: s?.orders7 ?? 0,
      aov: s?.aov ?? null,
      status: salesStatus,
      one_line: salesOneLine,
    },
    content: {
      hasData: contentHasData,
      published_7d: published7d,
      scheduled_today: scheduledToday.length,
      avg_save_rate: c?.avgSaveRate ?? null,
      avg_share_rate: c?.avgShareRate ?? null,
      follower_delta: c?.followerDelta ?? 0,
      best_title: c?.top[0]?.title ?? null,
      status: contentStatus,
      one_line: contentOneLine,
    },
    operations: {
      tasks_due_today: dueToday.length,
      tasks_overdue: overdue.length,
      tasks_unassigned: unassigned.length,
      approvals_pending: approvals.length,
      schedule_count_today: schedToday.length,
    },
    due_today: [
      ...dueToday.map(t => ({ type: 'task' as const, id: t.id, title: t.title, status: t.status })),
      ...schedToday.map(sc => ({ type: 'schedule' as const, id: sc.id, title: sc.title, time: sc.time })),
      ...scheduledToday.map(ci => ({ type: 'content' as const, id: ci.id, title: ci.title, time: ci.scheduledFor?.slice(11, 16) })),
    ],
    approvals_pending: approvals.slice(0, 5).map(a => ({
      id: a.id, source_staff: a.staffId, type: a.type,
      title: String((a.payload as { title?: string })?.title || a.type),
    })),
    one_line_advice: advice,
  };
}

/** 브리핑 생성 → office_briefings upsert(워크스페이스×날짜×kind) → 저장된 JSON 반환 */
export async function generateBriefing(workspace: Workspace, kind: 'daily' | 'weekly' = 'daily'): Promise<BriefingJson> {
  const brief = await buildBriefingJson(workspace, kind);
  const userId = await getCurrentUserId().catch(() => null);
  const { data: existing } = await supabase
    .from('office_briefings')
    .select('id')
    .eq('workspace_id', workspace.id).eq('briefing_date', brief.briefing_date).eq('kind', kind)
    .limit(1);
  if (existing && existing.length > 0) {
    await supabase.from('office_briefings')
      .update({ brief_json: brief, generated_at: new Date().toISOString() })
      .eq('id', existing[0].id);
  } else {
    await supabase.from('office_briefings').insert({
      workspace_id: workspace.id, created_by: userId, briefing_date: brief.briefing_date, kind, brief_json: brief,
    });
  }
  return brief;
}

/** 최신 저장된 브리핑 조회 — 없으면 null */
export async function fetchLatestBriefing(workspaceId: string, kind: 'daily' | 'weekly' = 'daily'): Promise<BriefingJson | null> {
  const { data, error } = await supabase
    .from('office_briefings')
    .select('brief_json, briefing_date')
    .eq('workspace_id', workspaceId).eq('kind', kind)
    .order('briefing_date', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return (data[0].brief_json ?? null) as BriefingJson | null;
}

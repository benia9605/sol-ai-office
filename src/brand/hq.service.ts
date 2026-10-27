/**
 * @file src/brand/hq.service.ts
 * @description 브랜드 오피스 데이터 - 본부(sol-hq) 표 읽기 · 쓰기 (마이그 065)
 *
 * 본부는 매일 09:00 hq_ingest 로 브리핑 · 실적 · 할 일 · 결정 · 리서치 · 콘텐츠 · 프롬프트를 넣고,
 * 사람은 이 화면에서 체크 · 결정 · 추가 · 수정한다. 본부는 다음 날 hq_pull 로 그 결과를 읽는다.
 * 권한은 RLS(워크스페이스 멤버)가 정한다 - 이 파일은 workspace_id 로 거르기만 한다.
 */
import { supabase } from '../services/supabase';
import { getCurrentUserId } from '../services/auth';
import { notify, getActorName, NotifyType } from '../services/notify.service';

// ── 날짜 (KST) ───────────────────────────────────────
export function todayKst(offsetDays = 0): string {
  const d = new Date(Date.now() + 9 * 3600e3 + offsetDays * 86400e3);
  return d.toISOString().slice(0, 10);
}
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** 2026-10-26 → 10.26 (월) */
export function fmtDay(iso: string, withWeek = true): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  const w = WEEK[new Date(Date.UTC(+y, +m - 1, +d)).getUTCDay()];
  return withWeek ? `${m}.${d} (${w})` : `${m}.${d}`;
}

/** 2026-10-26 → 2026.10.26 (월) */
export function fmtFull(iso: string): string {
  return `${iso.slice(0, 4)}.${fmtDay(iso)}`;
}

// ── 타입 ─────────────────────────────────────────────
export type Source = 'hq' | 'me';
export interface Briefing { id: string; date: string; title: string; summary?: string; html?: string; meta: Record<string, any>; source: Source; createdAt: string }
export interface MetricItem { label: string; value: string; note?: string }
export interface Metrics { date: string; items: MetricItem[]; raw: Record<string, any> }
export type TaskStatus = 'proposed' | 'open' | 'done' | 'held' | 'deleted';
export interface HqTask {
  id: string; workspaceId: string; title: string; why?: string; source: Source; sourceLabel?: string; status: TaskStatus;
  dueDate?: string; assigneeUserId?: string; assigneeShared: boolean; memo?: string;
  history: { at: string; text: string; by?: string }[]; createdAt: string; updatedAt: string; doneAt?: string; doneBy?: string;
}
export interface Decision {
  id: string; date: string; question: string; why?: string; options: string[];
  status: 'open' | 'decided' | 'held'; picked?: string; opinion?: string; makeTask: boolean; decidedAt?: string; decidedBy?: string;
}
export interface Research {
  id: string; date: string; kind: string; title: string; summary?: string; evidence: string[]; judgment?: string;
  implications: string[]; sources: { title?: string; url: string }[]; link?: string; source: Source;
}
export type Stage = 'plan' | 'draft' | 'shoot' | 'edit' | 'done';
export const STAGES: { key: Stage; label: string }[] = [
  { key: 'plan', label: '기획' }, { key: 'draft', label: '원고' }, { key: 'shoot', label: '촬영' },
  { key: 'edit', label: '편집' }, { key: 'done', label: '게시 완료' },
];
export interface Content {
  id: string; title: string; channel?: string; stage: Stage; dueDate?: string; draft?: string; draftVersion: number;
  draftStatus?: 'auto' | 'edited' | 'confirmed'; promptId?: string; memo?: string; position: number; source: Source; updatedAt: string;
}
export interface PromptCategory { id: string; name: string; position: number }
export interface Prompt {
  id: string; categoryId?: string; title: string; tool?: string; body: string; version: number; source: Source;
  lastUsedAt?: string; updatedAt: string;
}
export interface PromptVersion { id: string; version: number; body: string; note?: string; authorLabel?: string; createdAt: string }

const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

// ── 브리핑 ───────────────────────────────────────────
export async function listBriefings(ws: string, limit = 60): Promise<Briefing[]> {
  const { data, error } = await supabase.from('hq_briefings')
    .select('id,date,title,summary,meta,source,created_at').eq('workspace_id', ws)
    .order('date', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, date: r.date, title: r.title, summary: r.summary ?? undefined, meta: r.meta ?? {}, source: r.source, createdAt: r.created_at }));
}
export async function getBriefingHtml(id: string): Promise<string> {
  const { data, error } = await supabase.from('hq_briefings').select('html').eq('id', id).single();
  if (error) throw error;
  return data?.html ?? '';
}

// ── 실적 ─────────────────────────────────────────────
export async function listMetrics(ws: string, days = 30): Promise<Metrics[]> {
  const { data, error } = await supabase.from('hq_metrics')
    .select('date,items,raw').eq('workspace_id', ws).gte('date', todayKst(-days))
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ date: r.date, items: arr<MetricItem>(r.items), raw: r.raw ?? {} }));
}

// ── 사람 · 시간 · 알림 ───────────────────────────────
/** 2026-10-27T05:32Z → 10.27 14:32 (KST) */
export function fmtTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString();
  return `${d.slice(5, 7)}.${d.slice(8, 10)} ${d.slice(11, 16)}`;
}
const wsNames = new Map<string, Promise<string>>();
function wsName(ws: string): Promise<string> {
  if (!wsNames.has(ws)) wsNames.set(ws, Promise.resolve(supabase.from('workspaces').select('name').eq('id', ws).maybeSingle())
    .then(({ data }) => (data as { name?: string } | null)?.name ?? '').catch(() => ''));
  return wsNames.get(ws)!;
}
/** 나 (id · 이 워크스페이스에서 보이는 이름) */
async function whoAmI(ws: string): Promise<{ uid: string | null; name: string }> {
  const uid = await getCurrentUserId().catch(() => null);
  return { uid, name: await getActorName(ws, uid) };
}
/** 폰 알림 - 기존 notify 함수 · 알림 설정 그대로. 받는 사람이 없으면 워크스페이스 멤버 전체(나 빼고). 실패해도 조용히 */
async function brandNotify(ws: string, type: NotifyType, title: string, body: string, path: string, tag: string, targetUserIds?: string[]) {
  const [{ uid }, name] = await Promise.all([whoAmI(ws), wsName(ws)]);
  if (targetUserIds && !targetUserIds.filter(u => u !== uid).length) return;
  notify({ type, workspaceId: ws, actorId: uid, title: name ? `${title} · ${name}` : title, body, url: `/w/${ws}${path}`, tag, targetUserIds });
}

// ── 할 일 ────────────────────────────────────────────
function rowTask(r: any): HqTask {
  return {
    id: r.id, workspaceId: r.workspace_id, title: r.title, why: r.why ?? undefined, source: r.source, sourceLabel: r.source_label ?? undefined,
    status: r.status, dueDate: r.due_date ?? undefined, assigneeUserId: r.assignee_user_id ?? undefined,
    assigneeShared: !!r.assignee_shared, memo: r.memo ?? undefined, history: arr(r.history),
    createdAt: r.created_at, updatedAt: r.updated_at, doneAt: r.done_at ?? undefined, doneBy: r.done_by ?? undefined,
  };
}
/** 진행 중 · 제안 · 오늘 끝낸 할 일 */
export async function listTasks(ws: string): Promise<HqTask[]> {
  const { data, error } = await supabase.from('hq_tasks').select('*').eq('workspace_id', ws)
    .or(`status.in.(open,proposed),and(status.eq.done,done_at.gte.${todayKst()}T00:00:00+09:00)`)
    .order('created_at', { ascending: true }).limit(500);
  if (error) throw error;
  return (data ?? []).map(rowTask);
}
const stamp = (text: string, by?: string) => ({ at: new Date().toISOString(), text, ...(by ? { by } : {}) });
export async function addTask(ws: string, f: { title: string; dueDate?: string; assigneeUserId?: string; assigneeShared?: boolean; memo?: string; why?: string }): Promise<HqTask> {
  const me = await whoAmI(ws);
  const { data, error } = await supabase.from('hq_tasks').insert({
    workspace_id: ws, title: f.title.trim(), why: f.why ?? null, source: 'me', status: 'open',
    due_date: f.dueDate ?? null, assignee_user_id: f.assigneeUserId ?? null, assignee_shared: !!f.assigneeShared,
    memo: f.memo ?? null, created_by: me.uid, history: [stamp('추가', me.name)],
  }).select().single();
  if (error) throw error;
  const t = rowTask(data);
  if (t.assigneeUserId && t.assigneeUserId !== me.uid)
    brandNotify(ws, 'notify_task_assigned', '🔄 할 일 배정', `${me.name} 님이 「${t.title}」 을 맡겼어요.`, `/tasks/${t.id}`, `hq-task-assign-${t.id}-${t.assigneeUserId}`, [t.assigneeUserId]);
  return t;
}
export async function updateTask(t: HqTask, patch: Partial<Pick<HqTask, 'title' | 'status' | 'dueDate' | 'assigneeUserId' | 'assigneeShared' | 'memo'>>, note?: string): Promise<HqTask> {
  const me = await whoAmI(t.workspaceId);
  const p: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) p.title = patch.title.trim();
  if (patch.status !== undefined) {
    const done = patch.status === 'done';
    p.status = patch.status; p.done_at = done ? new Date().toISOString() : null; p.done_by = done ? me.uid : null;
  }
  if (patch.dueDate !== undefined) p.due_date = patch.dueDate || null;
  if (patch.assigneeUserId !== undefined) p.assignee_user_id = patch.assigneeUserId || null;
  if (patch.assigneeShared !== undefined) p.assignee_shared = patch.assigneeShared;
  if (patch.memo !== undefined) p.memo = patch.memo || null;
  if (note) p.history = [...t.history, stamp(note, me.name)];
  const { data, error } = await supabase.from('hq_tasks').update(p).eq('id', t.id).select().single();
  if (error) throw error;
  const next = rowTask(data);
  if (next.status === 'done' && t.status !== 'done')
    brandNotify(t.workspaceId, 'notify_task_completed', '✅ 할 일 완료', `${me.name} 님이 「${next.title}」 을 완료했어요.`, `/tasks/${t.id}`, `hq-task-${t.id}-done`);
  if (next.assigneeUserId && next.assigneeUserId !== t.assigneeUserId && next.assigneeUserId !== me.uid)
    brandNotify(t.workspaceId, 'notify_task_assigned', '🔄 할 일 배정', `${me.name} 님이 「${next.title}」 을 맡겼어요.`, `/tasks/${t.id}`, `hq-task-assign-${t.id}-${next.assigneeUserId}`, [next.assigneeUserId]);
  return next;
}

// ── 결정 ─────────────────────────────────────────────
function rowDecision(r: any): Decision {
  return { id: r.id, date: r.date, question: r.question, why: r.why ?? undefined, options: arr<string>(r.options),
    status: r.status, picked: r.picked ?? undefined, opinion: r.opinion ?? undefined, makeTask: !!r.make_task,
    decidedAt: r.decided_at ?? undefined, decidedBy: r.decided_by ?? undefined };
}
export async function listDecisions(ws: string): Promise<Decision[]> {
  const { data, error } = await supabase.from('hq_decisions').select('*').eq('workspace_id', ws)
    .in('status', ['open', 'held']).order('date', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map(rowDecision);
}
/** 결정 - 고른 안 저장 · 의견은 결정 댓글로 · 원하면 할 일 생성 */
export async function decide(ws: string, d: Decision, f: { picked?: string; opinion?: string; makeTask: boolean; assigneeUserId?: string; status: 'decided' | 'held' }): Promise<void> {
  const me = await whoAmI(ws);
  const { error } = await supabase.from('hq_decisions').update({
    status: f.status, picked: f.picked ?? null, make_task: f.makeTask,
    decided_by: me.uid, decided_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', d.id);
  if (error) throw error;
  if (f.opinion?.trim()) await addHqComment(ws, 'hq_decision', d.id, f.opinion, { label: '결정에 댓글', path: `/tasks/decide-${d.id}` });
  if (f.status === 'decided')
    brandNotify(ws, 'notify_decision', '🧭 결정', `${me.name} 님이 「${d.question.slice(0, 60)}」${f.picked ? ` → ${f.picked}` : ''}`, `/tasks/decide-${d.id}`, `hq-decision-${d.id}`);
  if (f.status === 'decided' && f.makeTask && f.picked) {
    await addTask(ws, { title: f.picked, why: `결정 · ${d.question}`, assigneeUserId: f.assigneeUserId, memo: f.opinion });
  }
}

// ── 댓글 (기존 social_comments 를 같이 쓴다 · 마이그 068) ──
// hq_task: 할 일 id · hq_decision: 결정 id · hq_briefing: '<브리핑 id>:<칸>' (칸 = top · brand · free)
export type HqRef = 'hq_task' | 'hq_decision' | 'hq_briefing';
export interface HqComment { id: string; userId: string; text: string; at: string }
export async function listHqComments(ws: string, ref: HqRef, refIds: string[]): Promise<Record<string, HqComment[]>> {
  const out: Record<string, HqComment[]> = {};
  if (!refIds.length) return out;
  const { data, error } = await supabase.from('social_comments').select('id,ref_id,user_id,content,created_at')
    .eq('workspace_id', ws).eq('ref_type', ref).in('ref_id', refIds).order('created_at', { ascending: true });
  if (error) throw error;
  for (const r of (data ?? []) as { id: string; ref_id: string; user_id: string; content: string; created_at: string }[])
    (out[r.ref_id] ??= []).push({ id: r.id, userId: r.user_id, text: r.content, at: r.created_at });
  return out;
}
/** 댓글 달기 → 다른 멤버에게 알림 (about.label · about.path = 알림 제목 · 누르면 갈 곳) */
export async function addHqComment(ws: string, ref: HqRef, refId: string, text: string, about: { label: string; path: string }): Promise<HqComment> {
  const me = await whoAmI(ws);
  if (!me.uid) throw new Error('로그인이 필요해요');
  const body = text.trim().slice(0, 5000);
  const { data, error } = await supabase.from('social_comments')
    .insert({ ref_type: ref, ref_id: refId, workspace_id: ws, user_id: me.uid, content: body })
    .select('id,user_id,content,created_at').single();
  if (error) throw error;
  brandNotify(ws, 'notify_comment', `💬 ${about.label}`, `${me.name} 님: ${body.slice(0, 80)}`, about.path, `hq-comment-${data.id}`);
  return { id: data.id, userId: data.user_id, text: data.content, at: data.created_at };
}
/** 내가 단 댓글만 지운다 */
export async function deleteHqComment(id: string): Promise<boolean> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase.from('social_comments').delete().eq('id', id).eq('user_id', uid).select('id');
  if (error) throw error;
  return !!data?.length;
}

// ── 브리핑 안에서 체크 · 결정 · 댓글 (BriefingModal ↔ 브리핑 iframe) ──
// 브리핑 HTML 은 본부가 만든 그대로라 할 일 · 결정을 제목 · 물음 글자로 찾는다. 이 워크스페이스 안에서만.
// 본부 보고서(이 맥)는 같은 일을 DB 함수 hq_act 로 한다 (마이그 067 · 068) - 둘이 같은 칸 · 같은 모양을 쓴다.
export interface BriefingComment { id: string; by: string; text: string; at: string; mine: boolean }
export type BriefingState = {
  tasks: Record<string, { done: boolean; at?: string; by?: string }>;
  decisions: Record<string, { picked: string | null; at?: string; by?: string; comments: BriefingComment[] }>;
  memos: Record<string, BriefingComment[]>;
};
export const BRIEFING_MEMO_SLOTS = ['top', 'brand', 'free'] as const;
const latestBy = <T extends { updated_at: string }>(rows: T[], k: (r: T) => string) => {
  const m = new Map<string, T>();
  for (const r of rows) { const o = m.get(k(r)); if (!o || o.updated_at < r.updated_at) m.set(k(r), r); }
  return m;
};
async function memberNames(ws: string): Promise<Map<string, string>> {
  const { data } = await supabase.from('workspace_members').select('user_id,nickname').eq('workspace_id', ws);
  return new Map(((data ?? []) as { user_id: string; nickname?: string }[]).map(m => [m.user_id, m.nickname?.trim() || '멤버']));
}
async function findTask(ws: string, title: string) {
  const { data, error } = await supabase.from('hq_tasks').select('*').eq('workspace_id', ws).eq('title', title)
    .neq('status', 'deleted').order('updated_at', { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0] ? rowTask(data[0]) : null;
}
async function findDecision(ws: string, question: string) {
  const { data, error } = await supabase.from('hq_decisions').select('*').eq('workspace_id', ws).eq('question', question)
    .order('updated_at', { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0] ? rowDecision(data[0]) : null;
}
/** 브리핑에 나온 할 일 · 결정 · 메모 댓글이 오피스에서 지금 어떤 상태인지. 없는 할 일 · 결정은 칸이 빠진다 (브리핑에서 못 누름) */
export async function briefingState(ws: string, briefingId: string, titles: string[], questions: string[]): Promise<BriefingState> {
  const out: BriefingState = { tasks: {}, decisions: {}, memos: {} };
  const [names, uid] = await Promise.all([memberNames(ws), getCurrentUserId().catch(() => null)]);
  const nameOf = (u?: string | null) => (u ? names.get(u) ?? '멤버' : undefined);
  const toB = (c: HqComment): BriefingComment => ({ id: c.id, by: nameOf(c.userId)!, text: c.text, at: c.at, mine: c.userId === uid });
  const t = [...new Set(titles)].slice(0, 100), q = [...new Set(questions)].slice(0, 50);
  if (t.length) {
    const { data, error } = await supabase.from('hq_tasks').select('title,status,done_at,done_by,updated_at').eq('workspace_id', ws).in('title', t).neq('status', 'deleted');
    if (error) throw error;
    latestBy((data ?? []) as { title: string; status: string; done_at: string | null; done_by: string | null; updated_at: string }[], r => r.title)
      .forEach((r, k) => { const done = r.status === 'done'; out.tasks[k] = { done, at: done ? r.done_at ?? undefined : undefined, by: done ? nameOf(r.done_by) : undefined }; });
  }
  if (q.length) {
    const { data, error } = await supabase.from('hq_decisions').select('id,question,status,picked,decided_at,decided_by,updated_at').eq('workspace_id', ws).in('question', q);
    if (error) throw error;
    const latest = latestBy((data ?? []) as { id: string; question: string; status: string; picked: string | null; decided_at: string | null; decided_by: string | null; updated_at: string }[], r => r.question);
    const cs = await listHqComments(ws, 'hq_decision', [...latest.values()].map(r => r.id));
    latest.forEach((r, k) => {
      const done = r.status === 'decided';
      out.decisions[k] = { picked: done ? (r.picked ?? '') : null, at: done ? r.decided_at ?? undefined : undefined, by: done ? nameOf(r.decided_by) : undefined, comments: (cs[r.id] ?? []).map(toB) };
    });
  }
  const cs = await listHqComments(ws, 'hq_briefing', BRIEFING_MEMO_SLOTS.map(s => `${briefingId}:${s}`));
  BRIEFING_MEMO_SLOTS.forEach(s => { out.memos[s] = (cs[`${briefingId}:${s}`] ?? []).map(toB); });
  return out;
}
/** 할 일 체크 · 해제 */
export async function setTaskDoneByTitle(ws: string, title: string, done: boolean): Promise<boolean> {
  const t = await findTask(ws, title);
  if (!t) return false;
  if ((t.status === 'done') !== done) await updateTask(t, { status: done ? 'done' : 'open' }, done ? '완료 (브리핑)' : '완료 취소 (브리핑)');
  return true;
}
/** 결정 고르기 (picked = null 이면 다시 결정 대기로) - 할 일은 만들지 않는다 (결정 메뉴에서 · 본부가 다음 날) */
export async function pickDecisionByQuestion(ws: string, question: string, picked: string | null): Promise<boolean> {
  const d = await findDecision(ws, question);
  if (!d) return false;
  if (picked === null) {
    const { error } = await supabase.from('hq_decisions').update({ status: 'open', picked: null, decided_by: null, decided_at: null, updated_at: new Date().toISOString() }).eq('id', d.id);
    if (error) throw error;
  } else {
    if (!d.options.includes(picked)) return false;
    await decide(ws, d, { picked, makeTask: false, status: 'decided' });
  }
  return true;
}
/** 브리핑 댓글 - 결정(question) 또는 브리핑 칸(slot: top · brand · free) */
export async function addBriefingComment(ws: string, briefingId: string, target: { question?: string; slot?: string }, text: string): Promise<BriefingComment | null> {
  if (!text.trim()) return null;
  let c: HqComment;
  if (target.question) {
    const d = await findDecision(ws, target.question);
    if (!d) return null;
    c = await addHqComment(ws, 'hq_decision', d.id, text, { label: '결정에 댓글', path: `/tasks/decide-${d.id}` });
  } else {
    if (!(BRIEFING_MEMO_SLOTS as readonly string[]).includes(target.slot ?? '')) return null;
    c = await addHqComment(ws, 'hq_briefing', `${briefingId}:${target.slot}`, text, { label: '브리핑 메모', path: `/briefing/${briefingId}` });
  }
  const me = await whoAmI(ws);
  return { id: c.id, by: me.name, text: c.text, at: c.at, mine: true };
}

// ── 리서치 ───────────────────────────────────────────
function rowResearch(r: any): Research {
  return { id: r.id, date: r.date, kind: r.kind, title: r.title, summary: r.summary ?? undefined, evidence: arr(r.evidence),
    judgment: r.judgment ?? undefined, implications: arr(r.implications), sources: arr(r.sources), link: r.link ?? undefined, source: r.source };
}
export async function listResearch(ws: string, limit = 120): Promise<Research[]> {
  const { data, error } = await supabase.from('hq_research').select('*').eq('workspace_id', ws)
    .order('date', { ascending: false }).order('created_at', { ascending: true }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowResearch);
}
export async function addResearchNote(ws: string, f: { kind: string; title: string; summary?: string; link?: string }): Promise<void> {
  const uid = await getCurrentUserId();
  const { error } = await supabase.from('hq_research').insert({
    workspace_id: ws, kind: f.kind, title: f.title.trim(), summary: f.summary ?? null, link: f.link || null, source: 'me', created_by: uid, date: todayKst(),
  });
  if (error) throw error;
}

// ── 콘텐츠 ───────────────────────────────────────────
function rowContent(r: any): Content {
  return { id: r.id, title: r.title, channel: r.channel ?? undefined, stage: r.stage, dueDate: r.due_date ?? undefined,
    draft: r.draft ?? undefined, draftVersion: r.draft_version ?? 0, draftStatus: r.draft_status ?? undefined,
    promptId: r.prompt_id ?? undefined, memo: r.memo ?? undefined, position: r.position ?? 0, source: r.source, updatedAt: r.updated_at };
}
export async function listContents(ws: string): Promise<Content[]> {
  const { data, error } = await supabase.from('hq_contents').select('*').eq('workspace_id', ws)
    .order('position', { ascending: true }).order('created_at', { ascending: true }).limit(500);
  if (error) throw error;
  return (data ?? []).map(rowContent);
}
export async function addContent(ws: string, f: { title: string; channel?: string; stage: Stage; dueDate?: string; memo?: string }): Promise<Content> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase.from('hq_contents').insert({
    workspace_id: ws, title: f.title.trim(), channel: f.channel ?? null, stage: f.stage, due_date: f.dueDate ?? null, memo: f.memo ?? null, source: 'me', created_by: uid,
  }).select().single();
  if (error) throw error;
  return rowContent(data);
}
export async function updateContent(id: string, patch: Partial<Pick<Content, 'title' | 'channel' | 'stage' | 'dueDate' | 'draft' | 'draftStatus' | 'memo' | 'position'>>): Promise<Content> {
  const p: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) p.title = patch.title.trim();
  if (patch.channel !== undefined) p.channel = patch.channel || null;
  if (patch.stage !== undefined) p.stage = patch.stage;
  if (patch.dueDate !== undefined) p.due_date = patch.dueDate || null;
  if (patch.draft !== undefined) p.draft = patch.draft;
  if (patch.draftStatus !== undefined) p.draft_status = patch.draftStatus;
  if (patch.memo !== undefined) p.memo = patch.memo || null;
  if (patch.position !== undefined) p.position = patch.position;
  const { data, error } = await supabase.from('hq_contents').update(p).eq('id', id).select().single();
  if (error) throw error;
  return rowContent(data);
}
export async function deleteContent(id: string): Promise<void> {
  const { error } = await supabase.from('hq_contents').delete().eq('id', id);
  if (error) throw error;
}

// ── 프롬프트 ─────────────────────────────────────────
export async function listPromptCategories(ws: string): Promise<PromptCategory[]> {
  const { data, error } = await supabase.from('hq_prompt_categories').select('id,name,position').eq('workspace_id', ws).order('position').order('name');
  if (error) throw error;
  return (data ?? []) as PromptCategory[];
}
export async function addPromptCategory(ws: string, name: string, position: number): Promise<void> {
  const { error } = await supabase.from('hq_prompt_categories').insert({ workspace_id: ws, name: name.trim(), position });
  if (error) throw error;
}
export async function renamePromptCategory(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('hq_prompt_categories').update({ name: name.trim() }).eq('id', id);
  if (error) throw error;
}
export async function deletePromptCategory(id: string): Promise<void> {
  const { error } = await supabase.from('hq_prompt_categories').delete().eq('id', id);   // 프롬프트는 미분류로 (on delete set null)
  if (error) throw error;
}
export async function reorderPromptCategories(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id, i) => supabase.from('hq_prompt_categories').update({ position: i }).eq('id', id)));
}
function rowPrompt(r: any): Prompt {
  return { id: r.id, categoryId: r.category_id ?? undefined, title: r.title, tool: r.tool ?? undefined, body: r.body, version: r.version,
    source: r.source, lastUsedAt: r.last_used_at ?? undefined, updatedAt: r.updated_at };
}
export async function listPrompts(ws: string): Promise<Prompt[]> {
  const { data, error } = await supabase.from('hq_prompts').select('*').eq('workspace_id', ws).order('updated_at', { ascending: false }).limit(300);
  if (error) throw error;
  return (data ?? []).map(rowPrompt);
}
export async function addPrompt(ws: string, f: { title: string; categoryId?: string; tool?: string; body: string }, author: string): Promise<Prompt> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase.from('hq_prompts').insert({
    workspace_id: ws, title: f.title.trim(), category_id: f.categoryId ?? null, tool: f.tool ?? null, body: f.body, source: 'me', created_by: uid,
  }).select().single();
  if (error) throw error;
  await supabase.from('hq_prompt_versions').insert({ prompt_id: data.id, version: 1, body: f.body, note: '등록', author_label: author });
  return rowPrompt(data);
}
/** 고치면 새 버전 - 이전 본문은 hq_prompt_versions 에 남는다 */
export async function revisePrompt(p: Prompt, f: { title?: string; categoryId?: string | null; tool?: string; body: string; note?: string }, author: string): Promise<Prompt> {
  const next = p.version + 1;
  const { error: vErr } = await supabase.from('hq_prompt_versions').insert({ prompt_id: p.id, version: next, body: f.body, note: f.note ?? null, author_label: author });
  if (vErr) throw vErr;
  const { data, error } = await supabase.from('hq_prompts').update({
    title: (f.title ?? p.title).trim(), category_id: f.categoryId === undefined ? (p.categoryId ?? null) : f.categoryId, tool: f.tool ?? p.tool ?? null,
    body: f.body, version: next, updated_at: new Date().toISOString(),
  }).eq('id', p.id).select().single();
  if (error) throw error;
  return rowPrompt(data);
}
export async function listPromptVersions(promptId: string): Promise<PromptVersion[]> {
  const { data, error } = await supabase.from('hq_prompt_versions').select('*').eq('prompt_id', promptId).order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, version: r.version, body: r.body, note: r.note ?? undefined, authorLabel: r.author_label ?? undefined, createdAt: r.created_at }));
}
export async function markPromptUsed(id: string): Promise<void> {
  await supabase.from('hq_prompts').update({ last_used_at: new Date().toISOString() }).eq('id', id);
}

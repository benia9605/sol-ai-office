/**
 * @file src/services/schedulerInsights.service.ts
 * @description 일정비서 인사이트 — tasks·schedules·content_items를 통합한 실행 스케줄러
 * - GPT 설계 v2: 개인 약속 관리가 아니라 "콘텐츠 발행 스케줄러". 촬영/편집/발행 중심.
 * - 원본은 기존 테이블(tasks·schedules·content_items). 이 서비스는 해석·충돌감지·빈시간만.
 * - 신규 테이블 없음.
 */
import { fetchTasks } from './tasks.service';
import { fetchSchedules } from './schedules.service';
import { fetchContentItems } from './contentItems.service';
import { ContentStatus } from '../types';

export interface SchedTimelineItem { type: 'schedule' | 'content' | 'task'; id: string; title: string; time?: string; status?: string }
export interface SchedConflict { severity: 'high' | 'medium'; message: string; suggestion: string }
export interface SchedDay { date: string; weekday: string; isToday: boolean; items: { id: string; title: string; kind: 'content' | 'task' | 'schedule' }[] }
export interface SchedulerInsights {
  date: string;
  timeline: SchedTimelineItem[];
  counts: { scheduledToday: number; tasksDueToday: number; shooting: number; editing: number; publishing: number };
  week: SchedDay[];
  conflicts: SchedConflict[];
  freeSlots: { start: string; end: string }[];
}

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const addDays = (iso: string, d: number) => { const dt = new Date(iso + 'T00:00:00'); dt.setDate(dt.getDate() + d); return dt.toISOString().slice(0, 10); };
/** 콘텐츠 상태 → 단계(촬영전/편집/발행) */
const stageOf = (s: ContentStatus): 'shooting' | 'editing' | 'publishing' | 'other' =>
  (['idea', 'approved', 'scripted', 'shooting'] as ContentStatus[]).includes(s) ? 'shooting'
    : s === 'editing' ? 'editing'
    : (['scheduled', 'published'] as ContentStatus[]).includes(s) ? 'publishing' : 'other';

export async function fetchSchedulerInsights(workspaceId: string, date: string): Promise<SchedulerInsights> {
  const [allTasks, schedules, content] = await Promise.all([
    fetchTasks().catch(() => []),
    fetchSchedules(workspaceId).catch(() => []),
    fetchContentItems(workspaceId).catch(() => []),
  ]);
  const wsTasks = allTasks.filter(t => t.workspace_id === workspaceId);

  // ── 오늘 타임라인 (시간순: 일정·콘텐츠 발행예정 + 마감 할일) ──
  const schedToday = schedules.filter(s => s.date === date);
  const contentToday = content.filter(c => c.scheduledFor && c.scheduledFor.slice(0, 10) === date && c.status !== 'published');
  const tasksDueToday = wsTasks.filter(t => t.due_date === date && t.status !== 'done');
  const timeline: SchedTimelineItem[] = [
    ...schedToday.map(s => ({ type: 'schedule' as const, id: s.id, title: s.title, time: s.time || undefined })),
    ...contentToday.map(c => ({ type: 'content' as const, id: c.id, title: c.title, time: c.scheduledFor?.slice(11, 16), status: c.status })),
    ...tasksDueToday.map(t => ({ type: 'task' as const, id: t.id, title: t.title, status: t.status })),
  ].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  // ── 단계 카운트 (이번 주 발행 예정/진행 콘텐츠 기준) ──
  const wd = (new Date(date + 'T00:00:00').getDay() + 6) % 7; // 월=0
  const monday = addDays(date, -wd);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekContent = content.filter(c => c.scheduledFor && weekDates.includes(c.scheduledFor.slice(0, 10)));
  let shooting = 0, editing = 0, publishing = 0;
  weekContent.forEach(c => { const st = stageOf(c.status); if (st === 'shooting') shooting++; else if (st === 'editing') editing++; else if (st === 'publishing') publishing++; });

  // ── 이번 주 (월~일) ──
  const week: SchedDay[] = weekDates.map(dt => ({
    date: dt,
    weekday: WD[new Date(dt + 'T00:00:00').getDay()],
    isToday: dt === date,
    items: [
      ...content.filter(c => c.scheduledFor?.slice(0, 10) === dt && c.status !== 'published').map(c => ({ id: c.id, title: c.title, kind: 'content' as const })),
      ...wsTasks.filter(t => t.due_date === dt && t.status !== 'done').map(t => ({ id: t.id, title: t.title, kind: 'task' as const })),
      ...schedules.filter(s => s.date === dt).map(s => ({ id: s.id, title: s.title, kind: 'schedule' as const })),
    ],
  }));

  // ── 충돌 / 무리한 날 감지 (규칙 기반) ──
  const conflicts: SchedConflict[] = [];
  const overdue = wsTasks.filter(t => t.due_date && t.due_date < date && t.status !== 'done');
  if (overdue.length > 0) conflicts.push({ severity: 'high', message: `마감이 지난 할일이 ${overdue.length}건 있습니다.`, suggestion: '오늘 오전에 지연 항목부터 정리하세요.' });
  contentToday.forEach(c => {
    const st = stageOf(c.status);
    if (st === 'shooting') conflicts.push({ severity: 'high', message: `오늘 발행 예정 "${c.title}"이 아직 촬영 전입니다.`, suggestion: '오전에 촬영 블록(약 90분)을 먼저 확보하세요.' });
    else if (st === 'editing') conflicts.push({ severity: 'medium', message: `오늘 발행 예정 "${c.title}"이 편집 단계입니다.`, suggestion: '발행 전 편집 완료 시간을 확보하세요.' });
  });
  if (tasksDueToday.length >= 5) conflicts.push({ severity: 'medium', message: `오늘 마감 할일이 ${tasksDueToday.length}건으로 많습니다.`, suggestion: '우선순위 높은 것부터, 일부는 내일로 분산을 고려하세요.' });

  // ── 빈 시간 (09:00~19:00, 일정·콘텐츠 시간 사이 60분+ 공백) ──
  const busy = timeline.map(t => t.time).filter((t): t is string => !!t).sort();
  const freeSlots: { start: string; end: string }[] = [];
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const toHM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  let cursor = 9 * 60;
  const marks = [...busy.map(toMin), 19 * 60];
  for (const m of marks) {
    if (m - cursor >= 60) freeSlots.push({ start: toHM(cursor), end: toHM(m) });
    cursor = Math.max(cursor, m + 60); // 일정 1건당 60분 점유 가정
  }

  return {
    date, timeline,
    counts: { scheduledToday: schedToday.length + contentToday.length, tasksDueToday: tasksDueToday.length, shooting, editing, publishing },
    week, conflicts, freeSlots: freeSlots.slice(0, 3),
  };
}

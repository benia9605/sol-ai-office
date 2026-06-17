/**
 * @file src/components/office/views.tsx
 * @description 오피스 셸 본문 뷰 7종 (Phase 2 이식 · 모노톤+몽글)
 * - 실데이터: 할일(useTasks, 워크스페이스 필터됨) · 멤버(fetchMembers)
 * - 샘플/빈 상태: 대시보드 KPI·브리핑·일정·인사이트·기록 (실연동은 Phase 4~5)
 */
import { useEffect, useRef, useState } from 'react';
import { Workspace, WorkspaceMember, TaskItem, DailyReport } from '../../types';
import { useTasks } from '../../hooks/useTasks';
import { fetchMembers, removeMember, changeMemberRole } from '../../services/workspaces.service';
import { getCurrentUserId } from '../../services/auth';
import { fetchReportsByWorkspace } from '../../services/dailyReports.service';
import { fetchSchedules, addSchedule, deleteSchedule, ScheduleRow } from '../../services/schedules.service';
import { fetchInsights, addInsight, deleteInsight, InsightRow } from '../../services/insights.service';
import { fetchRecords, addRecord, deleteRecord, RecordRow } from '../../services/records.service';
import { fetchExternalKpis, ExternalKpiRow } from '../../services/externalKpis.service';
import { TiptapEditor, TiptapEditorHandle } from '../tiptap/TiptapEditor';
import { Spark, ViewHead, Card, EmptyState } from './ui';

/** 클로드/질문 빠른삽입 버튼 (스터디노트와 동일 UX) */
function ClaudeQuickButtons({ onClaude, onQA }: { onClaude: () => void; onQA: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onClaude} title="Claude 대화 세트 (나 / Claude)"
        className="px-2.5 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors inline-flex items-center">
        <img src="/images/claude.png" alt="Claude" className="w-4 h-4" />
      </button>
      <button type="button" onClick={onQA} title="질문 + 답변"
        className="px-2.5 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors inline-flex items-center">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>
    </div>
  );
}

type Nav = (v: string) => void;

/* ───────── 대시보드 ───────── */
const FLAT_SPARK = [0, 0, 0, 0, 0, 0, 0];

// 외부 KPI(원/raw) → 대시보드 카드 단위 변환
const KPI_DEFS: { k: string; unit: string; pick: (r: ExternalKpiRow) => number | null }[] = [
  { k: '주간 매출', unit: '만원', pick: (r) => (r.revenue != null ? Math.round(r.revenue / 10000) : null) },
  { k: '전환율',   unit: '%',   pick: (r) => r.conversion_rate },
  { k: '방문자',   unit: 'K',   pick: (r) => (r.visitors != null ? Math.round((r.visitors / 1000) * 10) / 10 : null) },
  { k: '신규 문의', unit: '건',  pick: (r) => (r.inquiries ?? r.orders) },
];

type Kpi = { k: string; unit: string; value: number; spark: number[]; delta: number | null };

/** 워크스페이스 KPI — external_kpis(외부 앱 PUSH) 기반. 미연동/데이터 없으면 0·플랫 */
function useDashboardKpis(workspaceId: string): Kpi[] {
  const [rows, setRows] = useState<ExternalKpiRow[]>([]);
  useEffect(() => {
    fetchExternalKpis(workspaceId, 7).then(setRows).catch(() => setRows([]));
  }, [workspaceId]);

  return KPI_DEFS.map((def) => {
    const series = rows.map((r) => def.pick(r)).filter((v): v is number => v != null);
    if (series.length === 0) return { k: def.k, unit: def.unit, value: 0, spark: FLAT_SPARK, delta: null };
    const value = series[series.length - 1];
    const prev = series.length > 1 ? series[series.length - 2] : null;
    const delta = prev && prev !== 0 ? Math.round(((value - prev) / prev) * 100) : null;
    return { k: def.k, unit: def.unit, value, spark: series.length > 1 ? series : [series[0], series[0]], delta };
  });
}

export function DashboardView({ onNavigate, workspace }: { onNavigate: Nav; workspace: Workspace }) {
  const { tasks } = useTasks();
  const kpis = useDashboardKpis(workspace.id);
  const open = tasks.filter(t => t.status !== 'completed');
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [memos, setMemos] = useState<RecordRow[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  useEffect(() => {
    fetchSchedules(workspace.id).then(setSchedules).catch(() => setSchedules([]));
    fetchInsights(workspace.id).then(setInsights).catch(() => setInsights([]));
    fetchRecords(workspace.id, 'memo').then(setMemos).catch(() => setMemos([]));
    fetchReportsByWorkspace(workspace.id, 6).then(setReports).catch(() => setReports([]));
    fetchMembers(workspace.id).then(setMembers).catch(() => setMembers([]));
  }, [workspace.id]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '좋은 저녁이에요';
  const upcoming = schedules.filter(s => s.date >= todayStr).slice(0, 4);

  const SecHead = ({ title, to }: { title: string; to?: string }) => (
    <div className="flex items-center justify-between mb-2">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
      {to && <button onClick={() => onNavigate(to)} className="text-[11px] text-gray-400 hover:text-primary-500 transition-colors">전체 ›</button>}
    </div>
  );
  const Empty = ({ t }: { t: string }) => <p className="text-xs text-gray-300 py-3 text-center">{t}</p>;

  return (
    <>
      {/* 인사말 히어로 */}
      <div className="mb-5">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-1">{greeting} 👋</h1>
        <p className="text-sm text-gray-400 mt-0.5">{workspace.name} · 진행 중 할일 {open.length}건 · 멤버 {members.length}명</p>
      </div>

      {/* KPI 스트립 — 실데이터 연동 전엔 0 (배포·연동 시 자동 반영) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-1">
        {kpis.map((kpi, i) => {
          const empty = kpi.value === 0 && kpi.delta === null;
          return (
            <Card key={i} className="p-4 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">{kpi.k}</span>
                {kpi.delta === null
                  ? <span className="text-xs font-semibold text-gray-300">—</span>
                  : <span className={`text-xs font-semibold ${kpi.delta >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>{kpi.delta >= 0 ? '▲' : '▼'} {Math.abs(kpi.delta)}%</span>}
              </div>
              <div className={`text-2xl font-extrabold mt-1 ${empty ? 'text-gray-300' : 'text-gray-800'}`}>
                {kpi.value.toLocaleString()}<span className="text-sm font-semibold text-gray-400 ml-0.5">{kpi.unit}</span>
              </div>
              <div className="mt-1"><Spark data={kpi.spark} /></div>
            </Card>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-300 mb-4 pl-1">· 실데이터 연동 전이에요 — 지표 소스/분석가 직원 연동 시 자동으로 채워져요</p>

      {/* 브리핑 배너 */}
      <button onClick={() => onNavigate('briefing')}
        className="w-full flex items-center gap-3 p-4 rounded-[24px] bg-primary-500 text-white mb-4 transition-all active:scale-[0.99] hover:bg-primary-600 text-left">
        <span className="text-2xl">☀️</span>
        <span className="flex-1">
          <span className="block text-sm font-bold">오늘의 브리핑 읽기</span>
          <span className="block text-xs text-white/70 mt-0.5">어제 AI 직원들이 한 일을 한 장으로</span>
        </span>
        <span className="text-white/50">›</span>
      </button>

      {/* 다가오는 일정 + 내 할일 */}
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <Card className="p-4">
          <SecHead title="다가오는 일정" to="schedule" />
          {upcoming.length ? upcoming.map(s => (
            <div key={s.id} className="flex items-center gap-2 py-1.5">
              <span className="text-[11px] font-bold text-gray-700 w-14 flex-shrink-0">{s.date.slice(5)}{s.time ? ' ' + s.time : ''}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
              <span className="text-sm text-gray-600 truncate">{s.title}</span>
            </div>
          )) : <Empty t="예정된 일정이 없어요" />}
        </Card>
        <Card className="p-4">
          <SecHead title="진행 중 할일" to="todos" />
          {open.length ? open.slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center gap-2 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className="text-sm text-gray-600 truncate flex-1">{t.title}</span>
              {t.priority === 'high' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-500 flex-shrink-0">긴급</span>}
            </div>
          )) : <Empty t="할일이 없어요" />}
        </Card>
      </div>

      {/* 최근 인사이트 + 최근 메모 */}
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <Card className="p-4">
          <SecHead title="최근 인사이트" to="insights" />
          {insights.length ? insights.slice(0, 4).map(i => (
            <div key={i.id} className="flex items-center gap-2 py-1.5">
              <span className="text-sm">💡</span><span className="text-sm text-gray-600 truncate">{i.title}</span>
            </div>
          )) : <Empty t="인사이트가 없어요" />}
        </Card>
        <Card className="p-4">
          <SecHead title="최근 메모" to="log" />
          {memos.length ? memos.slice(0, 4).map(m => (
            <div key={m.id} className="flex items-center gap-2 py-1.5">
              <span className="text-sm">📝</span><span className="text-sm text-gray-600 truncate flex-1">{m.title}</span>
              <span className="text-[10px] text-gray-300 flex-shrink-0">{m.date?.slice(5)}</span>
            </div>
          )) : <Empty t="메모가 없어요" />}
        </Card>
      </div>

      {/* 활동 로그 (AI 직원) */}
      <Card className="p-4 mb-3">
        <SecHead title="AI 직원 활동" to="activity" />
        {reports.length ? reports.slice(0, 5).map(r => (
          <div key={r.id} className="flex items-center gap-2 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
            <span className="text-sm text-gray-600 truncate flex-1">🤖 {r.title}</span>
            <span className="text-[10px] text-gray-300 flex-shrink-0">{r.date?.slice(5)}</span>
          </div>
        )) : <Empty t="아직 활동이 없어요 — AI 직원을 채용하고 ‘지금 한 번’을 눌러보세요" />}
      </Card>

      {/* 멤버 */}
      <Card className="p-4">
        <SecHead title="멤버" to="members" />
        {members.length ? (
          <div className="flex flex-wrap gap-2">
            {members.map(m => (
              <span key={m.userId} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-50 text-xs text-gray-600">
                <span className="w-5 h-5 rounded-full bg-primary-500 text-white flex items-center justify-center text-[10px] font-bold">{(m.nickname || m.userId).slice(0, 1).toUpperCase()}</span>
                {m.nickname || '멤버'}{m.role === 'owner' && ' 👑'}
              </span>
            ))}
          </div>
        ) : <Empty t="멤버가 없어요" />}
      </Card>
    </>
  );
}

/* ───────── 오늘의 브리핑 (직원 리포트 집계) ───────── */
export function BriefingView({ workspace }: { workspace: Workspace }) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  useEffect(() => {
    fetchReportsByWorkspace(workspace.id, 30).then(setReports).catch(() => setReports([]));
  }, [workspace.id]);

  return (
    <>
      <ViewHead eyebrow="TODAY'S BRIEFING" title="브리핑" sub={`직원 리포트 ${reports.length}건`} />
      {reports.length === 0 ? (
        <EmptyState emoji="☀️" title="아직 브리핑이 없어요" sub="AI 직원 상세에서 ‘지금 실행’을 누르면 리포트가 여기 모여요" />
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <Card key={r.id} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800">{r.title}</span>
                <span className="text-[11px] text-gray-400">{r.date}</span>
              </div>
              {r.summary && <p className="text-xs text-gray-500 mt-1">{r.summary}</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* ───────── 할일 (실데이터) ───────── */
function PriorityDot({ p }: { p: TaskItem['priority'] }) {
  const c = p === 'high' ? 'bg-rose-400' : p === 'medium' ? 'bg-amber-400' : 'bg-gray-300';
  return <span className={`w-2 h-2 rounded-full ${c} flex-shrink-0`} />;
}

function TaskCol({ title, items, onToggle }: { title: string; items: TaskItem[]; onToggle: (id: string) => void }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-gray-700">{title}</span>
        <span className="text-xs text-gray-400">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map(t => (
          <button
            key={t.id}
            onClick={() => onToggle(t.id)}
            className="w-full flex items-center gap-2 p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all active:scale-[0.98] text-left"
          >
            <PriorityDot p={t.priority} />
            <span className={`text-sm flex-1 ${t.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{t.title}</span>
            {t.category === '🤖 AI' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600">🤖 AI</span>}
            {t.assigneeId && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-500">담당</span>}
          </button>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-300 py-3 text-center">없음</p>}
      </div>
    </Card>
  );
}

export function TodosView() {
  const { tasks, cycleStatus } = useTasks();
  const open = tasks.filter(t => t.status !== 'completed');
  const done = tasks.filter(t => t.status === 'completed');
  return (
    <>
      <ViewHead eyebrow="TASKS" title="할일" sub={`${open.length}건 진행 · ${done.length}건 완료`} />
      <div className="grid sm:grid-cols-2 gap-3">
        <TaskCol title="할 일" items={open} onToggle={cycleStatus} />
        <TaskCol title="완료" items={done} onToggle={cycleStatus} />
      </div>
    </>
  );
}

/* ───────── 일정 (실데이터 · 직원 자동 등록 포함) ───────── */
export function ScheduleView({ workspace }: { workspace: Workspace }) {
  const [items, setItems] = useState<ScheduleRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', time: '', category: '', notes: '' });
  const load = () => fetchSchedules(workspace.id)
    .then(rows => setItems(rows.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))))
    .catch(() => setItems([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspace.id]);

  const save = async () => {
    if (!form.title.trim() || !form.date) return;
    await addSchedule({
      title: form.title.trim(), date: form.date, time: form.time, project: '', color: '',
      category: form.category || undefined, notes: form.notes || undefined, workspace_id: workspace.id,
    } as Omit<ScheduleRow, 'id' | 'created_at'>).catch(() => {});
    setForm({ title: '', date: '', time: '', category: '', notes: '' }); setShowForm(false); load();
  };
  const del = async (id: string) => { await deleteSchedule(id).catch(() => {}); load(); };

  return (
    <>
      <ViewHead eyebrow="SCHEDULE" title="일정" sub={`${items.length}건`} />
      <div className="flex justify-end mb-3">
        <button onClick={() => setShowForm(v => !v)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 active:scale-95 transition-all">＋ 일정 추가</button>
      </div>
      {showForm && (
        <Card className="p-4 mb-3 space-y-2.5">
          <input autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="제목"
            className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:bg-white focus:border-primary-300 transition-colors" />
          <div className="flex gap-2">
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
              className="flex-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:bg-white focus:border-primary-300 transition-colors" />
            <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
              className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:bg-white focus:border-primary-300 transition-colors" />
          </div>
          <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="카테고리 (선택)"
            className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:bg-white focus:border-primary-300 transition-colors" />
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="메모 (선택)" rows={2}
            className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm resize-none focus:outline-none focus:bg-white focus:border-primary-300 transition-colors" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
            <button onClick={save} disabled={!form.title.trim() || !form.date}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 transition-all">저장</button>
          </div>
        </Card>
      )}
      {items.length === 0 ? (
        <EmptyState emoji="📅" title="일정이 없어요" sub="직접 추가하거나, AI 직원이 ‘지금 실행’ 시 제안 일정을 자동 등록해요" />
      ) : (
        <Card className="p-2">
          {items.map(s => (
            <div key={s.id} className="group flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors">
              <span className="text-xs font-bold text-gray-800 w-20 flex-shrink-0">{s.date.slice(5)}{s.time ? ' ' + s.time : ''}</span>
              <span className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 flex-1">{s.title}</span>
              {s.category === '🤖 AI' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 flex-shrink-0">🤖 AI</span>}
              <button onClick={() => del(s.id)} className="text-[11px] text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">삭제</button>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

/* ───────── 인사이트 (실데이터 · 직원 AI 제안 포함) ───────── */
export function InsightsView({ workspace }: { workspace: Workspace }) {
  const [list, setList] = useState<InsightRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', source: '', link: '', tags: '' });
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const load = () => fetchInsights(workspace.id).then(setList).catch(() => setList([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspace.id]);

  // 커서 위치에 템플릿 삽입 (content는 plain text라 텍스트 템플릿으로)
  const insertTpl = (tpl: string) => {
    const el = contentRef.current;
    const cur = form.content;
    const pos = el ? el.selectionStart : cur.length;
    const next = cur.slice(0, pos) + tpl + cur.slice(pos);
    setForm(f => ({ ...f, content: next }));
    requestAnimationFrame(() => { if (el) { el.focus(); const c = pos + tpl.length; el.setSelectionRange(c, c); } });
  };
  const insertClaude = () => insertTpl(`${form.content && !form.content.endsWith('\n') ? '\n' : ''}[나]\n\n[Claude]\n\n`);
  const insertQA = () => insertTpl(`${form.content && !form.content.endsWith('\n') ? '\n' : ''}[질문]\n\n[답변]\n\n`);

  const fieldCls = 'w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:bg-white focus:border-primary-300 transition-colors';
  const save = async () => {
    if (!form.title.trim()) return;
    await addInsight({
      title: form.title.trim(), content: form.content, source: form.source || '직접 입력', link: form.link || undefined,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      workspace_id: workspace.id,
    } as Omit<InsightRow, 'id' | 'created_at' | 'conversation_id'>).catch(() => {});
    setForm({ title: '', content: '', source: '', link: '', tags: '' }); setShowForm(false); load();
  };
  const del = async (id: string) => { await deleteInsight(id).catch(() => {}); load(); };

  return (
    <>
      <ViewHead eyebrow="INSIGHTS" title="인사이트" sub={`인사이트 ${list.length}건`} />
      <div className="flex justify-end mb-3">
        <button onClick={() => setShowForm(v => !v)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 active:scale-95 transition-all">＋ 인사이트 추가</button>
      </div>
      {showForm && (
        <Card className="p-4 mb-3 space-y-2.5">
          <input autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="제목" className={fieldCls} />
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500">내용</label>
            <ClaudeQuickButtons onClaude={insertClaude} onQA={insertQA} />
          </div>
          <textarea ref={contentRef} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="내용" rows={4} className={`${fieldCls} resize-none`} />
          <div className="flex gap-2">
            <input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="출처 (선택)" className={fieldCls} />
            <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="태그 (쉼표로)" className={fieldCls} />
          </div>
          <input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="링크 (선택)" className={fieldCls} />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
            <button onClick={save} disabled={!form.title.trim()}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 transition-all">저장</button>
          </div>
        </Card>
      )}
      {list.length === 0 ? (
        <EmptyState emoji="💡" title="아직 인사이트가 없어요" sub="직접 추가하거나, AI 직원이 트렌드·소구점을 자동 도출해요" />
      ) : (
        <div className="space-y-2">
          {list.map(i => (
            <Card key={i.id} className="group p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800 flex-1">{i.title}</span>
                {i.tags?.includes('🤖 AI') && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 flex-shrink-0">🤖 {i.source}</span>}
                <button onClick={() => del(i.id)} className="text-[11px] text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">삭제</button>
              </div>
              {i.content && i.content !== i.title && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{i.content}</p>}
              {i.link && <a href={i.link} target="_blank" rel="noreferrer" className="text-[11px] text-primary-500 mt-1 inline-block break-all">{i.link}</a>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* ───────── 기록 (메모 — Tiptap) ───────── */
export function LogView({ workspace }: { workspace: Workspace }) {
  const [memos, setMemos] = useState<RecordRow[]>([]);
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState<any>(undefined);
  const editorRef = useRef<TiptapEditorHandle>(null);
  const load = () => fetchRecords(workspace.id, 'memo').then(setMemos).catch(() => setMemos([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspace.id]);

  const save = async () => {
    if (!title.trim() && !body) return;
    await addRecord({
      title: title.trim() || '메모', date: new Date().toISOString().split('T')[0],
      record_type: 'memo', memo_body: body || {}, workspace_id: workspace.id,
    } as Omit<RecordRow, 'id' | 'created_at'>).catch(() => {});
    setTitle(''); setBody(undefined); setWriting(false); load();
  };
  const del = async (id: string) => { await deleteRecord(id).catch(() => {}); load(); };

  return (
    <>
      <ViewHead eyebrow="MEMO" title="기록" sub={`메모 ${memos.length}개`} />
      <div className="flex justify-end mb-3">
        <button onClick={() => setWriting(v => !v)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 active:scale-95 transition-all">＋ 메모</button>
      </div>
      {writing && (
        <Card className="p-4 mb-3 space-y-2.5">
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="제목"
            className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:bg-white focus:border-primary-300 transition-colors" />
          <div className="flex justify-end">
            <ClaudeQuickButtons
              onClaude={() => editorRef.current?.insertClaudeBlock()}
              onQA={() => editorRef.current?.insertQABlock()}
            />
          </div>
          <div className="border border-gray-100 rounded-xl px-2 py-1 max-h-[55vh] overflow-y-auto">
            <TiptapEditor ref={editorRef} content={body} onChange={setBody} placeholder="메모를 작성하세요..." />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setWriting(false); setTitle(''); setBody(undefined); }} className="px-3 py-1.5 rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
            <button onClick={save} className="px-4 py-1.5 rounded-xl text-xs font-bold bg-primary-500 text-white hover:bg-primary-600 transition-all">저장</button>
          </div>
        </Card>
      )}
      {memos.length === 0 ? (
        <EmptyState emoji="📝" title="메모가 없어요" sub="＋ 메모로 자유롭게 기록하세요" />
      ) : (
        <div className="space-y-2">
          {memos.map(m => (
            <Card key={m.id} className="group p-4 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 flex-1 truncate">📝 {m.title}</span>
              <span className="text-[11px] text-gray-400 flex-shrink-0">{m.date}</span>
              <button onClick={() => del(m.id)} className="text-[11px] text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">삭제</button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* ───────── 활동 로그 (AI 직원 리포트 타임라인) ───────── */
export function ActivityView({ workspace }: { workspace: Workspace }) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  useEffect(() => {
    fetchReportsByWorkspace(workspace.id, 60).then(setReports).catch(() => setReports([]));
  }, [workspace.id]);

  return (
    <>
      <ViewHead eyebrow="ACTIVITY" title="활동 로그" sub={`AI 직원 리포트 ${reports.length}건`} />
      {reports.length === 0 ? (
        <EmptyState emoji="🧾" title="아직 활동이 없어요" sub="AI 직원이 일하면 리포트가 여기 타임라인으로 쌓여요" />
      ) : (
        <Card className="p-2">
          {reports.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors">
              <span className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 flex-1 truncate">🤖 {r.title}</span>
              <span className="text-[11px] text-gray-400 flex-shrink-0">{r.date}</span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

/* ───────── 멤버 (실데이터) ───────── */
export function MembersView({ workspace }: { workspace: Workspace }) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [myId, setMyId] = useState('');
  const [copied, setCopied] = useState(false);
  const load = () => fetchMembers(workspace.id).then(setMembers).catch(() => setMembers([]));
  useEffect(() => { load(); getCurrentUserId().then(setMyId).catch(() => {}); /* eslint-disable-next-line */ }, [workspace.id]);

  const iAmOwner = members.find(m => m.userId === myId)?.role === 'owner';
  const copyCode = () => {
    if (!workspace.inviteCode) return;
    navigator.clipboard?.writeText(workspace.inviteCode);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const kick = async (uid: string) => {
    if (!confirm('이 멤버를 내보낼까요?')) return;
    await removeMember(workspace.id, uid).catch(() => {}); load();
  };
  const toggleRole = async (m: WorkspaceMember) => {
    await changeMemberRole(workspace.id, m.userId, m.role === 'owner' ? 'member' : 'owner').catch(() => {}); load();
  };

  return (
    <>
      <ViewHead eyebrow="MEMBERS" title="멤버" sub={`멤버 ${members.length}명`} />
      {/* 초대 코드 (오피스만) */}
      {workspace.type === 'office' && workspace.inviteCode && (
        <Card className="p-4 mb-3 space-y-2">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wide">초대 코드</div>
          <div className="flex items-center gap-2">
            <code className="text-lg font-bold text-primary-600 tracking-[0.2em] bg-primary-50 px-3 py-1.5 rounded-xl flex-1 text-center">{workspace.inviteCode}</code>
            <button onClick={copyCode}
              className="text-xs px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all flex-shrink-0">{copied ? '복사됨 ✓' : '복사'}</button>
          </div>
          <p className="text-[11px] text-gray-400">이 코드를 멤버에게 공유하세요. 멤버는 왼쪽 위 <b>워크스페이스 메뉴 → 🔑 코드로 합류</b>에서 이 코드를 입력하면 합류돼요.</p>
        </Card>
      )}
      <Card className="p-3">
        {members.map(m => (
          <div key={m.userId} className="flex items-center gap-2.5 p-3 rounded-2xl hover:bg-gray-50 transition-colors">
            <span className="w-9 h-9 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {(m.nickname || m.userId).slice(0, 1).toUpperCase()}
            </span>
            <span className="text-sm font-medium text-gray-700 flex-1 min-w-0 truncate">{m.nickname || '멤버'}{m.userId === myId && ' (나)'}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">{m.role === 'owner' ? '오너' : '멤버'}</span>
            {iAmOwner && m.userId !== myId && (
              <>
                <button onClick={() => toggleRole(m)} className="text-[11px] text-gray-400 hover:text-primary-500 flex-shrink-0">{m.role === 'owner' ? '멤버로' : '오너로'}</button>
                <button onClick={() => kick(m.userId)} className="text-[11px] text-rose-400 hover:text-rose-600 flex-shrink-0">내보내기</button>
              </>
            )}
          </div>
        ))}
        {members.length === 0 && <p className="text-xs text-gray-300 py-4 text-center">멤버를 불러오는 중…</p>}
      </Card>
    </>
  );
}

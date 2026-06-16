/**
 * @file src/components/office/views.tsx
 * @description 오피스 셸 본문 뷰 7종 (Phase 2 이식 · 모노톤+몽글)
 * - 실데이터: 할일(useTasks, 워크스페이스 필터됨) · 멤버(fetchMembers)
 * - 샘플/빈 상태: 대시보드 KPI·브리핑·일정·인사이트·기록 (실연동은 Phase 4~5)
 */
import { useEffect, useState } from 'react';
import { Workspace, WorkspaceMember, TaskItem, DailyReport } from '../../types';
import { useTasks } from '../../hooks/useTasks';
import { fetchMembers, removeMember, changeMemberRole } from '../../services/workspaces.service';
import { getCurrentUserId } from '../../services/auth';
import { fetchReportsByWorkspace } from '../../services/dailyReports.service';
import { fetchSchedules, ScheduleRow } from '../../services/schedules.service';
import { fetchInsights, InsightRow } from '../../services/insights.service';
import { Spark, ViewHead, Card, EmptyState } from './ui';

type Nav = (v: string) => void;

/* ───────── 대시보드 ───────── */
const SAMPLE_KPIS = [
  { k: '주간 매출', v: '320', unit: '만원', up: true, sub: '+12%', spark: [180, 210, 190, 250, 280, 300, 320] },
  { k: '전환율', v: '6.4', unit: '%', up: true, sub: '+0.8%', spark: [4.1, 4.8, 5.2, 5.0, 5.9, 6.1, 6.4] },
  { k: '방문자', v: '2.3', unit: 'K', up: true, sub: '+18%', spark: [1.4, 1.6, 1.5, 1.9, 2.0, 2.2, 2.3] },
  { k: '신규 문의', v: '47', unit: '건', up: false, sub: '-3%', spark: [52, 50, 49, 51, 48, 49, 47] },
];

export function DashboardView({ onNavigate }: { onNavigate: Nav }) {
  const { tasks } = useTasks();
  const open = tasks.filter(t => t.status !== 'completed').length;

  return (
    <>
      <ViewHead eyebrow="DASHBOARD" title="대시보드" sub={`진행 중 할일 ${open}건 · 핵심 지표 ${SAMPLE_KPIS.length}개`} />

      {/* KPI 스트립 (그래프가 박스 카드 안에) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {SAMPLE_KPIS.map((ins, i) => (
          <Card key={i} className="p-4 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">{ins.k}</span>
              <span className={`text-xs font-semibold ${ins.up ? 'text-emerald-500' : 'text-rose-400'}`}>{ins.up ? '▲' : '▼'} {ins.sub}</span>
            </div>
            <div className="text-2xl font-extrabold text-gray-800 mt-1">{ins.v}<span className="text-sm font-semibold text-gray-400 ml-0.5">{ins.unit}</span></div>
            <div className="mt-1"><Spark data={ins.spark} /></div>
          </Card>
        ))}
      </div>
      <p className="text-[11px] text-gray-300 mb-4 -mt-2 pl-1">· 샘플 지표예요. 실데이터 연동은 곧(Phase 5/8)</p>

      {/* 오늘의 브리핑 배너 */}
      <button
        onClick={() => onNavigate('briefing')}
        className="w-full flex items-center gap-3 p-4 rounded-[24px] bg-primary-500 text-white mb-4 transition-all active:scale-[0.99] hover:bg-primary-600 text-left"
      >
        <span className="text-2xl">☀️</span>
        <span className="flex-1">
          <span className="block text-sm font-bold">오늘의 브리핑 읽기</span>
          <span className="block text-xs text-white/70 mt-0.5">어제 AI 직원들이 한 일을 한 장으로</span>
        </span>
        <span className="text-white/50">›</span>
      </button>

      {/* 빠른 요약 + 오피스 플로어 */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Card className="p-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">빠른 현황</div>
          <div className="flex gap-6">
            <button onClick={() => onNavigate('todos')} className="text-left">
              <div className="text-2xl font-extrabold text-gray-800">{open}</div>
              <div className="text-xs text-gray-400">진행 중 할일</div>
            </button>
            <button onClick={() => onNavigate('members')} className="text-left">
              <div className="text-2xl font-extrabold text-gray-800">—</div>
              <div className="text-xs text-gray-400">멤버</div>
            </button>
          </div>
        </Card>
        <button onClick={() => onNavigate('staff')} className="text-left">
          <Card className="p-5 h-full hover:shadow-md transition-all">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">오피스 플로어</div>
            <div className="flex items-center gap-2 text-gray-600"><span className="text-2xl">🤖</span><span className="text-sm">AI 직원을 채용해보세요 ›</span></div>
            <div className="text-[11px] text-gray-300 mt-2">Phase 3에서 채용·자동 가동</div>
          </Card>
        </button>
      </div>
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
  useEffect(() => {
    fetchSchedules()
      .then(rows => setItems(
        rows.filter((r: any) => r.workspace_id === workspace.id)
          .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))),
      ))
      .catch(() => setItems([]));
  }, [workspace.id]);

  return (
    <>
      <ViewHead eyebrow="SCHEDULE" title="일정" sub={`${items.length}건`} />
      {items.length === 0 ? (
        <EmptyState emoji="📅" title="일정이 없어요" sub="직접 추가하거나, AI 직원이 ‘지금 실행’ 시 제안 일정을 자동 등록해요" />
      ) : (
        <Card className="p-2">
          {items.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors">
              <span className="text-xs font-bold text-gray-800 w-20 flex-shrink-0">{s.date.slice(5)}{s.time ? ' ' + s.time : ''}</span>
              <span className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 flex-1">{s.title}</span>
              {s.category === '🤖 AI' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 flex-shrink-0">🤖 AI</span>}
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
  useEffect(() => {
    fetchInsights()
      .then(rows => setList(rows.filter((r: any) => r.workspace_id === workspace.id)))
      .catch(() => setList([]));
  }, [workspace.id]);

  return (
    <>
      <ViewHead eyebrow="INSIGHTS" title="인사이트" sub={`인사이트 ${list.length}건`} />
      <Card className="p-5 mb-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">주간 매출 추이 (샘플)</div>
        <div className="text-3xl font-extrabold text-gray-800 mb-2">320<span className="text-base text-gray-400 ml-1">만원</span></div>
        <Spark data={[180, 210, 190, 250, 280, 300, 320]} h={64} />
      </Card>
      {list.length === 0 ? (
        <EmptyState emoji="💡" title="아직 인사이트가 없어요" sub="AI 직원이 ‘지금 실행’ 시 트렌드·소구점을 자동으로 도출해요" />
      ) : (
        <div className="space-y-2">
          {list.map(i => (
            <Card key={i.id} className="p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800 flex-1">{i.title}</span>
                {i.tags?.includes('🤖 AI') && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 flex-shrink-0">🤖 {i.source}</span>}
              </div>
              {i.content && i.content !== i.title && <p className="text-xs text-gray-500 mt-1">{i.content}</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* ───────── 기록 (직원 활동 = 리포트 타임라인) ───────── */
export function LogView({ workspace }: { workspace: Workspace }) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  useEffect(() => {
    fetchReportsByWorkspace(workspace.id, 40).then(setReports).catch(() => setReports([]));
  }, [workspace.id]);

  return (
    <>
      <ViewHead eyebrow="ACTIVITY" title="기록" sub={`활동 ${reports.length}건`} />
      {reports.length === 0 ? (
        <EmptyState emoji="🧾" title="아직 활동이 없어요" sub="AI 직원이 일하면 활동이 여기 타임라인으로 쌓여요" />
      ) : (
        <Card className="p-2">
          {reports.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors">
              <span className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 flex-1 truncate">🤖 리포트 · {r.title}</span>
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
          <p className="text-[11px] text-gray-400">이 코드를 멤버에게 공유하세요. 멤버는 워크스페이스 전환 → <b>코드로 합류</b>에서 입력하면 됩니다.</p>
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

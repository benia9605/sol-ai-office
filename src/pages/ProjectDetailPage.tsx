/**
 * @file src/pages/ProjectDetailPage.tsx
 * @description 프로젝트 상세 페이지
 * - 프로젝트 헤더 (이미지, 이름, 설명, 상태, 기간)
 * - 목표 리스트 (아코디언 토글)
 * - 각 목표: 유형(kpi/task/mixed), KPI 섹션, 연결된 할일
 * - KPI 추가/편집/기록 모달
 * - 목표에 할일 연결 추가
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useGoals } from '../hooks/useGoals';
import { useTasks } from '../hooks/useTasks';
import { GoalItem, GoalType, KpiItem, KpiLog, TaskItem, RepeatType, ScheduleItem, InsightItem } from '../types';
import { useSchedules } from '../hooks/useSchedules';
import { useInsights } from '../hooks/useInsights';
import { useInsightSources } from '../hooks/useInsightSources';
import { ItemDetailPopup } from '../components/ItemDetailPopup';
import { defaultTaskCategories, defaultScheduleCategories } from '../data';

// ── 더보기/접기 텍스트 ──

function ExpandableText({ text, maxLength = 30 }: { text: string; maxLength?: number }) {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= maxLength) {
    return <p className="text-sm text-gray-400 mt-0.5">{text}</p>;
  }
  return (
    <p className="text-sm text-gray-400 mt-0.5">
      {expanded ? text : text.slice(0, maxLength) + '...'}
      <button
        onClick={() => setExpanded(!expanded)}
        className="ml-1 text-primary-500 hover:text-primary-600 font-medium"
      >
        {expanded ? '접기' : '더보기'}
      </button>
    </p>
  );
}

// ── SVG 아이콘 ──

const PenIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11.5 1.5l3 3L5 14H2v-3z" />
    <path d="M9.5 3.5l3 3" />
  </svg>
);

const TrashIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 4h11" />
    <path d="M5.5 4V2.5a1 1 0 011-1h3a1 1 0 011 1V4" />
    <path d="M3.5 4l.7 9.1a1 1 0 001 .9h5.6a1 1 0 001-.9L12.5 4" />
  </svg>
);

const ChevronIcon = ({ open, className = 'w-4 h-4' }: { open: boolean; className?: string }) => (
  <svg className={`${className} transition-transform duration-200 ${open ? 'rotate-90' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4l4 4-4 4" />
  </svg>
);

/** 유형별 진행률 계산 */
function calcGoalProgress(
  goalType: GoalType,
  goalKpis: KpiItem[],
  goalTasks: TaskItem[],
): number {
  if (goalType === 'kpi') {
    if (goalKpis.length === 0) return 0;
    const total = goalKpis.reduce((sum, k) => {
      const range = k.targetValue - k.startValue;
      if (range <= 0) return sum + 100;
      return sum + Math.min(100, Math.round(((k.currentValue - k.startValue) / range) * 100));
    }, 0);
    return Math.round(total / goalKpis.length);
  }

  if (goalType === 'task') {
    if (goalTasks.length === 0) return 0;
    const completed = goalTasks.filter((t) => t.status === 'completed').length;
    return Math.round((completed / goalTasks.length) * 100);
  }

  // mixed: KPI 있으면 KPI, 없으면 할일
  if (goalKpis.length > 0) {
    const total = goalKpis.reduce((sum, k) => {
      const range = k.targetValue - k.startValue;
      if (range <= 0) return sum + 100;
      return sum + Math.min(100, Math.round(((k.currentValue - k.startValue) / range) * 100));
    }, 0);
    return Math.round(total / goalKpis.length);
  }
  if (goalTasks.length > 0) {
    const completed = goalTasks.filter((t) => t.status === 'completed').length;
    return Math.round((completed / goalTasks.length) * 100);
  }
  return 0;
}

const GOAL_TYPE_OPTIONS: { value: GoalType; label: string; desc: string }[] = [
  { value: 'kpi', label: '수치형', desc: 'KPI로 진행률' },
  { value: 'task', label: '업무형', desc: '할일 완료율' },
  { value: 'mixed', label: '혼합', desc: '둘 다 표시' },
];

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, loading: pLoading } = useProjects();
  const {
    goals, kpis, loading: gLoading,
    addGoal, updateGoal, removeGoal,
    addKpi, updateKpi, removeKpi,
    addKpiRecord, getKpiLogs, removeKpiLog,
  } = useGoals(projectId || '');
  const { tasks, add: addTaskItem, cycleStatus: cycleTaskStatus, remove: removeTask } = useTasks();
  const { schedules, update: updateSchedule, remove: removeSchedule } = useSchedules();
  const { insights, update: updateInsight, remove: removeInsight } = useInsights();

  // 목표 토글 상태 (열린 목표 ID 목록)
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({ title: '', type: 'mixed' as GoalType, startDate: '', endDate: '', notes: '' });
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [editGoalForm, setEditGoalForm] = useState({ title: '', type: 'mixed' as GoalType, startDate: '', endDate: '', notes: '' });

  // KPI state
  const [showKpiForm, setShowKpiForm] = useState<string | null>(null);
  const [kpiForm, setKpiForm] = useState({ name: '', targetValue: '', currentValue: '', startValue: '0', unit: '' });
  const [editingKpi, setEditingKpi] = useState<string | null>(null);
  const [editKpiForm, setEditKpiForm] = useState({ name: '', targetValue: '', currentValue: '', startValue: '', unit: '' });
  const [kpiDetailId, setKpiDetailId] = useState<string | null>(null);
  const [kpiLogs, setKpiLogs] = useState<KpiLog[]>([]);
  const [kpiLogLoading, setKpiLogLoading] = useState(false);
  const [showKpiLogForm, setShowKpiLogForm] = useState(false);
  const [kpiLogForm, setKpiLogForm] = useState({ value: '', note: '' });

  // 할일 state
  const [showTaskForm, setShowTaskForm] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '', date: '', priority: 'medium' as 'high' | 'medium' | 'low',
    category: '', notes: '', repeat: 'none' as RepeatType,
  });
  const [showTaskAdvanced, setShowTaskAdvanced] = useState(false);

  // 일정·인사이트 카드 state
  const [showAllSchedules, setShowAllSchedules] = useState(false);
  const [showAllInsights, setShowAllInsights] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<InsightItem | null>(null);
  const [scheduleCategories, setScheduleCategories] = useState(defaultScheduleCategories);
  const { sources: insightSources, setSources: setInsightSources, addSource: addInsightSource, removeSource: removeInsightSource } = useInsightSources();

  const project = projects.find((p) => p.id === projectId);
  const loading = pLoading || gLoading;

  // 목표 로드 후 첫 번째 목표 자동 열기
  useEffect(() => {
    if (goals.length > 0 && expandedGoals.size === 0) {
      setExpandedGoals(new Set([goals[0].id]));
    }
  }, [goals.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleGoal = (goalId: string) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

  const loadKpiLogs = useCallback(async (kpiId: string) => {
    setKpiLogLoading(true);
    const logs = await getKpiLogs(kpiId);
    setKpiLogs(logs);
    setKpiLogLoading(false);
  }, [getKpiLogs]);

  useEffect(() => {
    if (kpiDetailId) loadKpiLogs(kpiDetailId);
  }, [kpiDetailId, loadKpiLogs]);

  if (loading) {
    return (
      <div className="min-h-full p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-gray-400 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-full p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400 text-sm">프로젝트를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/')} className="text-sm text-primary-500 hover:underline">홈으로</button>
      </div>
    );
  }

  // ── 핸들러들 ──

  const handleAddGoal = async () => {
    if (!goalForm.title.trim()) return;
    const item = await addGoal({ title: goalForm.title, type: goalForm.type, startDate: goalForm.startDate || undefined, endDate: goalForm.endDate || undefined, notes: goalForm.notes || undefined });
    if (item) {
      setExpandedGoals((prev) => new Set(prev).add(item.id));
    }
    setGoalForm({ title: '', type: 'mixed', startDate: '', endDate: '', notes: '' });
    setShowGoalForm(false);
  };

  const handleUpdateGoal = async (id: string) => {
    await updateGoal(id, {
      title: editGoalForm.title,
      type: editGoalForm.type,
      startDate: editGoalForm.startDate || undefined,
      endDate: editGoalForm.endDate || undefined,
      notes: editGoalForm.notes || undefined,
    });
    setEditingGoal(null);
  };


  const handleAddKpi = async (goalId: string) => {
    if (!kpiForm.name.trim() || !kpiForm.targetValue) return;
    await addKpi({
      goalId,
      name: kpiForm.name,
      targetValue: Number(kpiForm.targetValue),
      currentValue: Number(kpiForm.currentValue) || 0,
      startValue: Number(kpiForm.startValue) || 0,
      unit: kpiForm.unit,
    });
    setKpiForm({ name: '', targetValue: '', currentValue: '', startValue: '0', unit: '' });
    setShowKpiForm(null);
  };

  const handleUpdateKpi = async (id: string) => {
    await updateKpi(id, {
      name: editKpiForm.name,
      targetValue: Number(editKpiForm.targetValue),
      currentValue: Number(editKpiForm.currentValue),
      startValue: Number(editKpiForm.startValue),
      unit: editKpiForm.unit,
    });
    setEditingKpi(null);
  };

  const handleAddKpiLog = async () => {
    if (!kpiDetailId || !kpiLogForm.value) return;
    await addKpiRecord(kpiDetailId, Number(kpiLogForm.value), kpiLogForm.note || undefined);
    setKpiLogForm({ value: '', note: '' });
    setShowKpiLogForm(false);
    loadKpiLogs(kpiDetailId);
  };

  const handleDeleteKpiLog = async (logId: string) => {
    await removeKpiLog(logId);
    if (kpiDetailId) loadKpiLogs(kpiDetailId);
  };

  const handleAddLinkedTask = async (goalId: string) => {
    if (!taskForm.title.trim()) return;
    await addTaskItem({
      title: taskForm.title,
      project: project.name,
      goalId,
      priority: taskForm.priority,
      date: taskForm.date || undefined,
      category: taskForm.category || undefined,
      notes: taskForm.notes || undefined,
      repeat: taskForm.repeat !== 'none' ? taskForm.repeat : undefined,
    });
    setTaskForm({ title: '', date: '', priority: 'medium', category: '', notes: '', repeat: 'none' });
    setShowTaskForm(null);
    setShowTaskAdvanced(false);
  };

  // ── 유틸 ──

  /** YYYY-MM-DD 간 일수 차이 (타임존/DST 무관, UTC 기반) */
  const diffDays = (dateStr: string): number => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const now = new Date();
    const utcTarget = Date.UTC(y, m - 1, d);
    const utcToday = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return (utcTarget - utcToday) / (1000 * 60 * 60 * 24);
  };

  /** 두 YYYY-MM-DD 간 일수 차이 */
  const diffDaysBetween = (a: string, b: string): number => {
    const [ay, am, ad] = a.split('-').map(Number);
    const [by, bm, bd] = b.split('-').map(Number);
    return (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / (1000 * 60 * 60 * 24);
  };

  const getDday = (deadline?: string) => {
    if (!deadline) return null;
    const diff = diffDays(deadline);
    if (diff === 0) return 'D-Day';
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${y}.${m}.${d}`;
  };

  const statusColor = (s: GoalItem['status']) =>
    s === 'pending' ? 'bg-gray-100 text-gray-500' :
    s === 'in_progress' ? 'bg-blue-100 text-blue-600' :
    s === 'on_hold' ? 'bg-orange-100 text-orange-600' :
    'bg-green-100 text-green-600';

  /** 목표 기간 포맷 */
  const goalDateRange = (goal: GoalItem): string => {
    if (goal.startDate && goal.endDate) return `${formatDate(goal.startDate)} ~ ${formatDate(goal.endDate)}`;
    if (goal.startDate) return formatDate(goal.startDate);
    if (goal.endDate) return `~ ${formatDate(goal.endDate)}`;
    return '';
  };

  /** 목표 스마트 상태 라벨 */
  const goalSmartLabel = (goal: GoalItem): { text: string; style: string } => {
    const endDiff = goal.endDate ? diffDays(goal.endDate) : null;
    const startDiff = goal.startDate ? diffDays(goal.startDate) : null;
    console.log('[goalSmartLabel]', {
      goalId: goal.id,
      title: goal.title,
      status: goal.status,
      startDate: goal.startDate,
      endDate: goal.endDate,
      endDiff,
      startDiff,
      nowUTC: new Date().toISOString(),
    });

    if (goal.status === 'completed') {
      if (goal.startDate && goal.endDate) {
        const days = diffDaysBetween(goal.startDate, goal.endDate) + 1;
        return { text: `총 ${days}일 진행`, style: 'text-green-600' };
      }
      return { text: '완료', style: 'text-green-600' };
    }

    if (goal.status === 'on_hold') {
      return { text: '⏸️ 보류 중', style: 'text-orange-500' };
    }

    if (goal.status === 'pending') {
      if (startDiff !== null) {
        if (startDiff > 0) return { text: `D-${startDiff}`, style: 'text-gray-500' };
        if (startDiff === 0) return { text: 'D-Day', style: 'text-blue-500 font-semibold' };
      }
      return { text: '', style: '' };
    }

    // in_progress
    if (goal.startDate) {
      const daysSinceStart = Math.max(1, diffDays(goal.startDate) * -1 + 1);
      return { text: `${daysSinceStart}일째 진행중`, style: 'text-blue-500' };
    }
    return { text: '', style: '' };
  };

  const kpiPercent = (kpi: KpiItem) => {
    const range = kpi.targetValue - kpi.startValue;
    if (range <= 0) return 0;
    return Math.min(100, Math.round(((kpi.currentValue - kpi.startValue) / range) * 100));
  };

  const taskStatusIcon = (t: TaskItem) =>
    t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '◐' : '○';

  const taskStatusStyle = (t: TaskItem) =>
    t.status === 'completed' ? 'text-green-500' :
    t.status === 'in_progress' ? 'text-blue-500' : 'text-gray-400';

  const goalTypeLabel = (type: GoalType) =>
    type === 'kpi' ? '수치형' : type === 'task' ? '업무형' : '혼합';

  const goalTypeBadge = (type: GoalType) =>
    type === 'kpi' ? 'bg-purple-50 text-purple-500' :
    type === 'task' ? 'bg-green-50 text-green-500' :
    'bg-gray-100 text-gray-500';

  // ── 유형 라디오 컴포넌트 ──
  const GoalTypeRadio = ({ value, onChange }: { value: GoalType; onChange: (v: GoalType) => void }) => (
    <div className="flex gap-2">
      {GOAL_TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-center ${
            value === opt.value
              ? 'text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
          style={value === opt.value ? { backgroundColor: project.color } : undefined}
        >
          <div>{opt.label}</div>
          <div className={`text-[10px] mt-0.5 ${value === opt.value ? 'text-white/70' : 'text-gray-400'}`}>{opt.desc}</div>
        </button>
      ))}
    </div>
  );

  const detailKpi = kpis.find((k) => k.id === kpiDetailId);

  // 프로젝트 기간 D-day
  const projectDday = getDday(project.endDate);

  // 이 프로젝트에 연결된 일정·인사이트
  const projectSchedules = schedules.filter((s) => s.project === project.name);
  const projectInsights = insights.filter((i) => i.project === project.name);
  const visibleSchedules = showAllSchedules ? projectSchedules : projectSchedules.slice(0, 3);
  const visibleInsights = showAllInsights ? projectInsights : projectInsights.slice(0, 3);

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-white to-primary-50/20 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 뒤로가기 */}
        <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← 뒤로
        </button>

        {/* 프로젝트 헤더 */}
        <section className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-soft p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ backgroundColor: project.color + '20' }}>
              {project.image
                ? <img src={project.image} alt={project.name} className="w-9 h-9 object-contain" />
                : <span className="text-3xl">{project.emoji}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-800">{project.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                  project.status === 'active' ? 'bg-green-100 text-green-600' :
                  project.status === 'paused' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {project.status === 'active' ? '진행' : project.status === 'paused' ? '일시정지' : project.status === 'completed' ? '완료' : '진행'}
                </span>
              </div>
              {project.description && (
                <ExpandableText text={project.description} maxLength={30} />
              )}
            </div>
          </div>

          {/* 기간 */}
          {(project.startDate || project.endDate) && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="12" height="11" rx="2" />
                <path d="M5 1v3M11 1v3M2 7h12" />
              </svg>
              <span className="text-gray-500">
                {formatDate(project.startDate)}{project.startDate && project.endDate ? ' ~ ' : ''}{formatDate(project.endDate)}
              </span>
              {projectDday && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ml-1 ${
                  projectDday.startsWith('D+') ? 'bg-red-100 text-red-500' : 'bg-blue-50 text-blue-500'
                }`}>
                  {projectDday}
                </span>
              )}
            </div>
          )}
        </section>

        {/* 일정 · 인사이트 카드 */}
        <div className="grid grid-cols-2 gap-3">
          {/* 일정 카드 */}
          <div className="p-4 rounded-2xl bg-[#fff3e0] border border-orange-100">
            <div className="flex items-center gap-2 mb-3">
              <img src="/images/schedule.png" alt="일정" className="w-5 h-5 object-contain" />
              <span className="text-sm font-bold text-orange-700">일정</span>
              <span className="text-[10px] text-orange-400 ml-auto">{projectSchedules.length}건</span>
            </div>
            {projectSchedules.length > 0 ? (
              <>
                <ul className="space-y-1.5">
                  {visibleSchedules.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-orange-50 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
                      onClick={() => setSelectedSchedule(s)}
                    >
                      <div className="w-1 h-4 rounded-full bg-orange-300 flex-shrink-0" />
                      <span className="text-xs text-gray-700 truncate flex-1">{s.title}</span>
                      <span className="text-[10px] text-orange-500 font-medium flex-shrink-0">{s.date.slice(5).replace('-', '/')}</span>
                    </li>
                  ))}
                </ul>
                {projectSchedules.length > 3 && (
                  <button
                    onClick={() => setShowAllSchedules(!showAllSchedules)}
                    className="text-[10px] text-orange-400 hover:text-orange-600 mt-2 w-full text-center"
                  >
                    {showAllSchedules ? '접기' : `더보기 (${projectSchedules.length - 3}건)`}
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">등록된 일정 없음</p>
            )}
          </div>

          {/* 인사이트 카드 */}
          <div className="p-4 rounded-2xl bg-[#fffde7] border border-yellow-100">
            <div className="flex items-center gap-2 mb-3">
              <img src="/images/insight.png" alt="인사이트" className="w-5 h-5 object-contain" />
              <span className="text-sm font-bold text-amber-700">인사이트</span>
              <span className="text-[10px] text-amber-400 ml-auto">{projectInsights.length}건</span>
            </div>
            {projectInsights.length > 0 ? (
              <>
                <ul className="space-y-2">
                  {visibleInsights.map((i) => (
                    <li
                      key={i.id}
                      className="cursor-pointer hover:bg-yellow-50 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
                      onClick={() => setSelectedInsight(i)}
                    >
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-semibold text-gray-700 truncate flex-1">{i.title}</p>
                        {i.link && (
                          <a
                            href={i.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 flex-shrink-0 transition-colors"
                          >
                            바로가기 &rarr;
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{i.content}</p>
                    </li>
                  ))}
                </ul>
                {projectInsights.length > 3 && (
                  <button
                    onClick={() => setShowAllInsights(!showAllInsights)}
                    className="text-[10px] text-amber-400 hover:text-amber-600 mt-2 w-full text-center"
                  >
                    {showAllInsights ? '접기' : `더보기 (${projectInsights.length - 3}건)`}
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">등록된 인사이트 없음</p>
            )}
          </div>
        </div>

        {/* 목표 섹션 */}
        <section className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-soft p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">목표</h2>
            <button
              onClick={() => setShowGoalForm(true)}
              className="px-3 py-1.5 text-white text-sm rounded-xl transition-colors hover:opacity-90"
              style={{ backgroundColor: project.color }}
            >
              + 목표 추가
            </button>
          </div>

          {/* 목표 추가 폼 */}
          {showGoalForm && (
            <div className="mb-4 p-4 rounded-2xl space-y-3" style={{ backgroundColor: project.color + '15' }}>
              <input
                value={goalForm.title}
                onChange={(e) => setGoalForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="목표 제목"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                autoFocus
              />
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">유형</label>
                <GoalTypeRadio value={goalForm.type} onChange={(v) => setGoalForm((f) => ({ ...f, type: v }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">기간</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={goalForm.startDate}
                    onChange={(e) => setGoalForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                  <span className="text-xs text-gray-400">~</span>
                  <input
                    type="date"
                    value={goalForm.endDate}
                    onChange={(e) => setGoalForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowGoalForm(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-xl text-gray-500 hover:bg-gray-50">취소</button>
                <button onClick={handleAddGoal} className="px-4 py-2 text-white text-sm rounded-xl hover:opacity-90" style={{ backgroundColor: project.color }}>추가</button>
              </div>
            </div>
          )}

          {/* 목표 리스트 */}
          {goals.length === 0 && !showGoalForm && (
            <p className="text-center text-sm text-gray-400 py-8">
              목표가 없습니다. 첫 번째 목표를 추가해보세요.
            </p>
          )}

          <div className="space-y-3">
            {goals.map((goal) => {
              const goalKpis = kpis.filter((k) => k.goalId === goal.id);
              const goalTasks = tasks.filter((t) => t.goalId === goal.id);
              const isEditing = editingGoal === goal.id;
              const smart = goalSmartLabel(goal);
              const effectiveProgress = calcGoalProgress(goal.type, goalKpis, goalTasks);
              const showKpiSection = goal.type === 'kpi' || goal.type === 'mixed';
              const showTaskSection = goal.type === 'task' || goal.type === 'mixed';
              const isExpanded = expandedGoals.has(goal.id);

              const headerBg =
                goal.status === 'in_progress' ? 'bg-blue-50' :
                goal.status === 'on_hold' ? 'bg-orange-50' :
                goal.status === 'completed' ? 'bg-green-50' :
                'bg-gray-50';

              return (
                <div key={goal.id} className="rounded-2xl overflow-hidden border border-gray-100">
                  {/* 목표 헤더 (토글 가능) */}
                  {isEditing ? (
                    <div className={`p-4 space-y-2 ${headerBg}`}>
                      <input
                        value={editGoalForm.title}
                        onChange={(e) => setEditGoalForm((f) => ({ ...f, title: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-sm"
                      />
                      <div>
                        <label className="text-xs text-gray-500 mb-1.5 block">유형</label>
                        <GoalTypeRadio value={editGoalForm.type} onChange={(v) => setEditGoalForm((f) => ({ ...f, type: v }))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1.5 block">기간</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={editGoalForm.startDate}
                            onChange={(e) => setEditGoalForm((f) => ({ ...f, startDate: e.target.value }))}
                            className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-sm"
                          />
                          <span className="text-xs text-gray-400">~</span>
                          <input
                            type="date"
                            value={editGoalForm.endDate}
                            onChange={(e) => setEditGoalForm((f) => ({ ...f, endDate: e.target.value }))}
                            className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingGoal(null)} className="px-3 py-1.5 border border-gray-200 text-xs rounded-xl text-gray-500">취소</button>
                        <button onClick={() => handleUpdateGoal(goal.id)} className="px-3 py-1.5 text-white text-xs rounded-xl hover:opacity-90" style={{ backgroundColor: project.color }}>저장</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex items-center gap-3 p-4 cursor-pointer transition-colors ${headerBg}`}
                      onClick={() => toggleGoal(goal.id)}
                    >
                      <ChevronIcon open={isExpanded} className="w-4 h-4 text-gray-400 flex-shrink-0" />

                      <select
                        value={goal.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          const next = e.target.value as GoalItem['status'];
                          const patch: Partial<GoalItem> = { status: next };
                          const todayStr = new Date().toISOString().slice(0, 10);
                          if (next === 'in_progress' && (!goal.startDate || goal.startDate > todayStr)) {
                            patch.startDate = todayStr;
                          }
                          if (next === 'completed') {
                            patch.endDate = todayStr;
                          }
                          updateGoal(goal.id, patch);
                        }}
                        className={`text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors flex-shrink-0 appearance-none text-center ${statusColor(goal.status)}`}
                      >
                        <option value="pending">대기</option>
                        <option value="in_progress">진행</option>
                        <option value="on_hold">보류</option>
                        <option value="completed">완료</option>
                      </select>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium text-sm ${goal.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            {goal.title}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${goalTypeBadge(goal.type)}`}>
                            {goalTypeLabel(goal.type)}
                          </span>
                          {(smart.text || goalDateRange(goal)) && (
                            <span className="inline-flex items-center gap-1.5 text-[11px]">
                              {smart.text && <span className={smart.style}>{smart.text}</span>}
                              {goalDateRange(goal) && <span className="text-gray-400 text-[10px]">{goalDateRange(goal)}</span>}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 진행률 미니 */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${effectiveProgress}%`, backgroundColor: project.color }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-500 w-8 text-right">{effectiveProgress}%</span>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingGoal(goal.id);
                            setEditGoalForm({ title: goal.title, type: goal.type, startDate: goal.startDate || '', endDate: goal.endDate || '', notes: goal.notes || '' });
                          }}
                          className="w-6 h-6 rounded-lg hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600"
                        >
                          <PenIcon />
                        </button>
                        <button
                          onClick={() => removeGoal(goal.id)}
                          className="w-6 h-6 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 펼쳐진 내용 */}
                  {isExpanded && !isEditing && (
                    <div className="px-4 pt-4 pb-4 space-y-6 bg-white">
                      {/* 노트 */}
                      {goal.notes && (
                        <p className="text-xs text-gray-400 pl-7">{goal.notes}</p>
                      )}

                      {/* ── KPI 섹션 (수치형 / 혼합) ── */}
                      {showKpiSection && (
                        <div className="pl-7">
                          <div className="flex items-center justify-between mb-2">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: project.color + '18', color: project.color }}>
                              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 14V9l3-3 3 4 4-8 2 3" />
                              </svg>
                              KPI
                            </span>
                            <button
                              onClick={() => { setShowKpiForm(goal.id); setKpiForm({ name: '', targetValue: '', currentValue: '', startValue: '0', unit: '' }); }}
                              className="text-xs text-gray-400 hover:text-primary-500 transition-colors"
                            >
                              + KPI 추가
                            </button>
                          </div>

                          {showKpiForm === goal.id && (
                            <div className="mb-3 p-3 bg-white rounded-xl space-y-2 border border-gray-100">
                              <input
                                value={kpiForm.name}
                                onChange={(e) => setKpiForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="KPI 이름 (예: 펀딩 금액)"
                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                                autoFocus
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input value={kpiForm.targetValue} onChange={(e) => setKpiForm((f) => ({ ...f, targetValue: e.target.value }))} placeholder="목표값" type="number" className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                                <input value={kpiForm.unit} onChange={(e) => setKpiForm((f) => ({ ...f, unit: e.target.value }))} placeholder="단위 (만원, 명, %)" className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <input value={kpiForm.currentValue} onChange={(e) => setKpiForm((f) => ({ ...f, currentValue: e.target.value }))} placeholder="현재값 (0)" type="number" className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                                <input value={kpiForm.startValue} onChange={(e) => setKpiForm((f) => ({ ...f, startValue: e.target.value }))} placeholder="시작값 (0)" type="number" className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                              </div>
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => setShowKpiForm(null)} className="px-3 py-1 border border-gray-200 text-xs rounded-lg text-gray-500">취소</button>
                                <button onClick={() => handleAddKpi(goal.id)} className="px-3 py-1 text-white text-xs rounded-lg hover:opacity-90" style={{ backgroundColor: project.color }}>추가</button>
                              </div>
                            </div>
                          )}

                          {goalKpis.length > 0 && (
                            <div className="space-y-2">
                              {goalKpis.map((kpi) => {
                                const pct = kpiPercent(kpi);
                                const isEditingThisKpi = editingKpi === kpi.id;

                                if (isEditingThisKpi) {
                                  return (
                                    <div key={kpi.id} className="p-3 bg-white rounded-xl space-y-2 border border-gray-100">
                                      <input value={editKpiForm.name} onChange={(e) => setEditKpiForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                                      <div className="grid grid-cols-2 gap-2">
                                        <input value={editKpiForm.targetValue} onChange={(e) => setEditKpiForm((f) => ({ ...f, targetValue: e.target.value }))} placeholder="목표값" type="number" className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                                        <input value={editKpiForm.unit} onChange={(e) => setEditKpiForm((f) => ({ ...f, unit: e.target.value }))} placeholder="단위" className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <input value={editKpiForm.currentValue} onChange={(e) => setEditKpiForm((f) => ({ ...f, currentValue: e.target.value }))} placeholder="현재값" type="number" className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                                        <input value={editKpiForm.startValue} onChange={(e) => setEditKpiForm((f) => ({ ...f, startValue: e.target.value }))} placeholder="시작값" type="number" className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                                      </div>
                                      <div className="flex gap-2 justify-end">
                                        <button onClick={() => setEditingKpi(null)} className="px-3 py-1 border border-gray-200 text-xs rounded-lg text-gray-500">취소</button>
                                        <button onClick={() => handleUpdateKpi(kpi.id)} className="px-3 py-1 text-white text-xs rounded-lg hover:opacity-90" style={{ backgroundColor: project.color }}>저장</button>
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    key={kpi.id}
                                    className="p-3 bg-white rounded-xl border border-gray-100 cursor-pointer hover:border-primary-200 transition-colors group"
                                    onClick={() => setKpiDetailId(kpi.id)}
                                  >
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-sm font-medium text-gray-700">{kpi.name}</span>
                                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <span className="text-xs text-gray-500">
                                          {kpi.currentValue}{kpi.unit} / {kpi.targetValue}{kpi.unit}
                                        </span>
                                        <button
                                          onClick={() => {
                                            setEditingKpi(kpi.id);
                                            setEditKpiForm({
                                              name: kpi.name,
                                              targetValue: String(kpi.targetValue),
                                              currentValue: String(kpi.currentValue),
                                              startValue: String(kpi.startValue),
                                              unit: kpi.unit,
                                            });
                                          }}
                                          className="w-5 h-5 rounded hover:bg-gray-100 flex items-center justify-center text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <PenIcon className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => removeKpi(kpi.id)}
                                          className="w-5 h-5 rounded hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: project.color }} />
                                      </div>
                                      <span className="text-xs font-medium w-10 text-right" style={{ color: project.color }}>{pct}%</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {goalKpis.length === 0 && showKpiForm !== goal.id && (
                            <p className="text-xs text-gray-300 ml-1">KPI가 없습니다</p>
                          )}
                        </div>
                      )}

                      {/* ── 연결된 할일 섹션 (업무형 / 혼합) ── */}
                      {showTaskSection && (
                        <div className="pl-7">
                          <div className="flex items-center justify-between mb-2">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: project.color + '18', color: project.color }}>
                              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 8l4 4 8-8" />
                              </svg>
                              연결된 할일
                            </span>
                            <button
                              onClick={() => { setShowTaskForm(goal.id); setTaskForm({ title: '', date: '', priority: 'medium', category: '', notes: '', repeat: 'none' }); setShowTaskAdvanced(false); }}
                              className="text-xs text-gray-400 hover:text-primary-500 transition-colors"
                            >
                              + 할일 추가
                            </button>
                          </div>

                          {showTaskForm === goal.id && (
                            <div className="mb-2 p-3 bg-white rounded-xl space-y-4 border border-gray-100">
                              {/* 제목 */}
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">제목</label>
                                <input
                                  value={taskForm.title}
                                  onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                                  placeholder="할일 제목"
                                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                                  autoFocus
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddLinkedTask(goal.id); }}
                                />
                              </div>

                              {/* 중요도 */}
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">중요도</label>
                                <select value={taskForm.priority} onChange={(e) => setTaskForm((f) => ({ ...f, priority: e.target.value as 'high' | 'medium' | 'low' }))} className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                                  <option value="high">높음</option>
                                  <option value="medium">보통</option>
                                  <option value="low">낮음</option>
                                </select>
                              </div>

                              {/* 종류 */}
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">종류</label>
                                <div className="flex flex-wrap gap-1.5">
                                  {defaultTaskCategories.map((cat) => (
                                    <button
                                      key={cat.id}
                                      type="button"
                                      onClick={() => setTaskForm((f) => ({ ...f, category: f.category === cat.id ? '' : cat.id }))}
                                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                        taskForm.category === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                      style={taskForm.category === cat.id ? { backgroundColor: cat.color } : undefined}
                                    >
                                      {cat.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* 마감일 */}
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">마감일</label>
                                <input type="date" value={taskForm.date} onChange={(e) => setTaskForm((f) => ({ ...f, date: e.target.value }))}
                                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                              </div>

                              {/* 더 보기 토글 */}
                              <button onClick={() => setShowTaskAdvanced(!showTaskAdvanced)}
                                className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                                {showTaskAdvanced ? '간단히 보기 ▲' : '더 보기 (메모/반복) ▼'}
                              </button>

                              {showTaskAdvanced && (
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-xs text-gray-500 mb-1 block">메모</label>
                                    <textarea value={taskForm.notes} onChange={(e) => setTaskForm((f) => ({ ...f, notes: e.target.value }))} rows={2}
                                      placeholder="메모를 입력하세요"
                                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300" />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500 mb-1 block">반복</label>
                                    <select value={taskForm.repeat} onChange={(e) => setTaskForm((f) => ({ ...f, repeat: e.target.value as RepeatType }))}
                                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                                      <option value="none">없음</option>
                                      <option value="daily">매일</option>
                                      <option value="weekly">매주</option>
                                      <option value="monthly">매월</option>
                                      <option value="yearly">매년</option>
                                    </select>
                                  </div>
                                </div>
                              )}

                              <div className="flex justify-end gap-2">
                                <button onClick={() => { setShowTaskForm(null); setShowTaskAdvanced(false); }} className="px-3 py-1.5 border border-gray-200 text-xs rounded-lg text-gray-500 hover:bg-gray-50">취소</button>
                                <button onClick={() => handleAddLinkedTask(goal.id)} className="px-3 py-1.5 text-white text-xs rounded-lg hover:opacity-90" style={{ backgroundColor: project.color }}>추가</button>
                              </div>
                            </div>
                          )}

                          <div className="space-y-1 ml-1">
                            {goalTasks.map((t) => (
                              <div key={t.id} className="flex items-center gap-2 group">
                                <button
                                  onClick={() => cycleTaskStatus(t.id)}
                                  className={`text-sm flex-shrink-0 ${taskStatusStyle(t)} transition-colors`}
                                >
                                  {taskStatusIcon(t)}
                                </button>
                                <span className={`text-sm flex-1 ${t.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                  {t.title}
                                </span>
                                {t.date && (
                                  <span className={`text-xs ${
                                    t.status === 'completed' ? 'text-gray-300' :
                                    getDday(t.date)?.startsWith('D+') ? 'text-red-400' : 'text-gray-400'
                                  }`}>
                                    {getDday(t.date)}
                                  </span>
                                )}
                                <button
                                  onClick={() => removeTask(t.id)}
                                  className="w-5 h-5 rounded hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            {goalTasks.length === 0 && showTaskForm !== goal.id && (
                              <p className="text-xs text-gray-300">연결된 할일이 없습니다</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── KPI 기록 상세 모달 ── */}
      {detailKpi && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setKpiDetailId(null); setShowKpiLogForm(false); }}>
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-gray-800">{detailKpi.name}</h3>
                <button
                  onClick={() => {
                    setEditingKpi(detailKpi.id);
                    setEditKpiForm({
                      name: detailKpi.name,
                      targetValue: String(detailKpi.targetValue),
                      currentValue: String(detailKpi.currentValue),
                      startValue: String(detailKpi.startValue),
                      unit: detailKpi.unit,
                    });
                    setKpiDetailId(null);
                  }}
                  className="text-xs text-gray-400 hover:text-primary-500"
                >
                  편집
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                현재: {detailKpi.currentValue}{detailKpi.unit} / {detailKpi.targetValue}{detailKpi.unit} ({kpiPercent(detailKpi)}%)
              </p>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${kpiPercent(detailKpi)}%`, backgroundColor: project.color }} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-600">기록</span>
                <button onClick={() => setShowKpiLogForm(true)} className="text-xs text-primary-500 hover:text-primary-600">+ 기록 추가</button>
              </div>

              {showKpiLogForm && (
                <div className="mb-3 p-3 bg-gray-50 rounded-xl space-y-2">
                  <input
                    value={kpiLogForm.value}
                    onChange={(e) => setKpiLogForm((f) => ({ ...f, value: e.target.value }))}
                    placeholder={`현재 값 (${detailKpi.unit})`}
                    type="number"
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                    autoFocus
                  />
                  <input
                    value={kpiLogForm.note}
                    onChange={(e) => setKpiLogForm((f) => ({ ...f, note: e.target.value }))}
                    placeholder="메모 (선택)"
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowKpiLogForm(false)} className="px-3 py-1 border border-gray-200 text-xs rounded-lg text-gray-500">취소</button>
                    <button onClick={handleAddKpiLog} className="px-3 py-1 text-white text-xs rounded-lg hover:opacity-90" style={{ backgroundColor: project.color }}>기록</button>
                  </div>
                </div>
              )}

              {kpiLogLoading ? (
                <p className="text-xs text-gray-400 text-center py-4">로딩 중...</p>
              ) : kpiLogs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">기록이 없습니다</p>
              ) : (
                <div className="space-y-2">
                  {kpiLogs.map((log, idx) => {
                    const prevLog = kpiLogs[idx + 1];
                    const diff = prevLog ? log.value - prevLog.value : null;
                    return (
                      <div key={log.id} className="flex items-center gap-3 py-1.5 group">
                        <span className="text-xs text-gray-400 w-12 flex-shrink-0">{log.date.slice(5)}</span>
                        <span className="text-sm font-medium text-gray-700">{log.value}{detailKpi.unit}</span>
                        {diff !== null && (
                          <span className={`text-xs ${diff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {diff >= 0 ? '+' : ''}{diff}{detailKpi.unit}
                          </span>
                        )}
                        {log.note && <span className="text-xs text-gray-400 flex-1 truncate">{log.note}</span>}
                        <button
                          onClick={() => handleDeleteKpiLog(log.id)}
                          className="w-5 h-5 rounded hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 pt-2 border-t border-gray-100">
              <button
                onClick={() => { setKpiDetailId(null); setShowKpiLogForm(false); }}
                className="w-full py-2 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일정 상세 팝업 */}
      {selectedSchedule && (
        <ItemDetailPopup
          type="schedule"
          item={selectedSchedule}
          categories={scheduleCategories}
          onSave={(updated) => {
            const s = updated as ScheduleItem;
            updateSchedule(s.id, s);
            setSelectedSchedule(null);
          }}
          onDelete={() => {
            removeSchedule(selectedSchedule.id);
            setSelectedSchedule(null);
          }}
          onClose={() => setSelectedSchedule(null)}
          onCategoriesChange={setScheduleCategories}
        />
      )}

      {/* 인사이트 상세 팝업 */}
      {selectedInsight && (
        <ItemDetailPopup
          type="insight"
          item={selectedInsight}
          insightSources={insightSources}
          onInsightSourcesChange={(next) => {
            const added = next.filter((n) => !insightSources.some((s) => s.id === n.id));
            added.forEach((s) => addInsightSource(s));
            const removed = insightSources.filter((s) => !next.some((n) => n.id === s.id));
            removed.forEach((s) => removeInsightSource(s.id));
            setInsightSources(next);
          }}
          onSave={(updated) => {
            const i = updated as InsightItem;
            updateInsight(i.id, i);
            setSelectedInsight(null);
          }}
          onDelete={() => {
            removeInsight(selectedInsight.id);
            setSelectedInsight(null);
          }}
          onClose={() => setSelectedInsight(null)}
        />
      )}
    </div>
  );
}

/**
 * @file src/components/office/views.tsx
 * @description 오피스 셸 본문 뷰 7종 (Phase 2 이식 · 모노톤+몽글)
 * - 실데이터: 할일(useTasks, 워크스페이스 필터됨) · 멤버(fetchMembers)
 * - 샘플/빈 상태: 대시보드 KPI·브리핑·일정·인사이트·기록 (실연동은 Phase 4~5)
 */
import { useEffect, useRef, useState } from 'react';
import { Workspace, WorkspaceMember, TaskItem, DailyReport, RecordItem, Product, ContentItem, ContentType, ContentStatus, ContentMetric, ContentCheckpoint, SalesDaily, CompanyMemory, MemoryKind } from '../../types';
import { useTasks } from '../../hooks/useTasks';
import { fetchMembers, removeMember, changeMemberRole, updateMemberNickname, updateWorkspace } from '../../services/workspaces.service';
import { generateBriefing, fetchLatestBriefing, BriefingJson, BriefStatus, Severity } from '../../services/officeBriefing.service';
import { notify, getActorName } from '../../services/notify.service';
import { fetchWorkspaceTasks, updateTaskStatus, updateTaskFields, deleteTask, toDbStatus, fromDbStatus, TaskRow } from '../../services/tasks.service';
import { recordActivity, fetchActivities } from '../../services/activities.service';
import { ActivityItem } from '../../types';
import { progressOf, progressBy } from '../../utils/taskProgress';
import { LikeCommentBlock } from './LikeCommentBlock';
import { getTodayStr, addDaysStr, bucketFor, dueLabel, daysUntil, DateBucket } from '../../utils/dateCalc';
import { fetchMeetings } from '../../services/meetings.service';
import { Meeting } from '../../types';
import { getCurrentUserId } from '../../services/auth';
import { fetchReportsByWorkspace } from '../../services/dailyReports.service';
import { fetchSchedules, ScheduleRow } from '../../services/schedules.service';
import { SchedulesPageModern } from '../../pages/SchedulesPage.modern';
import { fetchInsights, addInsight, deleteInsight, InsightRow } from '../../services/insights.service';
import { fetchRecords, addRecord, deleteRecord, updateRecord, RecordRow } from '../../services/records.service';
import { fetchProducts, addProduct, updateProduct, deleteProduct } from '../../services/products.service';
import { fetchContentItems, addContentItem, updateContentItem, deleteContentItem } from '../../services/contentItems.service';
import { fetchMetricsByItem, saveMetric } from '../../services/contentMetrics.service';
import { fetchSalesDaily, saveSalesDaily, deleteSalesDaily } from '../../services/salesDaily.service';
import { fetchMemories, addMemory, updateMemory, deleteMemory } from '../../services/companyMemory.service';
import { workspaceErpSource, isWsCompat } from '../../config/dataSource';
import { RecordDetailView } from '../records/RecordDetailView';
import { ReportCard } from './StaffView';
import { fetchWorkspaceAnalytics, WorkspaceAnalytics } from '../../services/analytics.service';
import { TiptapEditor, TiptapEditorHandle } from '../tiptap/TiptapEditor';
import { CalendarView } from '../calendar/CalendarView';
import { defaultTaskCategories, officeScheduleCategories } from '../../data';
import { Spark, ViewHead, Card, EmptyState, TaskProgress } from './ui';

/** TaskRow(DB) → TaskItem(프론트). 워크스페이스 팀 화면에서 남이 만든 할일도 다루기 위해 로컬 매핑. */
function rowToTaskItem(r: TaskRow): TaskItem {
  return {
    id: r.id, title: r.title, project: r.project ?? '', goalId: (r as any).goal_id ?? undefined,
    status: fromDbStatus(r.status), priority: (r.priority as TaskItem['priority']) ?? 'medium',
    starred: !!r.starred, date: r.due_date, category: r.category, notes: r.notes, tags: r.tags,
    conversationId: r.conversation_id, workspaceId: r.workspace_id, isShared: r.is_shared,
    assigneeId: r.assignee_id, createdBy: r.user_id, meetingId: r.meeting_id, source: r.source,
    completedAt: r.completed_at,
  };
}

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

type Kpi = { k: string; unit: string; value: number; spark: number[]; delta: number | null };

/** 워크스페이스 KPI — 실데이터(매출 sales_daily + 콘텐츠 성과 content_metrics). 없으면 0·플랫 */
function useDashboardKpis(workspace: Workspace): Kpi[] {
  const [a, setA] = useState<WorkspaceAnalytics | null>(null);
  useEffect(() => {
    fetchWorkspaceAnalytics(workspace.id, workspaceErpSource(workspace)).then(setA).catch(() => setA(null));
  }, [workspace.id, workspace.erpSource]);

  if (!a) return [
    { k: '주간 매출', unit: '만원', value: 0, spark: FLAT_SPARK, delta: null },
    { k: '객단가', unit: '원', value: 0, spark: FLAT_SPARK, delta: null },
    { k: '저장률', unit: '%', value: 0, spark: FLAT_SPARK, delta: null },
    { k: '공유율', unit: '%', value: 0, spark: FLAT_SPARK, delta: null },
  ];
  const rev = a.sales.dailySeries.map(v => Math.round(v / 10000));  // 만원
  const revLast = rev[rev.length - 1] ?? 0;
  const revPrev = rev.length > 1 ? rev[rev.length - 2] : null;
  const revDelta = revPrev && revPrev !== 0 ? Math.round(((revLast - revPrev) / revPrev) * 100) : null;
  return [
    { k: '주간 매출', unit: '만원', value: Math.round(a.sales.last7Revenue / 10000), spark: rev.some(v => v > 0) ? rev : FLAT_SPARK, delta: revDelta },
    { k: '객단가', unit: '원', value: a.sales.aov ?? 0, spark: FLAT_SPARK, delta: null },
    { k: '저장률', unit: '%', value: a.content.avgSaveRate ?? 0, spark: FLAT_SPARK, delta: null },
    { k: '공유율', unit: '%', value: a.content.avgShareRate ?? 0, spark: FLAT_SPARK, delta: null },
  ];
}

/** 하루 운영 흐름 가이드 — 워크스페이스 메인 홈 상단. 접기/펼치기(localStorage). */
function OfficeDailyGuide() {
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('office_guide_open') !== '0'; } catch { return true; }
  });
  const toggle = () => { const n = !open; setOpen(n); try { localStorage.setItem('office_guide_open', n ? '1' : '0'); } catch { /* noop */ } };
  const steps = [
    { n: '1', emoji: '☀️', title: '아침 — 브리핑 & 대시보드', desc: '오늘의 브리핑에서 AI 직원이 만든 것 확인 → 대시보드에서 오늘 할일·일정·승인 대기 파악.' },
    { n: '2', emoji: '🎬', title: '콘텐츠 운영', desc: '콘텐츠에서 오늘 촬영·편집·발행을 관리(아이디어→발행). 올린 뒤 24h/72h/7일 성과 입력.' },
    { n: '3', emoji: '💰', title: '판매·제품 확인', desc: '매출·제품에서 채널별 매출·재고 확인. (시목 앱 연동 시 자동 조회)' },
    { n: '4', emoji: '✅', title: '실행 관리', desc: '할일·일정으로 오늘 업무를 배치하고 담당자를 지정.' },
    { n: '5', emoji: '🧠', title: '기억 남기기', desc: '회사 기억·인사이트에 배운 것·실패·아이디어를 기록 → AI가 나중에 활용.' },
  ];
  return (
    <Card className="p-5">
      <button onClick={toggle} className="w-full flex items-center justify-between">
        <span className="text-sm font-bold text-gray-700">🗺️ 하루 운영 흐름</span>
        <span className="text-[11px] text-gray-400">{open ? '접기 ▲' : '펼치기 ▼'}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          {steps.map(s => (
            <div key={s.n} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-md bg-surface-muted text-foreground text-xs font-bold flex items-center justify-center flex-shrink-0">{s.n}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-800">{s.emoji} {s.title}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
          {/* AI 직원 활용법 */}
          <div className="pt-3 mt-1 border-t border-gray-100">
            <div className="text-sm font-semibold text-gray-800 mb-2">🤖 AI 직원 이렇게 쓰세요</div>
            <div className="space-y-1.5">
              {[
                { e: '🧭', n: '운영매니저', d: '아침에 \'브리핑 생성\' → 대시보드에 "오늘 볼 것 3개"' },
                { e: '📊', n: '분석가', d: '매출·콘텐츠 성과를 해석 (기간 7/30/90 · 시목 공식 · 이상치)' },
                { e: '🗓', n: '일정비서', d: '촬영·편집·발행·마감을 하루/주간으로 정리' },
                { e: '💬', n: 'CS', d: '문의 붙여넣기 → 자동 분류·답변초안 · FAQ' },
                { e: '📡', n: '모니터링', d: '경쟁사·키워드 추적, 🎬로 콘텐츠 아이디어 전환' },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-2 text-[12px]">
                  <span className="flex-shrink-0">{s.e}</span>
                  <span className="text-gray-700 font-medium flex-shrink-0 w-16">{s.n}</span>
                  <span className="text-gray-500 leading-relaxed">{s.d}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">각 직원 카드를 누르면 <b className="text-gray-500">상단에 상세 가이드 + 실데이터 화면</b>이 있어요. 상세페이지·SNS·광고·비주얼은 GPT 프로젝트에서(앱은 유지만).</p>
          </div>

          <div className="pt-3 mt-1 border-t border-gray-100 text-[11px] text-gray-400 leading-relaxed space-y-1">
            <p>💡 <b className="text-gray-500">원칙:</b> AI 직원은 <b>제안</b>하고, 대표가 <b>승인</b>하면 실제 업무로 반영돼요. 제품·매출은 시목 앱이 원본, AI Office는 <b>분석·판단</b>만 합니다.</p>
            <p>🤖 <b className="text-gray-500">AI 직원 현황:</b> 채용·수동 실행('지금 실행')은 되지만 <b>24시간 자동 운영은 준비 중</b>이에요.</p>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ───────── CEO 브리핑 패널 (운영매니저 산출물 = 대시보드가 렌더) ─────────
   GPT 설계 v2: ① 오늘 한 줄 → ② TOP3 → ③ 매출/콘텐츠 → ④ 오늘 할 일 → ⑤ 승인대기 → ⑥ 조언 */
const STATUS_UI: Record<BriefStatus, { dot: string; bar: string; label: string }> = {
  good: { dot: 'bg-emerald-400', bar: 'border-emerald-200 bg-emerald-50/60', label: '🟢 정상' },
  attention: { dot: 'bg-amber-400', bar: 'border-amber-200 bg-amber-50/60', label: '🟡 주의' },
  critical: { dot: 'bg-rose-400', bar: 'border-rose-200 bg-rose-50/60', label: '🔴 확인 필요' },
};
const SEV_UI: Record<Severity, string> = {
  critical: 'border-l-rose-400', warning: 'border-l-amber-400', info: 'border-l-foreground', positive: 'border-l-emerald-400',
};

function BriefingPanel({ workspace, onNavigate }: { workspace: Workspace; onNavigate: Nav }) {
  const [brief, setBrief] = useState<BriefingJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [gen, setGen] = useState(false);
  // 월 목표: 로컬 상태로 즉시 반영(컨텍스트 리프레시 없이) + updateWorkspace로 영속
  const [target, setTarget] = useState<number | null>(workspace.monthlySalesTarget ?? null);
  const [editTarget, setEditTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchLatestBriefing(workspace.id).then(b => { if (alive) setBrief(b); }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [workspace.id]);

  const generate = async () => {
    setGen(true);
    try { const b = await generateBriefing({ ...workspace, monthlySalesTarget: target ?? undefined }); setBrief(b); }
    catch (e) { console.error('[BriefingPanel] 생성 실패:', e); alert('브리핑 생성에 실패했어요.'); }
    finally { setGen(false); }
  };
  const saveTarget = async () => {
    const v = Math.round(Number(targetInput.replace(/[^0-9]/g, '')) * 10000); // 만원 단위 입력 → 원
    const next = v > 0 ? v : null;
    setTarget(next); setEditTarget(false);
    try { await updateWorkspace(workspace.id, { monthlySalesTarget: next }); } catch (e) { console.error(e); }
  };

  const won = (n: number) => `${n.toLocaleString()}원`;
  const man = (n: number) => `${Math.round(n / 10000).toLocaleString()}만원`;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">🧭 CEO 브리핑</span>
          {brief && <span className="text-[11px] text-gray-400">{brief.briefing_date} · 운영매니저</span>}
        </div>
        <button onClick={generate} disabled={gen}
          className="text-[11px] px-3 py-1.5 rounded-lg bg-foreground text-white font-medium hover:opacity-85 disabled:opacity-50 transition-all active:scale-95">
          {gen ? '생성 중…' : brief ? '↻ 새로고침' : '브리핑 생성'}
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-300 py-8 text-center">불러오는 중…</p>
      ) : !brief ? (
        <div className="py-10 text-center px-5">
          <div className="text-3xl mb-2">🧭</div>
          <p className="text-sm text-gray-500 font-medium">아직 브리핑이 없어요</p>
          <p className="text-[11px] text-gray-400 mt-1">‘브리핑 생성’을 누르면 운영매니저가 오늘 볼 것을 정리해요.</p>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {/* ① 오늘 한 줄 */}
          <div className={`rounded-lg border px-4 py-3 ${STATUS_UI[brief.headline.status].bar}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-semibold text-gray-500">{STATUS_UI[brief.headline.status].label}</span>
            </div>
            <p className="text-sm text-gray-800 font-medium leading-relaxed">{brief.headline.text}</p>
          </div>

          {/* ② 대표가 볼 것 TOP3 */}
          {brief.top3.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-400 mb-2">대표가 볼 것 {brief.top3.length}</div>
              <div className="space-y-2">
                {brief.top3.map(t => (
                  <div key={t.rank} className={`border-l-[3px] ${SEV_UI[t.severity]} bg-gray-50 rounded-r-lg px-3 py-2`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-gray-400">{t.rank}</span>
                      <span className="text-sm font-semibold text-gray-800 flex-1">{t.title}</span>
                      {t.recommended_action && (
                        <button onClick={() => onNavigate(t.type === 'content' ? 'contents' : t.type === 'schedule' ? 'schedule' : (t.type === 'decision' || t.type === 'cs') ? 'staff' : 'todos')}
                          className="text-[11px] px-2 py-0.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-line flex-shrink-0">{t.recommended_action.label}</button>
                      )}
                    </div>
                    <p className="text-[12px] text-gray-500 mt-0.5">{t.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ③ 매출 / 콘텐츠 한 줄 */}
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="rounded-lg bg-gray-50 px-3.5 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${STATUS_UI[brief.sales.status].dot}`} />
                <span className="text-[11px] font-semibold text-gray-500">💰 매출</span>
                {brief.sales.month_target != null
                  ? <span className="ml-auto text-[10px] text-gray-400">목표 {man(brief.sales.month_target)}</span>
                  : (!editTarget && <button onClick={() => { setEditTarget(true); setTargetInput(target ? String(Math.round(target / 10000)) : ''); }} className="ml-auto text-[10px] text-foreground hover:underline">월 목표 설정</button>)}
              </div>
              {editTarget ? (
                <div className="flex items-center gap-1.5">
                  <input autoFocus type="number" value={targetInput} onChange={e => setTargetInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTarget(); if (e.key === 'Escape') setEditTarget(false); }}
                    placeholder="예: 3000" className="w-24 px-2 py-1 rounded-lg border border-line text-sm focus:outline-none" />
                  <span className="text-[11px] text-gray-400">만원</span>
                  <button onClick={saveTarget} className="text-[11px] px-2 py-1 rounded-lg bg-foreground text-white">저장</button>
                </div>
              ) : (
                <p className="text-[12px] text-gray-600 leading-relaxed">{brief.sales.one_line}</p>
              )}
            </div>
            <div className="rounded-lg bg-gray-50 px-3.5 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${STATUS_UI[brief.content.status].dot}`} />
                <span className="text-[11px] font-semibold text-gray-500">🎬 콘텐츠</span>
              </div>
              <p className="text-[12px] text-gray-600 leading-relaxed">{brief.content.one_line}</p>
            </div>
          </div>

          {/* CS 문의 한 줄 (있을 때만) */}
          {brief.cs?.hasData && (
            <button onClick={() => onNavigate('staff')} className="w-full flex items-center gap-2 rounded-lg bg-gray-50 hover:bg-gray-100 px-3.5 py-2.5 text-left transition-colors">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${brief.cs.urgent > 0 ? 'bg-rose-400' : 'bg-gray-300'}`} />
              <span className="text-[11px] font-semibold text-gray-500 flex-shrink-0">💬 문의</span>
              <span className="text-[12px] text-gray-600 truncate">{brief.cs.one_line}</span>
            </button>
          )}
          {/* 모니터링 한 줄 (있을 때만) */}
          {brief.monitoring?.hasData && (
            <button onClick={() => onNavigate('staff')} className="w-full flex items-center gap-2 rounded-lg bg-gray-50 hover:bg-gray-100 px-3.5 py-2.5 text-left transition-colors">
              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-300" />
              <span className="text-[11px] font-semibold text-gray-500 flex-shrink-0">📡 트렌드</span>
              <span className="text-[12px] text-gray-600 truncate">{brief.monitoring.one_line}</span>
            </button>
          )}

          {/* ④ 운영 현황 4칸 */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { k: '지연', v: brief.operations.tasks_overdue, to: 'todos' as const, warn: brief.operations.tasks_overdue > 0 },
              { k: '오늘마감', v: brief.operations.tasks_due_today, to: 'todos' as const },
              { k: '미배정', v: brief.operations.tasks_unassigned, to: 'todos' as const },
              { k: '승인대기', v: brief.operations.approvals_pending, to: 'staff' as const, warn: brief.operations.approvals_pending > 0 },
            ].map(o => (
              <button key={o.k} onClick={() => onNavigate(o.to)} className="rounded-lg bg-gray-50 hover:bg-gray-100 px-2 py-2.5 text-center transition-colors">
                <div className={`text-lg font-bold tabular-nums ${o.warn ? 'text-rose-500' : 'text-gray-800'}`}>{o.v}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{o.k}</div>
              </button>
            ))}
          </div>

          {/* ⑤ 오늘 할 일 / 승인대기 */}
          {brief.due_today.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-400 mb-1.5">오늘 할 일</div>
              <div className="space-y-1">
                {brief.due_today.slice(0, 6).map(d => (
                  <div key={d.id} className="flex items-center gap-2 text-[12px]">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 flex-shrink-0">{d.type === 'task' ? '할일' : d.type === 'schedule' ? '일정' : '콘텐츠'}</span>
                    {d.time && <span className="text-gray-400 flex-shrink-0">{d.time}</span>}
                    <span className="text-gray-700 truncate">{d.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ⑥ 조언 */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[12px] text-gray-500 leading-relaxed">💡 {brief.one_line_advice}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** 대시보드 — 확인이 필요한 일(top5) + 내 할일 버킷 (가이드 §10.7/§10.8). tasks=내 미완료. */
const BUCKET_META: { key: DateBucket; label: string; tone: string }[] = [
  { key: 'overdue', label: '지연', tone: 'text-rose-500' },
  { key: 'today', label: '오늘', tone: 'text-foreground' },
  { key: 'this_week', label: '이번 주', tone: 'text-gray-700' },
  { key: 'later', label: '나중', tone: 'text-gray-400' },
  { key: 'no_date', label: '기한 없음', tone: 'text-gray-300' },
];
function MyTaskFocus({ tasks, onNavigate }: { tasks: TaskItem[]; onNavigate: Nav }) {
  if (tasks.length === 0) return null;
  // 확인이 필요한 일 — 기한 빠른 순(없는 건 뒤로) top5
  const pending = [...tasks].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999')).slice(0, 5);
  // 버킷 그룹핑
  const grouped = new Map<DateBucket, TaskItem[]>();
  for (const t of tasks) {
    const b = bucketFor(t.date);
    if (!grouped.has(b)) grouped.set(b, []);
    grouped.get(b)!.push(t);
  }
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">확인이 필요한 일 <span className="text-gray-300 tabular-nums">{tasks.length}</span></span>
          <button onClick={() => onNavigate('todos')} className="text-[11px] text-gray-400 hover:text-foreground transition-colors">전체 ›</button>
        </div>
        {pending.map(t => {
          const overdue = t.date ? (daysUntil(t.date) ?? 0) < 0 : false;
          return (
            <button key={t.id} onClick={() => onNavigate('todos')} className="w-full flex items-center gap-2 py-1.5 text-left">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${overdue ? 'bg-rose-400' : 'bg-emerald-400'}`} />
              <span className="text-sm text-gray-600 truncate flex-1">{t.title}</span>
              <span className={`text-[10px] flex-shrink-0 ${overdue ? 'text-rose-500' : 'text-gray-400'}`}>{dueLabel(t.date)}</span>
            </button>
          );
        })}
      </Card>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">내 할일</span>
          <button onClick={() => onNavigate('todos')} className="text-[11px] text-gray-400 hover:text-foreground transition-colors">전체 ›</button>
        </div>
        {BUCKET_META.filter(b => (grouped.get(b.key)?.length ?? 0) > 0).map(b => {
          const items = grouped.get(b.key)!;
          return (
            <div key={b.key} className="py-1.5">
              <p className={`text-[11px] font-medium ${b.tone} mb-1`}>{b.label} <span className="text-gray-300 tabular-nums">{items.length}</span></p>
              <div className="space-y-0.5">
                {items.slice(0, 4).map(t => (
                  <button key={t.id} onClick={() => onNavigate('todos')} className="w-full flex items-center gap-2 text-left">
                    <span className="text-sm text-gray-600 truncate flex-1">{t.title}</span>
                    {t.date && <span className="text-[10px] text-gray-300 flex-shrink-0">{t.date.slice(5)}</span>}
                  </button>
                ))}
                {items.length > 4 && <button onClick={() => onNavigate('todos')} className="text-[11px] text-gray-400 hover:text-foreground">그 외 {items.length - 4}건 →</button>}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

export function DashboardView({ onNavigate, workspace }: { onNavigate: Nav; workspace: Workspace }) {
  const kpis = useDashboardKpis(workspace);
  const [wsTasks, setWsTasks] = useState<TaskItem[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const open = wsTasks.filter(t => t.status !== 'completed');
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [memos, setMemos] = useState<RecordRow[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  useEffect(() => {
    fetchWorkspaceTasks(workspace.id).then(rows => setWsTasks(rows.map(rowToTaskItem))).catch(() => setWsTasks([]));
    getCurrentUserId().then(setMyId).catch(() => setMyId(null));
    fetchSchedules(workspace.id).then(setSchedules).catch(() => setSchedules([]));
    fetchInsights(workspace.id).then(setInsights).catch(() => setInsights([]));
    fetchRecords(workspace.id, 'memo').then(setMemos).catch(() => setMemos([]));
    fetchReportsByWorkspace(workspace.id, 6).then(setReports).catch(() => setReports([]));
    fetchMembers(workspace.id).then(setMembers).catch(() => setMembers([]));
  }, [workspace.id]);

  const todayStr = getTodayStr();
  // 내 할일 = 나에게 배정된 것 + (미배정이면서 내가 만든 것). 솔로 오너·팀원 모두 커버.
  const myTasks = wsTasks.filter(t => t.status !== 'completed' && (t.assigneeId === myId || (!t.assigneeId && t.createdBy === myId)));
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '좋은 저녁이에요';
  const upcoming = schedules.filter(s => s.date >= todayStr).slice(0, 4);

  const SecHead = ({ title, to }: { title: string; to?: string }) => (
    <div className="flex items-center justify-between mb-2">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
      {to && <button onClick={() => onNavigate(to)} className="text-[11px] text-gray-400 hover:text-foreground transition-colors">전체 ›</button>}
    </div>
  );
  const Empty = ({ t }: { t: string }) => <p className="text-xs text-gray-300 py-3 text-center">{t}</p>;

  return (
    <div className="space-y-5">
      {/* 인사말 히어로 — 무지 모던톤 (라이트 대형 헤드라인) */}
      <div className="mb-10">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground mb-3">{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</div>
        <h1 className="text-3xl sm:text-4xl font-light leading-[1.2] text-gray-800">{greeting} 👋</h1>
        <p className="text-sm text-gray-400 mt-3">{workspace.name} · 진행 중 할일 {open.length}건 · 멤버 {members.length}명</p>
      </div>

      {/* 하루 운영 흐름 가이드 */}
      <OfficeDailyGuide />

      {/* CEO 브리핑 — 운영매니저 산출물 (오늘 볼 것 중심) */}
      <BriefingPanel workspace={workspace} onNavigate={onNavigate} />

      {/* KPI 스트립 — 실데이터 있을 때만 표시 (연동 전엔 빈 그래프 숨김) */}
      {kpis.some(k => k.value > 0 || k.delta !== null) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <Card key={i} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">{kpi.k}</span>
                {kpi.delta === null
                  ? <span className="text-xs font-semibold text-gray-300">—</span>
                  : <span className={`text-xs font-semibold ${kpi.delta >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>{kpi.delta >= 0 ? '▲' : '▼'} {Math.abs(kpi.delta)}%</span>}
              </div>
              <div className="text-2xl font-light mt-1.5 text-gray-800 tabular-nums">
                {kpi.value.toLocaleString()}<span className="text-sm text-gray-400 ml-0.5">{kpi.unit}</span>
              </div>
              <div className="mt-1.5"><Spark data={kpi.spark} /></div>
            </Card>
          ))}
        </div>
      )}

      {/* 브리핑 배너 — 네모·라인 (무지톤) */}
      <button onClick={() => onNavigate('briefing')}
        className="w-full flex items-center gap-3 p-5 rounded-lg bg-foreground text-white transition-colors hover:opacity-85 text-left">
        <span className="text-xl">☀️</span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">오늘의 브리핑 읽기</span>
          <span className="block text-xs text-white/70 mt-0.5">어제 AI 직원들이 한 일을 한 장으로</span>
        </span>
        <span className="text-white/50">›</span>
      </button>

      {/* 확인이 필요한 일 + 내 할일 버킷 */}
      <MyTaskFocus tasks={myTasks} onNavigate={onNavigate} />

      {/* 다가오는 일정 + 내 할일 */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-4">
          <SecHead title="다가오는 일정" to="schedule" />
          {upcoming.length ? upcoming.map(s => (
            <div key={s.id} className="flex items-center gap-2 py-1.5">
              <span className="text-[11px] font-bold text-gray-700 w-14 flex-shrink-0">{s.date.slice(5)}{s.time ? ' ' + s.time : ''}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-foreground flex-shrink-0" />
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
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5">
          <SecHead title="최근 인사이트" to="insights" />
          {insights.length ? insights.slice(0, 4).map(i => (
            <div key={i.id} className="flex items-center gap-2 py-1.5">
              <span className="text-sm">💡</span><span className="text-sm text-gray-600 truncate">{i.title}</span>
            </div>
          )) : <Empty t="인사이트가 없어요" />}
        </Card>
        <Card className="p-5">
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
      <Card className="p-5">
        <SecHead title="AI 직원 활동" to="activity" />
        {reports.length ? reports.slice(0, 5).map(r => (
          <div key={r.id} className="flex items-center gap-2 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-foreground flex-shrink-0" />
            <span className="text-sm text-gray-600 truncate flex-1">🤖 {r.title}</span>
            <span className="text-[10px] text-gray-300 flex-shrink-0">{r.date?.slice(5)}</span>
          </div>
        )) : <Empty t="아직 활동이 없어요 — AI 직원을 채용하고 ‘지금 한 번’을 눌러보세요" />}
      </Card>

      {/* 멤버 */}
      <Card className="p-5">
        <SecHead title="멤버" to="members" />
        {members.length ? (
          <div className="flex flex-wrap gap-2">
            {members.map(m => (
              <span key={m.userId} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200 text-xs text-gray-600">
                <span className="w-5 h-5 rounded-md bg-foreground text-white flex items-center justify-center text-[10px] font-bold">{(m.nickname || m.userId).slice(0, 1).toUpperCase()}</span>
                {m.nickname || '멤버'}{m.role === 'owner' && ' 👑'}
              </span>
            ))}
          </div>
        ) : <Empty t="멤버가 없어요" />}
      </Card>
    </div>
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
          {reports.map(r => <ReportCard key={r.id} r={r} />)}
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

const STATUS_RING: Record<TaskItem['status'], string> = {
  pending: 'border-gray-300', in_progress: 'border-amber-400', completed: 'bg-foreground border-foreground',
};
const TASK_CATEGORIES = ['콘텐츠', '제품', '쇼룸', '촬영', '회의', '운영', '마케팅', 'CS', 'AI'];
const isAiTask = (t: TaskItem) => t.category === '🤖 AI' || t.source === 'ai';

function TaskCol({ title, items, onOpen, onCycle, memberName, onMeeting }: {
  title: string; items: TaskItem[]; onOpen: (t: TaskItem) => void; onCycle: (id: string) => void; memberName: (uid?: string) => string;
  onMeeting?: () => void;   // 회의에서 나온 할일이면 ↗회의 링크
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-gray-700">{title}</span>
        <span className="text-xs text-gray-400">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map(t => (
          <div key={t.id} className="w-full flex items-center gap-2 p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all">
            <button onClick={() => onCycle(t.id)} title="상태 변경"
              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${STATUS_RING[t.status]}`}>
              {t.status === 'completed' && <span className="text-white text-[9px] leading-none">✓</span>}
            </button>
            <button onClick={() => onOpen(t)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
              <PriorityDot p={t.priority} />
              <span className={`text-sm flex-1 truncate ${t.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{t.title}</span>
              {t.category && t.category !== '🤖 AI' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">{t.category}</span>}
              {t.date && <span className="text-[10px] text-gray-400 flex-shrink-0">{t.date.slice(5)}</span>}
              {isAiTask(t) && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-muted text-foreground flex-shrink-0">🤖 AI</span>}
              {t.assigneeId && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-muted text-foreground flex-shrink-0">{memberName(t.assigneeId)}</span>}
            </button>
            {t.meetingId && onMeeting && (
              <button onClick={onMeeting} title="회의로 이동" className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 hover:bg-amber-100 flex-shrink-0">↗회의</button>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-300 py-3 text-center">없음</p>}
      </div>
    </Card>
  );
}

/** 할일 상세/수정 팝업 (몽글 모노톤) */
function TaskDetailPopup({ task, members, onSave, onDelete, onClose }: {
  task: TaskItem; members: WorkspaceMember[];
  onSave: (patch: Partial<TaskItem>) => void; onDelete: () => void; onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<TaskItem['priority']>(task.priority);
  const [status, setStatus] = useState<TaskItem['status']>(task.status);
  const [date, setDate] = useState(task.date ?? '');
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? '');
  const [category, setCategory] = useState(task.category && task.category !== '🤖 AI' ? task.category : '');
  const [meetingId, setMeetingId] = useState(task.meetingId ?? '');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  useEffect(() => {
    if (!task.workspaceId) return;
    fetchMeetings(task.workspaceId).then(setMeetings).catch(() => {});
  }, [task.workspaceId]);
  const memberName = (m: WorkspaceMember) => m.nickname || m.name || m.email || '멤버';
  const fieldCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-foreground transition-colors';
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overflow-y-auto" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-[440px] max-w-[92vw] max-h-[88dvh] overflow-y-auto p-6 space-y-3 my-auto" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-gray-800">할일 수정</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center">✕</button>
        </div>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="제목" className={fieldCls} />
        <div className="grid grid-cols-2 gap-2">
          <select value={priority} onChange={e => setPriority(e.target.value as TaskItem['priority'])} className={fieldCls}>
            <option value="high">우선순위 · 높음</option>
            <option value="medium">우선순위 · 보통</option>
            <option value="low">우선순위 · 낮음</option>
          </select>
          <select value={status} onChange={e => setStatus(e.target.value as TaskItem['status'])} className={fieldCls}>
            <option value="pending">할 일</option>
            <option value="in_progress">진행 중</option>
            <option value="completed">완료</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={fieldCls} />
          <select value={category} onChange={e => setCategory(e.target.value)} className={fieldCls}>
            <option value="">카테고리 없음</option>
            {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {members.length > 1 && (
          <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className={fieldCls}>
            <option value="">담당자 없음</option>
            {members.map(m => <option key={m.userId} value={m.userId}>{memberName(m)}</option>)}
          </select>
        )}
        {task.workspaceId && meetings.length > 0 && (
          <select value={meetingId} onChange={e => setMeetingId(e.target.value)} className={fieldCls}>
            <option value="">📋 회의 연결 없음</option>
            {meetings.map(m => <option key={m.id} value={m.id}>📋 {m.title}{m.meetingDate ? ` · ${m.meetingDate.slice(5)}` : ''}</option>)}
          </select>
        )}
        {/* 작성자(배정한 사람) — 읽기 전용 */}
        {task.workspaceId && task.createdBy && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400 px-1">
            <span>✍️ 작성자</span>
            <span className="text-gray-600">{(() => { const c = members.find(x => x.userId === task.createdBy); return c ? (c.nickname || c.name || '멤버') : '나'; })()}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <button onClick={onDelete} className="text-xs text-rose-400 hover:text-rose-600 px-2 py-1.5">삭제</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
            <button onClick={() => onSave({ title: title.trim() || task.title, priority, status, date: date || undefined, assigneeId: assigneeId || undefined, category: category || undefined, meetingId: meetingId || undefined })}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 transition-all">저장</button>
          </div>
        </div>
        {/* 좋아요·댓글 (오피스 할일만) */}
        {task.workspaceId && <LikeCommentBlock resource="task" resId={task.id} members={members} />}
      </div>
    </div>
  );
}

export function TodosView({ workspace, onNavigate }: { workspace: Workspace; onNavigate?: Nav }) {
  const { add } = useTasks();
  const [wsTasks, setWsTasks] = useState<TaskItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  // 할일 추가 폼 — 날짜는 기본으로 '오늘'(수동 수정 가능)
  const blankForm = (): { title: string; priority: TaskItem['priority']; date: string; assigneeId: string; category: string } =>
    ({ title: '', priority: 'medium', date: getTodayStr(), assigneeId: '', category: '' });
  const [form, setForm] = useState(blankForm);
  const [selected, setSelected] = useState<TaskItem | null>(null);
  const [scope, setScope] = useState<'all' | 'mine' | 'assigned'>('all');  // 전체 / 받은 할일 / 내가 배정
  const [filter, setFilter] = useState<string>('all');                     // all 스코프의 하위 필터(멤버·미배정·AI)
  const [mode, setMode] = useState<'day' | 'list' | 'calendar'>('day');
  const [cursor, setCursor] = useState<string>(() => getTodayStr()); // 일별 뷰: 선택한 날짜

  const loadWs = () => fetchWorkspaceTasks(workspace.id).then(rows => setWsTasks(rows.map(rowToTaskItem))).catch(() => setWsTasks([]));
  useEffect(() => {
    loadWs();
    fetchMembers(workspace.id).then(setMembers).catch(() => setMembers([]));
    getCurrentUserId().then(setMyId).catch(() => setMyId(null));
    /* eslint-disable-next-line */
  }, [workspace.id]);

  const memberName = (uid?: string) => {
    if (!uid) return '';
    const m = members.find(x => x.userId === uid);
    return m ? (m.nickname || m.name || m.email || '멤버') : '담당';
  };
  const fieldCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-foreground transition-colors';

  const save = async () => {
    if (!form.title.trim()) return;
    // source='manual' — 대표가 직접 만든 할일. (content/decision/ai 등은 해당 기능이 생성 시 지정)
    try {
      await add({ title: form.title.trim(), priority: form.priority, date: form.date || undefined, assigneeId: form.assigneeId || undefined, category: form.category || undefined, source: 'manual' });
      setForm(blankForm()); setShowForm(false); await loadWs();
    } catch (e) { console.error('[TodosView] 할일 추가 실패:', e); alert('할일 추가에 실패했어요. 잠시 후 다시 시도해 주세요.'); }
  };

  // ── 뮤테이션(팀 전체 할일 대상 — 남이 만든 받은 할일도 처리) ──
  const cycleStatus = async (id: string) => {
    const t = wsTasks.find(x => x.id === id); if (!t) return;
    const order: TaskItem['status'][] = ['pending', 'in_progress', 'completed'];
    const next = order[(order.indexOf(t.status) + 1) % 3];
    if (next === 'completed') {
      await updateTaskStatus(id, 'completed').catch(() => {});
      recordActivity({ workspaceId: workspace.id, action: 'completed_task', resourceType: 'task', resourceId: id, metadata: { title: t.title } });
      const name = await getActorName(workspace.id, myId);
      notify({ type: 'notify_task_completed', workspaceId: workspace.id, actorId: myId, title: '✅ 할일 완료', body: `${name} 님이 「${t.title}」을 완료했어요.`, tag: `task-${id}-done` });
    } else {
      await updateTaskFields(id, { status: toDbStatus(next), completed_at: null }).catch(() => {});
    }
    await loadWs();
  };
  const saveTask = async (id: string, patch: Partial<TaskItem>) => {
    const prev = wsTasks.find(x => x.id === id);
    const db: Record<string, unknown> = {};
    if (patch.title !== undefined) db.title = patch.title;
    if (patch.priority !== undefined) db.priority = patch.priority;
    if (patch.status !== undefined) { db.status = toDbStatus(patch.status); db.completed_at = patch.status === 'completed' ? new Date().toISOString() : null; }
    if (patch.date !== undefined) db.due_date = patch.date || null;
    if (patch.assigneeId !== undefined) db.assignee_id = patch.assigneeId || null;
    if (patch.category !== undefined) db.category = patch.category || null;
    if (patch.meetingId !== undefined) db.meeting_id = patch.meetingId || null;
    await updateTaskFields(id, db).catch(() => {});
    // 재배정 알림 — 담당자가 실제로 바뀌었고 본인이 아닐 때만
    if (patch.assigneeId && patch.assigneeId !== prev?.assigneeId && patch.assigneeId !== myId) {
      const name = await getActorName(workspace.id, myId);
      notify({ type: 'notify_task_assigned', workspaceId: workspace.id, actorId: myId, title: '🔄 할일 담당자 변경', body: `${name} 님이 「${patch.title ?? prev?.title ?? '할일'}」을 회원님께 넘겼어요.`, tag: `task-assign-${id}-${patch.assigneeId}`, targetUserIds: [patch.assigneeId] });
    }
    // 완료 전환 알림·기록
    if (patch.status === 'completed' && prev?.status !== 'completed') {
      recordActivity({ workspaceId: workspace.id, action: 'completed_task', resourceType: 'task', resourceId: id, metadata: { title: prev?.title } });
      const name = await getActorName(workspace.id, myId);
      notify({ type: 'notify_task_completed', workspaceId: workspace.id, actorId: myId, title: '✅ 할일 완료', body: `${name} 님이 「${prev?.title}」을 완료했어요.`, tag: `task-${id}-done` });
    }
    await loadWs();
  };
  const removeTask = async (id: string) => { await deleteTask(id).catch(() => {}); await loadWs(); };
  const openMeeting = onNavigate ? () => onNavigate('meetings') : undefined;

  // ── 스코프(탭) + 하위 필터 적용 ──
  const counts = {
    all: wsTasks.length,
    mine: wsTasks.filter(t => t.assigneeId === myId).length,
    assigned: wsTasks.filter(t => t.createdBy === myId && t.assigneeId && t.assigneeId !== myId).length,
  };
  const scoped = scope === 'mine' ? wsTasks.filter(t => t.assigneeId === myId)
    : scope === 'assigned' ? wsTasks.filter(t => t.createdBy === myId && !!t.assigneeId && t.assigneeId !== myId)
      : wsTasks;
  const applyFilter = (list: TaskItem[]) => {
    if (scope !== 'all' || filter === 'all') return list;
    if (filter === 'unassigned') return list.filter(t => !t.assigneeId && !isAiTask(t));
    if (filter === 'ai') return list.filter(isAiTask);
    return list.filter(t => t.assigneeId === filter);
  };
  const fTasks = applyFilter(scoped);
  const open = fTasks.filter(t => t.status !== 'completed');
  const done = fTasks.filter(t => t.status === 'completed');

  // ── 일별 뷰 파생 ──
  const today = getTodayStr();
  const addDays = (iso: string, d: number) => addDaysStr(iso, d);  // 타임존 안전(로컬)
  const fmtDay = (iso: string) => { const [y, m, dd] = iso.split('-').map(Number); const dt = new Date(y, m - 1, dd); const w = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()]; return `${m}월 ${dd}일 (${w})`; };
  const overdue = fTasks.filter(t => t.status !== 'completed' && t.date && t.date < today);
  const noDate = cursor === today ? fTasks.filter(t => t.status !== 'completed' && !t.date) : [];
  const dayOpen = [...fTasks.filter(t => t.status !== 'completed' && t.date === cursor), ...noDate];
  const dayDone = fTasks.filter(t => t.status === 'completed' && t.date === cursor);

  const chip = (id: string, label: string) => (
    <button key={id} onClick={() => setFilter(id)}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${filter === id ? 'bg-foreground text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{label}</button>
  );
  const scopeTab = (id: typeof scope, label: string, count: number) => (
    <button key={id} onClick={() => setScope(id)}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${scope === id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{label} <span className="tabular-nums opacity-70">{count}</span></button>
  );
  const modeBtn = (m: typeof mode, label: string) => (
    <button key={m} onClick={() => setMode(m)}
      className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${mode === m ? 'bg-foreground text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{label}</button>
  );

  return (
    <>
      <ViewHead eyebrow="TASKS" title="할일" sub={`${open.length}건 진행 · ${done.length}건 완료${overdue.length ? ` · 지연 ${overdue.length}` : ''}`} />

      {/* 스코프 탭 — 전체 / 받은 할일(나에게 배정) / 내가 배정(남에게) */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        {scopeTab('all', '전체', counts.all)}
        {scopeTab('mine', '받은 할일', counts.mine)}
        {scopeTab('assigned', '내가 배정', counts.assigned)}
      </div>

      {/* 뷰 토글 (일별/전체/캘린더) + 추가 */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <div className="flex gap-1">{modeBtn('day', '일별')}{modeBtn('list', '전체')}{modeBtn('calendar', '캘린더')}</div>
        <button onClick={() => setShowForm(v => !v)}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-white hover:opacity-85 active:scale-95 transition-all">＋ 할일 추가</button>
      </div>

      {/* 담당자/AI 하위 필터 (전체 스코프에서만) */}
      {scope === 'all' && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {chip('all', '전체')}
          {members.length > 1 && members.map(m => chip(m.userId, memberName(m.userId)))}
          {members.length > 1 && chip('unassigned', '미배정')}
          {chip('ai', '🤖 AI')}
        </div>
      )}

      {showForm && (
        <Card className="p-4 mb-3 space-y-2.5">
          <input autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') save(); }} placeholder="무엇을 할까요?" className={fieldCls} />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as TaskItem['priority'] })} className={fieldCls}>
              <option value="high">우선순위 · 높음</option>
              <option value="medium">우선순위 · 보통</option>
              <option value="low">우선순위 · 낮음</option>
            </select>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={fieldCls}>
              <option value="">카테고리 없음</option>
              {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={fieldCls} />
            {members.length > 1 && (
              <select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })} className={fieldCls}>
                <option value="">담당자 없음</option>
                {members.map(m => <option key={m.userId} value={m.userId}>{memberName(m.userId)}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setForm(blankForm()); }}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
            <button onClick={save} disabled={!form.title.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 disabled:opacity-40 transition-all">추가</button>
          </div>
        </Card>
      )}

      {/* 일별 뷰 — 날짜 네비 + 지연 → 할일 → 완료 */}
      {mode === 'day' && (
        <>
          <div className="flex items-center justify-center gap-3 mb-3">
            <button onClick={() => setCursor(c => addDays(c, -1))} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95 transition-all">‹</button>
            <div className="text-center min-w-[9rem]">
              <div className="text-base font-bold text-gray-800">{fmtDay(cursor)}</div>
              {cursor !== today && <button onClick={() => setCursor(today)} className="text-[11px] text-foreground hover:underline">오늘로</button>}
              {cursor === today && <div className="text-[11px] text-gray-400">오늘</div>}
            </div>
            <button onClick={() => setCursor(c => addDays(c, 1))} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 active:scale-95 transition-all">›</button>
          </div>
          <div className="space-y-3">
            {overdue.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-1">
                <TaskCol title="🔴 지연" items={overdue} onOpen={setSelected} onCycle={cycleStatus} memberName={memberName} onMeeting={openMeeting} />
              </div>
            )}
            <TaskCol title="할 일" items={dayOpen} onOpen={setSelected} onCycle={cycleStatus} memberName={memberName} onMeeting={openMeeting} />
            <TaskCol title="완료" items={dayDone} onOpen={setSelected} onCycle={cycleStatus} memberName={memberName} onMeeting={openMeeting} />
          </div>
        </>
      )}

      {/* 전체 리스트 — 진행/완료 2열 */}
      {mode === 'list' && (
        <div className="grid sm:grid-cols-2 gap-3">
          <TaskCol title="할 일" items={open} onOpen={setSelected} onCycle={cycleStatus} memberName={memberName} onMeeting={openMeeting} />
          <TaskCol title="완료" items={done} onOpen={setSelected} onCycle={cycleStatus} memberName={memberName} onMeeting={openMeeting} />
        </div>
      )}

      {/* 캘린더 뷰 (개인 공간과 동일 컴포넌트 재사용) */}
      {mode === 'calendar' && (
        <div className="rounded-xl border border-gray-200 p-2 sm:p-3">
          <CalendarView
            mode="tasks"
            tasks={fTasks}
            schedules={[]}
            taskCategories={defaultTaskCategories}
            scheduleCategories={officeScheduleCategories}
            onTaskClick={setSelected}
            onScheduleClick={() => {}}
            onTaskDateChange={(id, date) => saveTask(id, { date })}
            onScheduleDateChange={() => {}}
            onTaskStatusCycle={cycleStatus}
          />
        </div>
      )}

      {selected && (
        <TaskDetailPopup
          task={selected} members={members}
          onSave={async (patch) => { await saveTask(selected.id, patch); setSelected(null); }}
          onDelete={async () => { await removeTask(selected.id); setSelected(null); }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

/* ───────── 일정 (개인 공간의 풍부한 캘린더를 오피스로 — 워크스페이스 스코프 + 직원 자동 등록/완료체크 포함) ───────── */
export function ScheduleView({ workspace }: { workspace: Workspace }) {
  return <SchedulesPageModern embedded workspaceId={workspace.id} />;
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

  const fieldCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-foreground transition-colors';
  const save = async () => {
    if (!form.title.trim()) return;
    try {
      await addInsight({
        title: form.title.trim(), content: form.content, source: form.source || '직접 입력', link: form.link || undefined,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        workspace_id: workspace.id,
      } as Omit<InsightRow, 'id' | 'created_at' | 'conversation_id'>);
      setForm({ title: '', content: '', source: '', link: '', tags: '' }); setShowForm(false); load();
    } catch (e) {
      console.error('[InsightsView] 저장 실패:', e);
      alert('인사이트 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  };
  const del = async (id: string) => { await deleteInsight(id).catch(() => {}); load(); };

  return (
    <>
      <ViewHead eyebrow="INSIGHTS" title="인사이트" sub={`인사이트 ${list.length}건`} />
      <div className="flex justify-end mb-3">
        <button onClick={() => setShowForm(v => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-white hover:opacity-85 active:scale-95 transition-all">＋ 인사이트 추가</button>
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
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
            <button onClick={save} disabled={!form.title.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 disabled:opacity-40 transition-all">저장</button>
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
                {i.tags?.includes('🤖 AI') && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-muted text-foreground flex-shrink-0">🤖 {i.source}</span>}
                <button onClick={() => del(i.id)} className="text-[11px] text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">삭제</button>
              </div>
              {i.content && i.content !== i.title && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{i.content}</p>}
              {i.link && <a href={i.link} target="_blank" rel="noreferrer" className="text-[11px] text-foreground mt-1 inline-block break-all">{i.link}</a>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/* ───────── 기록 (메모 — Tiptap) ───────── */
/** 오피스 메모 RecordRow → RecordDetailView가 받는 RecordItem 변환 (읽기/수정 공용) */
function memoRowToItem(r: RecordRow): RecordItem {
  return {
    id: r.id,
    recordType: 'memo',
    date: r.date,
    title: r.title,
    memoBody: r.memo_body,
    createdAt: r.created_at,
  } as RecordItem;
}

export function LogView({ workspace }: { workspace: Workspace }) {
  const [memos, setMemos] = useState<RecordRow[]>([]);
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState<any>(undefined);
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const editorRef = useRef<TiptapEditorHandle>(null);
  const load = () => fetchRecords(workspace.id, 'memo').then(setMemos).catch(() => setMemos([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspace.id]);

  const save = async () => {
    if (!title.trim() && !body) return;
    try {
      await addRecord({
        title: title.trim() || '메모', date: new Date().toISOString().split('T')[0],
        record_type: 'memo', memo_body: body || {}, workspace_id: workspace.id,
      } as Omit<RecordRow, 'id' | 'created_at'>);
      setTitle(''); setBody(undefined); setWriting(false); load();
    } catch (e) {
      console.error('[LogView] 메모 저장 실패:', e);
      alert('메모 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  };
  const del = async (id: string) => { await deleteRecord(id).catch(() => {}); load(); };

  return (
    <>
      <ViewHead eyebrow="MEMO" title="기록" sub={`메모 ${memos.length}개`} />
      <div className="flex justify-end mb-3">
        <button onClick={() => setWriting(v => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-white hover:opacity-85 active:scale-95 transition-all">＋ 메모</button>
      </div>
      {writing && (
        <Card className="p-4 mb-3 space-y-2.5">
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="제목"
            className="w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-foreground transition-colors" />
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
            <button onClick={() => { setWriting(false); setTitle(''); setBody(undefined); }} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
            <button onClick={save} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 transition-all">저장</button>
          </div>
        </Card>
      )}
      {memos.length === 0 ? (
        <EmptyState emoji="📝" title="메모가 없어요" sub="＋ 메모로 자유롭게 기록하세요" />
      ) : (
        <div className="space-y-2">
          {memos.map(m => (
            <Card key={m.id} className="group p-4 flex items-center gap-2">
              <button onClick={() => setSelected(m)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <span className="text-sm font-medium text-gray-700 flex-1 truncate">📝 {m.title}</span>
                <span className="text-[11px] text-gray-400 flex-shrink-0">{m.date}</span>
              </button>
              <button onClick={() => del(m.id)} className="text-[11px] text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">삭제</button>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <RecordDetailView
          record={memoRowToItem(selected)}
          onUpdate={async (updated) => {
            await updateRecord(updated.id, { title: updated.title, memo_body: updated.memoBody }).catch(() => {});
            setSelected(null); load();
          }}
          onDelete={async (id) => { await deleteRecord(id).catch(() => {}); setSelected(null); load(); }}
          onClose={() => setSelected(null)}
        />
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
        <div className="space-y-2">
          {reports.map(r => <ReportCard key={r.id} r={r} />)}
        </div>
      )}
    </>
  );
}

/* ───────── 콘텐츠 아이템 (실데이터 · 아이디어→발행) ───────── */
const CONTENT_TYPE_LABEL: Record<ContentType, string> = { desire: '💛 욕망', info: '📚 정보', worldview: '🌲 세계관', behind: '🎬 비하인드' };
const CONTENT_PLATFORMS = ['Instagram', 'YouTube Shorts', 'YouTube', 'Blog', 'Pinterest', '오늘의집', 'Other'];
const CONTENT_PURPOSES: { v: string; label: string }[] = [
  { v: 'view', label: '조회(view)' }, { v: 'follow', label: '팔로우(follow)' }, { v: 'save', label: '저장(save)' },
  { v: 'sale', label: '판매(sale)' }, { v: 'brand', label: '브랜드(brand)' },
];
const CONTENT_OWNERS = ['쏠닝', '홍대표', 'AI', '외주'];
const CONTENT_STATUS_ORDER: ContentStatus[] = ['idea', 'approved', 'scripted', 'shooting', 'editing', 'scheduled', 'published', 'archived'];
const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  idea: '아이디어', approved: '승인', scripted: '대본', shooting: '촬영', editing: '편집', scheduled: '예약', published: '발행', archived: '보관',
};
const CONTENT_STATUS_CLS: Record<ContentStatus, string> = {
  idea: 'bg-gray-100 text-gray-500', approved: 'bg-blue-50 text-blue-600', scripted: 'bg-indigo-50 text-indigo-600',
  shooting: 'bg-amber-50 text-amber-600', editing: 'bg-orange-50 text-orange-600', scheduled: 'bg-violet-50 text-violet-600',
  published: 'bg-emerald-50 text-emerald-600', archived: 'bg-gray-100 text-gray-400',
};
const nextContentStatus = (s: ContentStatus): ContentStatus | null => {
  const i = CONTENT_STATUS_ORDER.indexOf(s);
  return i >= 0 && i < CONTENT_STATUS_ORDER.length - 1 ? CONTENT_STATUS_ORDER[i + 1] : null;
};

const CHECKPOINT_LABEL: Record<ContentCheckpoint, string> = { h24: '24시간', h72: '72시간', d7: '7일' };

/** 콘텐츠 성과 입력 — 24h/72h/7d 시점별. 저장률·공유율을 최상단에 강조. */
function ContentMetricsEditor({ item, workspaceId }: { item: ContentItem; workspaceId: string }) {
  const [metrics, setMetrics] = useState<Record<string, ContentMetric>>({});
  const [cp, setCp] = useState<ContentCheckpoint>('h24');
  const [f, setF] = useState<Partial<ContentMetric>>({});
  const [saving, setSaving] = useState(false);
  const load = () => fetchMetricsByItem(item.id).then(rows => {
    const map: Record<string, ContentMetric> = {};
    rows.forEach(m => { map[m.checkpoint] = m; });
    setMetrics(map); setF(map[cp] ?? {});
  }).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [item.id]);
  useEffect(() => { setF(metrics[cp] ?? {}); /* eslint-disable-next-line */ }, [cp]);

  const setN = (k: keyof ContentMetric, v: string) => setF(prev => ({ ...prev, [k]: v === '' ? undefined : Number(v) }));
  const rate = (n?: number) => (f.views && f.views > 0 && n != null ? `${((n / f.views) * 100).toFixed(1)}%` : '—');
  const inputCls = 'w-full px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-line';
  const save = async () => {
    setSaving(true);
    try { await saveMetric(workspaceId, item.id, cp, f); await load(); }
    catch (e) { console.error('[metrics] 저장 실패', e); alert('성과 저장에 실패했어요.'); }
    finally { setSaving(false); }
  };
  // 컴포넌트(<NumIn/>)로 만들면 매 렌더 리마운트되어 포커스가 튐 → 함수 호출형으로 인라인 렌더.
  const numIn = (k: keyof ContentMetric, label: string) => (
    <label key={k} className="block">
      <span className="text-[10px] text-gray-400">{label}</span>
      <input type="number" value={f[k] == null ? '' : String(f[k])} onChange={e => setN(k, e.target.value)} className={inputCls} />
    </label>
  );

  return (
    <div className="border-t border-gray-100 pt-3 mt-1 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-500">📊 성과 <span className="text-gray-300">(저장률·공유율 중심)</span></span>
        <div className="flex gap-1">
          {(['h24', 'h72', 'd7'] as ContentCheckpoint[]).map(c => (
            <button key={c} onClick={() => setCp(c)}
              className={`px-2 py-1 rounded-lg text-[11px] ${cp === c ? 'bg-foreground text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {CHECKPOINT_LABEL[c]}{metrics[c] ? ' ●' : ''}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-muted p-2 text-center">
          <div className="text-[10px] text-gray-400">저장률 (saves/views)</div>
          <div className="text-lg font-extrabold text-foreground">{rate(f.saves)}</div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-2 text-center">
          <div className="text-[10px] text-gray-400">공유율 (shares/views)</div>
          <div className="text-lg font-extrabold text-emerald-600">{rate(f.shares)}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {numIn('saves', '저장 ★')}
        {numIn('shares', '공유 ★')}
        {numIn('views', '조회수')}
        {numIn('likes', '좋아요')}
        {numIn('comments', '댓글')}
        {numIn('followerDelta', '팔로워 증감')}
        {numIn('watchTime', '시청시간(초)')}
        {numIn('completionRate', '완주율(%)')}
      </div>
      <button onClick={save} disabled={saving}
        className="w-full py-1.5 rounded-xl text-xs font-bold bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40 transition-all">
        {saving ? '저장 중…' : `${CHECKPOINT_LABEL[cp]} 성과 저장`}
      </button>
    </div>
  );
}

function ContentEditPopup({ item, products, workspaceId, members, onSave, onDelete, onClose }: {
  item: ContentItem; products: Product[]; workspaceId: string; members: WorkspaceMember[];
  onSave: (fields: Partial<ContentItem>) => void; onDelete: () => void; onClose: () => void;
}) {
  const [f, setF] = useState<Partial<ContentItem>>({ ...item });
  const set = (patch: Partial<ContentItem>) => setF(prev => ({ ...prev, ...patch }));
  const fieldCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-foreground transition-colors';
  const next = f.status ? nextContentStatus(f.status) : null;

  // 발행 연동: published로 전환 시 published_at 자동, URL 없으면 경고(저장은 허용)
  const doSave = () => {
    const fields: Partial<ContentItem> = { ...f, title: (f.title || '').trim() || item.title };
    if (fields.status === 'published' && !item.publishedAt) fields.publishedAt = new Date().toISOString();
    if (fields.status !== 'published') fields.publishedAt = f.publishedAt; // 유지
    if (fields.status === 'published' && !fields.url) {
      if (!confirm('발행 URL이 비어 있어요. 그래도 발행 상태로 저장할까요?')) return;
    }
    onSave(fields);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overflow-y-auto" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-[520px] max-w-[94vw] max-h-[88vh] overflow-y-auto p-6 space-y-2.5" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-gray-800">콘텐츠</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center">✕</button>
        </div>
        <input autoFocus value={f.title ?? ''} onChange={e => set({ title: e.target.value })} placeholder="제목" className={fieldCls} />
        <div className="grid grid-cols-2 gap-2">
          <select value={f.platform ?? ''} onChange={e => set({ platform: e.target.value || undefined })} className={fieldCls}>
            <option value="">플랫폼</option>
            {CONTENT_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={f.contentType ?? ''} onChange={e => set({ contentType: (e.target.value || undefined) as ContentType | undefined })} className={fieldCls}>
            <option value="">유형</option>
            {(Object.keys(CONTENT_TYPE_LABEL) as ContentType[]).map(t => <option key={t} value={t}>{CONTENT_TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <select value={f.status} onChange={e => set({ status: e.target.value as ContentStatus })} className={fieldCls}>
            {CONTENT_STATUS_ORDER.map(s => <option key={s} value={s}>{CONTENT_STATUS_LABEL[s]}</option>)}
          </select>
          {next && (
            <button onClick={() => set({ status: next })}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-surface-muted text-foreground hover:bg-surface-muted whitespace-nowrap flex-shrink-0">
              다음 → {CONTENT_STATUS_LABEL[next]}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={f.contentPurpose ?? ''} onChange={e => set({ contentPurpose: e.target.value || undefined })} className={fieldCls}>
            <option value="">목적</option>
            {CONTENT_PURPOSES.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
          </select>
          <select value={f.owner ?? ''} onChange={e => set({ owner: e.target.value || undefined })} className={fieldCls}>
            <option value="">담당자</option>
            {CONTENT_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <select value={f.primaryProductId ?? ''} onChange={e => set({ primaryProductId: e.target.value || undefined })} className={fieldCls}>
          <option value="">대표 제품 없음</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="block">
          <span className="text-[10px] text-gray-400">발행 예정일</span>
          <input type="datetime-local" value={f.scheduledFor ? f.scheduledFor.slice(0, 16) : ''}
            onChange={e => set({ scheduledFor: e.target.value || undefined })} className={fieldCls} />
        </label>
        <input value={f.hook ?? ''} onChange={e => set({ hook: e.target.value })} placeholder="훅 (첫 문장)" className={fieldCls} />
        <textarea value={f.script ?? ''} onChange={e => set({ script: e.target.value })} placeholder="대본" rows={3} className={fieldCls} />
        <textarea value={f.shotList ?? ''} onChange={e => set({ shotList: e.target.value })} placeholder="촬영 컷 (줄 단위)" rows={2} className={fieldCls} />
        <input value={f.url ?? ''} onChange={e => set({ url: e.target.value })} placeholder="발행 URL" className={fieldCls} />
        {item.publishedAt && <p className="text-[11px] text-gray-400">발행: {item.publishedAt.slice(0, 10)}</p>}

        <ContentMetricsEditor item={item} workspaceId={workspaceId} />
        <LikeCommentBlock resource="content" resId={item.id} members={members} />
        <div className="flex items-center justify-between pt-1">
          <button onClick={() => { if (confirm(`'${item.title}' 콘텐츠를 삭제할까요?`)) onDelete(); }}
            className="text-xs text-rose-400 hover:text-rose-600 px-2 py-1.5">삭제</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
            <button onClick={doSave} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 transition-all">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ContentItemsView({ workspace }: { workspace: Workspace }) {
  const [list, setList] = useState<ContentItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ title: string; platform: string; contentType: string }>({ title: '', platform: '', contentType: '' });
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [filter, setFilter] = useState<ContentStatus | 'all'>('all');
  const load = () => fetchContentItems(workspace.id).then(setList).catch(() => setList([]));
  useEffect(() => {
    load();
    fetchMembers(workspace.id).then(setMembers).catch(() => setMembers([]));
    fetchProducts(workspace.id, workspaceErpSource(workspace)).then(setProducts).catch(() => setProducts([]));
    /* eslint-disable-next-line */
  }, [workspace.id]);
  const fieldCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-foreground transition-colors';

  const save = async () => {
    if (!form.title.trim()) return;
    try {
      await addContentItem(workspace.id, { title: form.title.trim(), platform: form.platform || undefined, contentType: (form.contentType || undefined) as ContentType | undefined });
      setForm({ title: '', platform: '', contentType: '' }); setShowForm(false); load();
    } catch (e) { console.error('[ContentItemsView] 저장 실패:', e); alert('콘텐츠 저장에 실패했어요. 잠시 후 다시 시도해 주세요.'); }
  };

  const shown = filter === 'all' ? list : list.filter(c => c.status === filter);
  const chip = (id: ContentStatus | 'all', label: string) => (
    <button key={id} onClick={() => setFilter(id)}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${filter === id ? 'bg-foreground text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{label}</button>
  );

  return (
    <>
      <ViewHead eyebrow="CONTENT" title="콘텐츠" sub={`${list.length}건 · 아이디어→발행`} />

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {chip('all', '전체')}
        {CONTENT_STATUS_ORDER.map(s => chip(s, CONTENT_STATUS_LABEL[s]))}
        <button onClick={() => setShowForm(v => !v)}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-white hover:opacity-85 active:scale-95 transition-all">＋ 콘텐츠</button>
      </div>

      {showForm && (
        <Card className="p-4 mb-3 space-y-2.5">
          <input autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') save(); }} placeholder="콘텐츠 아이디어 제목" className={fieldCls} />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} className={fieldCls}>
              <option value="">플랫폼</option>
              {CONTENT_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.contentType} onChange={e => setForm({ ...form, contentType: e.target.value })} className={fieldCls}>
              <option value="">유형</option>
              {(Object.keys(CONTENT_TYPE_LABEL) as ContentType[]).map(t => <option key={t} value={t}>{CONTENT_TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setForm({ title: '', platform: '', contentType: '' }); }} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
            <button onClick={save} disabled={!form.title.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 disabled:opacity-40 transition-all">추가</button>
          </div>
        </Card>
      )}

      {shown.length === 0 ? (
        <EmptyState emoji="🎬" title="콘텐츠가 없어요" sub="＋ 콘텐츠로 아이디어를 등록하고 발행까지 관리하세요" />
      ) : (
        <div className="space-y-2">
          {shown.map(c => (
            <Card key={c.id} className="group p-4 flex items-center gap-2">
              <button onClick={() => setSelected(c)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <span className="text-sm font-semibold text-gray-800 truncate">{c.title}</span>
                {c.contentType && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">{CONTENT_TYPE_LABEL[c.contentType]}</span>}
                {c.platform && <span className="text-[10px] text-gray-400 flex-shrink-0">{c.platform}</span>}
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${CONTENT_STATUS_CLS[c.status]}`}>{CONTENT_STATUS_LABEL[c.status]}</span>
              </button>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <ContentEditPopup
          item={selected} products={products} workspaceId={workspace.id} members={members}
          onSave={async (fields) => { try { const wasPublished = selected.status === 'published'; const title = fields.title || selected.title; await updateContentItem(selected.id, fields); setSelected(null); load(); if (fields.status === 'published' && !wasPublished) { const actor = await getCurrentUserId().catch(() => null); const name = await getActorName(workspace.id, actor); notify({ type: 'notify_content', workspaceId: workspace.id, actorId: actor, title: '🎬 콘텐츠 발행', body: `${name} 님이 「${title}」을 발행했어요.`, tag: `content-${selected.id}` }); } } catch (e) { console.error('[Content] 수정 실패:', e); alert('콘텐츠 수정에 실패했어요. 잠시 후 다시 시도해 주세요.'); } }}
          onDelete={async () => { try { await deleteContentItem(selected.id); setSelected(null); load(); } catch (e) { console.error('[Content] 삭제 실패:', e); alert('콘텐츠 삭제에 실패했어요.'); } }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

/** ERP 데이터(제품·매출) 소스 안내 배너 — 시목앱=System of Record, AI Office=조회·분석 */
function ErpSourceBanner({ what, compat }: { what: string; compat: boolean }) {
  if (compat) {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
        <span className="text-sm leading-none">🔌</span>
        <span><b>임시 수기 입력 모드</b> — {what}은(는) 시목 앱이 원본(System of Record)이에요. 지금은 시목 API 연동 전이라 AI Office에 직접 입력합니다. <b>연동되면 자동으로 외부 데이터를 읽어</b> 조회·분석만 하게 돼요.</span>
      </div>
    );
  }
  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 flex items-start gap-2">
      <span className="text-sm leading-none">🔗</span>
      <span>시목 앱 연동 — {what} 데이터는 시목 앱(System of Record)에서 조회합니다. AI Office는 분석·판단만 하고 여기서 직접 수정하지 않아요.</span>
    </div>
  );
}

/* ───────── 제품 (조회·분석 · 임시 수기) ───────── */
const PRODUCT_STATUS: Record<Product['status'], { label: string; cls: string }> = {
  active: { label: '판매중', cls: 'bg-emerald-50 text-emerald-600' },
  draft: { label: '준비중', cls: 'bg-amber-50 text-amber-600' },
  discontinued: { label: '단종', cls: 'bg-gray-100 text-gray-400' },
};
const won = (n?: number) => (n == null ? '—' : `${n.toLocaleString()}원`);
const marginPct = (price?: number, cost?: number) =>
  price && cost != null && price > 0 ? `${Math.round((1 - cost / price) * 100)}%` : '—';

type ProductForm = { name: string; category: string; price: string; cost: string; stock: string; sku: string; status: Product['status']; description: string };
const emptyProductForm: ProductForm = { name: '', category: '', price: '', cost: '', stock: '', sku: '', status: 'active', description: '' };
const formToFields = (f: ProductForm): Partial<Product> => ({
  name: f.name.trim(), category: f.category.trim() || undefined, sku: f.sku.trim() || undefined,
  status: f.status, description: f.description.trim() || undefined,
  price: f.price ? Number(f.price) : undefined, cost: f.cost ? Number(f.cost) : undefined,
  stock: f.stock ? Number(f.stock) : undefined,
});

function ProductEditPopup({ product, onSave, onDelete, onClose }: {
  product: Product; onSave: (fields: Partial<Product>) => void; onDelete: () => void; onClose: () => void;
}) {
  const [f, setF] = useState<ProductForm>({
    name: product.name, category: product.category ?? '', price: product.price?.toString() ?? '',
    cost: product.cost?.toString() ?? '', stock: product.stock?.toString() ?? '', sku: product.sku ?? '',
    status: product.status, description: product.description ?? '',
  });
  const fieldCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-foreground transition-colors';
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overflow-y-auto" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-[460px] max-w-[92vw] max-h-[86vh] overflow-y-auto p-6 space-y-2.5" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-gray-800">제품 수정</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center">✕</button>
        </div>
        <input autoFocus value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="제품명" className={fieldCls} />
        <div className="grid grid-cols-2 gap-2">
          <input value={f.category} onChange={e => setF({ ...f, category: e.target.value })} placeholder="카테고리 (도마·가구…)" className={fieldCls} />
          <input value={f.sku} onChange={e => setF({ ...f, sku: e.target.value })} placeholder="상품코드(선택)" className={fieldCls} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input type="number" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} placeholder="판매가" className={fieldCls} />
          <input type="number" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} placeholder="원가" className={fieldCls} />
          <input type="number" value={f.stock} onChange={e => setF({ ...f, stock: e.target.value })} placeholder="재고" className={fieldCls} />
        </div>
        <select value={f.status} onChange={e => setF({ ...f, status: e.target.value as Product['status'] })} className={fieldCls}>
          <option value="active">판매중</option>
          <option value="draft">준비중</option>
          <option value="discontinued">단종</option>
        </select>
        <textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="설명(선택)" rows={2} className={fieldCls} />
        <div className="flex items-center justify-between pt-1">
          <button onClick={() => { if (confirm(`'${product.name}' 제품을 삭제할까요? 되돌릴 수 없어요.`)) onDelete(); }}
            className="text-xs text-rose-400 hover:text-rose-600 px-2 py-1.5">삭제</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
            <button onClick={() => onSave(formToFields(f))} disabled={!f.name.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 disabled:opacity-40 transition-all">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductsView({ workspace }: { workspace: Workspace }) {
  const erp = workspaceErpSource(workspace);
  const compat = isWsCompat(workspace);
  const [list, setList] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyProductForm);
  const [selected, setSelected] = useState<Product | null>(null);
  const load = () => fetchProducts(workspace.id, erp).then(setList).catch(() => setList([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspace.id]);
  const fieldCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-foreground transition-colors';

  const save = async () => {
    if (!form.name.trim()) return;
    try {
      await addProduct(workspace.id, formToFields(form), erp);
      setForm(emptyProductForm); setShowForm(false); load();
    } catch (e) { console.error('[ProductsView] 저장 실패:', e); alert('제품 저장에 실패했어요. 잠시 후 다시 시도해 주세요.'); }
  };

  return (
    <>
      <ViewHead eyebrow="PRODUCTS" title="제품" sub={`${list.length}개 · 조회·분석${compat ? ' · 임시 수기' : ''}`} />
      <ErpSourceBanner what="제품·재고" compat={compat} />
      {compat && (
        <div className="flex justify-end mb-3">
          <button onClick={() => setShowForm(v => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-white hover:opacity-85 active:scale-95 transition-all">＋ 제품 추가</button>
        </div>
      )}

      {showForm && compat && (
        <Card className="p-4 mb-3 space-y-2.5">
          <input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="제품명" className={fieldCls} />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="카테고리 (도마·가구…)" className={fieldCls} />
            <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="상품코드(선택)" className={fieldCls} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="판매가" className={fieldCls} />
            <input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="원가" className={fieldCls} />
            <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="재고" className={fieldCls} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setForm(emptyProductForm); }} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
            <button onClick={save} disabled={!form.name.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 disabled:opacity-40 transition-all">추가</button>
          </div>
        </Card>
      )}

      {list.length === 0 ? (
        <EmptyState emoji="📦" title="아직 제품이 없어요" sub="＋ 제품 추가로 판매가·원가·재고를 등록하세요" />
      ) : (
        <div className="space-y-2">
          {list.map(p => (
            <Card key={p.id} className="group p-4 flex items-center gap-3">
              <button onClick={() => { if (compat) setSelected(p); }} className={`flex items-center gap-3 flex-1 min-w-0 text-left ${compat ? '' : 'cursor-default'}`}>
                <span className="text-sm font-semibold text-gray-800 truncate">{p.name}</span>
                {p.category && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">{p.category}</span>}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${PRODUCT_STATUS[p.status].cls}`}>{PRODUCT_STATUS[p.status].label}</span>
                <span className="ml-auto text-xs text-gray-600 flex-shrink-0">{won(p.price)}</span>
                <span className="text-[11px] text-gray-400 flex-shrink-0 w-14 text-right">마진 {marginPct(p.price, p.cost)}</span>
                <span className="text-[11px] text-gray-400 flex-shrink-0 w-14 text-right">재고 {p.stock ?? '—'}</span>
              </button>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <ProductEditPopup
          product={selected}
          onSave={async (fields) => { try { await updateProduct(selected.id, fields, erp); setSelected(null); load(); } catch (e) { console.error('[Product] 수정 실패:', e); alert('제품 수정에 실패했어요. 잠시 후 다시 시도해 주세요.'); } }}
          onDelete={async () => { try { await deleteProduct(selected.id, erp); setSelected(null); load(); } catch (e) { console.error('[Product] 삭제 실패:', e); alert('제품 삭제에 실패했어요.'); } }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

/* ───────── 매출 (실데이터 · 채널×날짜 중심 테이블) ───────── */
// ⚠️ 이중 집계 방지: 채널 행만 입력받고 날짜 합계는 채널 행의 계산값으로만 만든다.
// 'total'(합계)은 UI 입력 옵션에서 제외 — 합계 행을 따로 저장하면 채널 합과 이중 집계됨.
const SALES_SOURCES: { v: string; label: string }[] = [
  { v: 'smartstore', label: '스마트스토어' }, { v: 'coupang', label: '쿠팡' }, { v: 'ohouse', label: '오늘의집' },
  { v: 'self', label: '자사몰' }, { v: 'instagram', label: '인스타' }, { v: 'other', label: '기타' },
];
const salesSourceLabel = (v: string) => SALES_SOURCES.find(s => s.v === v)?.label ?? v;
const wonShort = (n?: number) => (n == null ? '—' : `${n.toLocaleString()}원`);
const aov = (rev?: number, ord?: number) => (rev != null && ord && ord > 0 ? Math.round(rev / ord) : null);
const convRate = (ord?: number, vis?: number) => (ord != null && vis && vis > 0 ? `${((ord / vis) * 100).toFixed(1)}%` : '—');

type SalesForm = { date: string; source: string; revenue: string; orders: string; visitors: string; memo: string };
const salesFormToFields = (f: SalesForm) => ({
  date: f.date, source: f.source,
  revenue: f.revenue ? Number(f.revenue) : undefined,
  orders: f.orders ? Number(f.orders) : undefined,
  visitors: f.visitors ? Number(f.visitors) : undefined,
  memo: f.memo.trim() || undefined,
});

export function SalesDailyView({ workspace }: { workspace: Workspace }) {
  const erp = workspaceErpSource(workspace);
  const compat = isWsCompat(workspace);
  const [list, setList] = useState<SalesDaily[]>([]);
  const [showForm, setShowForm] = useState(false);
  const today = () => new Date().toISOString().slice(0, 10);
  const emptyForm = (): SalesForm => ({ date: today(), source: 'smartstore', revenue: '', orders: '', visitors: '', memo: '' });
  const [form, setForm] = useState<SalesForm>(emptyForm());
  const [editing, setEditing] = useState<SalesDaily | null>(null);
  const load = () => fetchSalesDaily(workspace.id, 90, erp).then(setList).catch(() => setList([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspace.id]);
  const fieldCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-foreground transition-colors';

  const save = async (f: SalesForm) => {
    if (!f.date) return;
    try {
      await saveSalesDaily(workspace.id, salesFormToFields(f), erp);
      setShowForm(false); setEditing(null); setForm(emptyForm()); load();
    } catch (e) { console.error('[SalesDailyView] 저장 실패:', e); alert('매출 저장에 실패했어요. 잠시 후 다시 시도해 주세요.'); }
  };
  const del = async (id: string) => { if (!confirm('이 매출 기록을 삭제할까요?')) return; await deleteSalesDaily(id, erp).catch(() => {}); setEditing(null); load(); };

  // 날짜별 그룹 (최신순)
  const byDate: { date: string; rows: SalesDaily[]; total: number }[] = [];
  list.forEach(r => {
    let g = byDate.find(x => x.date === r.date);
    if (!g) { g = { date: r.date, rows: [], total: 0 }; byDate.push(g); }
    g.rows.push(r);
    if (r.source !== 'total') g.total += r.revenue ?? 0;  // 'total' 행은 합계에서 제외(이중 집계 방지)
  });

  const formCard = (f: SalesForm, setF: (v: SalesForm) => void, onSubmit: () => void, onCancel: () => void, editMode: boolean) => (
    <Card className="p-4 mb-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} disabled={editMode} className={fieldCls} />
        <select value={f.source} onChange={e => setF({ ...f, source: e.target.value })} disabled={editMode} className={fieldCls}>
          {SALES_SOURCES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input type="number" value={f.revenue} onChange={e => setF({ ...f, revenue: e.target.value })} placeholder="매출액" className={fieldCls} />
        <input type="number" value={f.orders} onChange={e => setF({ ...f, orders: e.target.value })} placeholder="주문수" className={fieldCls} />
        <input type="number" value={f.visitors} onChange={e => setF({ ...f, visitors: e.target.value })} placeholder="방문자" className={fieldCls} />
      </div>
      <input value={f.memo} onChange={e => setF({ ...f, memo: e.target.value })} placeholder="메모(선택)" className={fieldCls} />
      <div className="flex items-center justify-between">
        {editMode && editing ? <button onClick={() => del(editing.id)} className="text-xs text-rose-400 hover:text-rose-600 px-2 py-1.5">삭제</button> : <span />}
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
          <button onClick={onSubmit} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 transition-all">{editMode ? '저장' : '추가'}</button>
        </div>
      </div>
      {editMode && <p className="text-[10px] text-gray-300">※ 날짜·채널은 키라서 수정 불가 — 바꾸려면 삭제 후 새로 추가.</p>}
    </Card>
  );

  return (
    <>
      <ViewHead eyebrow="SALES" title="매출" sub={`${list.length}건 · 채널×날짜 · 조회·분석${compat ? ' · 임시 수기' : ''}`} />
      <ErpSourceBanner what="매출·주문" compat={compat} />
      {compat && (
        <div className="flex justify-end mb-3">
          <button onClick={() => { setEditing(null); setForm(emptyForm()); setShowForm(v => !v); }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground text-white hover:opacity-85 active:scale-95 transition-all">＋ 매출 입력</button>
        </div>
      )}

      {showForm && !editing && compat && formCard(form, setForm, () => save(form), () => { setShowForm(false); setForm(emptyForm()); }, false)}

      {byDate.length === 0 ? (
        <EmptyState emoji="💰" title="매출 기록이 없어요" sub="＋ 매출 입력으로 채널별 일 매출을 기록하세요" />
      ) : (
        <div className="space-y-4">
          {byDate.map(g => (
            <div key={g.date}>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-xs font-bold text-gray-500">{g.date}</span>
                <span className="text-xs font-semibold text-gray-700">합계 {wonShort(g.total)}</span>
              </div>
              <div className="space-y-2">
                {g.rows.map(r => (
                  <div key={r.id}>
                    <Card className="p-3.5">
                      <button onClick={() => { if (!compat) return; setEditing(r); setForm({ date: r.date, source: r.source, revenue: r.revenue?.toString() ?? '', orders: r.orders?.toString() ?? '', visitors: r.visitors?.toString() ?? '', memo: r.memo ?? '' }); }}
                        className="w-full flex items-center gap-3 text-left">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">{r.sourceLabel ?? salesSourceLabel(r.source)}</span>
                        <span className="text-sm font-semibold text-gray-800 flex-shrink-0">{wonShort(r.revenue)}</span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">주문 {r.orders ?? '—'}</span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">객단가 {r.ordersBasis === 'voucher' ? '—' : (aov(r.revenue, r.orders) != null ? `${aov(r.revenue, r.orders)!.toLocaleString()}원` : '—')}</span>
                        <span className="ml-auto text-[11px] text-gray-400 flex-shrink-0">전환 {convRate(r.orders, r.visitors)}</span>
                      </button>
                    </Card>
                    {editing?.id === r.id && compat && formCard(form, setForm, () => save(form), () => { setEditing(null); setForm(emptyForm()); }, true)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ───────── 회사 기억 (실데이터 · 30초 입력·검색) ───────── */
const MEMORY_KINDS: { v: MemoryKind; label: string }[] = [
  { v: 'ceo_memo', label: '📝 대표메모' }, { v: 'idea', label: '💡 아이디어' }, { v: 'insight', label: '✨ 깨달음' },
  { v: 'philosophy', label: '🌿 철학' }, { v: 'failure', label: '⚠️ 실패' }, { v: 'experiment', label: '🧪 실험' },
  { v: 'reference', label: '🔖 레퍼런스' }, { v: 'competitor', label: '🎯 경쟁사' },
];
const memoryKindLabel = (k?: MemoryKind) => MEMORY_KINDS.find(x => x.v === k)?.label ?? '메모';
const SALIENCE_LEVELS = [{ v: 25, label: '낮음' }, { v: 50, label: '보통' }, { v: 80, label: '높음' }];
const salienceLabel = (n?: number) => (n == null ? '보통' : n >= 70 ? '높음' : n >= 40 ? '보통' : '낮음');

function MemoryDetailPopup({ item, onSave, onArchive, onDelete, onClose }: {
  item: CompanyMemory; onSave: (f: Partial<CompanyMemory>) => void; onArchive: () => void; onDelete: () => void; onClose: () => void;
}) {
  const [f, setF] = useState({
    title: item.title, body: item.body ?? '', kind: (item.kind ?? 'ceo_memo') as MemoryKind,
    tags: (item.tags ?? []).join(', '), salience: item.salience ?? 50, pinned: item.pinned ?? false,
  });
  const fieldCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-foreground transition-colors';
  const submit = () => onSave({
    title: f.title.trim() || item.title, body: f.body.trim() || undefined, kind: f.kind,
    tags: f.tags ? f.tags.split(',').map(t => t.trim()).filter(Boolean) : [], salience: f.salience, pinned: f.pinned,
  });
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overflow-y-auto" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-[480px] max-w-[94vw] max-h-[88vh] overflow-y-auto p-6 space-y-2.5" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-gray-800">회사 기억</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center">✕</button>
        </div>
        <input autoFocus value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="제목" className={fieldCls} />
        <textarea value={f.body} onChange={e => setF({ ...f, body: e.target.value })} placeholder="내용" rows={5} className={fieldCls} />
        <div className="grid grid-cols-2 gap-2">
          <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value as MemoryKind })} className={fieldCls}>
            {MEMORY_KINDS.map(k => <option key={k.v} value={k.v}>{k.label}</option>)}
          </select>
          <select value={f.salience} onChange={e => setF({ ...f, salience: Number(e.target.value) })} className={fieldCls}>
            {SALIENCE_LEVELS.map(s => <option key={s.v} value={s.v}>중요도 · {s.label}</option>)}
          </select>
        </div>
        <input value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} placeholder="태그 (쉼표로)" className={fieldCls} />
        <label className="flex items-center gap-2 text-sm text-gray-600 px-1">
          <input type="checkbox" checked={f.pinned} onChange={e => setF({ ...f, pinned: e.target.checked })} /> 📌 고정(항상 상단)
        </label>
        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-2">
            <button onClick={() => { if (confirm('이 기억을 삭제할까요?')) onDelete(); }} className="text-xs text-rose-400 hover:text-rose-600 px-2 py-1.5">삭제</button>
            <button onClick={onArchive} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">{item.status === 'archived' ? '복원' : '보관'}</button>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
            <button onClick={submit} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 transition-all">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CompanyMemoryView({ workspace }: { workspace: Workspace }) {
  const [list, setList] = useState<CompanyMemory[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', kind: 'ceo_memo' as MemoryKind, tags: '', salience: 50, pinned: false });
  const [selected, setSelected] = useState<CompanyMemory | null>(null);
  const [kindFilter, setKindFilter] = useState<MemoryKind | 'all'>('all');
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const load = () => fetchMemories(workspace.id).then(setList).catch(() => setList([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspace.id]);
  const fieldCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-foreground transition-colors';

  const save = async () => {
    if (!form.title.trim()) return;
    try {
      await addMemory(workspace.id, {
        title: form.title.trim(), body: form.body.trim() || undefined, kind: form.kind,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [], salience: form.salience, pinned: form.pinned,
      });
      setForm({ title: '', body: '', kind: 'ceo_memo', tags: '', salience: 50, pinned: false }); setShowForm(false); load();
    } catch (e) { console.error('[CompanyMemoryView] 저장 실패:', e); alert('기억 저장에 실패했어요. 잠시 후 다시 시도해 주세요.'); }
  };

  const kw = q.trim().toLowerCase();
  const shown = list.filter(m => (showArchived ? m.status === 'archived' : m.status !== 'archived'))
    .filter(m => kindFilter === 'all' || m.kind === kindFilter)
    .filter(m => !kw || m.title.toLowerCase().includes(kw) || (m.body ?? '').toLowerCase().includes(kw) || (m.tags ?? []).some(t => t.toLowerCase().includes(kw)));

  const chip = (id: MemoryKind | 'all', label: string) => (
    <button key={id} onClick={() => setKindFilter(id)}
      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${kindFilter === id ? 'bg-foreground text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{label}</button>
  );

  return (
    <>
      <ViewHead eyebrow="MEMORY" title="회사 기억" sub={`${list.filter(m => m.status !== 'archived').length}개`} />

      <div className="flex items-center gap-2 mb-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 제목·내용·태그 검색" className={`${fieldCls} flex-1`} />
        <button onClick={() => setShowForm(v => !v)}
          className="px-3 py-2 rounded-lg text-xs font-medium bg-foreground text-white hover:opacity-85 active:scale-95 transition-all whitespace-nowrap">＋ 기억</button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {chip('all', '전체')}
        {MEMORY_KINDS.map(k => chip(k.v, k.label))}
        <button onClick={() => setShowArchived(v => !v)}
          className={`ml-auto px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${showArchived ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>보관함</button>
      </div>

      {showForm && (
        <Card className="p-4 mb-3 space-y-2.5">
          <input autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="무엇을 기억할까요? (제목)" className={fieldCls} />
          <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="내용 (선택)" rows={3} className={fieldCls} />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as MemoryKind })} className={fieldCls}>
              {MEMORY_KINDS.map(k => <option key={k.v} value={k.v}>{k.label}</option>)}
            </select>
            <select value={form.salience} onChange={e => setForm({ ...form, salience: Number(e.target.value) })} className={fieldCls}>
              {SALIENCE_LEVELS.map(s => <option key={s.v} value={s.v}>중요도 · {s.label}</option>)}
            </select>
          </div>
          <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="태그 (쉼표로, 선택)" className={fieldCls} />
          <label className="flex items-center gap-2 text-sm text-gray-600 px-1">
            <input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} /> 📌 고정
          </label>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setForm({ title: '', body: '', kind: 'ceo_memo', tags: '', salience: 50, pinned: false }); }} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
            <button onClick={save} disabled={!form.title.trim()} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 disabled:opacity-40 transition-all">추가</button>
          </div>
        </Card>
      )}

      {shown.length === 0 ? (
        <EmptyState emoji="🧠" title={showArchived ? '보관된 기억이 없어요' : '기억이 없어요'} sub="＋ 기억으로 아이디어·깨달음·실패·철학을 남기세요" />
      ) : (
        <div className="space-y-2">
          {shown.map(m => (
            <Card key={m.id} className="p-4">
              <button onClick={() => setSelected(m)} className="w-full text-left">
                <div className="flex items-center gap-2 mb-1">
                  {m.pinned && <span className="text-[11px]">📌</span>}
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">{memoryKindLabel(m.kind)}</span>
                  <span className="text-sm font-semibold text-gray-800 truncate">{m.title}</span>
                  <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">중요도 {salienceLabel(m.salience)}</span>
                </div>
                {(m.summary || m.body) && <p className="text-xs text-gray-500 line-clamp-2">{m.summary || m.body}</p>}
                {m.tags && m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {m.tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-muted text-foreground">#{t}</span>)}
                  </div>
                )}
              </button>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <MemoryDetailPopup
          item={selected}
          onSave={async (f) => { try { await updateMemory(selected.id, f); setSelected(null); load(); } catch (e) { console.error('[Memory] 수정 실패:', e); alert('기억 수정에 실패했어요. 잠시 후 다시 시도해 주세요.'); } }}
          onArchive={async () => { try { await updateMemory(selected.id, { status: selected.status === 'archived' ? 'active' : 'archived' }); setSelected(null); load(); } catch (e) { console.error('[Memory] 보관 실패:', e); alert('처리에 실패했어요.'); } }}
          onDelete={async () => { try { await deleteMemory(selected.id); setSelected(null); load(); } catch (e) { console.error('[Memory] 삭제 실패:', e); alert('기억 삭제에 실패했어요.'); } }}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

/* ───────── 멤버 (실데이터) ───────── */
/** 팀 진행률 보드 — 담당자별 진행률 + 미지정 행 (가이드 §11.7). tasks=워크스페이스 전체. */
function TeamProgressBoard({ tasks, members, memberLabel, onOpen }: {
  tasks: TaskItem[]; members: WorkspaceMember[]; memberLabel: (m: WorkspaceMember) => string; onOpen: (m: WorkspaceMember) => void;
}) {
  const today = getTodayStr();
  const overall = progressOf(tasks, today);
  if (overall.total === 0) return null;
  const byAssignee = progressBy(tasks, t => t.assigneeId, today);
  const unassigned = progressOf(tasks.filter(t => !t.assigneeId), today);
  const rows = members
    .map(m => ({ m, p: byAssignee.get(m.userId) }))
    .filter((r): r is { m: WorkspaceMember; p: ReturnType<typeof progressOf> } => !!r.p && r.p.total > 0)
    .sort((a, b) => (a.p.done / a.p.total) - (b.p.done / b.p.total) || (b.p.overdue - a.p.overdue));
  return (
    <Card className="p-4 mb-3 space-y-3">
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">팀 진행률</span>
      <TaskProgress label="전체" done={overall.done} total={overall.total} overdue={overall.overdue} />
      <div className="divide-y divide-gray-100">
        {rows.map(({ m, p }) => (
          <button key={m.userId} onClick={() => onOpen(m)} className="w-full text-left py-2 hover:bg-gray-50 -mx-1 px-1 rounded-lg transition-colors">
            <TaskProgress compact label={memberLabel(m)} done={p.done} total={p.total} overdue={p.overdue} />
          </button>
        ))}
        {unassigned.total > 0 && (
          <div className="py-2"><TaskProgress compact label="담당자 미지정" done={unassigned.done} total={unassigned.total} overdue={unassigned.overdue} /></div>
        )}
      </div>
    </Card>
  );
}

/** 멤버 상세 — 그 멤버의 담당 할일 + 진행률 (가이드 §10.9) */
function MemberDetailView({ member, label, tasks, onBack }: {
  member: WorkspaceMember; label: string; tasks: TaskItem[]; onBack: () => void;
}) {
  const today = getTodayStr();
  const mine = tasks.filter(t => t.assigneeId === member.userId);
  const open = mine.filter(t => t.status !== 'completed');
  const p = progressOf(mine, today);
  return (
    <>
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600 mb-3">← 멤버</button>
      <div className="rounded-[20px] bg-surface-muted/50 border border-line p-5 mb-4">
        <div className="text-lg font-extrabold text-gray-800">{label}</div>
        <div className="text-sm text-gray-500 mt-0.5">담당 할일 {open.length}건 진행 중</div>
        {p.total > 0 && <div className="mt-3"><TaskProgress done={p.done} total={p.total} overdue={p.overdue} /></div>}
      </div>
      <Card className="p-3">
        {open.length === 0 ? <p className="text-xs text-gray-300 py-4 text-center">진행 중인 담당 할일이 없어요</p> : (
          <div className="space-y-1.5">
            {open.map(t => {
              const overdue = t.date ? (daysUntil(t.date) ?? 0) < 0 : false;
              return (
                <div key={t.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50">
                  <PriorityDot p={t.priority} />
                  <span className="text-sm text-gray-700 flex-1 truncate">{t.title}</span>
                  <span className={`text-[10px] flex-shrink-0 ${overdue ? 'text-rose-500' : 'text-gray-400'}`}>{dueLabel(t.date)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}

/* ───────── 팀 활동 피드 (workspace_activities · 마이그 041) ───────── */
const ACTIVITY_META: Record<string, { emoji: string; verb: (title: string) => string }> = {
  completed_task: { emoji: '✅', verb: t => `「${t}」을 완료했어요` },
  created_meeting: { emoji: '📋', verb: t => `「${t}」 회의를 만들었어요` },
  created_task: { emoji: '📝', verb: t => `「${t}」 할일을 추가했어요` },
};
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return iso.slice(0, 10);
}
export function ActivityFeedView({ workspace }: { workspace: Workspace }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetchActivities(workspace.id, 80).then(setItems).catch(() => setItems([])).finally(() => setLoaded(true));
    fetchMembers(workspace.id).then(setMembers).catch(() => setMembers([]));
  }, [workspace.id]);
  const actorName = (uid?: string) => { if (!uid) return '누군가'; const m = members.find(x => x.userId === uid); return m?.nickname || m?.name || '멤버'; };
  return (
    <>
      <ViewHead eyebrow="ACTIVITY" title="팀 활동" sub={`최근 ${items.length}건`} />
      {items.length === 0 ? (
        <EmptyState emoji="📣" title={loaded ? '아직 팀 활동이 없어요' : '불러오는 중…'} sub="할일 완료·회의 생성 같은 팀 활동이 여기 쌓여요" />
      ) : (
        <Card className="p-3">
          <div className="divide-y divide-gray-100">
            {items.map(a => {
              const meta = ACTIVITY_META[a.action];
              const title = (a.metadata?.title as string) || '';
              return (
                <div key={a.id} className="flex items-center gap-2.5 py-2.5">
                  <span className="text-base flex-shrink-0">{meta?.emoji ?? '•'}</span>
                  <span className="text-sm text-gray-600 flex-1 min-w-0 truncate">
                    <b className="text-gray-800">{actorName(a.actorId)}</b> 님이 {meta ? meta.verb(title) : a.action}
                  </span>
                  <span className="text-[11px] text-gray-300 flex-shrink-0">{relTime(a.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}

export function MembersView({ workspace }: { workspace: Workspace }) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [wsTasks, setWsTasks] = useState<TaskItem[]>([]);
  const [detailMember, setDetailMember] = useState<WorkspaceMember | null>(null);
  const [myId, setMyId] = useState('');
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nickVal, setNickVal] = useState('');
  const [savingNick, setSavingNick] = useState(false);
  const load = () => fetchMembers(workspace.id).then(m => { setMembers(m); setLoaded(true); }).catch(() => { setMembers([]); setLoaded(true); });
  useEffect(() => {
    load();
    getCurrentUserId().then(setMyId).catch(() => {});
    fetchWorkspaceTasks(workspace.id).then(rows => setWsTasks(rows.map(rowToTaskItem))).catch(() => setWsTasks([]));
    /* eslint-disable-next-line */
  }, [workspace.id]);

  const memberLabel = (m: WorkspaceMember) => (m.nickname || m.name || `멤버 ${m.userId.slice(0, 4)}`) + (m.userId === myId ? ' (나)' : '');
  const iAmOwner = members.find(m => m.userId === myId)?.role === 'owner';

  if (detailMember) {
    return <MemberDetailView member={detailMember} label={memberLabel(detailMember)} tasks={wsTasks} onBack={() => setDetailMember(null)} />;
  }
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
  const startEdit = (m: WorkspaceMember) => { setEditingId(m.userId); setNickVal(m.nickname || ''); };
  const saveNick = async (uid: string) => {
    if (savingNick) return;
    setSavingNick(true);
    try { await updateMemberNickname(workspace.id, uid, nickVal); setEditingId(null); await load(); }
    catch (e) { console.error('[MembersView] 닉네임 저장 실패:', e); alert('닉네임 저장에 실패했어요.'); }
    finally { setSavingNick(false); }
  };

  return (
    <>
      <ViewHead eyebrow="MEMBERS" title="멤버" sub={`멤버 ${members.length}명`} />
      {/* 초대 코드 (오피스만) */}
      {workspace.type === 'office' && workspace.inviteCode && (
        <Card className="p-4 mb-3 space-y-2">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wide">초대 코드</div>
          <div className="flex items-center gap-2">
            <code className="text-lg font-bold text-foreground tracking-[0.2em] bg-surface-muted px-3 py-1.5 rounded-xl flex-1 text-center">{workspace.inviteCode}</code>
            <button onClick={copyCode}
              className="text-xs px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all flex-shrink-0">{copied ? '복사됨 ✓' : '복사'}</button>
          </div>
          <p className="text-[11px] text-gray-400">이 코드를 멤버에게 공유하세요. 멤버는 왼쪽 위 <b>워크스페이스 메뉴 → 🔑 코드로 합류</b>에서 이 코드를 입력하면 합류돼요.</p>
        </Card>
      )}
      {/* 팀 진행률 보드 — 담당자별 + 미지정 */}
      <TeamProgressBoard tasks={wsTasks} members={members} memberLabel={memberLabel} onOpen={setDetailMember} />
      <Card className="p-3">
        {members.map(m => {
          const canEditNick = m.userId === myId || iAmOwner;
          const editing = editingId === m.userId;
          return (
          <div key={m.userId} className="flex items-center gap-2.5 p-3 rounded-2xl hover:bg-gray-50 transition-colors">
            <span className="w-9 h-9 rounded-full bg-foreground text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {(m.nickname || m.userId).slice(0, 1).toUpperCase()}
            </span>
            {editing ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <input autoFocus value={nickVal} onChange={e => setNickVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveNick(m.userId); if (e.key === 'Escape') setEditingId(null); }}
                  placeholder="표시할 닉네임" maxLength={20}
                  className="flex-1 min-w-0 px-2.5 py-1 rounded-lg border border-line text-sm focus:outline-none focus:border-foreground" />
                <button onClick={() => saveNick(m.userId)} disabled={savingNick} className="text-[11px] px-2 py-1 rounded-lg bg-foreground text-white font-medium disabled:opacity-50 flex-shrink-0">저장</button>
                <button onClick={() => setEditingId(null)} className="text-[11px] px-1.5 py-1 rounded-lg text-gray-400 hover:bg-gray-100 flex-shrink-0">취소</button>
              </div>
            ) : (
              <>
                <span className="text-sm font-medium text-gray-700 flex-1 min-w-0 truncate">
                  {m.nickname || <span className="text-gray-400 italic">닉네임 없음</span>}{m.userId === myId && ' (나)'}
                </span>
                {canEditNick && (
                  <button onClick={() => startEdit(m)} title="닉네임 수정" className="text-gray-300 hover:text-foreground text-sm flex-shrink-0">✏️</button>
                )}
              </>
            )}
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">{m.role === 'owner' ? '오너' : '멤버'}</span>
            {!editing && (
              <button onClick={() => setDetailMember(m)} className="text-[11px] text-gray-400 hover:text-foreground flex-shrink-0">담당 할일 ›</button>
            )}
            {iAmOwner && m.userId !== myId && !editing && (
              <>
                <button onClick={() => toggleRole(m)} className="text-[11px] text-gray-400 hover:text-foreground flex-shrink-0">{m.role === 'owner' ? '멤버로' : '오너로'}</button>
                <button onClick={() => kick(m.userId)} className="text-[11px] text-rose-400 hover:text-rose-600 flex-shrink-0">내보내기</button>
              </>
            )}
          </div>
          );
        })}
        {members.length === 0 && <p className="text-xs text-gray-300 py-4 text-center">{loaded ? '멤버를 불러오지 못했어요 · 새로고침해 주세요' : '불러오는 중…'}</p>}
      </Card>
    </>
  );
}

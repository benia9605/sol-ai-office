/**
 * @file src/components/office/OfficeShell.tsx
 * @description 회사 오피스 셸
 * - 좌측 아이콘 레일: 상단 프로필(클릭 → 워크스페이스 전환 메뉴) + 브랜드명 + 8메뉴
 * - 헤더: 사업 정보
 * - 본문: 뷰 전환
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Workspace, ActiveWorkspace } from '../../types';
import { useWorkspaceContext } from '../../contexts/WorkspaceContext';
import { WorkspaceCreateModal } from '../WorkspaceCreateModal';
import {
  DashboardView, BriefingView, TodosView, ScheduleView,
  InsightsView, LogView, ActivityView, ActivityFeedView, MembersView, ProductsView, ContentItemsView, SalesDailyView, CompanyMemoryView, TaskDetailView,
} from './views';
import { StaffView } from './StaffView';
import { NotificationBell } from './NotificationBell';
import { NavIcon } from './NavIcons';
import { MeetingsView } from './MeetingsView';
import { CompanySettingsView } from './CompanySettingsView';
import { MeView } from './MeView';
import { ContentPage } from '../../pages/ContentPage';
import { fetchCredits, fetchUsage } from '../../services/credits.service';
import { fetchStaff } from '../../services/staff.service';
import { StaffUsage } from '../../types';
import { createPortal } from 'react-dom';

type ViewId = 'dashboard' | 'briefing' | 'staff' | 'todos' | 'schedule' | 'meetings' | 'insights' | 'contents' | 'content' | 'products' | 'sales' | 'memory' | 'log' | 'activity' | 'teamlog' | 'members' | 'brand' | 'company' | 'me';

type NavItem = { id: ViewId; label: string; emoji: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

/** 상단바 단일 소스 — 5그룹(홈·운영·콘텐츠·비즈니스·팀). 그룹 클릭 시 하위 항목 드롭다운. */
const NAV_GROUPS: NavGroup[] = [
  { id: 'home', label: '홈', items: [
    { id: 'dashboard', label: '대시보드', emoji: '📊' },
    { id: 'briefing', label: '오늘의 브리핑', emoji: '☀️' },
  ] },
  { id: 'ops', label: '운영', items: [
    { id: 'todos', label: '할일', emoji: '✅' },
    { id: 'schedule', label: '일정', emoji: '📅' },
    { id: 'meetings', label: '회의', emoji: '📋' },
  ] },
  { id: 'content', label: '콘텐츠', items: [
    { id: 'insights', label: '인사이트', emoji: '📈' },
    { id: 'contents', label: '콘텐츠', emoji: '🎬' },
    { id: 'content', label: '유튜브', emoji: '▶️' },
    { id: 'memory', label: '기억', emoji: '🧠' },
    { id: 'log', label: '기록', emoji: '📝' },
  ] },
  { id: 'biz', label: '비즈니스', items: [
    { id: 'products', label: '제품', emoji: '📦' },
    { id: 'sales', label: '매출', emoji: '💰' },
  ] },
  { id: 'team', label: '팀', items: [
    { id: 'staff', label: 'AI 직원', emoji: '🤖' },
    { id: 'activity', label: '활동 로그', emoji: '🧾' },
    { id: 'teamlog', label: '팀 활동', emoji: '📣' },
  ] },
];
const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items);
const groupOf = (v: ViewId) => NAV_GROUPS.find(g => g.items.some(it => it.id === v))?.id ?? null;
// URL 첫 세그먼트가 유효한 view인지 판별용 (모르는 경로는 dashboard로 폴백)
const KNOWN_VIEWS = new Set<ViewId>([
  'dashboard', 'briefing', 'staff', 'todos', 'schedule', 'meetings', 'insights',
  'contents', 'content', 'products', 'sales', 'memory', 'log', 'activity',
  'teamlog', 'members', 'company', 'me',
]);

/** 코인 사용 내역(요금) 모달 */
/** 코인 SVG 아이콘 (동전) */
function CoinIcon({ className = 'w-[18px] h-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 9.3c-.5-.9-1.6-1.3-2.8-1.3-1.7 0-2.8.8-2.8 2 0 2.7 5.6 1.3 5.6 4 0 1.2-1.1 2-2.8 2-1.2 0-2.3-.4-2.8-1.3" />
      <path d="M12 6.6v10.8" />
    </svg>
  );
}

function UsageModal({ workspace, credits, onClose }: { workspace: Workspace; credits: number | null; onClose: () => void }) {
  const [usage, setUsage] = useState<StaffUsage[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});
  useEffect(() => {
    fetchUsage(workspace.id).then(setUsage).catch(() => setUsage([]));
    fetchStaff(workspace.id).then(ss => setStaffMap(Object.fromEntries(ss.map(s => [s.id, s.name])))).catch(() => {});
  }, [workspace.id]);
  const totalCoins = usage.reduce((a, u) => a + (u.coins || 0), 0);
  const usd = (c: number) => `$${(c / 1000).toFixed(3)}`;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="bg-white rounded-[28px] shadow-2xl w-[460px] max-w-[92vw] max-h-[80vh] flex flex-col p-6" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-extrabold text-gray-800">🪙 코인 사용 내역</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center">✕</button>
        </div>
        <div className="rounded-2xl bg-surface-muted p-3 mb-3 flex items-center justify-between">
          <div><div className="text-[11px] text-gray-400">남은 코인</div><div className="text-xl font-bold text-foreground">{credits != null ? credits.toLocaleString() : '—'}</div></div>
          <div className="text-right"><div className="text-[11px] text-gray-400">최근 사용</div><div className="text-sm font-semibold text-gray-600">{totalCoins.toLocaleString()}코인 · {usd(totalCoins)}</div></div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {usage.length === 0 ? (
            <p className="text-xs text-gray-300 py-8 text-center">아직 사용 내역이 없어요</p>
          ) : usage.map(u => (
            <div key={u.id} className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-gray-50">
              <span className="text-xs font-medium text-gray-700 flex-1 truncate">{u.staffId && staffMap[u.staffId] ? staffMap[u.staffId] : '직원'} <span className="text-gray-400">· {u.model || '—'}</span></span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">{(u.inputTokens + u.outputTokens).toLocaleString()}t</span>
              <span className="text-xs font-semibold text-amber-500 flex-shrink-0 w-16 text-right">-{u.coins}코인</span>
              <span className="text-[10px] text-gray-300 flex-shrink-0 w-16 text-right">{u.createdAt?.slice(5, 10)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function OfficeShell({ workspace }: { workspace: Workspace }) {
  // ── URL ↔ view 동기화 (가이드 00 원칙 1: 팝업이 아니라 페이지) ──
  // 경로 첫 세그먼트 = view (예: /todos), 둘째 = 상세 id (예: /todos/abc, Phase 2+에서 사용).
  const navigate = useNavigate();
  const location = useLocation();
  const seg = location.pathname.split('/').filter(Boolean);
  const rawView = (seg[0] || 'dashboard') as ViewId;
  const view: ViewId = KNOWN_VIEWS.has(rawView) ? rawView : 'dashboard';
  const detailId = seg[1];  // 상세 화면 id (예: /todos/abc)
  const setView = (v: ViewId) => navigate('/' + (v === 'dashboard' ? '' : v));

  const [todosScope, setTodosScope] = useState<'all' | 'mine' | 'assigned'>('all'); // 할일 딥링크용 탭
  const [staffKey, setStaffKey] = useState(0); // 🤖 직원 아이콘 누를 때마다 목록(홈)으로 리셋
  const [openGroup, setOpenGroup] = useState<string | null>(null); // 상단바 메가메뉴
  const navRef = useRef<HTMLDivElement>(null);
  const onNavigate = (v: string, opts?: { scope?: 'all' | 'mine' | 'assigned' }) => {
    if (opts?.scope) setTodosScope(opts.scope);
    setView(v as ViewId); setOpenGroup(null);
  };
  const goNav = (id: ViewId) => { if (id === 'staff') setStaffKey(k => k + 1); setView(id); setOpenGroup(null); setMoreOpen(false); };

  // ── 코인 잔액 ──
  const [credits, setCredits] = useState<number | null>(null);
  const [coinPulse, setCoinPulse] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  useEffect(() => { fetchCredits(workspace.id).then(setCredits).catch(() => {}); }, [workspace.id]);
  const refreshCredits = async () => {
    const c = await fetchCredits(workspace.id).catch(() => null);
    if (c != null) { setCredits(c); setCoinPulse(true); setTimeout(() => setCoinPulse(false), 900); }
  };

  const { personal, offices, setActiveWorkspace, reload } = useWorkspaceContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);   // 모바일 더보기 시트
  const menuRef = useRef<HTMLDivElement>(null);

  // 모바일 하단 네비 주요 항목 (나머지는 더보기)
  const BOTTOM_NAV = ['dashboard', 'todos', 'schedule', 'staff']
    .map(id => NAV_ITEMS.find(n => n.id === id)!)
    .filter(Boolean);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  // 상단바 메가메뉴 — 바깥클릭 / ESC 로 닫힘
  useEffect(() => {
    if (!openGroup) return;
    const onPointer = (e: PointerEvent) => { if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenGroup(null); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [openGroup]);

  // 라우트가 바뀌면 열린 메뉴(메가메뉴·더보기·워크스페이스)를 닫는다 (뒤로가기 포함)
  useEffect(() => { setOpenGroup(null); setMoreOpen(false); setMenuOpen(false); }, [location.pathname]);

  const pick = (id: ActiveWorkspace) => { navigate('/'); setActiveWorkspace(id); setMenuOpen(false); setMoreOpen(false); };

  const Row = ({ ws }: { ws: Workspace }) => (
    <button onClick={() => pick(ws.id)}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-gray-100 transition-colors text-left">
      {ws.imageUrl ? <img src={ws.imageUrl} alt={ws.name} className="w-5 h-5 rounded object-cover" /> : <span className="text-base">{ws.emoji || '🏢'}</span>}
      <span className={ws.id === workspace.id ? 'font-semibold text-gray-800' : 'text-gray-600'}>{ws.name}</span>
      {ws.id === workspace.id && <span className="ml-auto text-foreground text-xs">✓</span>}
    </button>
  );

  return (
    <div className="office-shell h-[100dvh] overflow-hidden flex flex-col bg-gray-50 text-gray-800">
      {/* 상단바 */}
      <header ref={navRef} className="relative flex-shrink-0 bg-white border-b border-gray-100 z-30 pt-[env(safe-area-inset-top)]">
        <div className="h-14 flex items-center gap-2 px-4 sm:px-6">
          {/* 브랜드 = 워크스페이스 (PC: 전환 드롭다운 / 모바일: 더보기) */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button onClick={() => setMenuOpen(o => !o)} className="hidden lg:flex items-center gap-2 pr-2 active:scale-95 transition-transform" title="워크스페이스 전환">
              <span className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center text-lg flex-shrink-0">
                {workspace.imageUrl ? <img src={workspace.imageUrl} alt={workspace.name} className="w-full h-full object-cover rounded-xl" /> : <span>{workspace.emoji || '🏢'}</span>}
              </span>
              <span className="text-sm font-bold text-gray-800 truncate max-w-[120px]">{workspace.name}</span>
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
            </button>
            <button onClick={() => setMoreOpen(true)} className="lg:hidden flex items-center gap-1.5 min-w-0 active:scale-95 transition-transform">
              <span className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center text-lg flex-shrink-0">
                {workspace.imageUrl ? <img src={workspace.imageUrl} alt={workspace.name} className="w-full h-full object-cover rounded-lg" /> : <span>{workspace.emoji || '🏢'}</span>}
              </span>
              <span className="text-sm font-bold text-gray-800 truncate">{workspace.name}</span>
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
            </button>

            {menuOpen && (
              <div className="absolute left-0 top-[52px] w-56 bg-white rounded-2xl shadow-lg border border-gray-100 p-1.5 z-50">
                {offices.length > 0 && (
                  <>
                    <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">오피스</p>
                    {offices.map(o => <Row key={o.id} ws={o} />)}
                  </>
                )}
                {personal && (
                  <>
                    <div className="my-1 border-t border-gray-100" />
                    <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">개인 공간</p>
                    <Row ws={personal} />
                  </>
                )}
                <div className="my-1 border-t border-gray-100" />
                <button onClick={() => { setMenuOpen(false); setView('company'); setOpenGroup(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors text-left">
                  <span className="text-base leading-none">⚙️</span> 회사 설정 (정보·브레인·멤버)
                </button>
                <button onClick={() => { setMenuOpen(false); setShowCreate(true); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors text-left">
                  <span className="text-base leading-none">＋</span> 추가하기
                </button>
              </div>
            )}
          </div>

          {/* PC 그룹 네비 */}
          <nav className="hidden lg:flex items-center gap-0.5 text-sm ml-1">
            {NAV_GROUPS.map(g => {
              const active = groupOf(view) === g.id;
              const open = openGroup === g.id;
              return (
                <button key={g.id} type="button" onClick={() => setOpenGroup(open ? null : g.id)} aria-expanded={open}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${active || open ? 'text-gray-800 font-semibold' : 'text-gray-400 hover:text-gray-700'}`}>
                  {g.label}
                </button>
              );
            })}
            <button type="button" onClick={() => { setView('me'); setOpenGroup(null); }} title="나 — 프로필 · 내 할일"
              className={`px-2.5 py-1.5 rounded-lg transition-colors ${view === 'me' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle">
                <path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <button type="button" onClick={() => { setView('company'); setOpenGroup(null); }} title="회사 설정 — 정보 · 브레인 · 멤버"
              className={`px-2.5 py-1.5 rounded-lg transition-colors ${view === 'company' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-700'}`}>⚙️</button>
          </nav>

          <div className="flex-1" />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setShowUsage(true)} title="코인 잔액 — 클릭하면 사용 내역(요금)"
              className={`flex items-center gap-1 text-sm font-bold transition-all duration-300 hover:opacity-70 active:scale-95 ${coinPulse ? 'scale-110 text-amber-500' : 'text-gray-500'}`}>
              <CoinIcon /><span>{credits != null ? credits.toLocaleString() : '—'}</span>
            </button>
            <NotificationBell workspace={workspace} onNavigate={onNavigate} />
          </div>
        </div>

        {/* PC 메가메뉴 드롭다운 — 클릭한 그룹의 항목 */}
        {openGroup && (
          <div className="hidden lg:block absolute left-0 right-0 top-full bg-white border-b border-gray-100 shadow-sm z-20">
            <div className="px-4 sm:px-6 py-3 flex flex-wrap gap-1">
              {NAV_GROUPS.find(g => g.id === openGroup)!.items.map(it => {
                const on = view === it.id;
                return (
                  <button key={it.id} type="button" onClick={() => goNav(it.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${on ? 'bg-surface-muted text-foreground' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <NavIcon id={it.id} size={16} className={on ? 'text-foreground' : 'text-gray-400'} />
                    <span>{it.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* 본문 */}
      <main className="flex-1 overflow-y-auto px-5 sm:px-10 py-8 sm:py-12 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-12">
        <div className="max-w-5xl mx-auto">
          {view === 'dashboard' && <DashboardView onNavigate={onNavigate} workspace={workspace} />}
          {view === 'briefing' && <BriefingView workspace={workspace} />}
          {view === 'staff' && <StaffView key={staffKey} workspace={workspace} onRan={refreshCredits} />}
          {view === 'todos' && (detailId
            ? <TaskDetailView workspace={workspace} taskId={detailId} onBack={() => setView('todos')} />
            : <TodosView workspace={workspace} onNavigate={onNavigate} initialScope={todosScope} />)}
          {view === 'schedule' && <ScheduleView workspace={workspace} />}
          {view === 'meetings' && <MeetingsView workspace={workspace} />}
          {view === 'insights' && <InsightsView workspace={workspace} />}
          {view === 'contents' && <ContentItemsView workspace={workspace} />}
          {view === 'content' && <ContentPage embedded workspaceId={workspace.id} />}
          {view === 'products' && <ProductsView workspace={workspace} />}
          {view === 'sales' && <SalesDailyView workspace={workspace} />}
          {view === 'memory' && <CompanyMemoryView workspace={workspace} />}
          {view === 'log' && <LogView workspace={workspace} />}
          {view === 'activity' && <ActivityView workspace={workspace} />}
          {view === 'teamlog' && <ActivityFeedView workspace={workspace} />}
          {view === 'members' && <MembersView workspace={workspace} />}
          {view === 'company' && <CompanySettingsView workspace={workspace} onSaved={reload} />}
          {view === 'me' && <MeView workspace={workspace} onNavigate={onNavigate} />}
        </div>
      </main>

      {/* 모바일 하단 네비 */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 flex items-stretch min-h-16 pt-1 pb-[max(env(safe-area-inset-bottom),0.25rem)]">
        {BOTTOM_NAV.map(n => {
          const on = view === n.id;
          return (
            <button key={n.id} onClick={() => goNav(n.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${on ? 'text-foreground' : 'text-gray-400'}`}>
              <NavIcon id={n.id} size={21} className={on ? 'text-foreground' : 'text-gray-400'} />
              <span className="text-[10px] font-medium">{n.label}</span>
            </button>
          );
        })}
        <button onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-gray-400">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          <span className="text-[10px] font-medium">더보기</span>
        </button>
      </nav>

      {/* 모바일 더보기 시트 */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] flex flex-col justify-end" onMouseDown={() => setMoreOpen(false)}>
          <div className="bg-white rounded-t-[28px] max-h-[85vh] overflow-y-auto p-5 pb-8 animate-slide-up" onMouseDown={e => e.stopPropagation()}>
            {/* 워크스페이스 헤더 */}
            <div className="flex items-center gap-2.5 mb-4">
              <span className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-2xl flex-shrink-0">
                {workspace.imageUrl ? <img src={workspace.imageUrl} alt={workspace.name} className="w-full h-full object-cover rounded-xl" /> : <span>{workspace.emoji || '🏢'}</span>}
              </span>
              <span className="text-base font-extrabold text-gray-800 flex-1 truncate">{workspace.name}</span>
              <button onClick={() => { setMoreOpen(false); setView('company'); }}
                className="text-xs px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all">⚙️ 회사 설정</button>
            </div>

            {/* 전체 메뉴 — 그룹별 */}
            <div className="space-y-4 mb-5">
              {NAV_GROUPS.map(g => (
                <div key={g.id}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{g.label}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {g.items.map(n => {
                      const on = view === n.id;
                      return (
                        <button key={n.id} onClick={() => goNav(n.id)}
                          className={`flex flex-col items-center gap-1 py-3 rounded-2xl transition-colors ${on ? 'bg-surface-muted text-foreground' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                          <NavIcon id={n.id} size={22} className={on ? 'text-foreground' : 'text-gray-500'} />
                          <span className="text-[11px] font-medium">{n.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">설정</p>
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => { setView('me'); setMoreOpen(false); }}
                    className={`flex flex-col items-center gap-1 py-3 rounded-2xl transition-colors ${view === 'me' ? 'bg-surface-muted text-foreground' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                    <NavIcon id="me" size={22} className={view === 'me' ? 'text-foreground' : 'text-gray-500'} />
                    <span className="text-[11px] font-medium">나</span>
                  </button>
                  <button onClick={() => { setView('company'); setMoreOpen(false); }}
                    className={`flex flex-col items-center gap-1 py-3 rounded-2xl transition-colors ${view === 'company' ? 'bg-surface-muted text-foreground' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                    <NavIcon id="company" size={22} className={view === 'company' ? 'text-foreground' : 'text-gray-500'} />
                    <span className="text-[11px] font-medium">회사 설정</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 워크스페이스 전환 */}
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">워크스페이스 전환</p>
            <div className="space-y-1">
              {offices.map(o => <Row key={o.id} ws={o} />)}
              {personal && <Row ws={personal} />}
              <button onClick={() => { setMoreOpen(false); setShowCreate(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors text-left">
                <span className="text-base leading-none">＋</span> 추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      <WorkspaceCreateModal open={showCreate} onClose={() => setShowCreate(false)}
        onCreated={async (ws) => { await reload(); setActiveWorkspace(ws.id); }} />
      {showUsage && <UsageModal workspace={workspace} credits={credits} onClose={() => setShowUsage(false)} />}
    </div>
  );
}

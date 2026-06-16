/**
 * @file src/components/office/OfficeShell.tsx
 * @description 회사 오피스 셸
 * - 좌측 아이콘 레일: 상단 프로필(클릭 → 워크스페이스 전환 메뉴) + 브랜드명 + 8메뉴
 * - 헤더: 사업 정보
 * - 본문: 뷰 전환
 */
import { useState, useRef, useEffect } from 'react';
import { Workspace, ActiveWorkspace } from '../../types';
import { useWorkspaceContext } from '../../contexts/WorkspaceContext';
import { WorkspaceCreateModal } from '../WorkspaceCreateModal';
import {
  DashboardView, BriefingView, TodosView, ScheduleView,
  InsightsView, LogView, ActivityView, MembersView,
} from './views';
import { StaffView } from './StaffView';
import { BrandView } from './BrandView';
import { ContentPage } from '../../pages/ContentPage';
import { fetchCredits, fetchUsage } from '../../services/credits.service';
import { fetchStaff } from '../../services/staff.service';
import { StaffUsage } from '../../types';
import { createPortal } from 'react-dom';

type ViewId = 'dashboard' | 'briefing' | 'staff' | 'todos' | 'schedule' | 'insights' | 'content' | 'log' | 'activity' | 'members' | 'brand';

const NAV: { id: ViewId; label: string; emoji: string }[] = [
  { id: 'dashboard', label: '대시보드', emoji: '📊' },
  { id: 'briefing', label: '오늘의 브리핑', emoji: '☀️' },
  { id: 'staff', label: 'AI 직원', emoji: '🤖' },
  { id: 'todos', label: '할일', emoji: '✅' },
  { id: 'schedule', label: '일정', emoji: '📅' },
  { id: 'insights', label: '인사이트', emoji: '📈' },
  { id: 'content', label: '콘텐츠', emoji: '🎬' },
  { id: 'log', label: '기록', emoji: '📝' },
  { id: 'activity', label: '활동 로그', emoji: '🧾' },
  { id: 'members', label: '멤버', emoji: '👥' },
];

/** 코인 사용 내역(요금) 모달 */
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
        <div className="rounded-2xl bg-primary-50 p-3 mb-3 flex items-center justify-between">
          <div><div className="text-[11px] text-gray-400">남은 코인</div><div className="text-xl font-bold text-primary-600">{credits != null ? credits.toLocaleString() : '—'}</div></div>
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
  const [view, setView] = useState<ViewId>('dashboard');
  const [staffKey, setStaffKey] = useState(0); // 🤖 직원 아이콘 누를 때마다 목록(홈)으로 리셋
  const onNavigate = (v: string) => setView(v as ViewId);
  const goNav = (id: ViewId) => { if (id === 'staff') setStaffKey(k => k + 1); setView(id); };

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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const pick = (id: ActiveWorkspace) => { setActiveWorkspace(id); setMenuOpen(false); };

  const Row = ({ ws }: { ws: Workspace }) => (
    <button onClick={() => pick(ws.id)}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-gray-100 transition-colors text-left">
      {ws.imageUrl ? <img src={ws.imageUrl} alt={ws.name} className="w-5 h-5 rounded object-cover" /> : <span className="text-base">{ws.emoji || '🏢'}</span>}
      <span className={ws.id === workspace.id ? 'font-semibold text-gray-800' : 'text-gray-600'}>{ws.name}</span>
      {ws.id === workspace.id && <span className="ml-auto text-primary-500 text-xs">✓</span>}
    </button>
  );

  return (
    <div className="office-shell h-screen flex bg-gray-50 text-gray-800">
      {/* 좌측 아이콘 레일 */}
      <aside className="w-[76px] flex-shrink-0 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-1">
        {/* 프로필 = 워크스페이스 전환 토글 */}
        <div className="relative mb-3" ref={menuRef}>
          <button onClick={() => setMenuOpen(o => !o)} className="flex flex-col items-center gap-1 active:scale-95 transition-transform" title="워크스페이스 전환">
            <span className="w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center text-2xl">
              {workspace.imageUrl
                ? <img src={workspace.imageUrl} alt={workspace.name} className="w-full h-full object-cover rounded-2xl" />
                : <span>{workspace.emoji || '🏢'}</span>}
            </span>
            <span className="text-[10px] font-semibold text-gray-600 leading-tight text-center max-w-[60px] truncate">{workspace.name}</span>
          </button>

          {menuOpen && (
            <div className="absolute left-[60px] top-0 w-56 bg-white rounded-2xl shadow-lg border border-gray-100 p-1.5 z-50">
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
              <button onClick={() => { setMenuOpen(false); setShowCreate(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors text-left">
                <span className="text-base leading-none">＋</span> 추가하기
              </button>
            </div>
          )}
        </div>

        {NAV.map(n => {
          const on = view === n.id;
          return (
            <button key={n.id} onClick={() => goNav(n.id)} title={n.label}
              className={`relative w-11 h-11 rounded-2xl flex items-center justify-center text-lg transition-all active:scale-90
                ${on ? 'bg-primary-100 text-primary-800 shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}>
              <span className={on ? '' : 'grayscale opacity-80'}>{n.emoji}</span>
            </button>
          );
        })}
        <div className="flex-1" />
        <button title="회사 브레인 · 설정" onClick={() => setView('brand')}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-90
            ${view === 'brand' ? 'bg-primary-100 text-primary-800 shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}>⚙️</button>
      </aside>

      {/* 메인 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex-shrink-0 bg-white border-b border-gray-100 flex items-center justify-between px-5">
          <span className="text-sm text-gray-400 truncate max-w-[55%]">{workspace.bizInfo || ''}</span>
          <button onClick={() => setShowUsage(true)} title="코인 잔액 — 클릭하면 사용 내역(요금)"
            className={`flex items-center gap-1.5 text-sm font-bold transition-all duration-300 flex-shrink-0 hover:opacity-70 active:scale-95 ${coinPulse ? 'scale-125 text-amber-500' : 'text-gray-500'}`}>
            <span>🪙</span><span>{credits != null ? credits.toLocaleString() : '—'}</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {view === 'dashboard' && <DashboardView onNavigate={onNavigate} />}
            {view === 'briefing' && <BriefingView workspace={workspace} />}
            {view === 'staff' && <StaffView key={staffKey} workspace={workspace} onRan={refreshCredits} />}
            {view === 'todos' && <TodosView />}
            {view === 'schedule' && <ScheduleView workspace={workspace} />}
            {view === 'insights' && <InsightsView workspace={workspace} />}
            {view === 'content' && <ContentPage embedded workspaceId={workspace.id} />}
            {view === 'log' && <LogView workspace={workspace} />}
            {view === 'activity' && <ActivityView workspace={workspace} />}
            {view === 'members' && <MembersView workspace={workspace} />}
            {view === 'brand' && <BrandView workspace={workspace} />}
          </div>
        </main>
      </div>

      <WorkspaceCreateModal open={showCreate} onClose={() => setShowCreate(false)}
        onCreated={async (ws) => { await reload(); setActiveWorkspace(ws.id); }} />
      {showUsage && <UsageModal workspace={workspace} credits={credits} onClose={() => setShowUsage(false)} />}
    </div>
  );
}

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
  InsightsView, LogView, MembersView,
} from './views';
import { StaffView } from './StaffView';
import { BrandView } from './BrandView';
import { ContentPage } from '../../pages/ContentPage';
import { fetchCredits } from '../../services/credits.service';

type ViewId = 'dashboard' | 'briefing' | 'staff' | 'todos' | 'schedule' | 'insights' | 'content' | 'log' | 'members' | 'brand';

const NAV: { id: ViewId; label: string; emoji: string }[] = [
  { id: 'dashboard', label: '대시보드', emoji: '📊' },
  { id: 'briefing', label: '오늘의 브리핑', emoji: '☀️' },
  { id: 'staff', label: 'AI 직원', emoji: '🤖' },
  { id: 'todos', label: '할일', emoji: '✅' },
  { id: 'schedule', label: '일정', emoji: '📅' },
  { id: 'insights', label: '인사이트', emoji: '📈' },
  { id: 'content', label: '콘텐츠', emoji: '🎬' },
  { id: 'log', label: '기록', emoji: '🧾' },
  { id: 'members', label: '멤버', emoji: '👥' },
];

export function OfficeShell({ workspace }: { workspace: Workspace }) {
  const [view, setView] = useState<ViewId>('dashboard');
  const [staffKey, setStaffKey] = useState(0); // 🤖 직원 아이콘 누를 때마다 목록(홈)으로 리셋
  const onNavigate = (v: string) => setView(v as ViewId);
  const goNav = (id: ViewId) => { if (id === 'staff') setStaffKey(k => k + 1); setView(id); };

  // ── 코인 잔액 ──
  const [credits, setCredits] = useState<number | null>(null);
  const [coinPulse, setCoinPulse] = useState(false);
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
          <div title="코인 잔액 — 직원이 일할 때마다 토큰 비용만큼 차감"
            className={`flex items-center gap-1.5 text-sm font-bold transition-all duration-300 ${coinPulse ? 'scale-125 text-amber-500' : 'text-gray-500'}`}>
            <span>🪙</span><span>{credits != null ? credits.toLocaleString() : '—'}</span>
          </div>
          {workspace.bizInfo && <span className="text-sm text-gray-400 truncate max-w-[50%]">{workspace.bizInfo}</span>}
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {view === 'dashboard' && <DashboardView onNavigate={onNavigate} />}
            {view === 'briefing' && <BriefingView workspace={workspace} />}
            {view === 'staff' && <StaffView key={staffKey} workspace={workspace} onRan={refreshCredits} />}
            {view === 'todos' && <TodosView />}
            {view === 'schedule' && <ScheduleView workspace={workspace} />}
            {view === 'insights' && <InsightsView workspace={workspace} />}
            {view === 'content' && <ContentPage embedded />}
            {view === 'log' && <LogView workspace={workspace} />}
            {view === 'members' && <MembersView workspace={workspace} />}
            {view === 'brand' && <BrandView workspace={workspace} />}
          </div>
        </main>
      </div>

      <WorkspaceCreateModal open={showCreate} onClose={() => setShowCreate(false)}
        onCreated={async (ws) => { await reload(); setActiveWorkspace(ws.id); }} />
    </div>
  );
}

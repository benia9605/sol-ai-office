/**
 * @file src/brand/BrandShell.tsx
 * @description 브랜드 오피스 기본 템플릿 셸 - 모든 오피스 워크스페이스가 같이 쓴다 (마이그 065)
 *
 * 대표 결정 (2026-10-27):
 *   · 시목 · 쏠닝포인트 · 운명랩이 같은 템플릿. 다른 것은 워크스페이스의 브랜드 값뿐
 *     (이름 · 로고 · 한 줄 소개 · 배경 컬러 · 포인트 컬러 · 대표 이미지 / 글자)
 *   · 기존 Teamie 화면(OfficeShell)은 백업 - 설정 → 「Teamie 기존 화면」 으로만 들어간다
 *   · 데이터는 본부(sol-hq)가 매일 09:00 hq_ingest 로 넣는다 - 각 앱이 직접 보내지 않는다
 * 화면 규격 · 시안: sol-hq/할일/AI오피스-개편-시안.html
 *
 * 주소: /w/:workspaceId/:view/:detailId?  (view = today · briefing · tasks · content · research · insights · meetings · metrics · library · mail · budget · settings)
 * 본부(개인) 오피스 (hq_brand_key 'hq' · 076): 01 오늘 · 02 브리핑 · 03 할 일 · 10 메일 · 11 가계부(준비 중)
 * 폰: 위 헤더(☰ · 로고 · 날짜) 고정, ☰ 로 사이드바. 판이 열리면 뒤는 고정, 판 안만 스크롤.
 */
import { CSSProperties, Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Workspace, WorkspaceMember } from '../types';
import { useWorkspaceContext } from '../contexts/WorkspaceContext';
import { WorkspaceLauncher } from '../components/WorkspaceLauncher';
import { WorkspaceCreateModal } from '../components/WorkspaceCreateModal';
import { fetchMembers } from '../services/workspaces.service';
import { getCurrentUserId } from '../services/auth';
import { todayKst, fmtDay } from './hq.service';
import '../simok/simok.css';
import './brand.css';

import { TodayView } from './views/TodayView';
import { BriefingView } from './views/BriefingView';
import { TasksView } from './views/TasksView';
import { ContentView } from './views/ContentView';
import { ResearchView } from './views/ResearchView';
import { MetricsView } from './views/MetricsView';
import { LibraryView } from './views/LibraryView';
import { SettingsView } from './views/SettingsView';
import { MeetingsView } from './views/MeetingsView';
import { InsightsView } from './views/InsightsView';
import { MailView, BudgetSoon } from './views/MailView';
import { NoticePanel, useNotices } from './views/NoticePanel';
import { RefreshCtx } from './ui';

export type BrandView = 'today' | 'briefing' | 'tasks' | 'content' | 'research' | 'insights' | 'meetings' | 'metrics' | 'library' | 'mail' | 'budget' | 'settings';

const NAV: [string, [BrandView, string, string][]][] = [
  ['매일', [['today', '01', '오늘'], ['briefing', '02', '브리핑'], ['tasks', '03', '할 일']]],
  ['제작', [['content', '04', '콘텐츠'], ['research', '05', '리서치'], ['insights', '06', '인사이트']]],
  ['기록', [['meetings', '07', '회의'], ['metrics', '08', '실적 · 유입'], ['library', '09', '자료실']]],
  ['소통', [['mail', '10', '메일']]],
];
// 본부(개인) 오피스 - hq_brand_key 'hq' (076 · 메일 · 가계부 자리)
const NAV_HQ: [string, [BrandView, string, string][]][] = [
  ['매일', [['today', '01', '오늘'], ['briefing', '02', '브리핑'], ['tasks', '03', '할 일']]],
  ['소통', [['mail', '10', '메일']]],
  ['돈', [['budget', '11', '가계부 · 준비 중']]],
];
// 사이드바 아래 세 줄 아이콘 - 같은 크기 SVG (2026-10-31)
const svg = (d: string) => <svg className="n-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const IC = {
  bell: svg('M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0'),
  gear: svg('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'),
  swap: svg('M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16'),
};
const VIEWS = new Set<string>(['today', 'briefing', 'tasks', 'content', 'research', 'insights', 'meetings', 'metrics', 'library', 'mail', 'budget', 'settings']);

/** 브랜드 값 - 비어 있으면 워크스페이스 이름 · 기본 색으로 */
export interface BrandLook { logo: string; sub: string; motto: string; paper: string; point: string; heroImage?: string; heroWord?: string; custom: boolean }
export function brandLook(ws: Workspace): BrandLook {
  const paper = ws.brandPaper || '#f4f2eb';
  const point = ws.brandPoint || '#1f4035';
  return {
    logo: ws.brandLogo || ws.name, sub: ws.brandSub || 'THE PRIVATE OFFICE', motto: ws.brandMotto || ws.bizInfo || '',
    paper, point, heroImage: ws.brandHeroImage || undefined, heroWord: ws.brandHeroWord || ws.brandLogo || ws.name,
    // 시목 원래 색이면 simok.css 의 손으로 맞춘 값을 그대로 쓴다. 다르면 두 색에서 계산
    custom: !(paper.toLowerCase() === '#f4f2eb' && point.toLowerCase() === '#1f4035'),
  };
}

export interface BrandViewProps {
  workspace: Workspace;
  look: BrandLook;
  members: WorkspaceMember[];
  myId: string;
  detailId?: string;
  go: (view: BrandView, detailId?: string) => void;
  onBackupShell: () => void;
}

export function BrandShell({ workspace, onBackupShell }: { workspace: Workspace; onBackupShell: () => void }) {
  const navigate = useNavigate();
  const params = useParams();
  const { personal, offices, setActiveWorkspace, reload } = useWorkspaceContext();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [myId, setMyId] = useState('');
  const look = useMemo(() => brandLook(workspace), [workspace]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const notices = useNotices(workspace.id);

  const raw = params.view ?? 'today';
  const view = (VIEWS.has(raw) ? raw : 'today') as BrandView;
  const detailId = params.detailId;
  const go = (v: BrandView, id?: string) => { setNavOpen(false); navigate(`/w/${workspace.id}/${v}${id ? `/${id}` : ''}`); };

  useEffect(() => { if (!VIEWS.has(raw)) navigate(`/w/${workspace.id}/today`, { replace: true }); }, [raw, workspace.id, navigate]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [view]);
  useEffect(() => {
    fetchMembers(workspace.id).then(setMembers).catch(() => setMembers([]));
    getCurrentUserId().then(setMyId).catch(() => {});
  }, [workspace.id]);
  useEffect(() => { document.title = `${look.logo} · 오피스`; }, [look.logo]);

  const style = { '--paper': look.paper, '--green': look.point } as CSSProperties;
  const props: BrandViewProps = { workspace, look, members, myId, detailId, go, onBackupShell };
  const isSettings = view === 'settings';
  // 새로고침 - 지금 화면을 다시 띄운다 (그 화면이 Supabase 에서 새로 받는다 · 알림도) · ui.tsx RefreshBtn
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(async () => { setRefreshKey((k) => k + 1); notices.reload(); await new Promise((r) => setTimeout(r, 450)); }, [notices]);

  return (
    <div className={`simok-office simok-shell brand-office${navOpen ? ' nav-open' : ''}`} data-theme={look.custom ? 'custom' : undefined} style={style}>
      <aside className="simok-sidebar">
        <div className="simok-brand">
          <div className={`simok-logo${look.logo.length > 5 ? ' long' : ''}`}>{look.logo}</div>
          <div className="simok-logo-sub">{look.sub}</div>
        </div>
        <div className="simok-ws-label">WORKSPACE / {workspace.name}</div>
        <nav className="simok-nav" aria-label="오피스 메뉴">
          {(workspace.hqBrandKey === 'hq' ? NAV_HQ : NAV).map(([g, items]) => (
            <div key={g}>
              <div className="n-grp">{g}</div>
              {items.map(([k, n, l]) => (
                <button key={k} type="button" onClick={() => go(k)} aria-current={k === view ? 'page' : undefined}>
                  <span className="nav-num">{n}</span>{l}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="simok-side-bottom">
          <div className="n-me">{workspace.imageUrl ? <img src={workspace.imageUrl} alt="" className="simok-avatar n-avimg" /> : <span className="simok-avatar">{look.logo[0]}</span>}<div>{workspace.name}<br /><span style={{ color: 'var(--muted)' }}>{look.motto}</span></div></div>
          <button type="button" className="n-set" onClick={() => { setNavOpen(false); setNoticeOpen(true); }}>{IC.bell}알림{notices.unread > 0 && <span className="n-cnt">{notices.unread}</span>}</button>
          <button type="button" className={`n-set${isSettings ? ' on' : ''}`} onClick={() => go('settings')}>{IC.gear}설정</button>
          <button type="button" className="n-set" onClick={() => setLauncherOpen(true)}>{IC.swap}워크스페이스 전환</button>
        </div>
      </aside>

      <div className="n-top">
        <button type="button" className="n-burger" aria-label="메뉴 열기" onClick={() => setNavOpen(true)}><i /><i /><i /></button>
        <div className="simok-logo">{look.logo}</div>
        <small>{fmtDay(todayKst())}</small>
        <button type="button" className="n-bell" aria-label={`알림${notices.unread ? ` ${notices.unread}개` : ''}`} onClick={() => setNoticeOpen(true)}>🔔{notices.unread > 0 && <span className="n-cnt">{notices.unread}</span>}</button>
      </div>
      {navOpen && <div className="n-navdim" onClick={() => setNavOpen(false)} />}

      <main className="simok-main" id="brand-main">
        <div className="simok-main-inner">
          <RefreshCtx.Provider value={refresh}><Fragment key={refreshKey}>
          {view === 'today' && <TodayView {...props} />}
          {view === 'briefing' && <BriefingView {...props} />}
          {view === 'tasks' && <TasksView {...props} />}
          {view === 'content' && <ContentView {...props} />}
          {view === 'research' && <ResearchView {...props} />}
          {view === 'insights' && <InsightsView {...props} />}
          {view === 'meetings' && <MeetingsView {...props} />}
          {view === 'metrics' && <MetricsView {...props} />}
          {view === 'library' && <LibraryView {...props} />}
          {view === 'mail' && <MailView {...props} />}
          {view === 'budget' && <BudgetSoon />}
          {view === 'settings' && <SettingsView {...props} onOpenLauncher={() => setLauncherOpen(true)} />}
          </Fragment></RefreshCtx.Provider>
        </div>
      </main>

      {noticeOpen && <NoticePanel ws={workspace.id} items={notices.items} reload={notices.reload} onClose={() => setNoticeOpen(false)} />}

      <WorkspaceLauncher
        open={launcherOpen}
        personal={personal}
        offices={offices}
        activeId={workspace.id}
        onPick={(id) => { setActiveWorkspace(id); navigate(`/w/${id}/today`); }}
        onClose={() => setLauncherOpen(false)}
        // 예전에는 navigate('/') 만 해서 활성 워크스페이스(시목)로 되돌아갔다 - 만들기 팝업을 여기서 연다 (2026-10-31)
        onCreate={() => { setLauncherOpen(false); setCreateOpen(true); }}
      />
      <WorkspaceCreateModal open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={async (ws) => { setCreateOpen(false); await reload(); setActiveWorkspace(ws.id); navigate(`/w/${ws.id}/today`); }} />
    </div>
  );
}

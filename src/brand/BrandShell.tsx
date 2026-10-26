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
 * 주소: /w/:workspaceId/:view/:detailId?  (view = today · briefing · tasks · content · research · metrics · library · settings)
 * 폰: 위 헤더(☰ · 로고 · 날짜) 고정, ☰ 로 사이드바. 판이 열리면 뒤는 고정, 판 안만 스크롤.
 */
import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Workspace, WorkspaceMember } from '../types';
import { useWorkspaceContext } from '../contexts/WorkspaceContext';
import { WorkspaceLauncher } from '../components/WorkspaceLauncher';
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

export type BrandView = 'today' | 'briefing' | 'tasks' | 'content' | 'research' | 'metrics' | 'library' | 'settings';

const NAV: [string, [BrandView, string, string][]][] = [
  ['매일', [['today', '01', '오늘'], ['briefing', '02', '브리핑'], ['tasks', '03', '할 일']]],
  ['제작', [['content', '04', '콘텐츠'], ['research', '05', '리서치']]],
  ['기록', [['metrics', '06', '실적 · 유입'], ['library', '07', '자료실']]],
];
const VIEWS = new Set<string>(['today', 'briefing', 'tasks', 'content', 'research', 'metrics', 'library', 'settings']);

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
  const [navOpen, setNavOpen] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [myId, setMyId] = useState('');
  const look = useMemo(() => brandLook(workspace), [workspace]);

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

  return (
    <div className={`simok-office simok-shell brand-office${navOpen ? ' nav-open' : ''}`} data-theme={look.custom ? 'custom' : undefined} style={style}>
      <aside className="simok-sidebar">
        <div className="simok-brand">
          <div className={`simok-logo${look.logo.length > 5 ? ' long' : ''}`}>{look.logo}</div>
          <div className="simok-logo-sub">{look.sub}</div>
        </div>
        <div className="simok-ws-label">WORKSPACE / {workspace.name}</div>
        <nav className="simok-nav" aria-label="오피스 메뉴">
          {NAV.map(([g, items]) => (
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
          <div className="n-me"><span className="simok-avatar">{look.logo[0]}</span><div>{workspace.name}<br /><span style={{ color: 'var(--muted)' }}>{look.motto}</span></div></div>
          <button type="button" className={`n-set${isSettings ? ' on' : ''}`} onClick={() => go('settings')}>⚙ 설정</button>
          <button type="button" className="n-set" onClick={() => setLauncherOpen(true)}>⇄ 워크스페이스 전환</button>
        </div>
      </aside>

      <div className="n-top">
        <button type="button" className="n-burger" aria-label="메뉴 열기" onClick={() => setNavOpen(true)}><i /><i /><i /></button>
        <div className="simok-logo">{look.logo}</div>
        <small>{fmtDay(todayKst())}</small>
      </div>
      {navOpen && <div className="n-navdim" onClick={() => setNavOpen(false)} />}

      <main className="simok-main" id="brand-main">
        <div className="simok-main-inner">
          {view === 'today' && <TodayView {...props} />}
          {view === 'briefing' && <BriefingView {...props} />}
          {view === 'tasks' && <TasksView {...props} />}
          {view === 'content' && <ContentView {...props} />}
          {view === 'research' && <ResearchView {...props} />}
          {view === 'metrics' && <MetricsView {...props} />}
          {view === 'library' && <LibraryView {...props} />}
          {view === 'settings' && <SettingsView {...props} onOpenLauncher={() => setLauncherOpen(true)} />}
        </div>
      </main>

      <WorkspaceLauncher
        open={launcherOpen}
        personal={personal}
        offices={offices}
        activeId={workspace.id}
        onPick={(id) => { setActiveWorkspace(id); navigate(`/w/${id}/today`); }}
        onClose={() => setLauncherOpen(false)}
        onCreate={() => { setLauncherOpen(false); reload(); navigate('/'); }}
      />
    </div>
  );
}

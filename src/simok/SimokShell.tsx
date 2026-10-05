/**
 * @file src/simok/SimokShell.tsx
 * @description 시목 전용 Office 셸 — 좌측 브랜드 내비 + 8개 화면
 *
 * 기준: 11_SIMOK_OFFICE_BUILD_PACK.md (DESIGN-O1~O4), preview/design-manifest.json v1.7,
 *       06_UI_SPEC.md, 08_ROLES_AND_HANDOFFS.md
 *
 * ★ 설계 원칙
 *  - 기존 로그인·workspace context·membership·저장 service 를 **그대로 재사용**한다.
 *  - 전용 셸 선택은 **신뢰되는 DB 설정**(`workspaces.office_shell = 'simok'`, 마이그 062)으로 한다.
 *    표시 이름 '시목' 문자열이나 클라이언트가 바꿀 수 있는 값으로 분기하지 않는다(BUILD_PACK §2).
 *    ⚠️ UI 분기와 **서버 권한은 별개**다. 이 셸이 떠도 데이터 접근은 서버 RLS·가드가 결정한다.
 *  - CSS 는 `.simok-office` 아래로 격리한다. 전역 테마(user_profiles.active_theme)를 바꾸지 않는다.
 *  - 다른 workspace 로 나가면 기존 OfficeShell/개인 화면이 복원된다.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Workspace } from '../types';
import { useWorkspaceContext } from '../contexts/WorkspaceContext';
import { WorkspaceLauncher } from '../components/WorkspaceLauncher';
import './simok.css';

import { SimokToday } from './views/SimokToday';
import { SimokReports } from './views/SimokReports';
import { SimokStudio } from './views/SimokStudio';
import { SimokTraffic } from './views/SimokTraffic';
import { SimokConnections } from './views/SimokConnections';
import { SimokWorkflow } from './views/SimokWorkflow';
import { SimokTaste } from './views/SimokTaste';
import { SimokArchive } from './views/SimokArchive';

/** design-manifest.json 의 nav_key 와 1:1 */
export type SimokView =
  | 'today' | 'reports' | 'tastes' | 'studio' | 'archive' | 'workflow' | 'traffic' | 'connections';

interface NavEntry { key: SimokView; num: string; label: string }

/** 8개 메뉴 — 과거 PNG 의 6개가 아니라 index.html 기준 (BUILD_PACK §1) */
export const SIMOK_NAV: NavEntry[] = [
  { key: 'today', num: '01', label: '오늘의 시목' },
  { key: 'reports', num: '02', label: '브리핑 · 보고서' },
  { key: 'tastes', num: '03', label: '취향 지도' },
  { key: 'studio', num: '04', label: '콘텐츠 제작실' },
  { key: 'archive', num: '05', label: '우리의 아카이브' },
  { key: 'workflow', num: '06', label: '역할 · 업무 지도' },
  { key: 'traffic', num: '07', label: '방문 · 유입' },
  { key: 'connections', num: '08', label: '연결 상태' },
];

const VIEW_KEYS = new Set<string>(SIMOK_NAV.map(n => n.key));

export interface SimokViewProps {
  workspace: Workspace;
  /** 상세 id (예: /w/:id/reports/:detailId) */
  detailId?: string;
  go: (view: SimokView, detailId?: string) => void;
}

export function SimokShell({ workspace, onSwitchShell }: { workspace: Workspace; onSwitchShell?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const { personal, offices, setActiveWorkspace, reload } = useWorkspaceContext();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // URL: /w/:workspaceId/:view/:detailId?
  const rawView = (params.view ?? 'today') as SimokView;
  const view: SimokView = VIEW_KEYS.has(rawView) ? rawView : 'today';
  const detailId = params.detailId;

  const go = (v: SimokView, id?: string) => {
    navigate(`/w/${workspace.id}/${v}${id ? `/${id}` : ''}`);
  };

  // 모르는 view 로 들어오면 today 로 정리 (흰 화면 방지)
  useEffect(() => {
    if (!VIEW_KEYS.has(rawView)) navigate(`/w/${workspace.id}/today`, { replace: true });
  }, [rawView, workspace.id, navigate]);

  // 화면 전환 시 본문 맨 위로 + 포커스 이동(스크린리더가 새 화면을 읽도록)
  useEffect(() => {
    mainRef.current?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const current = SIMOK_NAV.find(n => n.key === view)!;
  const viewProps: SimokViewProps = { workspace, detailId, go };

  return (
    <div className="simok-office simok-shell">
      <a href={`#simok-main`} className="simok-btn text" style={{ position: 'absolute', left: -9999, top: 0 }}
        onFocus={e => { e.currentTarget.style.left = '8px'; e.currentTarget.style.top = '8px'; e.currentTarget.style.zIndex = '10'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.padding = '8px 12px'; }}
        onBlur={e => { e.currentTarget.style.left = '-9999px'; }}>
        본문으로 건너뛰기
      </a>

      <aside className="simok-sidebar">
        <div className="simok-brand">
          <div className="simok-logo">SIMOK</div>
          <div className="simok-logo-sub">THE PRIVATE OFFICE</div>
        </div>

        {/* 현재 브랜드를 항상 보이게 (06_UI_SPEC: 현재 브랜드 표시 유지) */}
        <div className="simok-ws-label">WORKSPACE / {workspace.name}</div>

        <nav className="simok-nav" aria-label="시목 주 메뉴">
          {SIMOK_NAV.map(n => (
            <button
              key={n.key}
              onClick={() => go(n.key)}
              aria-current={n.key === view ? 'page' : undefined}
            >
              <span className="nav-num" aria-hidden>{n.num}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="simok-side-bottom">
          <div className="simok-eyebrow">THIS SEASON</div>
          {/* 시즌 문구는 데이터로 관리할 대상이다 — 지금은 brand_contexts 미연결이라 고정 문구 + 설명 */}
          <div className="simok-season">A room for green.</div>
          <p>시즌·취향 계획은 아직 데이터로 연결되지 않았어요.</p>
          <div className="simok-profile">
            <span className="simok-avatar" aria-hidden>S</span>
            <div>
              SIMOK Creative Office<br />
              <span style={{ color: 'var(--muted)' }}>좋은 것은 시간을 담는다.</span>
            </div>
          </div>
          {/* 기존 workspace 전환을 전용 디자인 안에 유지 (BUILD_PACK §2·§3) */}
          <button className="simok-switch" onClick={() => setLauncherOpen(true)}>
            워크스페이스 전환 ↗
          </button>
          {/* 공통 오피스 화면으로 되돌아갈 길 — 기존 화면을 지우지 않았다는 것을 UI 로도 보장 */}
          {onSwitchShell && (
            <button className="simok-switch" style={{ marginTop: 8, background: 'transparent', border: '1px solid var(--line)' }} onClick={onSwitchShell}>
              화면 바꾸기 (직접 만든 오피스)
            </button>
          )}
        </div>
      </aside>

      <main className="simok-main" id="simok-main" ref={mainRef} tabIndex={-1}>
        <div className="simok-main-inner">
          <div className="simok-section-head" style={{ marginTop: 0 }}>
            <h2>{current.label}</h2>
          </div>
          {view === 'today' && <SimokToday {...viewProps} />}
          {view === 'reports' && <SimokReports {...viewProps} />}
          {view === 'tastes' && <SimokTaste {...viewProps} />}
          {view === 'studio' && <SimokStudio {...viewProps} />}
          {view === 'archive' && <SimokArchive {...viewProps} />}
          {view === 'workflow' && <SimokWorkflow {...viewProps} />}
          {view === 'traffic' && <SimokTraffic {...viewProps} />}
          {view === 'connections' && <SimokConnections {...viewProps} />}
        </div>
      </main>

      {/* 기존 런처를 그대로 재사용 — 전환하면 해당 workspace 의 기존 셸로 복원된다 */}
      <WorkspaceLauncher
        open={launcherOpen}
        personal={personal}
        offices={offices}
        activeId={workspace.id}
        onPick={(id) => { setActiveWorkspace(id); navigate('/'); }}
        onClose={() => setLauncherOpen(false)}
        onCreate={() => { setLauncherOpen(false); reload(); navigate('/'); }}
      />
    </div>
  );
}

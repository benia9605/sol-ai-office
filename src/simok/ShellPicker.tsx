/**
 * @file src/simok/ShellPicker.tsx
 * @description 오피스에 들어갈 때 "어떤 화면으로 볼까" 고르는 팝업
 *
 * 대표 요청(2026-10-05): "시목 스튜디오도 오피스 클릭하면 시목 / 직접 만든 오피스
 * 뭐 이렇게 선택하는 팝업 하나 더 나와서 들어가면 좋겠고"
 *
 * ★ 왜 선택제인가
 *   기존 공통 오피스 화면(OfficeShell)은 **지우지 않는다.** 할일·회의·제품·매출·AI직원 등
 *   실제로 쓰고 있는 기능이 거기 있고, 상용화 때 다듬어 쓸 자산이다.
 *   시목 전용 셸은 프리뷰 디자인의 8개 화면이고 아직 데이터 연결이 진행 중이다.
 *   → 둘 다 남겨 두고 들어갈 때 고른다. 고른 값은 workspace 별로 기억한다.
 *
 * 저장 위치: localStorage `officeShell:{workspaceId}`.
 *   화면 선택은 **표시 취향**이라 브라우저에 두어도 안전하다(권한·데이터 접근과 무관).
 *   데이터 접근은 서버 RLS·가드가 결정한다 — 이 선택이 권한을 바꾸지 않는다.
 */
import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';
import { Workspace } from '../types';
import './simok.css';

export type ShellChoice = 'simok' | 'common';

const KEY = (wsId: string) => `officeShell:${wsId}`;

/** 저장된 선택 (없으면 null → 팝업을 띄운다) */
export function readShellChoice(wsId: string): ShellChoice | null {
  try {
    const v = localStorage.getItem(KEY(wsId));
    return v === 'simok' || v === 'common' ? v : null;
  } catch { return null; }
}

export function writeShellChoice(wsId: string, choice: ShellChoice): void {
  try { localStorage.setItem(KEY(wsId), choice); } catch { /* 사생활 보호 모드 등 */ }
}

/** 다시 고르고 싶을 때 */
export function clearShellChoice(wsId: string): void {
  try { localStorage.removeItem(KEY(wsId)); } catch { /* noop */ }
}

export function ShellPicker({
  workspace, current, onPick, onClose,
}: {
  workspace: Workspace;
  /** 이미 고른 값이 있으면 표시용 */
  current?: ShellChoice | null;
  onPick: (c: ShellChoice) => void;
  /** 처음 진입(선택 전)이면 닫기를 주지 않는다 — 고르면 들어간다 */
  onClose?: () => void;
}) {
  const firstRef = useRef<HTMLButtonElement>(null);

  // 포커스 가두기 없이도 최소 접근성: 열릴 때 첫 버튼에 포커스, Escape 로 닫기(닫을 수 있을 때만)
  useEffect(() => {
    firstRef.current?.focus();
    if (!onClose) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return createPortal(
    <div
      className="simok-office"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shell-picker-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 120, display: 'grid', placeItems: 'center',
        background: 'rgba(37,58,50,.34)', backdropFilter: 'blur(2px)', padding: 16,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        style={{
          background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 'var(--radius)',
          width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: '30px 30px 26px',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="simok-eyebrow">{workspace.name.toUpperCase()}</div>
        <h2 id="shell-picker-title" style={{ fontSize: 21, fontWeight: 400, margin: '12px 0 6px', letterSpacing: '-.6px' }}>
          어떤 화면으로 들어갈까요?
        </h2>
        <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.85 }}>
          같은 워크스페이스예요. 데이터는 그대로고 보는 방식만 달라져요.
        </p>

        <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
          <button
            ref={firstRef}
            onClick={() => onPick('simok')}
            style={{
              textAlign: 'left', padding: '18px 20px', borderRadius: 11,
              border: `1px solid ${current === 'simok' ? 'var(--green)' : 'var(--line)'}`,
              background: current === 'simok' ? 'var(--sage)' : 'var(--white)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 17, letterSpacing: 1.5 }}>시목 스튜디오</span>
              <span className="simok-pill amber">만드는 중</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.8 }}>
              크림·딥그린 전용 디자인. 오늘의 시목 · 브리핑 · 취향 지도 · 제작실 · 아카이브 ·
              역할 지도 · 방문·유입 · 연결 상태 8개 화면.
              <br />
              <strong>데이터 연결이 진행 중</strong>이라 아직 비어 있는 화면이 있어요.
            </p>
          </button>

          <button
            onClick={() => onPick('common')}
            style={{
              textAlign: 'left', padding: '18px 20px', borderRadius: 11,
              border: `1px solid ${current === 'common' ? 'var(--green)' : 'var(--line)'}`,
              background: current === 'common' ? 'var(--sage)' : 'var(--white)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 15, fontWeight: 500 }}>직접 만든 오피스</span>
              <span className="simok-pill">쓰던 그대로</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.8 }}>
              지금까지 쓰던 공통 오피스 화면. 대시보드 · 할일 · 회의 · 인사이트 · 콘텐츠 ·
              제품 · 매출 · AI 직원 · 활동 로그가 전부 그대로 있어요.
            </p>
          </button>
        </div>

        <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 18, lineHeight: 1.8 }}>
          고른 값은 이 브라우저에 기억돼요. 양쪽 화면에서 ‘화면 바꾸기’ 로 언제든 다시 고를 수 있어요.
        </p>

        {onClose && (
          <button className="simok-btn" style={{ marginTop: 16 }} onClick={onClose}>
            닫기
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

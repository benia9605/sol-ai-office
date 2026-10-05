/**
 * @file src/simok/ui.tsx
 * @description 시목 전용 화면의 공통 조각 — 상태 표현을 타입으로 강제한다
 *
 * 기준: 11_SIMOK_OFFICE_BUILD_PACK.md §8, 06_UI_SPEC.md "반드시 있는 상태",
 *       design-manifest.json required_states
 *
 * ★ 핵심 규칙: **unknown ≠ 0**.
 *   loading / empty / partial / stale / revised / error / permission / demo / provisional 를
 *   서로 구별한다. 모르는 값은 `—` 로 그리고 이유를 함께 보여준다.
 */
import { ReactNode } from 'react';
import { Measure, formatMeasure } from '../contracts/projection';

/** 역할 표식 — 색과 역할 문자를 **같이** 쓴다(08 문서) */
export type Actor = 'gpt' | 'human' | 'system';

const ACTOR_TEXT: Record<Actor, { name: string; how: string }> = {
  gpt: { name: 'GPT', how: '자동 준비' },
  human: { name: '시목', how: '사람이 수행·검토' },
  system: { name: '앱', how: '자동 처리' },
};

export function RoleBadge({ actor, how }: { actor: Actor; how?: string }) {
  const t = ACTOR_TEXT[actor];
  const cls = actor === 'human' ? 'human' : actor === 'system' ? 'system' : '';
  return (
    <span className={`simok-role ${cls}`}>
      {t.name} <small>{how ?? t.how}</small>
    </span>
  );
}

/** 로딩 — 0을 그리지 않고 뼈대만 */
export function Loading({ rows = 3, label = '불러오는 중' }: { rows?: number; label?: string }) {
  return (
    <div className="simok-skeleton" role="status" aria-live="polite">
      <span style={{ position: 'absolute', left: -9999 }}>{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="simok-skeleton-bar" style={{ width: `${90 - i * 18}%` }} />
      ))}
    </div>
  );
}

/** 데이터가 없는 상태 — "연결 대기" 와 "실제로 0" 을 문구로 구별한다 */
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="simok-empty">
      <div className="simok-empty-title">{title}</div>
      {children && <p>{children}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

/** 실패 — 재시도 가능 여부를 밝힌다. 성공 카드로 위장하지 않는다 */
export function ErrorBox({ message, retryable, onRetry }: { message: string; retryable?: boolean; onRetry?: () => void }) {
  return (
    <div className="simok-error" role="alert">
      <div>{message}</div>
      <div style={{ marginTop: 8, fontSize: 11 }}>
        {retryable ? '일시적인 문제일 수 있어요.' : '설정이나 권한을 확인해야 해요.'}
        {retryable && onRetry && (
          <button className="simok-btn text" style={{ marginLeft: 10, textDecoration: 'underline' }} onClick={onRetry}>
            다시 시도
          </button>
        )}
      </div>
    </div>
  );
}

/** 권한 없음 */
export function NoPermission({ what }: { what: string }) {
  return (
    <div className="simok-error" role="alert">
      {what}을 볼 권한이 없어요. 워크스페이스 관리자에게 요청해 주세요.
    </div>
  );
}

/** 검증용 자료 배지 — 운영 집계와 구별 (계약 0.2.0 §2) */
export function ValidationBanner({ note }: { note?: string }) {
  return (
    <div className="simok-banner validation">
      <strong>검증용</strong>
      <span>{note ?? '실제 원장에서 뽑았지만 운영 집계·검색·GPT 운영 문맥에서는 제외되는 자료예요.'}</span>
    </div>
  );
}

/** 잠정값 배지 — GA4 처리 지연 등 (10_WEB_ANALYTICS_PLAN §5) */
export function ProvisionalBanner({ note }: { note: string }) {
  return <div className="simok-banner info"><strong>잠정</strong><span>{note}</span></div>;
}

/**
 * 지표 카드 한 장.
 * value 가 Measure 이므로 unknown 을 숫자로 바꿀 수 없다.
 * `scope` 는 그 숫자가 **어느 범위**인지 — 전체인지 특정 채널인지 밝히기 위한 것이다.
 */
export function MetricCard({
  label, badge, value, unit = '원', note, scope,
}: {
  label: string;
  badge?: string;
  value: Measure;
  unit?: string;
  note?: ReactNode;
  scope?: string;
}) {
  return (
    <div className="simok-metric">
      <div className="simok-metric-label">
        <span>{label}</span>
        {badge && <small>{badge}</small>}
      </div>
      <div className={`simok-metric-value${value.known ? '' : ' unknown'}`}>
        {value.known
          ? <>{value.value.toLocaleString()}<span>{unit}</span></>
          : '—'}
      </div>
      <div className="simok-metric-note">
        {value.known
          ? (note ?? (scope ? `범위: ${scope}` : null))
          : (value.reason ?? '아직 확인되지 않았어요')}
      </div>
    </div>
  );
}

/** Measure 를 인라인으로 (문장 안에서) */
export function M({ v, unit = '원' }: { v: Measure; unit?: string }) {
  return <strong>{formatMeasure(v, unit)}</strong>;
}

/** 섹션 머리 */
export function SectionHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="simok-section-head">
      <h2>{title}{sub && <span className="sub">{sub}</span>}</h2>
      {right}
    </div>
  );
}

/** 편집자 주 — 화면이 무엇을 뜻하는지 문장으로 */
export function Note({ children }: { children: ReactNode }) {
  return <div className="simok-note">{children}</div>;
}

/**
 * 아직 구현 전인 화면 — "준비 중" 을 정직하게 보여준다.
 * 동작하지 않는 버튼을 운영 기능으로 소개하지 않는다(BUILD_PACK §8).
 */
export function NotBuiltYet({ title, plan, next }: { title: string; plan: string[]; next?: string }) {
  return (
    <>
      <p className="simok-page-intro">{title}</p>
      <div className="simok-card">
        <div className="simok-eyebrow">아직 만들지 않았어요</div>
        <p style={{ marginTop: 10, fontSize: 12, lineHeight: 1.9, color: 'var(--muted)' }}>
          이 화면은 레이아웃만 있고 데이터·동작이 연결되지 않았어요. 가짜 숫자를 보여주지 않기 위해 비워 둡니다.
        </p>
        <ul style={{ marginTop: 14, display: 'grid', gap: 8 }}>
          {plan.map((p, i) => (
            <li key={i} style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 10 }}>
              <span style={{ fontFamily: 'Georgia, serif', opacity: .5 }}>{String(i + 1).padStart(2, '0')}</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        {next && <p style={{ marginTop: 16, fontSize: 11 }}><span className="simok-pill paper">다음</span> {next}</p>}
      </div>
    </>
  );
}

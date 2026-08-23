/**
 * @file src/components/office/ui.tsx
 * @description 오피스 셸 공용 UI 프리미티브 (모던 모노톤 — 시맨틱 토큰·색상 최소)
 * - 색상 규칙: surface / foreground(-muted/-faint) / line 만. 액센트는 foreground(near-black) 하나.
 *   danger(rose)는 삭제·지연에만. 보라(primary) 등 장식색 미사용.
 * - Spark: 스파크라인 그래프 (KPI 카드용)
 * - ViewHead: 뷰 상단 제목 영역 (라이트 대형 헤드라인 + 우측 action 슬롯)
 * - AddButton / InlineAddCard: 일정(SchedulesPage.modern) 방식의 하향 확장 추가 UX 공용화
 * - Card / EmptyState (네모·얇은 라인·무그림자)
 */
import { ReactNode } from 'react';

/** 공용 입력 필드 클래스 (모노) — 오피스 폼 전반에서 재사용 */
export const fieldCls =
  'w-full px-3.5 py-2.5 rounded-lg bg-surface-muted border border-line text-sm text-foreground ' +
  'placeholder:text-foreground-faint focus:outline-none focus:bg-surface focus:border-foreground transition-colors';
/** 좁은 인라인 필드 (칩 옆 등) */
export const miniFieldCls =
  'min-w-0 px-2.5 py-1.5 rounded-lg bg-surface-muted border border-line text-xs text-foreground ' +
  'focus:outline-none focus:bg-surface focus:border-foreground transition-colors';

/** 스파크라인 — currentColor(=foreground)로 그림 */
export function Spark({ data, h = 36 }: { data: number[]; h?: number }) {
  const w = 120;
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((d, i) => [
    (i / (data.length - 1)) * w,
    h - ((d - min) / (max - min || 1)) * (h - 6) - 3,
  ]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L${w} ${h} L0 ${h} Z`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block text-foreground">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-grad)" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill="currentColor" />
    </svg>
  );
}

export function ViewHead({ eyebrow, title, sub, action }: { eyebrow?: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-10 flex items-end justify-between gap-4 flex-wrap">
      <div>
        {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-faint mb-3">{eyebrow}</div>}
        <h1 className="text-3xl sm:text-4xl font-light leading-[1.2] text-foreground">{title}</h1>
        {sub && <p className="text-sm text-foreground-muted mt-3">{sub}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/**
 * 설정 섹션 — 통일된 카드 프레임: 헤더(제목·설명·우측 액션) + 본문 + (선택)푸터.
 * 저장 버튼은 항상 footer 슬롯에 두어 섹션마다 위치가 일정하도록 한다.
 * 본문에는 중첩 Card를 쓰지 않는다(이중 테두리 방지) — 그룹은 SectionGroup 사용.
 */
export function Section({ title, desc, action, children, footer }: {
  title: string; desc?: string; action?: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-surface border border-line">
      <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-line">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          {desc && <p className="text-xs text-foreground-muted mt-1 leading-relaxed">{desc}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      <div className="px-5 sm:px-6 py-5 space-y-4">{children}</div>
      {footer && <div className="px-5 sm:px-6 py-4 border-t border-line flex items-center gap-3">{footer}</div>}
    </section>
  );
}

/** 섹션 본문 안의 하위 그룹 — 얇은 구분선 위에 소제목. 중첩 카드 대신 사용. */
export function SectionGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      {label && <div className="text-[11px] font-semibold text-foreground-faint uppercase tracking-wider">{label}</div>}
      {children}
    </div>
  );
}

/** 섹션 공용 저장 버튼 (footer 슬롯용) — 모노 · 일관 스타일 */
export function SaveButton({ onClick, busy, saved, label = '저장', savedText = '✓ 저장됐어요' }: {
  onClick: () => void; busy?: boolean; saved?: boolean; label?: string; savedText?: string;
}) {
  return (
    <>
      <button onClick={onClick} disabled={busy}
        className="px-5 py-2.5 rounded-xl bg-foreground text-surface text-sm font-bold hover:opacity-85 transition-all active:scale-95 disabled:opacity-40">
        {busy ? '저장 중…' : label}
      </button>
      {saved && <span className="text-sm text-emerald-500 font-medium">{savedText}</span>}
    </>
  );
}

/** 목록 검색바 — 각 메뉴 리스트 상단. 제목/내용을 필터. */
export function SearchBar({ value, onChange, placeholder = '검색' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative mb-3">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-faint pointer-events-none"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 rounded-lg bg-surface-muted border border-line text-sm text-foreground placeholder:text-foreground-faint focus:outline-none focus:bg-surface focus:border-foreground transition-colors" />
      {value && <button onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-faint hover:text-foreground text-sm">✕</button>}
    </div>
  );
}

/** 모노 추가 버튼 — 일정의 "+ 새 일정" 톤(아웃라인 → hover 시 반전). open이면 '취소'로 표시. */
export function AddButton({ open, onClick, label = '추가', className = '' }: {
  open?: boolean; onClick: () => void; label?: string; className?: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors active:scale-95 ${
        open
          ? 'border-line text-foreground-muted hover:border-foreground hover:text-foreground'
          : 'border-foreground bg-foreground text-surface hover:opacity-85'
      } ${className}`}>
      {open ? '취소' : `＋ ${label}`}
    </button>
  );
}

/** 일정식 하향 확장 추가 폼 래퍼 — open일 때만 카드로 펼쳐진다. */
export function InlineAddCard({ open, children, className = '' }: { open: boolean; children: ReactNode; className?: string }) {
  if (!open) return null;
  return (
    <div className={`rounded-xl bg-surface border border-line p-4 sm:p-5 mb-3 space-y-3 ${className}`}>{children}</div>
  );
}

/** 카드 — 모던 모노: 라운드·얇은 라인·무그림자 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-surface border border-line ${className}`}>{children}</div>
  );
}

export function EmptyState({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <Card className="p-16 text-center">
      <div className="text-4xl mb-5 grayscale opacity-70">{emoji}</div>
      <p className="text-base font-medium text-foreground">{title}</p>
      {sub && <p className="text-sm text-foreground-muted mt-2">{sub}</p>}
    </Card>
  );
}

/** 진행률 % — 0건이면 0, done<total이면 최대 99(반올림 함정 방지 · 가이드 §11.2) */
export function progressPct(done: number, total: number): number {
  if (total === 0) return 0;
  if (done >= total) return 100;
  return Math.min(99, Math.round((done / total) * 100));
}

/**
 * 할일 진행률 바 (done/total · %). total===0이면 렌더 안 함(가이드 §11.2).
 * @param label 왼쪽 라벨(예: 멤버 이름·"전체")
 * @param overdue 지연 건수 — 있으면 빨간 뱃지
 * @param compact 리스트 행용 축소판(11px)
 */
export function TaskProgress({ done, total, label, overdue = 0, compact = false }: {
  done: number; total: number; label?: string; overdue?: number; compact?: boolean;
}) {
  if (total === 0) return null;
  const p = progressPct(done, total);
  const complete = done >= total;
  return (
    <div>
      <div className={`flex items-baseline justify-between gap-2 tabular-nums ${compact ? 'text-[11px]' : 'text-xs'} mb-1`}>
        <span className="min-w-0 truncate">
          {label && <span className="text-foreground mr-2">{label}</span>}
          <span className="text-foreground-faint">할일 {done}/{total}</span>
          {overdue > 0 && <span className="ml-2 text-rose-500">지연 {overdue}</span>}
        </span>
        <span className={complete ? 'text-foreground font-semibold' : 'text-foreground-muted'}>{p}%</span>
      </div>
      <div className="h-1 rounded-full bg-surface-muted overflow-hidden">
        <div className="h-full bg-foreground transition-all" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

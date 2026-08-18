/**
 * @file src/components/office/ui.tsx
 * @description 오피스 셸 공용 UI 프리미티브 (무지 모던톤 — 네모·라이트·넓은 여백)
 * - Spark: 스파크라인 그래프 (KPI 카드용)
 * - ViewHead: 뷰 상단 제목 영역 (라이트 대형 헤드라인)
 * - Card / EmptyState (네모·얇은 라인·무그림자)
 */
import { ReactNode } from 'react';

/** 스파크라인 — currentColor(=text-primary)로 그림 */
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
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block text-primary-500">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-grad)" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.6" fill="currentColor" />
    </svg>
  );
}

export function ViewHead({ eyebrow, title, sub, action }: { eyebrow: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-10 flex items-end justify-between gap-4 flex-wrap">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-500 mb-3">{eyebrow}</div>
        <h1 className="text-3xl sm:text-4xl font-light leading-[1.2] text-gray-800">{title}</h1>
        {sub && <p className="text-sm text-gray-400 mt-3">{sub}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/** 카드 — 무지 모던: 네모(rounded-xl)·얇은 라인·무그림자 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white border border-gray-200 ${className}`}>{children}</div>
  );
}

export function EmptyState({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <Card className="p-16 text-center">
      <div className="text-4xl mb-5 grayscale opacity-80">{emoji}</div>
      <p className="text-base font-semibold text-gray-700">{title}</p>
      {sub && <p className="text-sm text-gray-400 mt-2">{sub}</p>}
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
          {label && <span className="text-gray-700 mr-2">{label}</span>}
          <span className="text-gray-400">할일 {done}/{total}</span>
          {overdue > 0 && <span className="ml-2 text-rose-500">지연 {overdue}</span>}
        </span>
        <span className={complete ? 'text-primary-500 font-semibold' : 'text-gray-600'}>{p}%</span>
      </div>
      <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-primary-500 transition-all" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

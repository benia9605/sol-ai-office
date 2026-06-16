/**
 * @file src/components/office/ui.tsx
 * @description 오피스 셸 공용 UI 프리미티브 (모노톤 + 몽글)
 * - Spark: 스파크라인 그래프 (KPI 카드용)
 * - ViewHead: 뷰 상단 제목 영역
 * - Card / EmptyState
 */
import { ReactNode } from 'react';

/** 스파크라인 — currentColor(=text-primary, 모던 테마에선 진초록)로 그림 */
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
    <div className="mb-6 flex items-start justify-between gap-3">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-primary-500 mb-1.5">{eyebrow}</div>
        <h1 className="text-2xl font-extrabold text-gray-800">{title}</h1>
        {sub && <p className="text-sm text-gray-400 mt-1">{sub}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[24px] bg-white border border-gray-100 shadow-sm ${className}`}>{children}</div>
  );
}

export function EmptyState({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <Card className="p-10 text-center">
      <div className="text-5xl mb-4 grayscale opacity-90">{emoji}</div>
      <p className="text-base font-bold text-gray-700">{title}</p>
      {sub && <p className="text-sm text-gray-400 mt-1.5">{sub}</p>}
    </Card>
  );
}

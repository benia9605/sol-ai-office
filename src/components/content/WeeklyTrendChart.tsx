/**
 * @file src/components/content/WeeklyTrendChart.tsx
 * @description 주간 추이 라인 차트 (외부 라이브러리 없이 SVG)
 * - 컨테이너 폭을 ResizeObserver로 측정해 픽셀 좌표로 그림 (왜곡 없음)
 * - 라인 + 영역 채움 + 데이터 포인트 + 값 라벨 + x축 라벨
 */
import { useLayoutEffect, useRef, useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface WeeklyTrendChartProps {
  data: DataPoint[];
  color?: string;
  formatValue?: (v: number) => string;
  height?: number;
}

export function WeeklyTrendChart({
  data,
  color = '#ef4444',
  formatValue = (v) => v.toLocaleString(),
  height = 170,
}: WeeklyTrendChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (data.length === 0) {
    return <div className="text-sm text-gray-400 text-center py-10">데이터가 없어요</div>;
  }

  const padL = 8;
  const padR = 24;        // 마지막 값 라벨 공간
  const padTop = 18;
  const padBottom = 24;
  const innerW = Math.max(width - padL - padR, 10);
  const innerH = height - padTop - padBottom;

  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;

  const n = data.length;
  const stepX = n > 1 ? innerW / (n - 1) : 0;

  const points = data.map((d, i) => {
    const x = padL + stepX * i;
    const y = padTop + innerH - ((d.value - min) / range) * innerH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const baseY = padTop + innerH;
  const areaPath = `${linePath} L ${points[n - 1].x.toFixed(1)} ${baseY} L ${points[0].x.toFixed(1)} ${baseY} Z`;
  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <div ref={wrapRef} className="w-full overflow-hidden" style={{ height }}>
      {width > 0 && (
      <svg width={width} height={height} className="block" style={{ maxWidth: '100%' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 영역 채움 */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* 라인 */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* 데이터 포인트 + 라벨 */}
        {points.map((p, i) => {
          const isLast = i === n - 1;
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isLast ? 4 : 3}
                fill={isLast ? color : '#fff'}
                stroke={color}
                strokeWidth="2"
              />
              {isLast && (
                <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>
                  {formatValue(p.value)}
                </text>
              )}
              <text x={p.x} y={height - 8} textAnchor="middle" fontSize="10" fill="#9ca3af">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      )}
    </div>
  );
}

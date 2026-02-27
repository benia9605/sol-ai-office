/**
 * @file src/components/records/RecordIcons.tsx
 * @description 기록 페이지 공용 SVG 아이콘
 * - 기록 유형 아이콘 (아침/저녁/주간/메모)
 * - 템플릿 섹션 아이콘 (감사/기분좋은것/다짐/아이디어/첫단계 등)
 * - 모두 핑크 테마, stroke 기반
 */
import { RecordType } from '../../types';

interface IconProps {
  size?: number;
  className?: string;
}

const svgBase = (size: number, className: string) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  className,
});

/** 기록 유형 아이콘 */
export function RecordTypeIcon({ type, size = 16, className = '' }: IconProps & { type: RecordType }) {
  const p = svgBase(size, className);
  switch (type) {
    case 'morning':
      return (
        <svg {...p}>
          <circle cx="12" cy="14" r="5" />
          <path d="M12 3v3" /><path d="M5.6 6.6l2.1 2.1" /><path d="M3 14h3" />
          <path d="M21 14h-3" /><path d="M18.4 6.6l-2.1 2.1" />
          <path d="M6 21h12" />
        </svg>
      );
    case 'evening':
      return (
        <svg {...p}>
          <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
        </svg>
      );
    case 'weekly':
      return (
        <svg {...p}>
          <path d="M3 12a9 9 0 0115-6.7" /><path d="M21 12a9 9 0 01-15 6.7" />
          <path d="M16.5 3.5l1.5 2 2-1.5" /><path d="M7.5 20.5l-1.5-2-2 1.5" />
        </svg>
      );
    case 'memo':
      return (
        <svg {...p}>
          <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      );
  }
}

/** 감사 아이콘 (하트) */
export function GratitudeIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

/** 기분좋은것 아이콘 (별/스파클) */
export function SparkleIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    </svg>
  );
}

/** 다짐 아이콘 (방패/체크) */
export function AffirmationIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/** 아이디어 아이콘 (전구) */
export function IdeaIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M9 18h6" /><path d="M10 22h4" />
      <path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" />
    </svg>
  );
}

/** 실행/로켓 아이콘 */
export function RocketIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

/** 트로피 아이콘 */
export function TrophyIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2" />
      <path d="M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2" />
      <path d="M6 3h12v6a6 6 0 01-12 0V3z" />
      <path d="M12 15v3" /><path d="M8 21h8" />
    </svg>
  );
}

/** 렌치/개선 아이콘 */
export function ImproveIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

/** 책/배움 아이콘 */
export function BookIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2V3z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7V3z" />
    </svg>
  );
}

/** 말풍선/아쉬운점 아이콘 */
export function ThoughtIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
    </svg>
  );
}

/** 타겟/목표 아이콘 */
export function TargetIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}

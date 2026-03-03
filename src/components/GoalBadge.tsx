/**
 * @file src/components/GoalBadge.tsx
 * @description 목표 배지 컴포넌트
 * - macOS 캘린더 스타일 색상 자동 생성
 * - 원형 dot(프로젝트 컬러) + 연한 배경 + 진한 텍스트
 * - 리스트 토글, 칸반 카드, 프로젝트 페이지 등에서 재사용
 */
import { getBadgeColors } from '../utils/colorUtils';

interface GoalBadgeProps {
  title: string;
  projectColor?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function GoalBadge({ title, projectColor, size = 'sm', className = '' }: GoalBadgeProps) {
  const colors = getBadgeColors(projectColor || '');

  const sizeClasses = size === 'md'
    ? 'text-xs px-2.5 py-1 gap-1.5'
    : 'text-[11px] px-2 py-0.5 gap-1';

  const dotSize = size === 'md' ? 'w-2 h-2' : 'w-1.5 h-1.5';

  return (
    <span
      className={`inline-flex items-center ${sizeClasses} rounded-full font-semibold max-w-[160px] ${className}`}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      <span
        className={`${dotSize} rounded-full flex-shrink-0`}
        style={{ backgroundColor: colors.dot }}
      />
      <span className="truncate">{title}</span>
    </span>
  );
}

/**
 * @file src/components/CategoryBadge.tsx
 * @description 카테고리 색 배지 (앱 공용 표준)
 * - 각진 네모(모서리 없음) + 연한 배경 + 진한 텍스트 + 네모 색점
 * - 색은 getBadgeColors(카테고리 color)로 자동 생성
 * - size: 'md'(기본, text-[11px]) / 'sm'(text-[10px], 컴팩트 리스트용)
 * - 배지 스타일은 여기서만 바꾸면 앱 전체에 반영됨.
 */
import { getBadgeColors } from '../utils/colorUtils';

interface Props {
  /** 카테고리 색상 (hex 등) */
  color?: string;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function CategoryBadge({ color, label, size = 'md', className = '' }: Props) {
  const cc = getBadgeColors(color || '');
  const sz = size === 'sm' ? 'text-[10px] px-2 py-0.5 gap-1' : 'text-[11px] font-medium px-2 py-0.5 gap-1.5';
  const dot = size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5';
  return (
    <span
      className={`inline-flex items-center ${sz} shrink-0 ${className}`}
      style={{ backgroundColor: cc.bg, color: cc.text }}
    >
      <span className={`${dot} shrink-0`} style={{ backgroundColor: cc.dot }} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}

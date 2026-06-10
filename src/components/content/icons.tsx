/**
 * @file src/components/content/icons.tsx
 * @description 콘텐츠 기능 공용 라인 아이콘 (currentColor 기반 — 모디/모던 자동 대응)
 */
interface IconProps {
  size?: number;
  className?: string;
}

const stroke = {
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** 영상 (▶ 들어간 사각형) */
export function VideoIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} className={className}>
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M10 9.5l4.5 2.5L10 14.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 문서 (스크립트) */
export function DocIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

/** 조회수 (눈) */
export function EyeIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** 좋아요 (엄지) */
export function LikeIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} className={className}>
      <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3z" />
      <path d="M7 11l4.4-7.4a1.5 1.5 0 0 1 2.8.8V8h4.2a2 2 0 0 1 2 2.35l-1.1 6A2 2 0 0 1 19.3 18H7" />
    </svg>
  );
}

/** 댓글 (말풍선) */
export function CommentIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/** AI 생성 (스파클) */
export function SparkleIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} className={className}>
      <path d="M12 3l1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7z" />
      <path d="M19 14l.6 1.6L21 16.2l-1.4.6L19 18.4l-.6-1.6L17 16.2l1.4-.6z" />
    </svg>
  );
}

/** 리서치 (돋보기) */
export function SearchIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

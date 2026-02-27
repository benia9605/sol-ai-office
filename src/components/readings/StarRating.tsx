/**
 * @file src/components/readings/StarRating.tsx
 * @description 1~5 별점 클릭 컴포넌트
 * - 읽기/편집 모드 지원
 * - 독서 아이템 상세에서 사용
 */

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  size?: string;
}

export function StarRating({ value, onChange, size = 'text-lg' }: StarRatingProps) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(value === star ? 0 : star)}
          disabled={!onChange}
          className={`${size} transition-colors ${
            onChange ? 'cursor-pointer hover:scale-110' : 'cursor-default'
          } ${star <= value ? 'text-amber-400' : 'text-gray-200'}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

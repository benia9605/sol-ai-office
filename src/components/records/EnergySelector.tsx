/**
 * @file src/components/records/EnergySelector.tsx
 * @description 에너지 1-5 게이지 선택 UI
 * - 긴 타원형(pill) 안에 5칸 게이지
 * - 클릭 시 해당 레벨까지 채워짐
 */

interface EnergySelectorProps {
  value: number;
  onChange: (level: number) => void;
}

const levelColors = [
  'bg-red-300',       // 1 - 낮음
  'bg-orange-300',    // 2
  'bg-amber-300',     // 3 - 보통
  'bg-lime-400',      // 4
  'bg-emerald-400',   // 5 - 최고
];

export function EnergySelector({ value, onChange }: EnergySelectorProps) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-600 block mb-1.5">에너지</label>
      <div className="flex items-center gap-2">
        {/* 번개 아이콘 */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 flex-shrink-0">
          <path d="M9 1.5L3.5 9H8l-1 5.5L12.5 7H8l1-5.5z" />
        </svg>
        {/* 게이지 바 */}
        <div className="flex h-5 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              onClick={() => onChange(value === level ? 0 : level)}
              className={`flex-1 transition-all duration-200 relative ${
                level <= value ? levelColors[level - 1] : 'hover:bg-gray-200'
              } ${level < 5 ? 'border-r border-white/40' : ''}`}
              title={`에너지 ${level}`}
            />
          ))}
        </div>
        {/* 레벨 텍스트 */}
        <span className="text-xs text-gray-400 w-8 flex-shrink-0">
          {value > 0 ? `${value}/5` : ''}
        </span>
      </div>
    </div>
  );
}

/** 에너지 게이지 읽기전용 (타임라인/상세뷰용) */
export function EnergyGauge({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 flex-shrink-0">
        <path d="M9 1.5L3.5 9H8l-1 5.5L12.5 7H8l1-5.5z" />
      </svg>
      <div className="flex h-4 w-20 rounded-full overflow-hidden border border-gray-200 bg-gray-100">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`flex-1 transition-all ${
              level <= value ? levelColors[level - 1] : ''
            } ${level < 5 ? 'border-r border-white/40' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

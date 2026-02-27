/**
 * @file src/components/records/RecordTypeSelector.tsx
 * @description 기록 유형 선택 카드
 * - +추가 시 4종류(아침/저녁/주간/메모) 선택
 * - SVG 아이콘 + 타입별 테마 색상
 */
import { RecordType } from '../../types';
import { recordTypeConfig } from '../../utils/recordTemplates';
import { RecordTypeIcon } from './RecordIcons';

interface RecordTypeSelectorProps {
  onSelect: (type: RecordType) => void;
  onCancel: () => void;
}

const types: RecordType[] = ['morning', 'evening', 'weekly', 'memo'];

export function RecordTypeSelector({ onSelect, onCancel }: RecordTypeSelectorProps) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-soft space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700">어떤 기록을 남기시겠어요?</h3>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">취소</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {types.map((t) => {
          const cfg = recordTypeConfig[t];
          return (
            <button
              key={t}
              onClick={() => onSelect(t)}
              className={`p-4 rounded-xl text-left transition-all hover:scale-[1.02] hover:shadow-hover ${cfg.bgColor}/40 border border-transparent`}
            >
              <div className={`w-9 h-9 rounded-xl ${cfg.bgColor} flex items-center justify-center mb-2`}>
                <RecordTypeIcon type={t} size={20} className={cfg.iconText} />
              </div>
              <div className={`text-sm font-semibold ${cfg.textColor}`}>{cfg.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{cfg.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

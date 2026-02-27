/**
 * @file src/components/records/ListFieldEditor.tsx
 * @description +리스트 UI 컴포넌트
 * - 기존 항목들 목록 (각 줄 옆 [x] 삭제)
 * - 하단 입력 필드 + Enter/[+] 로 추가
 * - 아침/저녁/주간 템플릿 섹션에서 재사용
 */
import { ListField } from '../../types';
import { newListField } from '../../utils/recordTemplates';

interface ListFieldEditorProps {
  label: string;
  fields: ListField[];
  onChange: (fields: ListField[]) => void;
  placeholder?: string;
  accentColor?: string; // e.g. 'orange', 'indigo', 'emerald'
}

export function ListFieldEditor({ label, fields, onChange, placeholder = '입력 후 Enter', accentColor = 'pink' }: ListFieldEditorProps) {
  const ringClass = `focus:ring-${accentColor}-200`;

  const handleUpdate = (id: string, text: string) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, text } : f)));
  };

  const handleRemove = (id: string) => {
    if (fields.length <= 1) return;
    onChange(fields.filter((f) => f.id !== id));
  };

  const handleAdd = () => {
    onChange([...fields, newListField()]);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const current = fields.find((f) => f.id === id);
      if (current?.text.trim()) {
        handleAdd();
        // Focus the new input after render
        setTimeout(() => {
          const inputs = document.querySelectorAll(`[data-list-editor="${label}"] input`);
          (inputs[inputs.length - 1] as HTMLElement)?.focus();
        }, 50);
      }
    }
    if (e.key === 'Backspace' && fields.find((f) => f.id === id)?.text === '' && fields.length > 1) {
      e.preventDefault();
      handleRemove(id);
    }
  };

  return (
    <div data-list-editor={label}>
      {label && <label className="text-sm font-medium text-gray-600 block mb-1.5">{label}</label>}
      <div className="space-y-1.5">
        {fields.map((field, idx) => (
          <div key={field.id} className="flex items-center gap-2">
            <span className="text-xs text-gray-300 w-4 text-right flex-shrink-0">{idx + 1}</span>
            <input
              type="text"
              value={field.text}
              onChange={(e) => handleUpdate(field.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, field.id)}
              placeholder={placeholder}
              className={`flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${ringClass}`}
            />
            {fields.length > 1 && (
              <button
                onClick={() => handleRemove(field.id)}
                className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0 w-5 h-5 flex items-center justify-center"
              >
                x
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={handleAdd}
        className="mt-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        + 추가
      </button>
    </div>
  );
}

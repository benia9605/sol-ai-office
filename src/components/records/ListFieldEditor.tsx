/**
 * @file src/components/records/ListFieldEditor.tsx
 * @description +리스트 UI 컴포넌트
 * - 기존 항목들 목록 (각 줄 옆 [x] 삭제)
 * - Enter로 새 항목 추가, Shift+Enter로 줄바꿈
 * - textarea 자동 확장 (최대 5줄, 이후 스크롤)
 * - 아침/저녁/주간 템플릿 섹션에서 재사용
 */
import { useRef, useCallback } from 'react';
import { ListField } from '../../types';
import { newListField } from '../../utils/recordTemplates';

interface ListFieldEditorProps {
  label: string;
  fields: ListField[];
  onChange: (fields: ListField[]) => void;
  placeholder?: string;
  accentColor?: string; // e.g. 'orange', 'indigo', 'emerald'
}

/** textarea 높이 자동 조절 (최대 5줄) */
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  const lineHeight = 22; // text-sm leading
  const maxHeight = lineHeight * 5 + 12; // 5줄 + padding
  el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
}

export function ListFieldEditor({ label, fields, onChange, placeholder = '입력 후 Enter', accentColor = 'pink' }: ListFieldEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
    // Shift+Enter = 줄바꿈 (기본 동작 유지)
    if (e.key === 'Enter' && e.shiftKey) return;

    // Enter = 새 항목 추가
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const current = fields.find((f) => f.id === id);
      if (current?.text.trim()) {
        handleAdd();
        setTimeout(() => {
          const textareas = containerRef.current?.querySelectorAll('textarea');
          if (textareas) {
            const last = textareas[textareas.length - 1] as HTMLTextAreaElement;
            last?.focus();
          }
        }, 50);
      }
    }

    // Backspace: 빈 필드 삭제
    if (e.key === 'Backspace' && fields.find((f) => f.id === id)?.text === '' && fields.length > 1) {
      e.preventDefault();
      handleRemove(id);
    }
  };

  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    autoResize(e.currentTarget);
  }, []);

  const textareaRef = useCallback((el: HTMLTextAreaElement | null) => {
    if (el) autoResize(el);
  }, []);

  return (
    <div ref={containerRef}>
      {label && <label className="text-sm font-medium text-gray-600 block mb-1.5">{label}</label>}
      <div className="space-y-1.5">
        {fields.map((field, idx) => (
          <div key={field.id} className="flex items-start gap-2">
            <span className="text-xs text-gray-300 w-4 text-right flex-shrink-0 mt-2">{idx + 1}</span>
            <textarea
              ref={textareaRef}
              value={field.text}
              onChange={(e) => { handleUpdate(field.id, e.target.value); autoResize(e.target); }}
              onInput={handleInput}
              onKeyDown={(e) => handleKeyDown(e, field.id)}
              placeholder={placeholder}
              rows={1}
              className={`flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${ringClass} resize-none overflow-y-auto leading-[22px]`}
              style={{ maxHeight: `${22 * 5 + 12}px` }}
            />
            {fields.length > 1 && (
              <button
                onClick={() => handleRemove(field.id)}
                className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0 w-5 h-5 flex items-center justify-center mt-1.5"
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

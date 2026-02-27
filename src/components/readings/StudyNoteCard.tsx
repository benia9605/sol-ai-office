/**
 * @file src/components/readings/StudyNoteCard.tsx
 * @description 스터디 노트 카드 (타임라인 표시용)
 * - 도서(book): Tiptap 읽기전용 본문
 * - 강좌(course): 구조화된 섹션/액션아이템 표시
 * - 수정/삭제 버튼 (hover 시 표시)
 */
import { useState } from 'react';
import { StudyNote, NoteActionItem } from '../../types';
import { TiptapReadOnly } from '../tiptap/TiptapReadOnly';

interface StudyNoteCardProps {
  note: StudyNote;
  readingCategory: string;
  onEdit: (note: StudyNote) => void;
  onDelete: (id: string) => void;
  onUpdateNote?: (note: StudyNote) => void;
}

export function StudyNoteCard({ note, readingCategory, onEdit, onDelete, onUpdateNote }: StudyNoteCardProps) {
  const isCourse = readingCategory === 'rcat-course';
  const [rawTextOpen, setRawTextOpen] = useState(false);

  const toggleActionItem = (itemId: string) => {
    if (!onUpdateNote || !note.actionItems) return;
    const updated: StudyNote = {
      ...note,
      actionItems: note.actionItems.map((a: NoteActionItem) =>
        a.id === itemId ? { ...a, checked: !a.checked } : a
      ),
      updatedAt: new Date().toISOString(),
    };
    onUpdateNote(updated);
  };

  return (
    <div className="group relative">
      {/* 타임라인 라인 */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-blue-100" />

      <div className="flex gap-4 pl-2">
        {/* 타임라인 점 */}
        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-400 border-2 border-white shadow-sm mt-1 z-10" />

        {/* 카드 본문 */}
        <div className="flex-1 bg-white rounded-2xl p-5 shadow-soft mb-4 hover:shadow-hover transition-all">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{note.date}</span>
              {note.time && <span className="text-xs text-gray-300">{note.time}</span>}
              {note.chapter && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                  {note.chapter}
                </span>
              )}
            </div>

            {/* 수정/삭제 */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEdit(note)}
                className="text-xs px-2 py-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
              >
                수정
              </button>
              <button
                onClick={() => onDelete(note.id)}
                className="text-xs px-2 py-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                삭제
              </button>
            </div>
          </div>

          {isCourse ? (
            /* ── 강좌용: 구조화된 표시 ── */
            <div className="space-y-3">
              {/* 원본 텍스트 (접기/펼치기) */}
              {note.rawText && (
                <div>
                  <button
                    onClick={() => setRawTextOpen(!rawTextOpen)}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                  >
                    <span>📄 원본 텍스트</span>
                    <span>{rawTextOpen ? '▲' : '▼'}</span>
                  </button>
                  {rawTextOpen && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-xl text-xs text-gray-500 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {note.rawText}
                    </div>
                  )}
                </div>
              )}

              {/* 요약 섹션들 */}
              {note.sections && note.sections.length > 0 && (
                <div className="space-y-2">
                  {note.sections.map((section) => (
                    <div key={section.id} className="border-l-2 border-blue-200 pl-3">
                      {section.title && (
                        <h5 className="text-sm font-semibold text-gray-700 mb-1">{section.title}</h5>
                      )}
                      <div className="prose-sm">
                        <TiptapReadOnly content={section.content as Record<string, unknown>} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 액션 아이템 */}
              {note.actionItems && note.actionItems.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-400 mb-1.5 block">액션 아이템</span>
                  <div className="space-y-1">
                    {note.actionItems.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 cursor-pointer group/check">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleActionItem(item.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-200"
                        />
                        <span className={`text-sm ${item.checked ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                          {item.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── 도서용: Tiptap 본문 ── */
            <div className="prose-sm">
              <TiptapReadOnly content={note.content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

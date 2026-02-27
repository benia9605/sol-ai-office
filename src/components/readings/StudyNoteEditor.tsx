/**
 * @file src/components/readings/StudyNoteEditor.tsx
 * @description 스터디 노트 작성/수정 에디터
 * - 도서(book): 블로그형 Tiptap 리치텍스트 에디터
 * - 강좌(course): 구조화된 섹션형 에디터 (원본텍스트, 요약섹션, 액션아이템)
 */
import { useState } from 'react';
import { StudyNote, NoteSection, NoteActionItem } from '../../types';
import { TiptapEditor } from '../tiptap/TiptapEditor';

interface StudyNoteEditorProps {
  readingId: string;
  readingCategory: string;
  chapters?: string[];
  preselectedChapter?: string;
  editingNote?: StudyNote | null;
  onSave: (note: Omit<StudyNote, 'id' | 'createdAt'> & { id?: string }) => void;
  onCancel: () => void;
}

const genId = () => Math.random().toString(36).slice(2, 9);

export function StudyNoteEditor({ readingId, readingCategory, chapters, preselectedChapter, editingNote, onSave, onCancel }: StudyNoteEditorProps) {
  const isCourse = readingCategory === 'rcat-course';

  const [date, setDate] = useState(editingNote?.date || new Date().toISOString().slice(0, 10));
  const [chapter, setChapter] = useState(editingNote?.chapter || preselectedChapter || '');

  // 도서용
  const [content, setContent] = useState<Record<string, unknown>>(
    editingNote?.content || { type: 'doc', content: [{ type: 'paragraph' }] }
  );

  // 강좌용
  const [rawText, setRawText] = useState(editingNote?.rawText || '');
  const [rawTextOpen, setRawTextOpen] = useState(false);
  const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };
  const [sections, setSections] = useState<NoteSection[]>(
    editingNote?.sections || [{ id: genId(), title: '', content: emptyDoc }]
  );
  const [actionItems, setActionItems] = useState<NoteActionItem[]>(
    editingNote?.actionItems || []
  );

  const handleSave = () => {
    if (isCourse) {
      onSave({
        id: editingNote?.id,
        readingId,
        date,
        chapter: chapter || undefined,
        content: {},
        rawText,
        sections: sections.filter(s => s.title || (s.content as Record<string, unknown>)?.content),
        actionItems,
        updatedAt: new Date().toISOString(),
      });
    } else {
      onSave({
        id: editingNote?.id,
        readingId,
        date,
        chapter: chapter || undefined,
        content,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // 섹션 핸들러
  const addSection = () => setSections([...sections, { id: genId(), title: '', content: emptyDoc }]);
  const updateSectionTitle = (id: string, value: string) =>
    setSections(sections.map(s => s.id === id ? { ...s, title: value } : s));
  const updateSectionContent = (id: string, value: Record<string, unknown>) =>
    setSections(sections.map(s => s.id === id ? { ...s, content: value } : s));
  const removeSection = (id: string) => {
    if (sections.length <= 1) return;
    setSections(sections.filter(s => s.id !== id));
  };

  // 액션아이템 핸들러
  const addActionItem = () => setActionItems([...actionItems, { id: genId(), text: '', checked: false }]);
  const updateActionItem = (id: string, text: string) =>
    setActionItems(actionItems.map(a => a.id === id ? { ...a, text } : a));
  const removeActionItem = (id: string) =>
    setActionItems(actionItems.filter(a => a.id !== id));

  return (
    <div className="bg-white rounded-2xl p-5 shadow-soft space-y-4">
      <h4 className="text-sm font-bold text-gray-700">
        {editingNote ? '스터디 노트 수정' : '새 스터디 노트'}
      </h4>

      {/* 날짜 + 챕터 */}
      <div className="flex gap-3">
        <div className="w-40">
          <label className="text-xs text-gray-500 mb-1 block">날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">챕터/섹션</label>
          {chapters && chapters.length > 0 ? (
            <select
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">목차에서 선택...</option>
              {chapters.map((ch, idx) => (
                <option key={idx} value={ch}>{ch}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder={isCourse ? '예: 3강 - React Hooks' : '예: 3장 - 검증된 학습'}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          )}
        </div>
      </div>

      {isCourse ? (
        /* ── 강좌용: 구조화된 섹션형 ── */
        <>
          {/* 원본 텍스트 (접기/펼치기) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">원본 텍스트</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {/* TODO: AI 요약 기능 연결 */}}
                  className="text-xs px-2.5 py-1 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg font-medium transition-colors"
                >
                  AI 요약
                </button>
                <button
                  onClick={() => setRawTextOpen(!rawTextOpen)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {rawTextOpen ? '접기 ▲' : '펼치기 ▼'}
                </button>
              </div>
            </div>
            {rawTextOpen && (
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="녹음 텍스트나 원본 내용을 붙여넣기 하세요..."
                rows={6}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y"
              />
            )}
            {!rawTextOpen && rawText && (
              <p className="text-xs text-gray-400 truncate">{rawText.slice(0, 80)}...</p>
            )}
          </div>

          {/* 요약 섹션들 */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">요약</label>
            <div className="space-y-3">
              {sections.map((section, idx) => (
                <div key={section.id} className="bg-gray-50 rounded-xl p-3 space-y-2 relative group/sec">
                  {sections.length > 1 && (
                    <button
                      onClick={() => removeSection(section.id)}
                      className="absolute top-2 right-2 text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover/sec:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  )}
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                    placeholder={`섹션 ${idx + 1} 제목`}
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <TiptapEditor
                    content={section.content as Record<string, unknown>}
                    onChange={(json) => updateSectionContent(section.id, json)}
                    placeholder="내용을 입력하세요... 볼드, 하이라이트, 인용문, 이미지 등을 활용할 수 있습니다."
                  />
                </div>
              ))}
            </div>
            <button
              onClick={addSection}
              className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
            >
              + 섹션 추가
            </button>
          </div>

          {/* 액션 아이템 */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">액션 아이템</label>
            <div className="space-y-2">
              {actionItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group/action">
                  <div className="w-4 h-4 rounded border border-gray-300 bg-white flex-shrink-0" />
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => updateActionItem(item.id, e.target.value)}
                    placeholder="할 일을 입력하세요..."
                    className="flex-1 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <button
                    onClick={() => removeActionItem(item.id)}
                    className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover/action:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addActionItem}
              className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
            >
              + 액션 추가
            </button>
          </div>
        </>
      ) : (
        /* ── 도서용: 블로그형 에디터 ── */
        <div>
          <label className="text-xs text-gray-500 mb-1 block">노트</label>
          <TiptapEditor
            content={content}
            onChange={setContent}
            placeholder="스터디 노트를 작성하세요... 인용문, 체크리스트, 하이라이트 등을 활용해보세요."
          />
        </div>
      )}

      {/* 버튼 */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-xl font-medium transition-colors"
        >
          {editingNote ? '수정' : '저장'}
        </button>
      </div>
    </div>
  );
}

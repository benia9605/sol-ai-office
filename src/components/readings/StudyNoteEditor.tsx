/**
 * @file src/components/readings/StudyNoteEditor.tsx
 * @description 스터디 노트 작성/수정 에디터
 * - 도서(book): 블로그형 Tiptap 리치텍스트 에디터
 * - 강좌(course): 구조화된 섹션형 에디터 (원본텍스트, 요약섹션, 액션아이템)
 */
import { useState, useRef, useEffect } from 'react';
import { StudyNote, NoteSection, NoteActionItem } from '../../types';
import { TiptapEditor, TiptapEditorHandle } from '../tiptap/TiptapEditor';
import { useUserProfile } from '../../hooks/useUserProfile';

/** 노션 스타일 멀티셀렉트 드롭다운 */
function ChapterMultiSelect({
  chapters,
  selected,
  onChange,
}: {
  chapters: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (ch: string) => {
    onChange(selected.includes(ch) ? selected.filter((c) => c !== ch) : [...selected, ch]);
  };

  const filtered = chapters.filter((ch) =>
    ch.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      {/* 트리거 */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="w-full min-h-[38px] px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left
          focus:outline-none focus:ring-2 focus:ring-blue-200 flex items-center gap-1.5 flex-wrap"
      >
        {selected.length > 0 ? (
          selected.map((ch) => (
            <span key={ch} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">
              {ch}
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); toggle(ch); }}
                className="text-blue-400 hover:text-blue-600 cursor-pointer"
              >
                ×
              </span>
            </span>
          ))
        ) : (
          <span className="text-gray-400">챕터를 선택하세요...</span>
        )}
        <svg className="w-3.5 h-3.5 text-gray-400 ml-auto flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {/* 드롭다운 */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* 검색 */}
          <div className="px-3 py-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색..."
              className="w-full text-sm bg-transparent outline-none placeholder:text-gray-400"
            />
          </div>
          {/* 목록 */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">일치하는 챕터가 없습니다</p>
            ) : (
              filtered.map((ch) => {
                const checked = selected.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => toggle(ch)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2.5 transition-colors
                      ${checked ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs
                      ${checked ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'}`}>
                      {checked && '✓'}
                    </span>
                    <span className="truncate">{ch}</span>
                  </button>
                );
              })
            )}
          </div>
          {/* 선택 수 + 전체 선택/해제 */}
          <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">{selected.length}개 선택됨</span>
            <button
              type="button"
              onClick={() => onChange(selected.length === chapters.length ? [] : [...chapters])}
              className="text-xs text-blue-500 hover:text-blue-600 font-medium"
            >
              {selected.length === chapters.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export type NoteEditorSaveData = Omit<StudyNote, 'id' | 'createdAt'> & { id?: string; pageNumber?: number };

interface StudyNoteEditorProps {
  readingId: string;
  readingCategory: string;
  chapters?: string[];
  preselectedChapter?: string;
  editingNote?: StudyNote | null;
  onSave: (note: NoteEditorSaveData) => void;
  onCancel: () => void;
}

const genId = () => Math.random().toString(36).slice(2, 9);

export function StudyNoteEditor({ readingId, readingCategory, chapters, preselectedChapter, editingNote, onSave, onCancel }: StudyNoteEditorProps) {
  const isCourse = readingCategory === 'rcat-course';
  const { profile } = useUserProfile();
  const userName = profile.name || '나';

  // 도서 본문 에디터 ref (하단 [Claude]/[질문] 버튼이 호출)
  const editorRef = useRef<TiptapEditorHandle>(null);
  // 강좌 섹션별 에디터 ref (마지막 활성/제일 마지막 섹션에 insert)
  const sectionEditorRefs = useRef<Record<string, TiptapEditorHandle | null>>({});
  const lastFocusedSectionRef = useRef<string | null>(null);

  const [date, setDate] = useState(editingNote?.date || new Date().toISOString().slice(0, 10));
  const [selectedChapters, setSelectedChapters] = useState<string[]>(
    editingNote?.chapter || (preselectedChapter ? [preselectedChapter] : [])
  );
  const [chapterInput, setChapterInput] = useState('');
  const [pageNumber, setPageNumber] = useState<string>('');

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

  const toggleChapter = (ch: string) => {
    setSelectedChapters((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const handleAddChapterInput = () => {
    const ch = chapterInput.trim();
    if (ch && !selectedChapters.includes(ch)) {
      setSelectedChapters([...selectedChapters, ch]);
      setChapterInput('');
    }
  };

  const handleSave = () => {
    const chapterValue = selectedChapters.length > 0 ? selectedChapters : undefined;
    const page = pageNumber ? Number(pageNumber) : undefined;
    if (isCourse) {
      onSave({
        id: editingNote?.id,
        readingId,
        date,
        chapter: chapterValue,
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
        chapter: chapterValue,
        content,
        pageNumber: page,
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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="w-full sm:w-40 flex-shrink-0">
          <label className="text-xs text-gray-500 mb-1 block">날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-xs text-gray-500 mb-1 block">챕터/섹션 (복수 선택 가능)</label>
          {chapters && chapters.length > 0 ? (
            <ChapterMultiSelect
              chapters={chapters}
              selected={selectedChapters}
              onChange={setSelectedChapters}
            />
          ) : (
            <div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chapterInput}
                  onChange={(e) => setChapterInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddChapterInput(); } }}
                  placeholder={isCourse ? '예: 3강 - React Hooks' : '예: 3장 - 검증된 학습'}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button type="button" onClick={handleAddChapterInput}
                  className="px-3 py-2 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl font-medium transition-colors">
                  추가
                </button>
              </div>
              {selectedChapters.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedChapters.map((ch) => (
                    <span key={ch} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {ch}
                      <button type="button" onClick={() => setSelectedChapters(selectedChapters.filter((c) => c !== ch))}
                        className="text-blue-400 hover:text-blue-600">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
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
                    ref={(h) => { sectionEditorRefs.current[section.id] = h; }}
                    content={section.content as Record<string, unknown>}
                    onChange={(json) => updateSectionContent(section.id, json)}
                    placeholder="내용을 입력하세요... 볼드, 하이라이트, 인용문, 이미지 등을 활용할 수 있습니다."
                    userName={userName}
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
        <>
          {/* 현재 페이지 입력 */}
          <div className="w-48">
            <label className="text-xs text-gray-500 mb-1 block">현재 페이지 (선택)</label>
            <input
              type="number"
              min={0}
              value={pageNumber}
              onChange={(e) => setPageNumber(e.target.value)}
              placeholder="예: 150"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">노트</label>
            <TiptapEditor
              ref={editorRef}
              content={content}
              onChange={setContent}
              placeholder="스터디 노트를 작성하세요... 인용문, 체크리스트, 하이라이트 등을 활용해보세요."
              userName={userName}
            />
          </div>
        </>
      )}

      {/* 버튼 */}
      <div className="flex justify-end items-center gap-2">
        {/* Claude / 질문 빠른 삽입 버튼 */}
        <button
          type="button"
          onClick={() => {
            if (isCourse) {
              // 강좌: 마지막 활성 섹션 또는 첫 섹션에 삽입
              const id = lastFocusedSectionRef.current
                || Object.keys(sectionEditorRefs.current)[0];
              sectionEditorRefs.current[id]?.insertClaudeBlock();
            } else {
              editorRef.current?.insertClaudeBlock();
            }
          }}
          aria-label="Claude 대화 세트 삽입"
          title="Claude 대화 세트"
          className="px-2.5 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors inline-flex items-center gap-1.5"
        >
          <img src="/images/claude.png" alt="" className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (isCourse) {
              const id = lastFocusedSectionRef.current
                || Object.keys(sectionEditorRefs.current)[0];
              sectionEditorRefs.current[id]?.insertQABlock();
            } else {
              editorRef.current?.insertQABlock();
            }
          }}
          aria-label="질문 + 답변 삽입"
          title="질문 + 답변"
          className="px-2.5 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors inline-flex items-center gap-1.5"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>

        <span className="w-px h-5 bg-gray-200 mx-1" aria-hidden />

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

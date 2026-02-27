/**
 * @file src/components/readings/ReadingDetailView.tsx
 * @description 독서 상세 뷰 (전체화면 오버레이)
 * - 상단: 메타데이터 (이모지/제목/저자/카테고리/진행률/날짜/별점/한줄평/태그/링크) + 수정
 * - 하단: 스터디 노트 타임라인 + 노트 추가/수정
 */
import { useState, useRef, useMemo } from 'react';
import { ReadingItem, ReadingCategory, StudyNote } from '../../types';
import { calcReadingProgress, progressLabel } from '../../utils/readingProgress';
import { StarRating } from './StarRating';
import { StudyNoteCard } from './StudyNoteCard';
import { StudyNoteEditor } from './StudyNoteEditor';
import { generateBookToc } from '../../services/claudeApi';
import { uploadImage } from '../../services/storage.service';

interface ReadingDetailViewProps {
  reading: ReadingItem;
  categories: ReadingCategory[];
  studyNotes: StudyNote[];
  onUpdateReading: (updated: ReadingItem) => void;
  onDeleteReading: (id: string) => void;
  onAddNote: (note: Omit<StudyNote, 'id' | 'createdAt'>) => void;
  onUpdateNote: (note: StudyNote) => void;
  onDeleteNote: (id: string) => void;
  onClose: () => void;
}

export function ReadingDetailView({
  reading, categories, studyNotes,
  onUpdateReading, onDeleteReading,
  onAddNote, onUpdateNote, onDeleteNote,
  onClose,
}: ReadingDetailViewProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...reading });
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<StudyNote | null>(null);
  const [showChapters, setShowChapters] = useState(false);
  const [preselectedChapter, setPreselectedChapter] = useState<string | undefined>();
  const [tocLoading, setTocLoading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);

  // 각 챕터별 노트 작성 여부 추적
  const writtenChapters = useMemo(() => {
    return new Set(studyNotes.map((n) => n.chapter).filter(Boolean));
  }, [studyNotes]);

  const handleCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const url = await uploadImage(file, 'readings');
      setForm((prev) => ({ ...prev, coverImage: url }));
    } catch (err) {
      alert(err instanceof Error ? err.message : '이미지 업로드 실패');
    } finally {
      setCoverUploading(false);
    }
  };

  const progress = calcReadingProgress(reading);
  const pLabel = progressLabel(reading);
  const cat = categories.find((c) => c.id === reading.category);

  const sortedNotes = [...studyNotes].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleSaveMetadata = () => {
    onUpdateReading(form);
    setEditing(false);
  };

  const handleGenerateToc = async () => {
    if (!form.title.trim()) return;
    setTocLoading(true);
    try {
      const chapters = await generateBookToc(form.title, form.author, form.isbn13 || undefined);
      setForm((prev) => ({ ...prev, chapters }));
    } catch {
      alert('목차 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setTocLoading(false);
    }
  };

  const handleSaveNote = (noteData: Omit<StudyNote, 'id' | 'createdAt'> & { id?: string }) => {
    if (noteData.id) {
      // 수정
      const existing = studyNotes.find((n) => n.id === noteData.id);
      if (existing) {
        onUpdateNote({ ...existing, ...noteData, id: existing.id });
      }
    } else {
      // 새 노트
      onAddNote(noteData);
    }
    setShowNoteEditor(false);
    setEditingNote(null);
  };

  const handleEditNote = (note: StudyNote) => {
    setEditingNote(note);
    setShowNoteEditor(true);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#f0f7ff] rounded-3xl shadow-hover w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 바 */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between flex-shrink-0 bg-white/80 border-b border-blue-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            {reading.coverImage
              ? <img src={reading.coverImage} alt={reading.title} className="w-8 h-8 rounded-lg object-cover" />
              : <span className="text-2xl">{reading.coverEmoji}</span>}
            {reading.title}
          </h2>
          <div className="flex items-center gap-2">
            {!editing && (
              <button onClick={() => { setForm({ ...reading }); setEditing(true); }}
                className="text-xs px-2.5 py-1 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium">
                수정
              </button>
            )}
            <button
              onClick={() => {
                if (window.confirm('이 항목을 삭제하시겠습니까?')) {
                  onDeleteReading(reading.id);
                  onClose();
                }
              }}
              className="text-xs px-2 py-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              삭제
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl px-2">×</button>
          </div>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-6 space-y-6">
          {/* ── 메타데이터 섹션 ── */}
          <div className="bg-white rounded-2xl p-5 shadow-soft">
            {!editing ? (
              <div className="flex gap-5">
                {/* 왼쪽: 커버 이미지 (강좌: 정방형, 도서: 세로) */}
                <div className={`w-28 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0 overflow-hidden ${
                  reading.category === 'rcat-course' ? 'h-28' : 'h-40'
                }`}>
                  {reading.coverImage
                    ? <img src={reading.coverImage} alt={reading.title} className="w-full h-full object-cover" />
                    : <span className="text-5xl">{reading.coverEmoji}</span>}
                </div>

                {/* 오른쪽: 정보 */}
                <div className="flex-1 min-w-0 space-y-2.5">
                  {/* 제목 */}
                  <h3 className="font-bold text-gray-800 text-base leading-snug">{reading.title}</h3>

                  {/* 저자 + 종류 + 상태 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-500">{reading.author}</span>
                    {cat && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full text-white font-medium"
                        style={{ backgroundColor: cat.color }}>
                        {cat.label}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      reading.status === 'reading' ? 'bg-blue-100 text-blue-600' :
                      reading.status === 'completed' ? 'bg-green-100 text-green-600' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {reading.status === 'reading' ? '읽는 중' : reading.status === 'completed' ? '완독' : '예정'}
                    </span>
                  </div>

                  {/* 진행률 */}
                  {pLabel && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">진행률</span>
                        <span className="text-xs text-blue-600 font-semibold">{pLabel} ({progress}%)</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full transition-all"
                          style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}

                  {/* 날짜 */}
                  <div className="flex gap-4 text-xs text-gray-400">
                    {reading.startDate && <span>시작 {reading.startDate}</span>}
                    {reading.completedDate && <span>완료 {reading.completedDate}</span>}
                  </div>

                  {/* 별점 + 한줄평 */}
                  {(reading.rating || reading.review) && (
                    <div className="flex items-center gap-2">
                      {reading.rating && <StarRating value={reading.rating} size="text-sm" />}
                      {reading.review && <span className="text-xs text-gray-400 italic truncate">"{reading.review}"</span>}
                    </div>
                  )}

                  {/* 가격 */}
                  {reading.price && (
                    <span className="text-xs text-gray-500">{reading.price.toLocaleString()}원</span>
                  )}

                  {/* 태그 + 바로가기 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {reading.tags?.map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500 font-medium">#{tag}</span>
                    ))}
                    {reading.link && (
                      <a href={reading.link} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium">
                        바로가기 ↗
                      </a>
                    )}
                  </div>

                </div>
              </div>
            ) : (
              /* 수정 모드 */
              <div className="space-y-3">
                <div className="flex gap-3">
                  {/* 커버 */}
                  <div className="flex flex-col items-center gap-1">
                    <div
                      onClick={() => !coverUploading && coverFileRef.current?.click()}
                      className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl cursor-pointer hover:bg-blue-100 transition-colors overflow-hidden border-2 border-dashed border-blue-200"
                      title="클릭하여 이미지 선택"
                    >
                      {coverUploading
                        ? <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        : form.coverImage
                          ? <img src={form.coverImage} alt="cover" className="w-full h-full object-cover" />
                          : form.coverEmoji}
                    </div>
                    <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
                    {form.coverImage ? (
                      <button onClick={() => setForm({ ...form, coverImage: undefined })}
                        className="text-[10px] text-red-400 hover:text-red-500">제거</button>
                    ) : (
                      <input type="text" value={form.coverEmoji}
                        onChange={(e) => setForm({ ...form, coverEmoji: e.target.value })}
                        className="w-14 px-1 py-0.5 bg-gray-50 border border-gray-200 rounded-lg text-center text-xs" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">제목</label>
                    <input type="text" value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">저자/강사</label>
                    <input type="text" value={form.author}
                      onChange={(e) => setForm({ ...form, author: e.target.value })}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div className="w-28">
                    <label className="text-xs text-gray-500 mb-1 block">종류</label>
                    <select value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-gray-500 mb-1 block">상태</label>
                    <select value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as ReadingItem['status'] })}
                      className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm">
                      <option value="planned">예정</option>
                      <option value="reading">읽는 중</option>
                      <option value="completed">완독</option>
                    </select>
                  </div>
                </div>

                {/* 진행률 입력 */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">
                      {categories.find((c) => c.id === form.category)?.label === '강좌' ? '현재 강' : '현재 페이지'}
                    </label>
                    <input type="number" min={0}
                      value={form.category === 'rcat-course' ? (form.currentLesson || 0) : (form.currentPage || 0)}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 0;
                        if (form.category === 'rcat-course') setForm({ ...form, currentLesson: v });
                        else setForm({ ...form, currentPage: v });
                      }}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">
                      {categories.find((c) => c.id === form.category)?.label === '강좌' ? '총 강수' : '총 페이지'}
                    </label>
                    <input type="number" min={0}
                      value={form.category === 'rcat-course' ? (form.totalLessons || 0) : (form.totalPages || 0)}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 0;
                        if (form.category === 'rcat-course') setForm({ ...form, totalLessons: v });
                        else setForm({ ...form, totalPages: v });
                      }}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                  </div>
                </div>

                {/* 날짜 */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">시작일</label>
                    <input type="date" value={form.startDate || ''}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">완료일</label>
                    <input type="date" value={form.completedDate || ''}
                      onChange={(e) => setForm({ ...form, completedDate: e.target.value })}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                  </div>
                </div>

                {/* 별점 + 한줄평 */}
                <div className="flex items-end gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">평점</label>
                    <StarRating value={form.rating || 0} onChange={(r) => setForm({ ...form, rating: r })} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">한줄평</label>
                    <input type="text" value={form.review || ''}
                      onChange={(e) => setForm({ ...form, review: e.target.value })}
                      placeholder="이 책/강의에 대한 한줄평"
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                  </div>
                </div>

                {/* 링크 */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">링크</label>
                  <input type="url" value={form.link || ''}
                    onChange={(e) => setForm({ ...form, link: e.target.value })}
                    placeholder="https://"
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                </div>

                {/* 태그 */}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">태그</label>
                  <input type="text" placeholder="쉼표로 구분하여 입력"
                    value={(form.tags || []).join(', ')}
                    onChange={(e) => setForm({ ...form, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                </div>

                {/* 목차 (도서일 때) */}
                {form.category === 'rcat-book' && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-500">
                        목차 {(form.chapters?.length || 0) > 0 && <span className="text-blue-500">({form.chapters!.length}개)</span>}
                      </label>
                      <button
                        onClick={handleGenerateToc}
                        disabled={tocLoading || !form.title.trim()}
                        className="text-xs px-2.5 py-1 bg-purple-50 text-purple-600 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                      >
                        {tocLoading ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                          생성 중...
                        </span>
                      ) : 'AI 목차 생성'}
                      </button>
                    </div>
                    <textarea
                      placeholder="한 줄에 한 챕터씩 입력"
                      value={(form.chapters || []).join('\n')}
                      onChange={(e) => setForm({ ...form, chapters: e.target.value.split('\n').filter((line) => line.trim()) })}
                      rows={5}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-y" />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setEditing(false)}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
                  <button onClick={handleSaveMetadata}
                    className="px-3 py-1.5 text-xs text-white bg-blue-500 hover:bg-blue-600 rounded-lg font-medium">저장</button>
                </div>
              </div>
            )}
          </div>

          {/* ── 목차 섹션 (도서 + 챕터가 있을 때) ── */}
          {reading.chapters && reading.chapters.length > 0 && (
            <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
              <button
                onClick={() => setShowChapters(!showChapters)}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> 목차
                  <span className="text-xs text-gray-400 font-normal">
                    ({writtenChapters.size}/{reading.chapters.length} 완료)
                  </span>
                </h3>
                <span className="text-xs text-gray-400">{showChapters ? '접기 ▲' : '펼치기 ▼'}</span>
              </button>
              {showChapters && (
                <div className="px-5 pb-4 space-y-1">
                  {reading.chapters.map((ch, idx) => {
                    const done = writtenChapters.has(ch);
                    return (
                      <div key={idx}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                          done ? 'bg-green-50' : 'bg-gray-50'
                        }`}>
                        <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                        }`}>
                          {done ? '✓' : idx + 1}
                        </span>
                        <span className={`flex-1 truncate ${done ? 'text-green-700' : 'text-gray-600'}`}>{ch}</span>
                        {!done && (
                          <button
                            onClick={() => {
                              setEditingNote(null);
                              setPreselectedChapter(ch);
                              setShowNoteEditor(true);
                            }}
                            className="text-[10px] px-2 py-0.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0"
                          >
                            노트 작성
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── 스터디 노트 섹션 ── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> 스터디 노트
                <span className="text-xs text-gray-400 font-normal">({studyNotes.length})</span>
              </h3>
              {!showNoteEditor && (
                <button
                  onClick={() => { setEditingNote(null); setShowNoteEditor(true); }}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-white rounded-xl shadow-soft hover:shadow-hover transition-all"
                >
                  + 노트 추가
                </button>
              )}
            </div>

            {/* 노트 에디터 */}
            {showNoteEditor && (
              <div className="mb-4">
                <StudyNoteEditor
                  readingId={reading.id}
                  readingCategory={reading.category}
                  chapters={reading.chapters}
                  preselectedChapter={preselectedChapter}
                  editingNote={editingNote}
                  onSave={(noteData) => { handleSaveNote(noteData); setPreselectedChapter(undefined); }}
                  onCancel={() => { setShowNoteEditor(false); setEditingNote(null); setPreselectedChapter(undefined); }}
                />
              </div>
            )}

            {/* 타임라인 */}
            {sortedNotes.length > 0 ? (
              <div className="relative">
                {sortedNotes.map((note) => (
                  <StudyNoteCard
                    key={note.id}
                    note={note}
                    readingCategory={reading.category}
                    onEdit={handleEditNote}
                    onDelete={onDeleteNote}
                    onUpdateNote={onUpdateNote}
                  />
                ))}
              </div>
            ) : (
              !showNoteEditor && (
                <p className="text-sm text-gray-400 text-center py-8">
                  아직 스터디 노트가 없습니다. 위의 "+ 노트 추가" 버튼을 눌러 시작하세요.
                </p>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

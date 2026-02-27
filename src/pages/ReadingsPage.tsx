/**
 * @file src/pages/ReadingsPage.tsx
 * @description 독서/스터디 페이지
 * - 상태 필터 (전체/읽는 중/완독/예정)
 * - 카테고리 뱃지, 자동 진행률, 별점 표시
 * - 카드 클릭 → ReadingDetailView (스터디 노트 타임라인 포함)
 * - 종류(카테고리) 커스텀 관리
 */
import { useState, useMemo, useRef } from 'react';
import { ReadingItem, ReadingCategory, StudyNote } from '../types';
import { defaultReadingCategories } from '../data';
import { useReadings } from '../hooks/useReadings';
import { calcReadingProgress, progressLabel } from '../utils/readingProgress';
import { StarRating } from '../components/readings/StarRating';
import { ReadingDetailView } from '../components/readings/ReadingDetailView';
import { searchBooks, getBookDetail, parseCategoryToTags, AladinSearchItem } from '../services/aladinApi';
import { generateBookToc } from '../services/claudeApi';
import { uploadImage } from '../services/storage.service';

const statusStyle: Record<ReadingItem['status'], { label: string; cls: string }> = {
  reading:   { label: '읽는 중', cls: 'bg-blue-100 text-blue-600' },
  completed: { label: '완독',   cls: 'bg-green-100 text-green-600' },
  planned:   { label: '예정',   cls: 'bg-gray-100 text-gray-500' },
};

export function ReadingsPage() {
  const {
    readings, studyNotes,
    addReading: hookAddReading, updateReading: hookUpdateReading, removeReading: hookRemoveReading,
    addNote: hookAddNote, updateNote: hookUpdateNote, removeNote: hookRemoveNote,
  } = useReadings();
  const [categories] = useState<ReadingCategory[]>(defaultReadingCategories);
  const [showForm, setShowForm] = useState(false);
  const [selectedReading, setSelectedReading] = useState<ReadingItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ReadingItem['status']>('all');

  // 추가 폼
  const [form, setForm] = useState({
    title: '', author: '', category: 'rcat-book', coverEmoji: '📖', coverImage: '' as string,
    startDate: new Date().toISOString().slice(0, 10),
    totalPages: '', totalLessons: '', tagInput: '', tags: [] as string[], link: '',
    price: '', isbn13: '', chapters: [] as string[],
  });
  const coverFileRef = useRef<HTMLInputElement>(null);

  // 알라딘 검색 상태
  const [aladinQuery, setAladinQuery] = useState('');
  const [aladinResults, setAladinResults] = useState<AladinSearchItem[]>([]);
  const [aladinLoading, setAladinLoading] = useState(false);
  const [aladinError, setAladinError] = useState('');
  // AI 목차 생성 상태
  const [tocLoading, setTocLoading] = useState(false);
  const [aladinSelected, setAladinSelected] = useState(false);

  const handleAladinSearch = async () => {
    if (!aladinQuery.trim()) return;
    setAladinLoading(true);
    setAladinError('');
    setAladinResults([]);
    setAladinSelected(false);
    try {
      const results = await searchBooks(aladinQuery);
      setAladinResults(results);
      if (results.length === 0) setAladinError('검색 결과가 없습니다');
    } catch {
      setAladinError('검색 중 오류가 발생했습니다');
    } finally {
      setAladinLoading(false);
    }
  };

  const handleAladinSelect = async (item: AladinSearchItem) => {
    setAladinLoading(true);
    try {
      const detail = await getBookDetail(item.isbn13);
      const tags = parseCategoryToTags(item.categoryName);
      setForm((prev) => ({
        ...prev,
        title: item.title.replace(/ - .*$/, ''),  // 부제 제거
        author: item.author.replace(/ \(지은이\).*$/, '').replace(/ \(옮긴이\).*$/, ''),
        coverImage: item.cover,
        coverEmoji: '📖',
        tags,
        tagInput: '',
        link: item.link,
        totalPages: detail?.subInfo?.itemPage ? String(detail.subInfo.itemPage) : '',
        price: item.priceSales ? String(item.priceSales) : String(item.priceStandard),
        isbn13: item.isbn13,
      }));
      setAladinSelected(true);
      setAladinResults([]);
    } catch {
      setAladinError('상세 정보를 가져오지 못했습니다');
    } finally {
      setAladinLoading(false);
    }
  };

  const [coverUploading, setCoverUploading] = useState(false);

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

  // 필터링
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return readings;
    return readings.filter((r) => r.status === statusFilter);
  }, [readings, statusFilter]);

  // 상태별 카운트
  const counts = useMemo(() => ({
    all: readings.length,
    reading: readings.filter((r) => r.status === 'reading').length,
    completed: readings.filter((r) => r.status === 'completed').length,
    planned: readings.filter((r) => r.status === 'planned').length,
  }), [readings]);

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    const isCourseCat = form.category === 'rcat-course';
    const isBookCat = form.category === 'rcat-book';
    try {
      await hookAddReading({
        title: form.title,
        author: form.author,
        category: form.category,
        status: 'planned',
        coverEmoji: form.coverEmoji,
        coverImage: form.coverImage || undefined,
        startDate: form.startDate,
        totalPages: !isCourseCat && form.totalPages ? Number(form.totalPages) : undefined,
        totalLessons: isCourseCat && form.totalLessons ? Number(form.totalLessons) : undefined,
        tags: form.tags.length > 0 ? form.tags : undefined,
        link: form.link || undefined,
        price: isBookCat && form.price ? Number(form.price) : undefined,
        chapters: isBookCat && form.chapters.length > 0 ? form.chapters : undefined,
        isbn13: isBookCat && form.isbn13 ? form.isbn13 : undefined,
      });
      resetForm();
      setShowForm(false);
    } catch {
      alert('독서 추가에 실패했습니다. 다시 시도해주세요.');
    }
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

  const resetForm = () => {
    setForm({
      title: '', author: '', category: 'rcat-book', coverEmoji: '📖', coverImage: '',
      startDate: new Date().toISOString().slice(0, 10),
      totalPages: '', totalLessons: '', tagInput: '', tags: [], link: '',
      price: '', isbn13: '', chapters: [],
    });
    setAladinQuery('');
    setAladinResults([]);
    setAladinError('');
    setAladinSelected(false);
  };

  // 스터디 노트 CRUD
  const notesForSelected = useMemo(() => {
    if (!selectedReading) return [];
    return studyNotes.filter((n) => n.readingId === selectedReading.id);
  }, [studyNotes, selectedReading]);

  const handleAddNote = (note: Omit<StudyNote, 'id' | 'createdAt'>) => {
    hookAddNote(note);
  };

  const handleUpdateNote = (updated: StudyNote) => {
    hookUpdateNote(updated.id, updated);
  };

  const handleDeleteNote = (id: string) => {
    hookRemoveNote(id);
  };

  const handleAddTag = () => {
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag], tagInput: '' });
    }
  };

  return (
    <div className="min-h-full bg-[#f0f7ff] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <img src="/images/book.png" alt="스터디" className="w-6 h-6 object-contain" />
            스터디
          </h1>
          <button onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-white rounded-xl shadow-soft hover:shadow-hover transition-all">
            + 추가
          </button>
        </div>

        {/* 상태 필터 */}
        <div className="flex gap-2">
          {([['all', '전체'], ['reading', '읽는 중'], ['completed', '완독'], ['planned', '예정']] as const).map(([key, label]) => (
            <button key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                statusFilter === key ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-100 shadow-soft'
              }`}>
              {label}
              <span className="ml-1 opacity-70">{counts[key]}</span>
            </button>
          ))}
        </div>

        {/* 추가 폼 */}
        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-soft space-y-3">
            {/* 종류 선택 (최상단) */}
            <div className="flex gap-2">
              <select value={form.category}
                onChange={(e) => {
                  setForm({ ...form, category: e.target.value });
                  if (e.target.value !== 'rcat-book') {
                    setAladinResults([]);
                    setAladinQuery('');
                    setAladinSelected(false);
                    setAladinError('');
                  }
                }}
                className="w-28 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <span className="text-xs text-gray-400 self-center">
                {form.category === 'rcat-book' ? '알라딘에서 도서 검색 가능' : '직접 입력'}
              </span>
            </div>

            {/* 알라딘 도서 검색 (도서일 때만) */}
            {form.category === 'rcat-book' && !aladinSelected && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input type="text" placeholder="책 제목으로 검색..." value={aladinQuery}
                    onChange={(e) => setAladinQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleAladinSearch(); } }}
                    className="flex-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder-blue-300" />
                  <button onClick={handleAladinSearch} disabled={aladinLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 rounded-xl transition-colors">
                    {aladinLoading ? '검색 중...' : '검색'}
                  </button>
                </div>

                {aladinError && <p className="text-xs text-red-400">{aladinError}</p>}

                {/* 검색 결과 리스트 */}
                {aladinResults.length > 0 && (
                  <div className="max-h-64 overflow-y-auto space-y-1.5 border border-gray-100 rounded-xl p-2 bg-gray-50">
                    {aladinResults.map((item) => (
                      <button key={item.isbn13} onClick={() => handleAladinSelect(item)}
                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-blue-50 transition-colors text-left">
                        <img src={item.cover} alt={item.title}
                          className="w-10 h-14 object-cover rounded-lg flex-shrink-0 bg-gray-200" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                          <p className="text-xs text-gray-500 truncate">{item.author}</p>
                          <p className="text-xs text-gray-400">{item.publisher} · {item.pubDate}</p>
                        </div>
                        <span className="text-xs text-blue-500 font-medium flex-shrink-0">
                          {item.priceSales?.toLocaleString()}원
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 알라딘 선택 완료 표시 */}
            {form.category === 'rcat-book' && aladinSelected && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
                <span className="text-xs text-green-600">✓ 알라딘에서 도서 정보를 가져왔습니다</span>
                <button onClick={() => { setAladinSelected(false); setAladinQuery(''); }}
                  className="text-xs text-blue-500 hover:text-blue-600 ml-auto">다시 검색</button>
              </div>
            )}

            {/* 커버 + 제목 */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center gap-1">
                <div
                  onClick={() => !coverUploading && coverFileRef.current?.click()}
                  className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0 cursor-pointer hover:bg-blue-100 transition-colors overflow-hidden border-2 border-dashed border-blue-200"
                  title="클릭하여 이미지 선택"
                >
                  {coverUploading
                    ? <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    : form.coverImage
                      ? <img src={form.coverImage} alt="cover" className="w-full h-full object-cover" />
                      : form.coverEmoji || '📖'}
                </div>
                <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFile} />
                {form.coverImage && !aladinSelected ? (
                  <button onClick={() => setForm({ ...form, coverImage: '' })}
                    className="text-[10px] text-red-400 hover:text-red-500">제거</button>
                ) : null}
              </div>
              <input type="text" placeholder="제목" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 self-start mt-1" />
            </div>

            <div className="flex gap-2">
              <input type="text" placeholder="저자/강사" value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">시작일</label>
                <input type="date" value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">
                  {form.category === 'rcat-course' ? '총 강수' : '총 페이지'}
                </label>
                <input type="number" min={0} placeholder="선택"
                  value={form.category === 'rcat-course' ? form.totalLessons : form.totalPages}
                  onChange={(e) => {
                    if (form.category === 'rcat-course') setForm({ ...form, totalLessons: e.target.value });
                    else setForm({ ...form, totalPages: e.target.value });
                  }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </div>

            {/* 링크 */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">링크 (선택)</label>
              <input type="url" placeholder="https://" value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>

            {/* 태그 */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">태그</label>
              <div className="flex gap-2 items-center flex-wrap">
                <input type="text" placeholder="태그 입력 후 Enter" value={form.tagInput}
                  onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddTag(); } }}
                  className="flex-1 min-w-[140px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                {form.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                    #{t}
                    <button onClick={() => setForm({ ...form, tags: form.tags.filter((tt) => tt !== t) })}
                      className="text-blue-400 hover:text-blue-600">x</button>
                  </span>
                ))}
              </div>
            </div>

            {/* 가격 (도서만) */}
            {form.category === 'rcat-book' && form.price && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">가격</label>
                <input type="text" value={Number(form.price).toLocaleString() + '원'} readOnly
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600" />
              </div>
            )}

            {/* 목차 (도서일 때) */}
            {form.category === 'rcat-book' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-500">
                    목차 {form.chapters.length > 0 && <span className="text-blue-500">({form.chapters.length}개 챕터)</span>}
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
                  placeholder="한 줄에 한 챕터씩 입력&#10;예:&#10;0-1 프롤로그&#10;1-1 첫 번째 소제목&#10;1-2 두 번째 소제목"
                  value={form.chapters.join('\n')}
                  onChange={(e) => setForm({ ...form, chapters: e.target.value.split('\n').filter((line) => line.trim()) })}
                  rows={5}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => { resetForm(); setShowForm(false); }} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">취소</button>
              <button onClick={handleAdd} className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-xl font-medium">추가</button>
            </div>
          </div>
        )}

        {/* 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((item) => {
            const status = statusStyle[item.status];
            const progress = calcReadingProgress(item);
            const pLabel = progressLabel(item);
            const cat = categories.find((c) => c.id === item.category);
            const noteCount = studyNotes.filter((n) => n.readingId === item.id).length;

            return (
              <div key={item.id}
                onClick={() => setSelectedReading(item)}
                className="bg-white rounded-2xl p-5 shadow-soft hover:shadow-hover transition-all duration-300 cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                    {item.coverImage
                      ? <img src={item.coverImage} alt={item.title} className="w-full h-full object-cover" />
                      : item.coverEmoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-800 text-sm truncate">{item.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${status.cls}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{item.author}</span>
                      {cat && (
                        <span className="px-1.5 py-0.5 rounded-full text-white text-[10px] font-medium"
                          style={{ backgroundColor: cat.color }}>
                          {cat.label}
                        </span>
                      )}
                      {item.startDate && <span className="text-gray-400">{item.startDate}</span>}
                    </p>
                  </div>
                </div>

                {/* 진행률 */}
                {pLabel && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">진행률</span>
                      <span className="text-xs font-semibold text-blue-600">{pLabel} ({progress}%)</span>
                    </div>
                    <div className="w-full h-2 bg-blue-50 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                {/* 하단: 별점 + 노트 수 */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.rating && <StarRating value={item.rating} size="text-sm" />}
                  </div>
                  {noteCount > 0 && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      📝 {noteCount}
                    </span>
                  )}
                </div>

                {/* 태그 */}
                {item.tags && item.tags.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {item.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">해당하는 항목이 없습니다</p>
        )}
      </div>

      {/* 독서 상세 뷰 */}
      {selectedReading && (
        <ReadingDetailView
          reading={selectedReading}
          categories={categories}
          studyNotes={notesForSelected}
          onUpdateReading={(updated) => {
            hookUpdateReading(updated.id, updated);
            setSelectedReading(updated);
          }}
          onDeleteReading={(id) => {
            hookRemoveReading(id);
            setSelectedReading(null);
          }}
          onAddNote={handleAddNote}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
          onClose={() => setSelectedReading(null)}
        />
      )}
    </div>
  );
}

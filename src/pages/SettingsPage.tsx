/**
 * @file src/pages/SettingsPage.tsx
 * @description 설정 페이지
 * - 내 정보 섹션 (이름, 소개, 대화 스타일)
 * - 프로젝트 관리 섹션 (추가/편집/삭제/순서 변경)
 * - 나머지 설정은 "준비 중" placeholder
 */
import { useState, useRef, useEffect } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useUserProfile, UserProfile } from '../hooks/useUserProfile';
import { useAuth } from '../hooks/useAuth';
import { Project } from '../types';
import { uploadImage, deleteImage } from '../services/storage.service';

const PROJECT_COLOR_PRESETS = [
  '#a855f7', '#ec4899', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6', '#6366f1',
  '#78716c', '#ef4444',
];

const EMOJI_PRESETS = [
  '📁', '🚀', '💡', '🎯', '📊', '🛒', '🎨', '📱',
  '💻', '📝', '🏠', '🎓', '💰', '🌱', '⭐', '🔥',
  '📚', '🎵', '✈️', '🏋️', '🍳', '❤️', '🤖', '📸',
];

const EMPTY_PROJECT: Omit<Project, 'id'> = {
  name: '',
  emoji: '📁',
  color: '#a855f7',
  image: '',
  description: '',
  status: 'active',
  priority: 999,
  startDate: '',
  endDate: '',
};

export function SettingsPage() {
  const { user } = useAuth();
  const { profile, loading: profileLoading, save: saveProfile } = useUserProfile();
  const { projects, loading, add, update, remove, reorder } = useProjects();

  // 내 정보 폼
  const [profileForm, setProfileForm] = useState<Omit<UserProfile, 'id'>>({
    name: '', bio: '', tone: 'polite', responseLength: 'short', emojiUsage: 'moderate',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    const googleName = user?.user_metadata?.name || user?.email?.split('@')[0] || '';
    if (profile.id) {
      setProfileForm({
        name: profile.name || googleName,
        bio: profile.bio,
        tone: profile.tone,
        responseLength: profile.responseLength,
        emojiUsage: profile.emojiUsage,
      });
    } else if (!profileLoading && googleName) {
      // 프로필이 아직 없으면 구글 이름으로 초기화
      setProfileForm((f) => ({ ...f, name: f.name || googleName }));
    }
  }, [profile, user, profileLoading]);

  const handleProfileSave = async () => {
    if (!profileForm.name.trim()) return;
    setProfileSaving(true);
    const ok = await saveProfile(profileForm);
    setProfileSaving(false);
    if (ok) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    }
  };
  const [editing, setEditing] = useState<string | null>(null); // project id or 'new'
  const [form, setForm] = useState<Omit<Project, 'id'>>(EMPTY_PROJECT);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [iconTab, setIconTab] = useState<'emoji' | 'image'>('emoji');
  const [imageUploading, setImageUploading] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const startAdd = () => {
    setEditing('new');
    setForm({ ...EMPTY_PROJECT, priority: projects.length + 1 });
    setIconTab('emoji');
  };

  const startEdit = (p: Project) => {
    setEditing(p.id);
    setForm({ name: p.name, emoji: p.emoji, color: p.color, image: p.image, description: p.description, status: p.status, priority: p.priority, startDate: p.startDate || '', endDate: p.endDate || '' });
    setIconTab(p.image ? 'image' : 'emoji');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      // 기존 이미지가 Storage URL이면 삭제
      if (form.image) {
        try { await deleteImage(form.image); } catch { /* ignore */ }
      }
      const url = await uploadImage(file, 'projects');
      setForm((f) => ({ ...f, image: url }));
    } catch (err) {
      alert(err instanceof Error ? err.message : '이미지 업로드 실패');
    } finally {
      setImageUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editing === 'new') {
      await add(form);
    } else if (editing) {
      await update(editing, form);
    }
    setEditing(null);
    setForm(EMPTY_PROJECT);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    setDeleteConfirm(null);
  };

  const handleCancel = () => {
    setEditing(null);
    setForm(EMPTY_PROJECT);
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-full p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="text-gray-400 text-sm">로딩 중...</div>
      </div>
    );
  }

  const selectStyle = "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239ca3af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8";

  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-white to-primary-50/20 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-800">설정</h1>

        {/* 내 정보 */}
        <section className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-soft p-4 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              내 정보
            </h2>
            <button
              onClick={handleProfileSave}
              disabled={profileSaving || !profileForm.name.trim()}
              className={`px-4 py-1.5 text-sm rounded-xl font-medium transition-all ${
                profileSaved
                  ? 'bg-green-100 text-green-600'
                  : 'bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50'
              }`}
            >
              {profileSaved ? '저장됨' : profileSaving ? '저장 중...' : '저장'}
            </button>
          </div>

          <div className="space-y-5">
            {/* 이름 */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">이름 *</label>
              <input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="이름을 입력하세요"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
            </div>

            {/* 나에 대해 */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1.5">나에 대해 <span className="text-gray-400 font-normal">(AI가 참고할 내용)</span></label>
              <textarea
                value={profileForm.bio}
                onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                rows={3}
                placeholder="예: 1인 사업가, 3개 프로젝트 운영 중. 피드백은 솔직하게 해줘도 OK"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
            </div>

            {/* 대화 스타일 */}
            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-600 mb-4">선호하는 대화 스타일</h3>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">톤</label>
                  <select
                    value={profileForm.tone}
                    onChange={(e) => setProfileForm((f) => ({ ...f, tone: e.target.value }))}
                    className={selectStyle}
                  >
                    <option value="friendly">친근하게</option>
                    <option value="polite">존댓말</option>
                    <option value="formal">격식있게</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">답변 길이</label>
                  <select
                    value={profileForm.responseLength}
                    onChange={(e) => setProfileForm((f) => ({ ...f, responseLength: e.target.value }))}
                    className={selectStyle}
                  >
                    <option value="short">짧게</option>
                    <option value="medium">적당히</option>
                    <option value="detailed">자세히</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">이모지</label>
                  <select
                    value={profileForm.emojiUsage}
                    onChange={(e) => setProfileForm((f) => ({ ...f, emojiUsage: e.target.value }))}
                    className={selectStyle}
                  >
                    <option value="many">많이</option>
                    <option value="moderate">적당히</option>
                    <option value="few">거의 안씀</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 프로젝트 관리 */}
        <section className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-soft p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">프로젝트 관리</h2>
            <button
              onClick={startAdd}
              className="px-3 py-1.5 bg-primary-500 text-white text-sm rounded-xl hover:bg-primary-600 transition-colors"
            >
              + 추가
            </button>
          </div>

          {/* 프로젝트 목록 */}
          <div className="space-y-2">
            {projects.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-2xl group"
              >
                {/* 아이콘 */}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: p.color?.startsWith('#') ? p.color + '20' : undefined }}>
                  {p.image
                    ? <img src={p.image} alt={p.name} className="w-5 h-5 object-contain" />
                    : <span className="text-lg">{p.emoji}</span>}
                </div>

                {/* 이름 & 설명 */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-800 truncate">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-gray-400 truncate">{p.description}</div>
                  )}
                </div>

                {/* 상태 뱃지 */}
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                  p.status === 'active' ? 'bg-green-100 text-green-600' :
                  p.status === 'paused' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {p.status === 'active' ? '진행' : p.status === 'paused' ? '일시정지' : p.status === 'completed' ? '완료' : p.status || '진행'}
                </span>

                {/* 순서 변경 & 편집/삭제 */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => reorder(p.id, 'up')}
                    disabled={idx === 0}
                    className="w-6 h-6 rounded-lg bg-white hover:bg-gray-100 flex items-center justify-center text-gray-400 disabled:opacity-30 text-xs"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => reorder(p.id, 'down')}
                    disabled={idx === projects.length - 1}
                    className="w-6 h-6 rounded-lg bg-white hover:bg-gray-100 flex items-center justify-center text-gray-400 disabled:opacity-30 text-xs"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => startEdit(p)}
                    className="w-6 h-6 rounded-lg bg-white hover:bg-purple-50 flex items-center justify-center text-gray-400 hover:text-purple-500"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(p.id)}
                    className="w-6 h-6 rounded-lg bg-white hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {projects.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">
              프로젝트가 없습니다. 추가 버튼을 눌러 프로젝트를 만들어보세요.
            </p>
          )}
        </section>

        {/* 편집/추가 모달 */}
        {editing && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={handleCancel}>
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-800">
                {editing === 'new' ? '프로젝트 추가' : '프로젝트 편집'}
              </h3>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">프로젝트 이름 *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                    placeholder="프로젝트 이름"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">설명</label>
                  <input
                    value={form.description || ''}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                    placeholder="프로젝트 설명"
                  />
                </div>

                {/* 아이콘: 이모지 / 이미지 탭 */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">아이콘</label>
                  <div className="flex gap-1 mb-2">
                    <button onClick={() => setIconTab('emoji')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        iconTab === 'emoji' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                      }`}>이모지</button>
                    <button onClick={() => setIconTab('image')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        iconTab === 'image' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'
                      }`}>이미지</button>
                  </div>
                  {iconTab === 'emoji' ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">{form.emoji}</span>
                        <span className="text-xs text-gray-400">선택하거나 직접 입력하세요</span>
                      </div>
                      <div className="grid grid-cols-8 gap-1 mb-2">
                        {EMOJI_PRESETS.map((e) => (
                          <button
                            key={e}
                            onClick={() => setForm((f) => ({ ...f, emoji: e, image: '' }))}
                            className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${
                              form.emoji === e ? 'bg-purple-100 ring-2 ring-purple-400 scale-110' : 'hover:bg-gray-100'
                            }`}
                          >{e}</button>
                        ))}
                      </div>
                      <input
                        value={form.emoji}
                        onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value, image: '' }))}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                        placeholder="직접 이모지 입력"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {form.image ? (
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                          <img src={form.image} alt="프로젝트" className="w-full h-full object-cover" />
                        </div>
                      ) : null}
                      <button
                        onClick={() => imageFileRef.current?.click()}
                        disabled={imageUploading}
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 border-dashed rounded-xl text-xs text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
                      >
                        {imageUploading
                          ? <span className="inline-flex items-center gap-1"><span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> 업로드 중...</span>
                          : form.image ? '이미지 변경' : '이미지 업로드'}
                      </button>
                      <input ref={imageFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleImageUpload} />
                      {form.image && (
                        <button onClick={() => setForm((f) => ({ ...f, image: '' }))}
                          className="text-xs text-red-400 hover:text-red-500 flex-shrink-0">제거</button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">상태</label>
                  <select
                    value={form.status || 'active'}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                  >
                    <option value="active">진행</option>
                    <option value="paused">일시정지</option>
                    <option value="completed">완료</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">기간</label>
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">시작일</span>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!form.startDate}
                              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.checked ? '' : new Date().toISOString().split('T')[0] }))}
                              className="w-3 h-3 rounded accent-purple-500"
                            />
                            <span className="text-xs text-gray-400">미정</span>
                          </label>
                        </div>
                        <input
                          type="date"
                          value={form.startDate || ''}
                          onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                          disabled={!form.startDate}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </div>
                      <span className="text-xs text-gray-400 mt-5">~</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">종료일</span>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!form.endDate}
                              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.checked ? '' : new Date().toISOString().split('T')[0] }))}
                              className="w-3 h-3 rounded accent-purple-500"
                            />
                            <span className="text-xs text-gray-400">미정</span>
                          </label>
                        </div>
                        <input
                          type="date"
                          value={form.endDate || ''}
                          onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                          disabled={!form.endDate}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">컬러</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PROJECT_COLOR_PRESETS.map((c) => (
                      <button key={c}
                        onClick={() => setForm((f) => ({ ...f, color: c }))}
                        className={`w-7 h-7 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-1 ring-gray-600 scale-110' : 'hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <div className="relative">
                      <button
                        onClick={() => colorInputRef.current?.click()}
                        className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-600 text-xs"
                        title="직접 색상 선택"
                      >+</button>
                      <input
                        ref={colorInputRef}
                        type="color"
                        value={form.color?.startsWith('#') ? form.color : '#a855f7'}
                        onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                        className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
                      />
                    </div>
                    {form.color && !PROJECT_COLOR_PRESETS.includes(form.color) && form.color.startsWith('#') && (
                      <span className="w-7 h-7 rounded-full ring-2 ring-offset-1 ring-gray-600 scale-110" style={{ backgroundColor: form.color }} />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={!form.name.trim()}
                  className="flex-1 py-2 bg-primary-500 text-white rounded-xl text-sm hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 삭제 확인 */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-gray-600 mb-4">
                이 프로젝트를 삭제하시겠습니까?<br />
                <span className="text-xs text-red-400">관련된 목표와 데이터도 함께 삭제됩니다.</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm hover:bg-red-600"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 기타 설정 (placeholder) */}
        <section className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-soft p-4 sm:p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">기타 설정</h2>
          <div className="space-y-3">
            {['AI 캐릭터 설정', '알림 설정', '테마 설정', '데이터 관리'].map((label) => (
              <div
                key={label}
                className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-2xl"
              >
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">준비 중</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

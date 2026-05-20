/**
 * @file src/pages/SettingsPage.modern.tsx
 * @description 설정 페이지 — 모던 테마 (MUJI 톤)
 * - 내 정보 (이름·소개·대화 스타일)
 * - 테마 (ThemePicker 그대로 호출)
 * - 알림 (NotificationSettings 그대로 호출)
 * - 프로젝트 관리 (간단 추가/편집/삭제)
 */
import { useState, useEffect } from 'react';
import { useUserProfile, UserProfile } from '../hooks/useUserProfile';
import { useAuth } from '../hooks/useAuth';
import { useProjects } from '../hooks/useProjects';
import { Project } from '../types';
import { uploadImage, deleteImage } from '../services/storage.service';
import { NotificationSettings } from '../components/NotificationSettings';
import { ThemePicker } from '../components/ThemePicker';

const EMOJI_PRESETS = [
  '📁', '🚀', '💡', '🎯', '📊', '🛒', '🎨', '📱',
  '💻', '📝', '🏠', '🎓', '💰', '🌱', '⭐', '🔥',
];

const EMPTY_PROJECT: Omit<Project, 'id'> = {
  name: '', emoji: '📁', color: '#1b4332', image: '',
  description: '', status: 'active', priority: 999,
  startDate: '', endDate: '',
};

export function SettingsPageModern() {
  const { user } = useAuth();
  const { profile, loading: profileLoading, save: saveProfile } = useUserProfile();
  const { projects, loading: projectsLoading, add, update, remove } = useProjects();

  // 내 정보 폼
  const [profileForm, setProfileForm] = useState<Omit<UserProfile, 'id' | 'activeTheme'>>({
    name: '', bio: '', tone: 'polite', responseLength: 'short', emojiUsage: 'moderate',
  });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

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
      setProfileForm((f) => ({ ...f, name: f.name || googleName }));
    }
  }, [profile, user, profileLoading]);

  const handleProfileSave = async () => {
    if (!profileForm.name.trim()) return;
    setProfileSaving(true);
    const ok = await saveProfile(profileForm);
    setProfileSaving(false);
    if (ok) setProfileEditing(false);
  };

  // 프로젝트 편집
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Project, 'id'>>(EMPTY_PROJECT);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const startAdd = () => {
    setEditing('new');
    setForm({ ...EMPTY_PROJECT, priority: projects.length + 1 });
  };

  const startEdit = (p: Project) => {
    setEditing(p.id);
    setForm({
      name: p.name, emoji: p.emoji, color: p.color, image: p.image,
      description: p.description, status: p.status, priority: p.priority,
      startDate: p.startDate || '', endDate: p.endDate || '',
    });
  };

  const handleSaveProject = async () => {
    if (!form.name.trim()) return;
    if (editing === 'new') {
      await add(form);
    } else if (editing) {
      await update(editing, form);
    }
    setEditing(null);
    setForm(EMPTY_PROJECT);
  };

  const handleCancel = () => {
    setEditing(null);
    setForm(EMPTY_PROJECT);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    setDeleteConfirm(null);
  };

  const [imageUploading, setImageUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
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

  return (
    <main className="min-h-full bg-surface text-foreground">
      <div className="mx-auto max-w-3xl px-5 sm:px-8 py-10 sm:py-14 space-y-14 sm:space-y-16">

        {/* ── Page Header ── */}
        <section>
          <p className="label">Settings</p>
          <h1 className="mt-5 text-4xl font-light leading-[1.25] sm:text-5xl">
            설정
          </h1>
          <p className="mt-4 text-sm text-foreground-muted">
            프로필 · 테마 · 알림 · 프로젝트 관리
          </p>
        </section>

        {/* ── 내 정보 ── */}
        <section className="space-y-5">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <div className="flex items-baseline gap-3">
              <p className="label">Profile</p>
              <h2 className="text-base font-normal text-foreground-muted">내 정보</h2>
            </div>
            {!profileEditing ? (
              <button
                type="button"
                onClick={() => setProfileEditing(true)}
                className="text-xs text-foreground-muted hover:text-foreground transition-colors"
              >
                수정 →
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setProfileEditing(false); }}
                  className="text-xs text-foreground-muted hover:text-foreground transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleProfileSave}
                  disabled={profileSaving || !profileForm.name.trim()}
                  className="border border-foreground bg-foreground px-3 py-1 text-xs text-surface hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-40 transition-colors"
                >
                  {profileSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            )}
          </div>

          {profileEditing ? (
            <div className="space-y-5">
              <label className="block space-y-2">
                <span className="label">이름</span>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="이름"
                  className="w-full border border-line bg-surface px-4 py-3 text-base placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
                />
              </label>

              <label className="block space-y-2">
                <span className="label">소개</span>
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  placeholder="AI가 참고할 내용 (1인 사업가, 운영 중인 프로젝트, 피드백 선호도 등)"
                  className="w-full border border-line bg-surface px-4 py-3 text-sm resize-none placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
                />
              </label>

              <div className="space-y-3 pt-5 border-t border-line">
                <p className="label">대화 스타일</p>
                <div className="grid grid-cols-3 gap-3">
                  <label className="block space-y-1.5">
                    <span className="text-[11px] text-foreground-faint">톤</span>
                    <select
                      value={profileForm.tone}
                      onChange={(e) => setProfileForm((f) => ({ ...f, tone: e.target.value }))}
                      className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
                    >
                      <option value="friendly">친근하게</option>
                      <option value="polite">존댓말</option>
                      <option value="formal">격식있게</option>
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[11px] text-foreground-faint">답변 길이</span>
                    <select
                      value={profileForm.responseLength}
                      onChange={(e) => setProfileForm((f) => ({ ...f, responseLength: e.target.value }))}
                      className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
                    >
                      <option value="short">짧게</option>
                      <option value="medium">적당히</option>
                      <option value="detailed">자세히</option>
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-[11px] text-foreground-faint">이모지</span>
                    <select
                      value={profileForm.emojiUsage}
                      onChange={(e) => setProfileForm((f) => ({ ...f, emojiUsage: e.target.value }))}
                      className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
                    >
                      <option value="many">많이</option>
                      <option value="moderate">적당히</option>
                      <option value="few">거의 안씀</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 border border-line bg-surface-muted flex items-center justify-center text-base font-light text-foreground-muted">
                  {(profile.name || '?')[0]}
                </div>
                <div>
                  <p className="text-base">{profile.name || '이름 미설정'}</p>
                  <p className="text-xs text-foreground-faint">{user?.email}</p>
                </div>
              </div>
              {profile.bio && (
                <div className="pt-3 border-t border-line">
                  <p className="label mb-1.5">소개</p>
                  <p className="text-sm text-foreground-muted leading-[1.7]">{profile.bio}</p>
                </div>
              )}
              <div className="pt-3 border-t border-line">
                <p className="label mb-2">대화 스타일</p>
                <div className="flex flex-wrap gap-3 text-xs text-foreground-muted">
                  <span>톤 · <span className="text-foreground">{ ({ friendly: '친근하게', polite: '존댓말', formal: '격식있게' } as Record<string, string>)[profile.tone] || profile.tone }</span></span>
                  <span>길이 · <span className="text-foreground">{ ({ short: '짧게', medium: '적당히', detailed: '자세히' } as Record<string, string>)[profile.responseLength] || profile.responseLength }</span></span>
                  <span>이모지 · <span className="text-foreground">{ ({ many: '많이', moderate: '적당히', few: '거의 안씀' } as Record<string, string>)[profile.emojiUsage] || profile.emojiUsage }</span></span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── 테마 ── */}
        <ThemePicker />

        {/* ── 알림 ── */}
        {user && <NotificationSettings userId={user.id} />}

        {/* ── 프로젝트 관리 ── */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <div className="flex items-baseline gap-3">
              <p className="label">Projects</p>
              <h2 className="text-base font-normal text-foreground-muted">프로젝트</h2>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={startAdd}
                className="text-xs text-foreground-muted hover:text-foreground transition-colors"
              >
                + 새 프로젝트
              </button>
            )}
          </div>

          {projectsLoading ? (
            <p className="text-sm text-foreground-faint py-8 text-center">불러오는 중…</p>
          ) : (
            <>
              {editing && (
                <div className="border border-line p-5 sm:p-6 space-y-5">
                  <p className="label">{editing === 'new' ? 'New Project' : 'Edit Project'}</p>

                  <div className="grid grid-cols-[80px_1fr] gap-4 items-start">
                    <div>
                      <p className="label mb-2">아이콘</p>
                      <div className="flex flex-wrap gap-1">
                        {EMOJI_PRESETS.slice(0, 8).map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => setForm({ ...form, emoji: e, image: '' })}
                            className={`w-8 h-8 flex items-center justify-center border transition-colors ${
                              form.emoji === e && !form.image
                                ? 'bg-foreground text-surface border-foreground'
                                : 'border-line hover:border-foreground'
                            }`}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="block space-y-1.5">
                        <span className="label">이름</span>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="프로젝트 이름"
                          className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="label">설명</span>
                        <textarea
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          rows={2}
                          placeholder="이 프로젝트가 어떤 일을 하는지"
                          className="w-full border border-line bg-surface px-3 py-2 text-sm resize-none focus:border-foreground focus:outline-none transition-colors"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-1.5">
                      <span className="label">시작일</span>
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                        className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="label">상태</span>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value as Project['status'] })}
                        className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
                      >
                        <option value="active">진행 중</option>
                        <option value="paused">잠시 중단</option>
                        <option value="done">완료</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-line">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="border border-line-strong px-5 py-2 text-sm text-foreground hover:border-foreground transition-colors"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProject}
                      disabled={!form.name.trim()}
                      className="border border-foreground bg-foreground px-5 py-2 text-sm text-surface hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-40 transition-colors"
                    >
                      저장
                    </button>
                  </div>
                </div>
              )}

              {projects.length === 0 && !editing ? (
                <p className="text-sm text-foreground-faint py-10 text-center border border-line">
                  아직 등록된 프로젝트가 없습니다.
                </p>
              ) : (
                <ul className="divide-y divide-line border-b border-line">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <div className="flex items-center gap-4 py-4 pl-4 pr-3 sm:pl-5 hover:bg-surface-muted transition-colors">
                        <div className="w-9 h-9 bg-surface-muted flex items-center justify-center text-base shrink-0">
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            p.emoji
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm truncate">{p.name}</p>
                            <span className={`text-[10px] tracking-[0.18em] uppercase ${
                              p.status === 'active' ? 'text-primary-500'
                              : p.status === 'done' ? 'text-foreground-faint'
                              : 'text-foreground-muted'
                            }`}>
                              {p.status === 'active' ? 'Active' : p.status === 'done' ? 'Done' : 'Paused'}
                            </span>
                          </div>
                          {p.description && (
                            <p className="mt-0.5 text-xs text-foreground-faint truncate">{p.description}</p>
                          )}
                        </div>
                        {deleteConfirm === p.id ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(null)}
                              className="text-xs text-foreground-muted hover:text-foreground"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              className="border border-primary-500 text-primary-500 px-3 py-1 text-xs hover:bg-primary-500 hover:text-surface transition-colors"
                            >
                              삭제
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEdit(p)}
                              className="text-xs text-foreground-muted hover:text-foreground transition-colors"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(p.id)}
                              className="text-xs text-foreground-faint hover:text-primary-500 transition-colors"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

      </div>
    </main>
  );
}

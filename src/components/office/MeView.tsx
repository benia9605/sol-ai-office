/**
 * @file src/components/office/MeView.tsx
 * @description 나 — 오피스 안의 개인 페이지
 * - ① 내 프로필(이름·소개·대화 스타일) ② 알림 설정 ③ 내 할일(나에게 배정된 것)
 * - 프로필은 user_profiles(useUserProfile), 할일은 workspace_tasks(assignee 필터).
 */
import { useEffect, useState } from 'react';
import { Workspace } from '../../types';
import { useUserProfile } from '../../hooks/useUserProfile';
import { getCurrentUserId } from '../../services/auth';
import { fetchWorkspaceTasks, updateTaskStatus, fromDbStatus } from '../../services/tasks.service';
import { ViewHead, Section, SaveButton, EmptyState, fieldCls } from './ui';
import { NotificationSettings } from '../NotificationSettings';
import { dueLabel, daysUntil } from '../../utils/dateCalc';

type ViewId = 'dashboard' | 'todos' | 'schedule' | 'staff' | string;

const TONE = [
  { v: 'friendly', label: '친근하게' },
  { v: 'polite', label: '정중하게' },
  { v: 'formal', label: '격식있게' },
];
const LENGTH = [
  { v: 'short', label: '짧게' },
  { v: 'medium', label: '보통' },
  { v: 'detailed', label: '자세히' },
];
const EMOJI = [
  { v: 'many', label: '많이' },
  { v: 'moderate', label: '적당히' },
  { v: 'few', label: '적게' },
];

/** 라디오식 선택 칩 그룹 */
function ChipGroup({ value, options, onChange }: { value: string; options: { v: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`px-3.5 py-2 rounded-xl text-sm transition-all active:scale-95 ${value === o.v ? 'bg-foreground text-white' : 'bg-surface-muted text-gray-500 hover:bg-gray-100'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ProfileCard() {
  const { profile, loading, save } = useUserProfile();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [tone, setTone] = useState('polite');
  const [length, setLength] = useState('short');
  const [emoji, setEmoji] = useState('moderate');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (loading) return;
    setName(profile.name);
    setBio(profile.bio);
    setTone(profile.tone);
    setLength(profile.responseLength);
    setEmoji(profile.emojiUsage);
  }, [loading, profile]);

  const onSave = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const ok = await save({ name: name.trim(), bio, tone, responseLength: length, emojiUsage: emoji });
    setBusy(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    else alert('저장에 실패했어요. 잠시 후 다시 시도해주세요.');
  };

  return (
    <Section
      title="내 프로필"
      desc="AI 직원들이 나를 이해하는 데 쓰는 정보예요"
      footer={loading ? undefined : <SaveButton onClick={onSave} busy={busy} saved={saved} label="프로필 저장" />}
    >
      {loading ? (
        <p className="text-xs text-foreground-faint py-6 text-center">불러오는 중…</p>
      ) : (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">이름</label>
            <input value={name} onChange={e => { setName(e.target.value); setSaved(false); }}
              onKeyDown={e => { if (e.key === 'Enter') onSave(); }} placeholder="이름" className={fieldCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">소개 <span className="text-gray-300 font-normal">(AI가 나를 이해하는 데 써요)</span></label>
            <textarea value={bio} onChange={e => { setBio(e.target.value); setSaved(false); }} rows={3}
              placeholder="예: 원목 가구 브랜드 운영. 실전적이고 담백한 답변 선호."
              className={`${fieldCls} resize-none leading-relaxed`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">대화 톤</label>
            <ChipGroup value={tone} options={TONE} onChange={v => { setTone(v); setSaved(false); }} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">답변 길이</label>
            <ChipGroup value={length} options={LENGTH} onChange={v => { setLength(v); setSaved(false); }} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">이모지 사용</label>
            <ChipGroup value={emoji} options={EMOJI} onChange={v => { setEmoji(v); setSaved(false); }} />
          </div>
        </>
      )}
    </Section>
  );
}

type MyTask = { id: string; title: string; dueDate?: string };

function MyTasksCard({ workspace, onNavigate }: { workspace: Workspace; onNavigate: (v: ViewId) => void }) {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const myId = await getCurrentUserId().catch(() => null);
      const rows = await fetchWorkspaceTasks(workspace.id);
      const mine: MyTask[] = rows
        .filter(r => fromDbStatus(r.status) !== 'completed'
          && (r.assignee_id === myId || (!r.assignee_id && r.user_id === myId)))
        .map(r => ({ id: r.id, title: r.title, dueDate: r.due_date ?? undefined }))
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
      setTasks(mine);
    } catch { setTasks([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [workspace.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = async (id: string) => {
    setTasks(ts => ts.filter(t => t.id !== id)); // 낙관적 제거
    try { await updateTaskStatus(id, 'completed'); } catch { load(); }
  };

  return (
    <Section
      title="내 할일"
      desc="나에게 배정된 미완료 할일"
      action={<button onClick={() => onNavigate('todos')} className="text-xs text-foreground-muted hover:text-foreground transition-colors">전체 할일 ›</button>}
    >
      {loading ? (
        <p className="text-xs text-foreground-faint py-6 text-center">불러오는 중…</p>
      ) : tasks.length === 0 ? (
        <EmptyState emoji="✅" title="배정된 할일이 없어요" sub="나에게 배정된 미완료 할일이 여기 모여요" />
      ) : (
        <ul className="space-y-1">
          {tasks.map(t => {
            const d = t.dueDate ? daysUntil(t.dueDate) : null;
            const overdue = d != null && d < 0;
            return (
              <li key={t.id} className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-surface-muted transition-colors group">
                <button onClick={() => complete(t.id)} title="완료 처리"
                  className="w-5 h-5 rounded-full border border-line-strong hover:border-foreground hover:bg-foreground/5 flex items-center justify-center flex-shrink-0 transition-colors">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-transparent group-hover:text-gray-300">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </button>
                <button onClick={() => onNavigate('todos')} className="flex-1 min-w-0 text-left">
                  <span className="text-sm text-gray-700 truncate block">{t.title}</span>
                </button>
                {t.dueDate && (
                  <span className={`text-[11px] flex-shrink-0 ${overdue ? 'text-rose-500 font-medium' : 'text-gray-400'}`}>{dueLabel(t.dueDate)}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

export function MeView({ workspace, onNavigate }: { workspace: Workspace; onNavigate: (v: ViewId) => void }) {
  const [uid, setUid] = useState('');
  useEffect(() => { getCurrentUserId().then(setUid).catch(() => {}); }, []);

  return (
    <>
      <ViewHead title="나" sub="내 프로필과 나에게 배정된 할일을 확인해요" />
      <div className="space-y-6">
        <ProfileCard />
        <MyTasksCard workspace={workspace} onNavigate={onNavigate} />
        {uid && (
          <Section title="알림 설정" desc="푸시 알림 종류를 켜고 끌 수 있어요">
            <NotificationSettings userId={uid} />
          </Section>
        )}
      </div>
    </>
  );
}

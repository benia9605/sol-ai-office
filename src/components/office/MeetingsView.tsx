/**
 * @file src/components/office/MeetingsView.tsx
 * @description 회의 전용 메뉴 — 회의 목록·생성 + 회의록 + 액션아이템(할일 연동)
 * - 회의(=일정+회의록) 1행. 액션아이템 = tasks(meeting_id) → 할일 메뉴에도 자동으로 보임(양방향).
 * - 액션아이템은 여러 줄을 로컬에서 편집하고 「저장」 한 번에 일괄 반영(가이드 §7 syncTasksForNote).
 *   각 줄: 내용 · 담당자 · 기한. 「+ 할일 추가」로 빠르게 여러 줄, 「전체 과제」로 전원 일괄 배정.
 * - 회의 등록·회의록 저장 시 멤버 알림, 할일 배정 시 담당자 알림.
 */
import { useEffect, useMemo, useState } from 'react';
import { Workspace, WorkspaceMember, Meeting, TaskItem, TaskStatus } from '../../types';
import { fetchMeetings, addMeeting, updateMeeting, notifyMeetingNote, syncMeetingTasks, MeetingTaskDraft } from '../../services/meetings.service';
import { fetchMembers } from '../../services/workspaces.service';
import { fetchTasks, updateTaskStatus, fromDbStatus } from '../../services/tasks.service';
import { ViewHead, Card, EmptyState, TaskProgress } from './ui';
import { getTodayStr } from '../../utils/dateCalc';

const fieldCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-primary-400 transition-colors';
const miniCls = 'min-w-0 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 focus:outline-none focus:bg-white focus:border-primary-400 transition-colors';

export function MeetingsView({ workspace }: { workspace: Workspace }) {
  const [list, setList] = useState<Meeting[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [progress, setProgress] = useState<Map<string, { done: number; total: number }>>(new Map());
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: getTodayStr(), time: '' });

  const load = async () => {
    const [ms, ts] = await Promise.all([
      fetchMeetings(workspace.id).catch(() => [] as Meeting[]),
      fetchTasks().catch(() => []),
    ]);
    setList(ms);
    // 회의별 진행률 집계 (한 번의 순회 — 가이드 §11.4)
    const map = new Map<string, { done: number; total: number }>();
    ts.forEach(t => {
      if (!t.meeting_id) return;
      const prev = map.get(t.meeting_id) ?? { done: 0, total: 0 };
      prev.total += 1;
      if (t.status === 'done') prev.done += 1;
      map.set(t.meeting_id, prev);
    });
    setProgress(map);
  };
  useEffect(() => { load(); fetchMembers(workspace.id).then(setMembers).catch(() => setMembers([])); /* eslint-disable-next-line */ }, [workspace.id]);

  const memberName = (uid?: string) => { if (!uid) return ''; const m = members.find(x => x.userId === uid); return m?.nickname || m?.name || '멤버'; };

  const create = async () => {
    if (!form.title.trim()) return;
    try {
      const m = await addMeeting(workspace.id, { title: form.title.trim(), meetingDate: form.date || undefined, meetingTime: form.time || undefined });
      setForm({ title: '', date: getTodayStr(), time: '' }); setShowForm(false);
      await load(); setSelected(m);
    } catch (e) { console.error(e); alert('회의 생성 실패'); }
  };

  if (selected) {
    return <MeetingDetail meeting={selected} workspace={workspace} members={members} memberName={memberName}
      onBack={() => { setSelected(null); load(); }} onChanged={load} />;
  }

  return (
    <>
      <ViewHead eyebrow="MEETINGS" title="회의" sub={`${list.length}건`} />
      <div className="flex items-center mb-3">
        <button onClick={() => setShowForm(v => !v)} className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 active:scale-95 transition-all">＋ 새 회의</button>
      </div>
      {showForm && (
        <Card className="p-4 mb-3 space-y-2.5">
          <input autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') create(); }} placeholder="회의 제목" className={fieldCls} />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={fieldCls} />
            <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className={fieldCls} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100">취소</button>
            <button onClick={create} disabled={!form.title.trim()} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40">만들기</button>
          </div>
        </Card>
      )}
      {list.length === 0 ? (
        <EmptyState emoji="📋" title="아직 회의가 없어요" sub="＋ 새 회의로 만들고, 회의록·액션아이템(할일)을 정리하세요" />
      ) : (
        <div className="space-y-2">
          {list.map(m => {
            const p = progress.get(m.id);
            return (
              <button key={m.id} onClick={() => setSelected(m)} className="w-full text-left rounded-xl border border-gray-100 bg-white hover:shadow-sm p-4 transition-all active:scale-[0.99]">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-800 flex-1 truncate">{m.title}</span>
                  {m.meetingDate && <span className="text-[11px] text-gray-400 flex-shrink-0">{m.meetingDate.slice(5)}{m.meetingTime ? ` ${m.meetingTime}` : ''}</span>}
                </div>
                {m.content && <p className="text-[12px] text-gray-500 mt-1 line-clamp-1">{m.content}</p>}
                {p && p.total > 0 && <div className="mt-2"><TaskProgress done={p.done} total={p.total} compact /></div>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ── 액션아이템 로컬 편집 모델 ── */
type ActionDraft = { id: string | null; title: string; assigneeId: string; due: string; status: TaskStatus };
const emptyAction = (): ActionDraft => ({ id: null, title: '', assigneeId: '', due: '', status: 'pending' });

/* ── 회의 상세: 회의록 + 액션아이템(할일) ── */
function MeetingDetail({ meeting, workspace, members, memberName, onBack, onChanged }: {
  meeting: Meeting; workspace: Workspace; members: WorkspaceMember[]; memberName: (uid?: string) => string;
  onBack: () => void; onChanged: () => void;
}) {
  const [note, setNote] = useState(meeting.content ?? '');
  const [saving, setSaving] = useState(false);
  const [actions, setActions] = useState<ActionDraft[]>([emptyAction()]);
  const [bulk, setBulk] = useState({ title: '', due: '' });

  // 이 회의의 할일을 불러와 편집 줄로 시딩
  const loadItems = async () => {
    const rows = await fetchTasks().catch(() => []);
    const seeded = rows
      .filter(r => r.meeting_id === meeting.id)
      .map<ActionDraft>(r => ({ id: r.id, title: r.title, assigneeId: r.assignee_id ?? '', due: r.due_date ?? '', status: fromDbStatus(r.status) }));
    setActions(seeded.length ? seeded : [emptyAction()]);
  };
  useEffect(() => { loadItems(); /* eslint-disable-next-line */ }, [meeting.id]);

  const progress = useMemo(() => {
    const saved = actions.filter(a => a.id);
    return { done: saved.filter(a => a.status === 'completed').length, total: saved.length };
  }, [actions]);

  // 줄 편집 3함수 (가이드 §6.2 배열 편집 표준 패턴)
  const updateAction = (i: number, patch: Partial<ActionDraft>) => setActions(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  const addAction = () => setActions(prev => [...prev, emptyAction()]);
  const removeAction = (i: number) => setActions(prev => prev.length === 1 ? [emptyAction()] : prev.filter((_, idx) => idx !== i));

  // 전체 과제 — 같은 일을 전원에게 (멤버 수만큼 줄 생성, 각기 다른 담당자)
  const bulkAdd = () => {
    const t = bulk.title.trim();
    if (!t || members.length === 0) return;
    const rows: ActionDraft[] = members.map(m => ({ id: null, title: t, assigneeId: m.userId, due: bulk.due, status: 'pending' }));
    setActions(prev => {
      const base = prev.length === 1 && !prev[0].title && !prev[0].id ? [] : prev;
      return [...base, ...rows];
    });
    setBulk({ title: '', due: '' });
  };

  // 완료 토글 — 저장된 줄만, 즉시 반영
  const toggleStatus = async (i: number) => {
    const a = actions[i];
    if (!a.id) return;
    const next: TaskStatus = a.status === 'completed' ? 'pending' : 'completed';
    updateAction(i, { status: next });
    await updateTaskStatus(a.id, next).catch(() => {});
    onChanged();
  };

  // 저장 — 회의록(content) + 할일 일괄 동기화
  const save = async () => {
    setSaving(true);
    try {
      const hadContent = !!meeting.content;
      await updateMeeting(meeting.id, { content: note });
      if (!hadContent && note.trim()) await notifyMeetingNote(workspace.id, meeting);
      const drafts: MeetingTaskDraft[] = actions.map(a => ({ id: a.id, title: a.title, assigneeId: a.assigneeId, due: a.due }));
      await syncMeetingTasks(meeting.id, workspace.id, drafts);
      await loadItems();
      onChanged();
    } catch (e) { console.error(e); alert('저장 실패'); } finally { setSaving(false); }
  };

  return (
    <>
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600 mb-3">← 회의</button>
      <div className="rounded-[20px] bg-primary-50/50 border border-primary-100 p-5 mb-4">
        <div className="text-lg font-extrabold text-gray-800">{meeting.title}</div>
        {meeting.meetingDate && <div className="text-sm text-gray-500 mt-0.5">📅 {meeting.meetingDate}{meeting.meetingTime ? ` ${meeting.meetingTime}` : ''}</div>}
        {progress.total > 0 && <div className="mt-3"><TaskProgress done={progress.done} total={progress.total} /></div>}
      </div>

      {/* 회의록 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">📝 회의록</span>
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={7} placeholder="회의 내용·결정사항·다음 액션을 적어요…" className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm leading-relaxed focus:outline-none focus:border-primary-400 resize-none" />
      </div>

      {/* 액션아이템 (할일 연동) */}
      <div className="mb-4">
        <div className="flex items-center h-9 mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">✅ 액션 아이템</span>
          <span className="ml-2 text-[11px] text-gray-300">저장하면 할일 메뉴에도 담당자·기한과 함께 보여요</span>
        </div>
        <Card className="p-3 space-y-2">
          {/* 편집 줄들 — 내용 · 담당자 · 기한 */}
          {actions.map((a, i) => (
            <div key={a.id ?? `new-${i}`} className="group rounded-xl border border-gray-100 p-2.5 space-y-2 hover:border-gray-200">
              <div className="flex items-center gap-2">
                <button onClick={() => toggleStatus(i)} disabled={!a.id} title={a.id ? '완료 토글' : '저장하면 완료 체크 가능'}
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${a.status === 'completed' ? 'bg-primary-500 border-primary-500' : 'border-gray-300'} ${!a.id ? 'opacity-30' : ''}`}>
                  {a.status === 'completed' && <span className="text-white text-[9px]">✓</span>}
                </button>
                <input value={a.title} onChange={e => updateAction(i, { title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') addAction(); }}
                  placeholder="할 일 내용" className={`flex-1 bg-transparent text-sm focus:outline-none ${a.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`} />
                <button onClick={() => removeAction(i)} className="text-[13px] text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 flex-shrink-0">×</button>
              </div>
              <div className="flex gap-2 pl-6">
                <select value={a.assigneeId} onChange={e => updateAction(i, { assigneeId: e.target.value })} className={`${miniCls} flex-1`}>
                  <option value="">👤 담당자</option>
                  {members.map(m => <option key={m.userId} value={m.userId}>{memberName(m.userId)}</option>)}
                </select>
                <input type="date" value={a.due} onChange={e => updateAction(i, { due: e.target.value })} className={`${miniCls} flex-1`} />
              </div>
            </div>
          ))}
          <button onClick={addAction} className="w-full text-left text-xs text-gray-400 hover:text-primary-500 px-2 py-1.5">＋ 할일 추가</button>

          {/* 전체 과제 — 전원 일괄 배정 */}
          {members.length > 1 && (
            <div className="border-t border-gray-100 pt-2.5 mt-1">
              <p className="text-[11px] text-gray-400 mb-1.5">전체 과제 · 모든 멤버에게 일괄 배정</p>
              <div className="flex gap-2">
                <input value={bulk.title} onChange={e => setBulk({ ...bulk, title: e.target.value })} placeholder="예: 다음 회의 전까지 자료 정리" className={`${miniCls} flex-1`} />
                <input type="date" value={bulk.due} onChange={e => setBulk({ ...bulk, due: e.target.value })} className={`${miniCls} w-32`} />
                <button onClick={bulkAdd} disabled={!bulk.title.trim()} className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40 flex-shrink-0">{members.length}명 추가</button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* 저장 — 회의록 + 할일 일괄 반영 */}
      <div className="flex justify-end pb-6">
        <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 active:scale-95 transition-all">{saving ? '저장 중…' : '저장'}</button>
      </div>
    </>
  );
}

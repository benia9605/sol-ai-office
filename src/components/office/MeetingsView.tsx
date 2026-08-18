/**
 * @file src/components/office/MeetingsView.tsx
 * @description 회의 전용 메뉴 — 회의 목록·생성 + 회의록 + 액션아이템(할일 연동)
 * - 액션아이템 = tasks(meeting_id) → 할일 메뉴에도 자동으로 보임(양방향).
 * - 회의 등록·회의록 저장 시 멤버 알림, 할일 배정 시 담당자 알림.
 */
import { useEffect, useState } from 'react';
import { Workspace, WorkspaceMember, Meeting, TaskItem } from '../../types';
import { fetchMeetings, addMeeting, updateMeeting, deleteMeeting, notifyMeetingNote } from '../../services/meetings.service';
import { fetchMembers } from '../../services/workspaces.service';
import { fetchTasks, addTask, updateTaskStatus, deleteTask, fromDbStatus } from '../../services/tasks.service';
import { notify, getActorName } from '../../services/notify.service';
import { getCurrentUserId } from '../../services/auth';
import { ViewHead, Card, EmptyState } from './ui';
import { getTodayStr } from '../../utils/dateCalc';

const fieldCls = 'w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:bg-white focus:border-primary-400 transition-colors';

export function MeetingsView({ workspace }: { workspace: Workspace }) {
  const [list, setList] = useState<Meeting[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: getTodayStr(), time: '' });

  const load = () => fetchMeetings(workspace.id).then(setList).catch(() => setList([]));
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
          {list.map(m => (
            <button key={m.id} onClick={() => setSelected(m)} className="w-full text-left rounded-xl border border-gray-100 bg-white hover:shadow-sm p-4 transition-all active:scale-[0.99]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800 flex-1 truncate">{m.title}</span>
                {m.meetingDate && <span className="text-[11px] text-gray-400 flex-shrink-0">{m.meetingDate.slice(5)}{m.meetingTime ? ` ${m.meetingTime}` : ''}</span>}
              </div>
              {m.content && <p className="text-[12px] text-gray-500 mt-1 line-clamp-1">{m.content}</p>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ── 회의 상세: 회의록 + 액션아이템(할일) ── */
function MeetingDetail({ meeting, workspace, members, memberName, onBack, onChanged }: {
  meeting: Meeting; workspace: Workspace; members: WorkspaceMember[]; memberName: (uid?: string) => string;
  onBack: () => void; onChanged: () => void;
}) {
  const [note, setNote] = useState(meeting.content ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [items, setItems] = useState<TaskItem[]>([]);
  const [ai, setAi] = useState({ title: '', assigneeId: '', due: '' });

  const loadItems = () => fetchTasks().then(rows => {
    setItems(rows.filter(r => r.meeting_id === meeting.id).map(r => ({
      id: r.id, title: r.title, project: r.project ?? '', status: fromDbStatus(r.status), priority: (r.priority as TaskItem['priority']) ?? 'medium',
      starred: !!r.starred, date: r.due_date, assigneeId: r.assignee_id, meetingId: r.meeting_id,
    })));
  }).catch(() => setItems([]));
  useEffect(() => { loadItems(); /* eslint-disable-next-line */ }, [meeting.id]);

  const saveNote = async () => {
    setSavingNote(true);
    try {
      const hadContent = !!meeting.content;
      await updateMeeting(meeting.id, { content: note });
      if (!hadContent && note.trim()) await notifyMeetingNote(workspace.id, meeting);
      onChanged();
    } catch (e) { console.error(e); alert('회의록 저장 실패'); } finally { setSavingNote(false); }
  };

  const addItem = async () => {
    if (!ai.title.trim()) return;
    try {
      const row = await addTask({ workspace_id: workspace.id, title: ai.title.trim(), due_date: ai.due || undefined, assignee_id: ai.assigneeId || undefined, meeting_id: meeting.id, source: 'manual' });
      // 담당자 알림
      if (ai.assigneeId) {
        const actor = await getCurrentUserId().catch(() => null);
        if (ai.assigneeId !== actor) {
          const name = await getActorName(workspace.id, actor);
          notify({ type: 'notify_task_assigned', workspaceId: workspace.id, actorId: actor, title: '📝 새 할일(회의)', body: `${name} 님이 「${row.title}」을 배정했어요.`, tag: `task-${row.id}`, targetUserIds: [ai.assigneeId] });
        }
      }
      setAi({ title: '', assigneeId: '', due: '' }); await loadItems();
    } catch (e) { console.error(e); alert('할일 추가 실패'); }
  };
  const toggleItem = async (t: TaskItem) => {
    const next = t.status === 'completed' ? 'pending' : 'completed';
    await updateTaskStatus(t.id, next).catch(() => {}); await loadItems();
  };
  const removeItem = async (id: string) => { await deleteTask(id).catch(() => {}); await loadItems(); };

  return (
    <>
      <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600 mb-3">← 회의</button>
      <div className="rounded-[20px] bg-primary-50/50 border border-primary-100 p-5 mb-4">
        <div className="text-lg font-extrabold text-gray-800">{meeting.title}</div>
        {meeting.meetingDate && <div className="text-sm text-gray-500 mt-0.5">📅 {meeting.meetingDate}{meeting.meetingTime ? ` ${meeting.meetingTime}` : ''}</div>}
      </div>

      {/* 회의록 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">📝 회의록</span>
          <button onClick={saveNote} disabled={savingNote} className="text-[11px] px-3 py-1 rounded-lg bg-primary-500 text-white font-medium disabled:opacity-50">{savingNote ? '저장 중…' : '저장'}</button>
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={7} placeholder="회의 내용·결정사항·다음 액션을 적어요…" className="w-full rounded-xl border border-gray-200 px-3.5 py-3 text-sm leading-relaxed focus:outline-none focus:border-primary-400 resize-none" />
      </div>

      {/* 액션아이템 (할일 연동) */}
      <div className="mb-4">
        <div className="flex items-center h-9 mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">✅ 액션 아이템 {items.length > 0 && <span className="text-gray-300">({items.length})</span>}</span>
          <span className="ml-2 text-[11px] text-gray-300">할일 메뉴에도 자동으로 보여요</span>
        </div>
        <Card className="p-3 space-y-2">
          {items.map(t => (
            <div key={t.id} className="group flex items-center gap-2 p-2 rounded-xl hover:bg-gray-50">
              <button onClick={() => toggleItem(t)} className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${t.status === 'completed' ? 'bg-primary-500 border-primary-500' : 'border-gray-300'}`}>
                {t.status === 'completed' && <span className="text-white text-[9px]">✓</span>}
              </button>
              <span className={`text-sm flex-1 truncate ${t.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{t.title}</span>
              {t.date && <span className="text-[10px] text-gray-400 flex-shrink-0">{t.date.slice(5)}</span>}
              {t.assigneeId && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-500 flex-shrink-0">{memberName(t.assigneeId)}</span>}
              <button onClick={() => removeItem(t.id)} className="text-[11px] text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 flex-shrink-0">×</button>
            </div>
          ))}
          {items.length === 0 && <p className="text-xs text-gray-300 py-2 text-center">회의에서 나온 할일을 추가하세요</p>}
          {/* 추가 폼 */}
          <div className="border-t border-gray-100 pt-2 space-y-2">
            <input value={ai.title} onChange={e => setAi({ ...ai, title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') addItem(); }} placeholder="＋ 액션 아이템 (할일)" className={fieldCls} />
            <div className="flex gap-2">
              {members.length > 1 && (
                <select value={ai.assigneeId} onChange={e => setAi({ ...ai, assigneeId: e.target.value })} className={`${fieldCls} flex-1`}>
                  <option value="">담당자</option>
                  {members.map(m => <option key={m.userId} value={m.userId}>{memberName(m.userId)}</option>)}
                </select>
              )}
              <input type="date" value={ai.due} onChange={e => setAi({ ...ai, due: e.target.value })} className={`${fieldCls} flex-1`} />
              <button onClick={addItem} disabled={!ai.title.trim()} className="px-3 py-2 rounded-lg text-xs font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 flex-shrink-0">추가</button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

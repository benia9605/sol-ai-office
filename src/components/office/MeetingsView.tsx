/**
 * @file src/components/office/MeetingsView.tsx
 * @description 회의 전용 메뉴 — 회의 목록·생성 + 회의록 + 액션아이템(할일 연동)
 * - 회의(=일정+회의록) 1행. 액션아이템 = tasks(meeting_id) → 할일 메뉴에도 자동으로 보임(양방향).
 * - 액션아이템은 여러 줄을 로컬에서 편집하고 「저장」 한 번에 일괄 반영(가이드 §7 syncTasksForNote).
 *   각 줄: 내용 · 담당자 · 기한. 「+ 할일 추가」로 빠르게 여러 줄, 「전체 과제」로 전원 일괄 배정.
 * - 회의 등록·회의록 저장 시 멤버 알림, 할일 배정 시 담당자 알림.
 */
import { useEffect, useMemo, useState } from 'react';
import { Workspace, WorkspaceMember, Meeting, TaskStatus } from '../../types';
import { fetchMeetings, addMeeting, updateMeeting, deleteMeeting, notifyMeetingNote, syncMeetingTasks, MeetingTaskDraft } from '../../services/meetings.service';
import { fetchMembers } from '../../services/workspaces.service';
import { fetchWorkspaceTasks, fetchTasksByMeeting, updateTaskStatus, fromDbStatus } from '../../services/tasks.service';
import { recordActivity } from '../../services/activities.service';
import { ViewHead, EmptyState, TaskProgress, AddButton, InlineAddCard, SearchBar, NoteSection as Section, inputClass, chipBtn } from './ui';
import { TiptapEditor } from '../tiptap/TiptapEditor';
import { RichText, parseDoc, serializeDoc, docToText, docHasContent } from './RichText';
import { Avatar } from './Avatar';
import { LikeCommentBlock } from './LikeCommentBlock';
import { AttachmentsSection } from './AttachmentsSection';
import { getTodayStr } from '../../utils/dateCalc';

const fieldCls = 'w-full px-4 py-2.5 rounded-lg bg-surface-muted border border-line text-sm focus:outline-none focus:bg-surface focus:border-foreground transition-colors';

export function MeetingsView({ workspace, openId }: { workspace: Workspace; openId?: string }) {
  const [list, setList] = useState<Meeting[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [progress, setProgress] = useState<Map<string, { done: number; total: number }>>(new Map());
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: getTodayStr(), time: '' });
  const [q, setQ] = useState('');

  // 딥링크(/meetings/:id · 알림·활동 클릭)로 들어오면 해당 회의를 연다
  useEffect(() => {
    if (!openId) { return; }
    const m = list.find(x => x.id === openId);
    if (m) setSelected(m);
  }, [openId, list]);

  const load = async () => {
    const [ms, ts] = await Promise.all([
      fetchMeetings(workspace.id).catch(() => [] as Meeting[]),
      fetchWorkspaceTasks(workspace.id).catch(() => []),  // 워크스페이스 전체 할일(팀원 것 포함)로 회의 진행률 집계
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
      recordActivity({ workspaceId: workspace.id, action: 'created_meeting', resourceType: 'meeting', resourceId: m.id, metadata: { title: m.title } });
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
      <ViewHead eyebrow="MEETINGS" title="회의" sub={`${list.length}건`}
        action={<AddButton open={showForm} onClick={() => setShowForm(v => !v)} label="새 회의" />} />
      {list.length > 0 && <SearchBar value={q} onChange={setQ} placeholder="회의 검색" />}
      <InlineAddCard open={showForm}>
        <input autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') create(); }} placeholder="회의 제목" className={fieldCls} />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={fieldCls} />
          <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className={fieldCls} />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg text-xs text-foreground-muted hover:bg-surface-muted">취소</button>
          <button onClick={create} disabled={!form.title.trim()} className="px-4 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 disabled:opacity-40">만들기</button>
        </div>
      </InlineAddCard>
      {(() => { const shown = q.trim() ? list.filter(m => `${m.title} ${m.content ? docToText(m.content) : ''}`.toLowerCase().includes(q.trim().toLowerCase())) : list; return (
        list.length === 0 ? (
        <EmptyState emoji="📋" title="아직 회의가 없어요" sub="＋ 새 회의로 만들고, 회의록·액션아이템(할일)을 정리하세요" />
      ) : shown.length === 0 ? (
        <p className="text-sm text-foreground-faint py-10 text-center">‘{q.trim()}’ 결과가 없어요.</p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {shown.map(m => {
            const p = progress.get(m.id);
            const preview = m.content ? docToText(m.content).trim() : '';
            return (
              <li key={m.id}>
                <button onClick={() => setSelected(m)} className="w-full text-left py-5 -mx-2 px-2 hover:bg-surface-muted transition-colors block">
                  <div className="flex items-baseline gap-3">
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{m.title}</span>
                    {m.meetingDate && <span className="text-xs text-foreground-faint flex-shrink-0 tabular-nums">{m.meetingDate.slice(5)}{m.meetingTime ? ` ${m.meetingTime}` : ''}</span>}
                  </div>
                  {preview && <p className="text-xs text-foreground-muted mt-1.5 line-clamp-2">{preview}</p>}
                  {p && p.total > 0 && <div className="mt-2.5 max-w-md"><TaskProgress done={p.done} total={p.total} compact /></div>}
                </button>
              </li>
            );
          })}
        </ul>
      )); })()}
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
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [note, setNote] = useState(() => parseDoc(meeting.content));
  const [saving, setSaving] = useState(false);
  const [actions, setActions] = useState<ActionDraft[]>([emptyAction()]);
  const [bulk, setBulk] = useState({ title: '', due: '' });
  const [wsTasks, setWsTasks] = useState<any[]>([]);   // '기존 할일 불러오기' 후보
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => { fetchWorkspaceTasks(workspace.id).then(setWsTasks).catch(() => setWsTasks([])); }, [workspace.id]);
  const parseAgenda = (a?: string) => { const arr = (a || '').split('\n').map(s => s.trim()).filter(Boolean); return arr.length ? arr : ['']; };
  const [agenda, setAgenda] = useState<string[]>(() => parseAgenda(meeting.agenda));
  // 뷰 모드용 아젠다 — 저장 직후 stale prop 대신 로컬 state를 정리해서 렌더
  const viewAgenda = agenda.map(s => s.trim()).filter(Boolean);
  const updateAgenda = (i: number, v: string) => setAgenda(prev => prev.map((x, idx) => idx === i ? v : x));
  const addAgenda = () => setAgenda(prev => [...prev, '']);
  const removeAgenda = (i: number) => setAgenda(prev => prev.length === 1 ? [''] : prev.filter((_, idx) => idx !== i));
  const del = async () => { if (!confirm('이 회의를 삭제할까요?')) return; await deleteMeeting(meeting.id).catch(() => {}); onBack(); };

  // 이 회의의 할일을 불러와 편집 줄로 시딩
  const loadItems = async () => {
    const rows = await fetchTasksByMeeting(meeting.id).catch(() => []);
    const seeded = rows
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
    if (next === 'completed') recordActivity({ workspaceId: workspace.id, action: 'completed_task', resourceType: 'task', resourceId: a.id, metadata: { title: a.title } });
    onChanged();
  };

  // 저장 — 회의록(content) + 할일 일괄 동기화
  const save = async () => {
    setSaving(true);
    try {
      const hadContent = !!docToText(meeting.content);
      const agendaStr = agenda.map(s => s.trim()).filter(Boolean).join('\n');
      await updateMeeting(meeting.id, { content: serializeDoc(note), agenda: agendaStr });
      if (!hadContent && docToText(note).trim()) await notifyMeetingNote(workspace.id, meeting);
      const drafts: MeetingTaskDraft[] = actions.map(a => ({ id: a.id, title: a.title, assigneeId: a.assigneeId, due: a.due }));
      await syncMeetingTasks(meeting.id, workspace.id, drafts);
      await loadItems();
      onChanged();
      setMode('view');
    } catch (e) { console.error(e); alert('저장 실패'); } finally { setSaving(false); }
  };
  const savedActions = actions.filter(a => a.id && a.title.trim());

  const candidates = wsTasks.filter(t => !actions.some(a => a.id === t.id));
  const addExisting = (rows: ActionDraft[]) => setActions(prev => {
    const base = prev.length === 1 && !prev[0].title && !prev[0].id ? [] : prev;
    return [...base, ...rows];
  });

  return (
    <div className="max-w-3xl">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground mb-8 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        회의
      </button>

      {/* ── 헤더 — 제목 · 일시 · 진행률 · (뷰)편집/삭제 (편집)취소/저장 ── */}
      <header className="flex items-start justify-between gap-4 mb-10">
        <div className="min-w-0 flex-1">
          <p className="label">Meeting Note</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-light leading-tight text-foreground">{meeting.title}</h1>
          {meeting.meetingDate && (
            <div className="flex items-center gap-1.5 text-sm text-foreground-muted mt-3">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
              {meeting.meetingDate}{meeting.meetingTime ? ` ${meeting.meetingTime}` : ''}
            </div>
          )}
          {progress.total > 0 && <div className="mt-4 max-w-md"><TaskProgress done={progress.done} total={progress.total} /></div>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {mode === 'view'
            ? <>
                <button onClick={() => setMode('edit')} className="border border-line-strong px-4 py-2 text-sm text-foreground hover:border-foreground transition-colors">편집</button>
                <button onClick={del} className="border border-line-strong px-4 py-2 text-sm text-rose-500 hover:border-rose-400 transition-colors">삭제</button>
              </>
            : <>
                <button onClick={() => { setMode('view'); loadItems(); setNote(parseDoc(meeting.content)); setAgenda(parseAgenda(meeting.agenda)); }} className="border border-line-strong px-4 py-2 text-sm text-foreground hover:border-foreground transition-colors">취소</button>
                <button onClick={save} disabled={saving} className="border border-foreground bg-foreground px-5 py-2 text-sm text-surface hover:opacity-85 disabled:opacity-60 transition-all">{saving ? '저장 중…' : '저장'}</button>
              </>}
        </div>
      </header>

      {mode === 'edit' ? (
        /* ═══════════ 편집 모드 (이식 킷 06 그대로) ═══════════ */
        <div className="space-y-12">
          {/* ── 아젠다 ── */}
          <Section title="아젠다">
            <ul className="space-y-2">
              {agenda.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-xs text-foreground-faint w-6 shrink-0 text-right tabular-nums">{i + 1}.</span>
                  <input value={item} onChange={e => updateAgenda(i, e.target.value)} placeholder="안건" className={inputClass} />
                  <button type="button" onClick={() => removeAgenda(i)} aria-label="아젠다 삭제"
                    className="text-xl leading-none text-foreground-faint hover:text-rose-500 px-2 -mr-2 disabled:opacity-30"
                    disabled={agenda.length === 1 && !agenda[0]}>×</button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={addAgenda} className="mt-3 text-xs text-foreground-muted hover:text-foreground">+ 아젠다 추가</button>
          </Section>

          {/* ── 회의 내용 ── */}
          <Section title="회의 내용">
            <div>
              <label className="text-xs text-foreground-muted">본문</label>
              <div className="mt-2">
                <TiptapEditor content={note} onChange={setNote} placeholder="아젠다 별로 정리한 토론 내용을 적습니다." />
              </div>
            </div>
          </Section>

          {/* ── 할일 ── */}
          <Section title="할일" subtitle="회의 결과로 정해진 액션 아이템. 저장 시 회의록에 연결된 할일로 등록됩니다.">
            {/* 방식 ② 전체 일괄 배정 */}
            {members.length > 0 && (
              <div className="border border-line p-4 space-y-3 bg-surface-muted">
                <p className="label">전체 과제 · 모든 멤버에게 일괄 배정</p>
                <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_140px_auto] sm:gap-2 sm:items-center">
                  <input value={bulk.title} onChange={e => setBulk({ ...bulk, title: e.target.value })} placeholder="예: 다음 회의 전까지 자료 정리" className={inputClass} />
                  <input type="date" value={bulk.due} onChange={e => setBulk({ ...bulk, due: e.target.value })} className={`${inputClass} w-32 sm:w-auto`} aria-label="기한" />
                  <button type="button" onClick={bulkAdd} disabled={!bulk.title.trim() || members.length === 0}
                    className="bg-primary-500 text-white px-4 py-2 text-xs hover:opacity-85 disabled:opacity-60">멤버 {members.length}명에게 추가</button>
                </div>
              </div>
            )}

            {/* 방식 ① 개별 행 */}
            <ul className="mt-6 space-y-4 sm:space-y-3">
              {actions.map((row, i) => (
                <li key={row.id ?? `new-${i}`} className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_160px_140px_auto] sm:gap-2 sm:items-center">
                  <input value={row.title} onChange={e => updateAction(i, { title: e.target.value })} placeholder="내용" className={inputClass} />
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 sm:contents">
                    <select value={row.assigneeId} onChange={e => updateAction(i, { assigneeId: e.target.value })} className={inputClass} aria-label="담당자">
                      <option value="">담당자 미지정</option>
                      {members.map(m => <option key={m.userId} value={m.userId}>{memberName(m.userId)}</option>)}
                    </select>
                    <input type="date" value={row.due} onChange={e => updateAction(i, { due: e.target.value })} className={`${inputClass} w-32 sm:w-auto`} aria-label="기한" />
                    <button type="button" onClick={() => removeAction(i)} aria-label="할일 삭제"
                      className="text-xl leading-none text-foreground-faint hover:text-rose-500 px-2 sm:px-0 sm:w-8 sm:text-right disabled:opacity-30"
                      disabled={actions.length === 1 && !row.title && !row.assigneeId && !row.due}>×</button>
                  </div>
                </li>
              ))}
            </ul>

            {/* 리스트 하단 — 배지형 버튼 */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={addAction} className={chipBtn}>+ 할일 추가</button>
              {candidates.length > 0 && (
                <button type="button" onClick={() => setPickerOpen(v => !v)} className={`${chipBtn} ${pickerOpen ? 'border-foreground text-foreground' : ''}`}>+ 기존 할일 불러오기</button>
              )}
            </div>
            {pickerOpen && candidates.length > 0 && (
              <ExistingTaskPanel candidates={candidates} memberName={memberName} onAdd={addExisting} onClose={() => setPickerOpen(false)} />
            )}
          </Section>

          {/* 첨부파일 — AttachmentsSection이 자체 헤더(border-b) 렌더 */}
          <AttachmentsSection workspaceId={workspace.id} refType="meeting" refId={meeting.id} canManage />
        </div>
      ) : (
        /* ═══════════ 뷰 모드 ═══════════ */
        <div className="space-y-12">
          {/* ── 아젠다 ── (저장 직후 stale prop 대신 로컬 state로 렌더) */}
          {viewAgenda.length > 0 && (
            <Section title="아젠다">
              <ol className="space-y-2">
                {viewAgenda.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground">
                    <span className="text-foreground-faint w-6 shrink-0 text-right tabular-nums">{i + 1}.</span>
                    <span className="flex-1">{item}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {/* ── 회의 내용 ── */}
          <Section title="회의 내용">
            {docHasContent(note)
              ? <RichText value={note} />
              : <p className="text-sm text-foreground-faint">작성된 회의록이 없어요. <button onClick={() => setMode('edit')} className="underline">작성하기</button></p>}
          </Section>

          {/* ── 할일 ── */}
          <Section title="할일">
            {savedActions.length === 0 ? (
              <p className="text-sm text-foreground-faint">액션 아이템이 없어요.</p>
            ) : (
              <ul className="divide-y divide-line -mt-2">
                {actions.map((a, i) => a.id && a.title.trim() ? (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <button onClick={() => toggleStatus(i)} title="완료 토글"
                      className={`size-5 shrink-0 border flex items-center justify-center transition-colors ${a.status === 'completed' ? 'border-foreground bg-foreground text-surface' : 'border-line-strong hover:border-foreground'}`}>
                      {a.status === 'completed' && <span className="text-[11px] leading-none">✓</span>}
                    </button>
                    <span className={`text-sm flex-1 truncate ${a.status === 'completed' ? 'line-through text-foreground-faint' : 'text-foreground'}`}>{a.title}</span>
                    {a.assigneeId && <span className="flex items-center gap-1.5 shrink-0"><Avatar name={memberName(a.assigneeId)} url={members.find(m => m.userId === a.assigneeId)?.avatarUrl} size="xs" /><span className="text-xs text-foreground-muted">{memberName(a.assigneeId)}</span></span>}
                    {a.due && <span className="text-xs text-foreground-faint shrink-0 tabular-nums">{a.due.slice(5)}</span>}
                  </li>
                ) : null)}
              </ul>
            )}
          </Section>

          {/* 첨부파일 (읽기전용) — 자체 헤더 렌더 */}
          <AttachmentsSection workspaceId={workspace.id} refType="meeting" refId={meeting.id} canManage={false} />

          {/* 좋아요·댓글 */}
          <div className="pb-6">
            <LikeCommentBlock resource="meeting" resId={meeting.id} members={members} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── 기존 할일 불러오기 (다중 선택 패널) — 이식 킷 06 ──
function ExistingTaskPanel({ candidates, memberName, onAdd, onClose }: {
  candidates: any[]; memberName: (uid?: string) => string;
  onAdd: (rows: ActionDraft[]) => void; onClose: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setChecked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const handleAdd = () => {
    const rows: ActionDraft[] = candidates.filter(t => checked.has(t.id)).map(t => ({
      id: t.id, title: t.title, assigneeId: t.assignee_id ?? '', due: t.due_date ? t.due_date.slice(0, 10) : '', status: fromDbStatus(t.status),
    }));
    if (!rows.length) return;
    onAdd(rows); setChecked(new Set()); onClose();
  };
  return (
    <div className="mt-2 border border-line">
      <ul className="max-h-64 overflow-y-auto divide-y divide-line">
        {candidates.map(t => {
          const on = checked.has(t.id);
          return (
            <li key={t.id}>
              <button type="button" onClick={() => toggle(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${on ? 'bg-surface-muted' : 'hover:bg-surface-muted'}`}>
                <span aria-hidden className={`shrink-0 w-4 h-4 border flex items-center justify-center text-[10px] ${on ? 'bg-foreground border-foreground text-surface' : 'border-line-strong text-transparent'}`}>✓</span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm truncate ${t.status === 'done' ? 'line-through text-foreground-faint' : 'text-foreground'}`}>{t.title}</span>
                  <span className="block text-xs text-foreground-faint truncate">{memberName(t.assignee_id) || '미지정'}{t.meeting_id ? ' · 다른 회의에 연결됨' : ''}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-end gap-2 border-t border-line px-3 py-2">
        <span className="mr-auto text-xs text-foreground-faint">{checked.size}개 선택</span>
        <button type="button" onClick={handleAdd} disabled={checked.size === 0} className="bg-primary-500 text-white px-4 py-2 text-xs hover:opacity-85 disabled:opacity-60">연결</button>
      </div>
    </div>
  );
}

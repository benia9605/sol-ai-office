import { isDemoMode } from "@/lib/demo/mode";
import { MOCK_MEETING_NOTES } from "@/lib/demo/fixtures";
import { supabase } from "@/lib/supabase";
import { recordActivity } from "@/lib/data/activities";
import { getActorName, notify } from "@/lib/data/notify";
import type { MeetingNote } from "@/lib/types/database";

function newId(): string {
  return crypto.randomUUID();
}

export async function getWorkspaceNotes(
  workspaceId: string,
): Promise<MeetingNote[]> {
  if (isDemoMode()) {
    return [...MOCK_MEETING_NOTES]
      .filter((n) => n.workspace_id === workspaceId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const { data } = await supabase!
    .from("meeting_notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  return (data as MeetingNote[]) ?? [];
}

export async function getNotesForMeeting(
  meetingId: string,
): Promise<MeetingNote[]> {
  if (isDemoMode()) {
    return [...MOCK_MEETING_NOTES]
      .filter((n) => n.meeting_id === meetingId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const { data } = await supabase!
    .from("meeting_notes")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: false });
  return (data as MeetingNote[]) ?? [];
}

export async function getNote(id: string): Promise<MeetingNote | null> {
  if (isDemoMode()) {
    return MOCK_MEETING_NOTES.find((n) => n.id === id) ?? null;
  }
  const { data } = await supabase!
    .from("meeting_notes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as MeetingNote | null) ?? null;
}

export type NoteInput = {
  workspace_id: string;
  meeting_id: string | null;
  title: string;
  agenda: string | null;
  content: string | null;
  summary: string | null;
};

export async function createNote(
  input: NoteInput,
  createdBy: string,
): Promise<MeetingNote | null> {
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const n: MeetingNote = {
      id: newId(),
      ...input,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    };
    MOCK_MEETING_NOTES.push(n);
    await recordActivity(
      {
        workspace_id: n.workspace_id,
        action: "created_meeting_note",
        resource_type: "note",
        resource_id: n.id,
        metadata: { title: n.title },
      },
      createdBy,
    );
    return n;
  }
  const { data } = await supabase!
    .from("meeting_notes")
    .insert({ ...input, created_by: createdBy })
    .select()
    .single();
  if (data) {
    const name = await getActorName(createdBy);
    await notify({
      type: "new_note",
      workspace_id: (data as MeetingNote).workspace_id,
      actor_id: createdBy,
      title: "📝 새 회의록",
      body: `${name} 님이 「${(data as MeetingNote).title}」 회의록을 작성했어요.`,
      url: `/notes/${(data as MeetingNote).id}`,
      tag: `note-${(data as MeetingNote).id}`,
    });
  }
  return (data as MeetingNote | null) ?? null;
}

export type NotePatch = Partial<Omit<NoteInput, "workspace_id">>;

export async function updateNote(
  id: string,
  patch: NotePatch,
): Promise<MeetingNote | null> {
  const cleaned: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(patch)) {
    cleaned[k] = typeof v === "string" && v.trim() === "" ? null : (v as string);
  }

  if (isDemoMode()) {
    const i = MOCK_MEETING_NOTES.findIndex((n) => n.id === id);
    if (i < 0) return null;
    MOCK_MEETING_NOTES[i] = {
      ...MOCK_MEETING_NOTES[i],
      ...(cleaned as Partial<MeetingNote>),
      updated_at: new Date().toISOString(),
    };
    return MOCK_MEETING_NOTES[i];
  }
  const { data } = await supabase!
    .from("meeting_notes")
    .update({ ...cleaned, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  return (data as MeetingNote | null) ?? null;
}

export async function deleteNote(id: string): Promise<boolean> {
  if (isDemoMode()) {
    const i = MOCK_MEETING_NOTES.findIndex((n) => n.id === id);
    if (i < 0) return false;
    MOCK_MEETING_NOTES.splice(i, 1);
    return true;
  }
  const { error } = await supabase!.from("meeting_notes").delete().eq("id", id);
  return !error;
}

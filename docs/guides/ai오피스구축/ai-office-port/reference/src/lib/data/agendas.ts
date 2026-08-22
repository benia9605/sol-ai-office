import { isDemoMode } from "@/lib/demo/mode";
import { MOCK_USER_PROFILES } from "@/lib/demo/fixtures";
import { supabase } from "@/lib/supabase";
import { recordActivity } from "@/lib/data/activities";
import { getActorName, notify } from "@/lib/data/notify";
import type {
  Agenda,
  AgendaComment,
  AgendaOption,
  AgendaPollType,
  AgendaVote,
  UserProfile,
} from "@/lib/types/database";

export type AuthorRef = Pick<
  UserProfile,
  "user_id" | "name" | "email" | "avatar_url"
>;

export type AgendaWithAuthor = Agenda & {
  author: AuthorRef | null;
  /** 지금까지 응답한 unique 멤버 수. listAgendas / getAgenda 에서 채움. */
  vote_count?: number;
};

// ─── 데모 모드 in-memory 저장 ─────────────────────────────────
const MOCK_AGENDAS: Agenda[] = [];
const MOCK_VOTES: AgendaVote[] = [];
const MOCK_COMMENTS: AgendaComment[] = [];

function authorFor(userId: string): AuthorRef | null {
  const p = MOCK_USER_PROFILES.find((x) => x.user_id === userId);
  if (!p) return null;
  return {
    user_id: p.user_id,
    name: p.name,
    email: p.email,
    avatar_url: p.avatar_url,
  };
}

/** 마감 여부 — closed_at 있거나 deadline 지났을 때. */
export function isAgendaClosed(a: Pick<Agenda, "deadline" | "closed_at">): boolean {
  if (a.closed_at) return true;
  return Date.now() >= new Date(a.deadline).getTime();
}

// ─── Agendas CRUD ─────────────────────────────────────────────
export async function listAgendas(
  workspaceId: string,
): Promise<AgendaWithAuthor[]> {
  if (isDemoMode()) {
    return MOCK_AGENDAS.filter((a) => a.workspace_id === workspaceId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((a) => ({
        ...a,
        author: authorFor(a.user_id),
        vote_count: MOCK_VOTES.filter((v) => v.agenda_id === a.id).length,
      }));
  }
  const { data, error } = await supabase!
    .from("agendas")
    .select(
      "*, author:user_profiles!agendas_user_id_fkey(user_id, name, email, avatar_url), votes:agenda_votes(user_id)",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[meetup-agendas] listAgendas error", error);
    return [];
  }
  return (data ?? []).map((row) => {
    const r = row as unknown as AgendaWithAuthor & {
      votes?: { user_id: string }[];
    };
    return {
      ...r,
      vote_count: r.votes?.length ?? 0,
    };
  });
}

export async function getAgenda(id: string): Promise<AgendaWithAuthor | null> {
  if (isDemoMode()) {
    const a = MOCK_AGENDAS.find((x) => x.id === id);
    if (!a) return null;
    return { ...a, author: authorFor(a.user_id) };
  }
  const { data, error } = await supabase!
    .from("agendas")
    .select(
      "*, author:user_profiles!agendas_user_id_fkey(user_id, name, email, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[meetup-agendas] getAgenda error", error);
    return null;
  }
  return (data as AgendaWithAuthor | null) ?? null;
}

export type AgendaInput = {
  workspace_id: string;
  title: string;
  description?: string | null;
  poll_type: AgendaPollType;
  options: AgendaOption[];
  deadline: string;
};

export async function createAgenda(
  input: AgendaInput,
  userId: string,
): Promise<Agenda | null> {
  const row = {
    workspace_id: input.workspace_id,
    user_id: userId,
    title: input.title,
    description: input.description ?? null,
    poll_type: input.poll_type,
    options: input.poll_type === "text" ? [] : input.options,
    deadline: input.deadline,
  };
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const a: Agenda = {
      id: crypto.randomUUID(),
      ...row,
      description: row.description,
      closed_at: null,
      created_at: now,
      updated_at: now,
    };
    MOCK_AGENDAS.unshift(a);
    return a;
  }
  const { data, error } = await supabase!
    .from("agendas")
    .insert(row)
    .select()
    .single();
  if (error) {
    console.error("[meetup-agendas] createAgenda error", error);
    throw new Error(`안건 등록 실패 (${error.code ?? ""}): ${error.message}`);
  }
  const created = data as Agenda;
  await recordActivity(
    {
      workspace_id: created.workspace_id,
      action: "created_agenda",
      resource_type: "agenda",
      resource_id: created.id,
      metadata: { title: created.title },
    },
    userId,
  );
  const creatorName = await getActorName(userId);
  await notify({
    type: "new_agenda",
    workspace_id: created.workspace_id,
    actor_id: userId,
    title: "📋 새 안건",
    body: `${creatorName} 님이 「${created.title}」 안건을 올렸어요.`,
    url: `/agendas/${created.id}`,
    tag: `agenda-${created.id}`,
  });
  return created;
}

export type AgendaPatch = Partial<
  Pick<AgendaInput, "title" | "description" | "poll_type" | "options" | "deadline">
> & { closed_at?: string | null };

export async function updateAgenda(
  id: string,
  patch: AgendaPatch,
): Promise<Agenda | null> {
  if (isDemoMode()) {
    const i = MOCK_AGENDAS.findIndex((x) => x.id === id);
    if (i < 0) return null;
    const updated = {
      ...MOCK_AGENDAS[i],
      ...patch,
      description:
        patch.description !== undefined
          ? patch.description
          : MOCK_AGENDAS[i].description,
      updated_at: new Date().toISOString(),
    } as Agenda;
    MOCK_AGENDAS[i] = updated;
    return updated;
  }
  const { data, error } = await supabase!
    .from("agendas")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[meetup-agendas] updateAgenda error", error);
    return null;
  }
  return (data as Agenda | null) ?? null;
}

export async function deleteAgenda(id: string): Promise<boolean> {
  if (isDemoMode()) {
    const i = MOCK_AGENDAS.findIndex((x) => x.id === id);
    if (i >= 0) MOCK_AGENDAS.splice(i, 1);
    return true;
  }
  const { error } = await supabase!.from("agendas").delete().eq("id", id);
  if (error) {
    console.error("[meetup-agendas] deleteAgenda error", error);
    return false;
  }
  return true;
}

// ─── Votes ───────────────────────────────────────────────────
export async function listVotes(agendaId: string): Promise<AgendaVote[]> {
  if (isDemoMode()) {
    return MOCK_VOTES.filter((v) => v.agenda_id === agendaId);
  }
  const { data, error } = await supabase!
    .from("agenda_votes")
    .select("*")
    .eq("agenda_id", agendaId);
  if (error) {
    console.error("[meetup-agendas] listVotes error", error);
    return [];
  }
  return (data ?? []) as AgendaVote[];
}

export type VoteInput = {
  agenda_id: string;
  choices: string[];
  text_answer?: string | null;
};

/** upsert — 같은 (agenda_id, user_id) 가 있으면 갱신, 없으면 삽입. */
export async function castVote(
  input: VoteInput,
  userId: string,
): Promise<AgendaVote | null> {
  const row = {
    agenda_id: input.agenda_id,
    user_id: userId,
    choices: input.choices,
    text_answer: input.text_answer ?? null,
  };
  let saved: AgendaVote | null = null;
  let isNew = false;
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const i = MOCK_VOTES.findIndex(
      (v) => v.agenda_id === input.agenda_id && v.user_id === userId,
    );
    if (i >= 0) {
      const updated = { ...MOCK_VOTES[i], ...row, updated_at: now };
      MOCK_VOTES[i] = updated;
      saved = updated;
    } else {
      const v: AgendaVote = {
        id: crypto.randomUUID(),
        ...row,
        text_answer: row.text_answer,
        created_at: now,
        updated_at: now,
      };
      MOCK_VOTES.push(v);
      saved = v;
      isNew = true;
    }
  } else {
    // 신규/수정 구분을 위해 사전 조회
    const { data: prev } = await supabase!
      .from("agenda_votes")
      .select("id")
      .eq("agenda_id", input.agenda_id)
      .eq("user_id", userId)
      .maybeSingle();
    isNew = !prev;
    const { data, error } = await supabase!
      .from("agenda_votes")
      .upsert(row, { onConflict: "agenda_id,user_id" })
      .select()
      .single();
    if (error) {
      console.error("[meetup-agendas] castVote error", error);
      throw new Error(`투표 실패 (${error.code ?? ""}): ${error.message}`);
    }
    saved = (data as AgendaVote | null) ?? null;
  }
  // 신규 투표일 때만 활동 피드 기록 (수정은 노이즈)
  if (saved && isNew) {
    const a = await getAgenda(input.agenda_id);
    if (a) {
      const chosenLabels =
        a.poll_type === "text"
          ? null
          : a.options
              .filter((o) => input.choices.includes(o.id))
              .map((o) => o.label)
              .join(", ");
      await recordActivity(
        {
          workspace_id: a.workspace_id,
          action: "voted_agenda",
          resource_type: "agenda",
          resource_id: a.id,
          metadata: {
            title: a.title,
            choices: chosenLabels,
            poll_type: a.poll_type,
            text_excerpt: input.text_answer?.slice(0, 80) ?? null,
          },
        },
        userId,
      );
    }
  }
  return saved;
}

// ─── Comments ────────────────────────────────────────────────
export async function listComments(
  agendaId: string,
): Promise<Array<AgendaComment & { author: AuthorRef | null }>> {
  if (isDemoMode()) {
    return MOCK_COMMENTS.filter((c) => c.agenda_id === agendaId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({ ...c, author: authorFor(c.user_id) }));
  }
  const { data, error } = await supabase!
    .from("agenda_comments")
    .select(
      "*, author:user_profiles!agenda_comments_user_id_fkey(user_id, name, email, avatar_url)",
    )
    .eq("agenda_id", agendaId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[meetup-agendas] listComments error", error);
    return [];
  }
  return (data ?? []) as unknown as Array<
    AgendaComment & { author: AuthorRef | null }
  >;
}

export async function addComment(
  agendaId: string,
  userId: string,
  content: string,
  parentId?: string | null,
): Promise<AgendaComment | null> {
  const row = {
    agenda_id: agendaId,
    user_id: userId,
    content,
    parent_id: parentId ?? null,
  };
  let created: AgendaComment | null = null;
  if (isDemoMode()) {
    const c: AgendaComment = {
      id: crypto.randomUUID(),
      ...row,
      created_at: new Date().toISOString(),
    };
    MOCK_COMMENTS.push(c);
    created = c;
  } else {
    const { data, error } = await supabase!
      .from("agenda_comments")
      .insert(row)
      .select()
      .single();
    if (error) {
      console.error("[meetup-agendas] addComment error", error);
      return null;
    }
    created = (data as AgendaComment | null) ?? null;
  }
  if (created) {
    const a = await getAgenda(agendaId);
    if (a) {
      await recordActivity(
        {
          workspace_id: a.workspace_id,
          action: "commented_agenda",
          resource_type: "agenda",
          resource_id: a.id,
          metadata: { title: a.title, excerpt: content.slice(0, 80) },
        },
        userId,
      );
      // 안건 댓글은 전체 멤버에게 — 작성자 본인은 actor_id 로 자동 제외.
      const commenterName = await getActorName(userId);
      await notify({
        type: "comment",
        workspace_id: a.workspace_id,
        actor_id: userId,
        title: "💬 안건에 새 의견",
        body: `${commenterName} 님: ${content.slice(0, 80)}`,
        url: `/agendas/${a.id}`,
        tag: `agenda-comment-${a.id}-${created.id}`,
      });
    }
  }
  return created;
}

export async function deleteComment(id: string): Promise<boolean> {
  if (isDemoMode()) {
    const i = MOCK_COMMENTS.findIndex((c) => c.id === id);
    if (i >= 0) MOCK_COMMENTS.splice(i, 1);
    return true;
  }
  const { error } = await supabase!
    .from("agenda_comments")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[meetup-agendas] deleteComment error", error);
    return false;
  }
  return true;
}

// ─── 집계 헬퍼 — 다수결 채택 표시용 ───────────────────────────
export type OptionTally = {
  option: AgendaOption;
  count: number;
  voters: string[];
};

/**
 * 객관식 안건의 옵션별 득표 집계 + 최다 득표 option id (동률이면 null).
 */
export function tallyAgenda(
  agenda: Pick<Agenda, "poll_type" | "options">,
  votes: AgendaVote[],
): { tally: OptionTally[]; winnerId: string | null } {
  if (agenda.poll_type === "text") {
    return { tally: [], winnerId: null };
  }
  const tally: OptionTally[] = agenda.options.map((o) => ({
    option: o,
    count: 0,
    voters: [],
  }));
  for (const v of votes) {
    for (const c of v.choices) {
      const t = tally.find((x) => x.option.id === c);
      if (t) {
        t.count += 1;
        t.voters.push(v.user_id);
      }
    }
  }
  const max = Math.max(...tally.map((t) => t.count), 0);
  if (max === 0) return { tally, winnerId: null };
  const top = tally.filter((t) => t.count === max);
  return { tally, winnerId: top.length === 1 ? top[0].option.id : null };
}

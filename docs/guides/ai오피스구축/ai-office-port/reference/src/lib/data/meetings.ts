import { isDemoMode } from "@/lib/demo/mode";
import {
  MOCK_MEETINGS,
  MOCK_MEETING_ATTENDEES,
  MOCK_USER_PROFILES,
} from "@/lib/demo/fixtures";
import { supabase } from "@/lib/supabase";
import { recordActivity } from "@/lib/data/activities";
import { getActorName, notify } from "@/lib/data/notify";
import type {
  Meeting,
  MeetingAttendeeStatus,
  UserProfile,
} from "@/lib/types/database";

export type MeetingAttendeeWithProfile = {
  status: MeetingAttendeeStatus;
  reason: string | null;
  responded_at: string | null;
  profile: Pick<
    UserProfile,
    "user_id" | "name" | "email" | "avatar_url" | "industry"
  >;
};

/** Meetings inside a workspace, default newest first. */
export async function getWorkspaceMeetings(
  workspaceId: string,
  { upcomingOnly = false }: { upcomingOnly?: boolean } = {},
): Promise<Meeting[]> {
  if (isDemoMode()) {
    const now = Date.now();
    return MOCK_MEETINGS
      .filter((m) => m.workspace_id === workspaceId)
      .filter((m) => (upcomingOnly ? new Date(m.starts_at).getTime() >= now : true))
      .sort((a, b) =>
        upcomingOnly
          ? a.starts_at.localeCompare(b.starts_at)
          : b.starts_at.localeCompare(a.starts_at),
      );
  }

  let query = supabase!.from("meetings").select("*").eq("workspace_id", workspaceId);
  if (upcomingOnly) {
    query = query
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });
  } else {
    query = query.order("starts_at", { ascending: false });
  }
  const { data } = await query;
  return (data as Meeting[]) ?? [];
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  if (isDemoMode()) {
    return MOCK_MEETINGS.find((m) => m.id === id) ?? null;
  }
  const { data } = await supabase!
    .from("meetings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Meeting | null) ?? null;
}

export async function getMeetingAttendees(
  meetingId: string,
): Promise<MeetingAttendeeWithProfile[]> {
  if (isDemoMode()) {
    return MOCK_MEETING_ATTENDEES
      .filter((a) => a.meeting_id === meetingId)
      .map((a) => {
        const profile = MOCK_USER_PROFILES.find(
          (p) => p.user_id === a.user_id,
        )!;
        return {
          status: a.status,
          reason: (a as { reason?: string | null }).reason ?? null,
          responded_at: (a as { responded_at?: string | null }).responded_at ?? null,
          profile: {
            user_id: profile.user_id,
            name: profile.name,
            email: profile.email,
            avatar_url: profile.avatar_url,
            industry: profile.industry,
          },
        };
      });
  }

  const { data } = await supabase!
    .from("meeting_attendees")
    .select(
      "status, reason, responded_at, profile:user_profiles(user_id, name, email, avatar_url, industry)",
    )
    .eq("meeting_id", meetingId);
  return (data ?? []) as unknown as MeetingAttendeeWithProfile[];
}

export async function countWorkspaceMeetings(
  workspaceId: string,
): Promise<number> {
  if (isDemoMode()) {
    return MOCK_MEETINGS.filter((m) => m.workspace_id === workspaceId).length;
  }
  const { count } = await supabase!
    .from("meetings")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  return count ?? 0;
}

// ───────────────────────────────────────────────────────────────
// Mutations
// ───────────────────────────────────────────────────────────────

export type MeetingInput = {
  workspace_id: string;
  type_id: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
};

function newId(): string {
  // crypto.randomUUID is available in modern browsers + recent Node
  return crypto.randomUUID();
}

/**
 * Create a meeting and (optionally) seed an initial attendee list with
 * everyone marked "attending". `createdBy` is auto-added so the creator
 * doesn't have to remember to check themselves.
 */
export async function createMeeting(
  input: MeetingInput,
  createdBy: string,
  attendeeUserIds: ReadonlyArray<string>,
): Promise<Meeting | null> {
  const ids = Array.from(new Set([createdBy, ...attendeeUserIds]));

  if (isDemoMode()) {
    const now = new Date().toISOString();
    const m: Meeting = {
      id: newId(),
      ...input,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    };
    MOCK_MEETINGS.push(m);
    ids.forEach((uid) =>
      MOCK_MEETING_ATTENDEES.push({
        meeting_id: m.id,
        user_id: uid,
        status: "attending",
      }),
    );
    await recordActivity(
      {
        workspace_id: m.workspace_id,
        action: "created_meeting",
        resource_type: "meeting",
        resource_id: m.id,
        metadata: { title: m.title },
      },
      createdBy,
    );
    return m;
  }

  const { data, error } = await supabase!
    .from("meetings")
    .insert({ ...input, created_by: createdBy })
    .select()
    .single();
  if (error || !data) return null;

  if (ids.length > 0) {
    await supabase!.from("meeting_attendees").insert(
      ids.map((uid) => ({
        meeting_id: data.id,
        user_id: uid,
        status: "attending" as const,
      })),
    );
  }
  const creatorName = await getActorName(createdBy);
  await notify({
    type: "new_meeting",
    workspace_id: (data as Meeting).workspace_id,
    actor_id: createdBy,
    title: "📅 새 일정",
    body: `${creatorName} 님이 「${(data as Meeting).title}」 일정을 등록했어요.`,
    url: `/meetings/${(data as Meeting).id}`,
    tag: `meeting-${(data as Meeting).id}`,
  });
  return data as Meeting;
}

export type MeetingPatch = Partial<Omit<MeetingInput, "workspace_id">>;

export async function updateMeeting(
  id: string,
  patch: MeetingPatch,
): Promise<Meeting | null> {
  const cleaned: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(patch)) {
    cleaned[k] = typeof v === "string" && v.trim() === "" ? null : (v as string);
  }

  if (isDemoMode()) {
    const i = MOCK_MEETINGS.findIndex((m) => m.id === id);
    if (i < 0) return null;
    MOCK_MEETINGS[i] = {
      ...MOCK_MEETINGS[i],
      ...(cleaned as Partial<Meeting>),
      updated_at: new Date().toISOString(),
    };
    return MOCK_MEETINGS[i];
  }

  const { data } = await supabase!
    .from("meetings")
    .update({ ...cleaned, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  return (data as Meeting | null) ?? null;
}

export async function deleteMeeting(id: string): Promise<boolean> {
  if (isDemoMode()) {
    const mi = MOCK_MEETINGS.findIndex((m) => m.id === id);
    if (mi < 0) return false;
    MOCK_MEETINGS.splice(mi, 1);
    for (let i = MOCK_MEETING_ATTENDEES.length - 1; i >= 0; i--) {
      if (MOCK_MEETING_ATTENDEES[i].meeting_id === id) {
        MOCK_MEETING_ATTENDEES.splice(i, 1);
      }
    }
    return true;
  }
  const { error } = await supabase!.from("meetings").delete().eq("id", id);
  return !error;
}

/**
 * Upsert a single attendee row. Used by the "내 참석 상태" toggle on the
 * meeting detail page.
 */
export async function setMeetingAttendance(
  meetingId: string,
  userId: string,
  status: MeetingAttendeeStatus,
  reason?: string | null,
  /** 본인이 직접 표시한 경우 활동 피드에 기록. 운영자가 다른 멤버
   *  상태를 바꿀 땐 false 로 호출해 노이즈 회피. */
  recordToActivity = true,
): Promise<void> {
  const now = new Date().toISOString();
  // 참석은 사유 불필요 — null 로 정리.
  const normalizedReason =
    status === "attending" ? null : reason?.trim() || null;
  if (isDemoMode()) {
    const existing = MOCK_MEETING_ATTENDEES.find(
      (a) => a.meeting_id === meetingId && a.user_id === userId,
    ) as
      | (typeof MOCK_MEETING_ATTENDEES[number] & {
          reason?: string | null;
          responded_at?: string | null;
        })
      | undefined;
    if (existing) {
      existing.status = status;
      existing.reason = normalizedReason;
      existing.responded_at = now;
    } else {
      MOCK_MEETING_ATTENDEES.push({
        meeting_id: meetingId,
        user_id: userId,
        status,
        reason: normalizedReason,
        responded_at: now,
      });
    }
  } else {
    await supabase!
      .from("meeting_attendees")
      .upsert(
        {
          meeting_id: meetingId,
          user_id: userId,
          status,
          reason: normalizedReason,
          responded_at: now,
        },
        { onConflict: "meeting_id,user_id" },
      );
  }

  // 지각/불참 표시(+ 사유) 만 활동 피드에 기록. 참석 토글은 노이즈가
  // 너무 많아 제외.
  if (recordToActivity && (status === "late" || status === "absent")) {
    const meeting = await getMeeting(meetingId);
    if (meeting) {
      await recordActivity(
        {
          workspace_id: meeting.workspace_id,
          action:
            status === "late"
              ? "reported_late"
              : "reported_absent",
          resource_type: "meeting",
          resource_id: meetingId,
          metadata: {
            title: meeting.title,
            reason: normalizedReason,
            starts_at: meeting.starts_at,
          },
        },
        userId,
      );
      // 운영자(+호스트) 에게 푸시. 호스트 = meeting.created_by.
      // 운영자는 edge function 의 getRecipients 가 처리.
      const name = await getActorName(userId);
      const verb = status === "late" ? "지각해요" : "참석 못 해요";
      await notify({
        type: "attendance_reported",
        workspace_id: meeting.workspace_id,
        actor_id: userId,
        title: status === "late" ? "⏰ 지각 알림" : "🙏 불참 알림",
        body: `${name} 님이 「${meeting.title}」 ${verb}${normalizedReason ? ` — ${normalizedReason}` : ""}`,
        url: `/meetings/${meeting.id}`,
        tag: `attendance-${meeting.id}-${userId}`,
      });
    }
  }
}

/**
 * Replace a meeting's entire attendee list with the given users (all marked
 * "attending"). Used by the edit form when the host re-picks attendees.
 */
export async function setMeetingAttendees(
  meetingId: string,
  userIds: ReadonlyArray<string>,
): Promise<void> {
  const unique = Array.from(new Set(userIds));

  if (isDemoMode()) {
    for (let i = MOCK_MEETING_ATTENDEES.length - 1; i >= 0; i--) {
      if (MOCK_MEETING_ATTENDEES[i].meeting_id === meetingId) {
        MOCK_MEETING_ATTENDEES.splice(i, 1);
      }
    }
    unique.forEach((uid) =>
      MOCK_MEETING_ATTENDEES.push({
        meeting_id: meetingId,
        user_id: uid,
        status: "attending",
      }),
    );
    return;
  }

  await supabase!.from("meeting_attendees").delete().eq("meeting_id", meetingId);
  if (unique.length > 0) {
    await supabase!.from("meeting_attendees").insert(
      unique.map((uid) => ({
        meeting_id: meetingId,
        user_id: uid,
        status: "attending" as const,
      })),
    );
  }
}

export async function getMeetupsHostedBy(profileId: string): Promise<Meeting[]> {
  // kept as alias for old name used elsewhere — defers to hostedBy
  return getMeetingsHostedBy(profileId);
}

export async function getMeetingsForProject(
  projectId: string,
): Promise<Meeting[]> {
  if (isDemoMode()) {
    return MOCK_MEETINGS
      .filter((m) => m.project_id === projectId)
      .slice()
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  }
  const { data } = await supabase!
    .from("meetings")
    .select("*")
    .eq("project_id", projectId)
    .order("starts_at", { ascending: false });
  return (data as Meeting[]) ?? [];
}

export async function getMeetingsHostedBy(profileId: string): Promise<Meeting[]> {
  if (isDemoMode()) {
    return MOCK_MEETINGS.filter((m) => m.created_by === profileId).sort((a, b) =>
      a.starts_at.localeCompare(b.starts_at),
    );
  }
  const { data } = await supabase!
    .from("meetings")
    .select("*")
    .eq("created_by", profileId)
    .order("starts_at", { ascending: true });
  return (data as Meeting[]) ?? [];
}

export async function getMeetupsAttendedBy(
  profileId: string,
): Promise<Meeting[]> {
  return getMeetingsAttendedBy(profileId);
}

export async function getMeetingsAttendedBy(
  profileId: string,
): Promise<Meeting[]> {
  if (isDemoMode()) {
    const ids = MOCK_MEETING_ATTENDEES.filter(
      (a) => a.user_id === profileId && a.status === "attending",
    ).map((a) => a.meeting_id);
    return MOCK_MEETINGS.filter((m) => ids.includes(m.id)).sort((a, b) =>
      a.starts_at.localeCompare(b.starts_at),
    );
  }
  const { data } = await supabase!
    .from("meeting_attendees")
    .select("meeting:meetings(*)")
    .eq("user_id", profileId)
    .eq("status", "attending");
  return ((data ?? []) as unknown as { meeting: Meeting }[])
    .map((r) => r.meeting)
    .filter(Boolean);
}

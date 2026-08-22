import { isDemoMode } from "@/lib/demo/mode";
import {
  MOCK_ACTIVITIES,
  MOCK_USER_PROFILES,
} from "@/lib/demo/fixtures";
import { supabase } from "@/lib/supabase";
import type { Activity, UserProfile } from "@/lib/types/database";

export type ActorRef = Pick<
  UserProfile,
  "user_id" | "name" | "email" | "avatar_url"
>;

export type ActivityWithActor = Activity & {
  actor: ActorRef | null;
};

function actorFor(userId: string): ActorRef | null {
  const p = MOCK_USER_PROFILES.find((x) => x.user_id === userId);
  if (!p) return null;
  return {
    user_id: p.user_id,
    name: p.name,
    email: p.email,
    avatar_url: p.avatar_url,
  };
}

export async function getWorkspaceActivities(
  workspaceId: string,
  limit?: number,
): Promise<ActivityWithActor[]> {
  if (isDemoMode()) {
    const rows = MOCK_ACTIVITIES
      .filter((a) => a.workspace_id === workspaceId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((a) => ({ ...a, actor: actorFor(a.user_id) }));
    return typeof limit === "number" ? rows.slice(0, limit) : rows;
  }

  let query = supabase!
    .from("activities")
    .select(
      "*, actor:user_profiles(user_id, name, email, avatar_url)",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (typeof limit === "number") query = query.limit(limit);
  const { data } = await query;
  return (data ?? []) as unknown as ActivityWithActor[];
}

export type ActivityInput = {
  workspace_id: string;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append a single activity. Best-effort — failures are swallowed so a
 * domain mutation never gets blocked by a logging error.
 */
export async function recordActivity(
  input: ActivityInput,
  userId: string,
): Promise<void> {
  try {
    if (isDemoMode()) {
      MOCK_ACTIVITIES.unshift({
        id: crypto.randomUUID(),
        workspace_id: input.workspace_id,
        user_id: userId,
        action: input.action,
        resource_type: input.resource_type ?? null,
        resource_id: input.resource_id ?? null,
        metadata: input.metadata ?? {},
        created_at: new Date().toISOString(),
      });
      return;
    }
    await supabase!.from("activities").insert({
      workspace_id: input.workspace_id,
      user_id: userId,
      action: input.action,
      resource_type: input.resource_type ?? null,
      resource_id: input.resource_id ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {
    /* logging is best-effort */
  }
}

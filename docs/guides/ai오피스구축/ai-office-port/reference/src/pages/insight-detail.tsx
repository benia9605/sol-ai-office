import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import { getMyRole } from "@/lib/data/workspaces";
import {
  addInsightComment,
  deleteInsight,
  deleteInsightComment,
  getInsight,
  getInsightComments,
  toggleInsightLike,
  updateInsight,
} from "@/lib/data/insights";
import { Avatar } from "@/components/avatar";
import { RichEditor, RichRender } from "@/features/editor/rich-editor";
import { formatDateTime } from "@/lib/format";
import { errorBox, inputClass, labelClass } from "@/features/auth/_shared";
import { PostModerationBar } from "@/features/social/post-moderation";
import { LikeCommentBlock } from "@/features/social/like-comment-block";
import { VisionLinkPicker } from "@/features/vision/vision-link-picker";
import type { Insight } from "@/lib/types/database";

export function InsightDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);
  const [editing, setEditing] = useState(false);
  function bump() {
    setRefreshKey((v) => v + 1);
  }

  const { data: insight, loading } = useAsync(
    () =>
      id && user ? getInsight(id, user.id) : Promise.resolve(null),
    [id, user?.id, refreshKey],
  );
  const { data: comments } = useAsync(
    () => (id ? getInsightComments(id) : Promise.resolve([])),
    [id, refreshKey],
  );
  const { data: myRole } = useAsync(
    () =>
      workspace && user
        ? getMyRole(workspace.id, user.id)
        : Promise.resolve(null),
    [workspace?.id, user?.id],
  );

  if (loading) return null;
  if (!insight) return <Navigate to="/insights" replace />;
  if (!user) return null;

  const isAuthor = insight.user_id === user.id;
  const isAdmin = myRole === "owner" || myRole === "admin";

  async function handleDeleteInsight() {
    if (!insight) return;
    const ok = await deleteInsight(insight.id);
    if (ok) navigate("/insights");
  }

  const author = insight.author;
  const display = author?.name ?? author?.email ?? "익명";
  const subtitle =
    [author?.company, author?.position].filter(Boolean).join(" · ") || "";

  return (
    <article className="space-y-10 max-w-3xl">
      <div className="flex items-center justify-between">
        <Link
          to="/insights"
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          ← 인사이트
        </Link>
        <PostModerationBar
          isAuthor={isAuthor}
          isAdmin={isAdmin}
          isShared={insight.is_shared}
          editing={editing}
          onEdit={() => setEditing(true)}
          onToggleShared={async (next) => {
            const updated = await updateInsight(insight.id, {
              is_shared: next,
            });
            if (!updated) throw new Error("처리에 실패했습니다.");
            bump();
          }}
          onDelete={handleDeleteInsight}
          noun="이 인사이트"
        />
      </div>

      {editing && isAuthor ? (
        <EditForm
          insight={insight}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            bump();
          }}
        />
      ) : (
        <>
          <header>
            <div className="flex items-center gap-3">
              <Avatar url={author?.avatar_url ?? null} name={display} size="md" />
              <div className="min-w-0 flex-1">
                {author ? (
                  <Link
                    to={`/members/${author.user_id}`}
                    className="text-sm hover:text-accent-teal"
                  >
                    {display}
                  </Link>
                ) : (
                  <p className="text-sm">{display}</p>
                )}
                {subtitle && (
                  <p className="text-xs text-foreground-muted truncate">
                    {subtitle}
                  </p>
                )}
              </div>
              <span className="text-xs text-foreground-faint">
                {formatDateTime(insight.created_at)}
              </span>
            </div>

            <h1 className="mt-8 text-3xl font-light leading-tight sm:text-4xl">
              {insight.title}
            </h1>

            {insight.tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {insight.tags.map((tag) => (
                  <li
                    key={tag}
                    className="text-xs text-foreground-muted border border-line px-2 py-0.5"
                  >
                    #{tag}
                  </li>
                ))}
              </ul>
            )}
          </header>

          {insight.content && (
            <section>
              <RichRender html={insight.content} />
            </section>
          )}

          {insight.source && (
            <section>
              <p className="text-xs text-foreground-muted">
                출처 · <span className="text-foreground">{insight.source}</span>
              </p>
            </section>
          )}

      <LikeCommentBlock
        liked={insight.liked_by_me}
        likeCount={insight.like_count}
        onToggleLike={async () => {
          await toggleInsightLike(insight.id, user.id);
          bump();
        }}
        comments={comments ?? []}
        currentUserId={user.id}
        canModerate={isAdmin}
        onAddComment={async (content, parentId) => {
          await addInsightComment(insight.id, user.id, content, parentId);
          bump();
        }}
        onDeleteComment={async (cid) => {
          await deleteInsightComment(cid);
          bump();
        }}
      />
        </>
      )}
    </article>
  );
}

// ───────────────────────────────────────────────────────────────
// 인사이트 편집 폼 — 작성자만
// ───────────────────────────────────────────────────────────────

function EditForm({
  insight,
  onCancel,
  onSaved,
}: {
  insight: Insight;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(insight.title);
  const [content, setContent] = useState(insight.content ?? "");
  const [source, setSource] = useState(insight.source ?? "");
  const [tagsText, setTagsText] = useState(insight.tags.join(", "));
  const [busy, setBusy] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(nextStatus: "draft" | "published") {
    if (!title.trim()) {
      setError("제목은 필수입니다.");
      return;
    }
    setBusy(nextStatus);
    setError(null);
    const tags = tagsText
      .split(/[,#]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const updated = await updateInsight(insight.id, {
      title: title.trim(),
      content: content.trim() || null,
      source: source.trim() || null,
      tags,
      status: nextStatus,
    });
    if (!updated) {
      setError("저장에 실패했습니다.");
      setBusy(null);
      return;
    }
    onSaved();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    save("published");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className={labelClass}>제목 *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputClass} mt-2`}
          placeholder="짧고 분명하게."
        />
      </div>

      <div>
        <label className={labelClass}>본문</label>
        <div className="mt-2">
          <RichEditor value={content} onChange={setContent} minHeight={280} />
        </div>
      </div>

      <div>
        <label className={labelClass}>출처</label>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className={`${inputClass} mt-2`}
          placeholder="책 / 강의 / 운영 데이터 등"
        />
      </div>

      <div>
        <label className={labelClass}>태그</label>
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          className={`${inputClass} mt-2`}
          placeholder="가격, 디자인"
        />
      </div>

      <VisionLinkPicker target={{ type: "insight", id: insight.id }} />

      {error && <p className={errorBox}>{error}</p>}

      <footer className="flex justify-end gap-2 border-t border-line pt-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy !== null}
          className="border border-line-strong px-5 py-2.5 text-sm hover:border-foreground disabled:opacity-60"
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => save("draft")}
          disabled={busy !== null}
          className="border border-line-strong px-5 py-2.5 text-sm text-foreground-muted hover:text-foreground hover:border-foreground disabled:opacity-60"
        >
          {busy === "draft" ? "저장 중..." : "임시저장"}
        </button>
        <button
          type="submit"
          disabled={busy !== null}
          className="border border-accent bg-accent px-5 py-2.5 text-sm text-accent-foreground hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-60"
        >
          {busy === "published" ? "저장 중..." : "수정 저장"}
        </button>
      </footer>
    </form>
  );
}

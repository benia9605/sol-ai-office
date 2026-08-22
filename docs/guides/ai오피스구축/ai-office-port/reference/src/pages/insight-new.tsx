import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { createInsight } from "@/lib/data/insights";
import { errorBox, inputClass, labelClass } from "@/features/auth/_shared";
import { RichEditor } from "@/features/editor/rich-editor";

export function InsightNewPage() {
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [busy, setBusy] = useState<"draft" | "published" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user || !workspace) return <Navigate to="/insights" replace />;

  async function save(status: "draft" | "published") {
    if (!title.trim()) {
      setError("제목은 필수입니다.");
      return;
    }
    setBusy(status);
    setError(null);
    const tags = tagsText
      .split(/[,#]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const created = await createInsight(
      {
        workspace_id: workspace!.id,
        title: title.trim(),
        content: content.trim() || null,
        source: source.trim() || null,
        tags,
        status,
      },
      user!.id,
    );
    setBusy(null);
    if (!created) {
      setError("저장에 실패했습니다.");
      return;
    }
    if (status === "draft") navigate("/me/posts");
    else navigate(`/insights/${created.id}`);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await save("published");
  }

  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <Link
          to="/insights"
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          ← 인사이트
        </Link>
      </div>
      <header>
        <p className="label">Insight</p>
        <h1 className="mt-3 text-3xl font-light">새 인사이트</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Field label="제목 *">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="짧고 분명하게."
            className={inputClass}
            autoFocus
          />
        </Field>

        <Field label="본문">
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="배운 점 · 경험 · 데이터 등. AI 답변/마크다운도 그대로 붙여넣을 수 있어요."
            minHeight={280}
          />
        </Field>

        <Field label="출처">
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="책 / 강의 / 운영 데이터 / 대화 등"
            className={inputClass}
          />
        </Field>

        <Field label="태그" hint="쉼표 또는 # 으로 구분. 예: 가격, 디자인, SaaS">
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="가격, 디자인"
            className={inputClass}
          />
        </Field>

        {error && <p className={errorBox}>{error}</p>}

        <div className="flex justify-end gap-2 border-t border-line pt-6">
          <button
            type="button"
            onClick={() => navigate("/insights")}
            disabled={busy !== null}
            className="border border-line-strong px-5 py-2.5 text-sm text-foreground hover:border-foreground"
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
            className="bg-accent-teal text-accent-foreground px-5 py-2.5 text-sm hover:bg-accent-teal/85 transition-colors disabled:opacity-60"
          >
            {busy === "published" ? "발행 중..." : "발행"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1 text-xs text-foreground-faint">{hint}</p>}
    </div>
  );
}

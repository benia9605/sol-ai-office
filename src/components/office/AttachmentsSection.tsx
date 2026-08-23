/**
 * @file src/components/office/AttachmentsSection.tsx
 * @description 첨부파일 섹션 (목록·업로드·삭제) + 뷰어 모달 — 이식 킷 04
 * - 상세 화면(할일/회의/인사이트/기록)에 mount. refType/refId로 대상 지정.
 * - 뷰어 모달은 가이드가 허용하는 예외(파일을 크게 보고 닫으면 원래 자리).
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Attachment, AttachmentRefType,
  listAttachments, uploadAttachment, deleteAttachment, signedUrl,
} from '../../services/attachments.service';

function fmtBytes(n?: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(a: Attachment) { return (a.mime || '').startsWith('image/'); }
function isPdf(a: Attachment) { return (a.mime || '') === 'application/pdf'; }

/** 파일 유형 아이콘 (모노 라인) */
function FileGlyph({ a }: { a: Attachment }) {
  const kind = isImage(a) ? 'image' : isPdf(a) ? 'pdf' : 'file';
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-foreground-muted flex-shrink-0">
      {kind === 'image' ? (
        <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.6" /><path d="m21 15-4.5-4.5L6 21" /></>
      ) : (
        <><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />{kind === 'pdf' && <path d="M9 13h6M9 17h4" />}</>
      )}
    </svg>
  );
}

/** 첨부 뷰어 모달 — 이미지/PDF는 인라인, 그 외는 다운로드 */
function AttachmentViewer({ att, onClose }: { att: Attachment; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    signedUrl(att).then(u => { if (alive) { setUrl(u); if (!u) setErr(true); } }).catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [att]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="bg-surface rounded-2xl w-full max-w-3xl max-h-[88dvh] overflow-hidden flex flex-col" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <FileGlyph a={att} />
          <span className="text-sm font-medium text-foreground truncate flex-1">{att.filename}</span>
          {url && <a href={url} download={att.filename} className="text-xs text-foreground-muted hover:text-foreground">다운로드</a>}
          <button onClick={onClose} className="w-7 h-7 rounded-full hover:bg-surface-muted text-foreground-muted flex items-center justify-center">✕</button>
        </div>
        <div className="flex-1 overflow-auto bg-surface-muted flex items-center justify-center min-h-[200px]">
          {err ? (
            <p className="text-sm text-foreground-faint p-8">파일을 열 수 없어요.</p>
          ) : !url ? (
            <p className="text-sm text-foreground-faint p-8">불러오는 중…</p>
          ) : isImage(att) ? (
            <img src={url} alt={att.filename} className="max-w-full max-h-[76dvh] object-contain" />
          ) : isPdf(att) ? (
            <iframe src={url} title={att.filename} className="w-full h-[76dvh]" />
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm text-foreground-muted mb-3">미리보기를 지원하지 않는 형식이에요.</p>
              <a href={url} download={att.filename} className="inline-block px-4 py-2 rounded-xl bg-foreground text-surface text-sm font-medium">다운로드</a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function AttachmentsSection({
  workspaceId, refType, refId, canManage = true,
}: {
  workspaceId: string; refType: AttachmentRefType; refId: string; canManage?: boolean;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<Attachment | null>(null);

  // initial=true일 때만 로딩 스피너(=깜빡임). 조용한 재조회는 스피너 없이.
  const load = async (initial = false) => {
    if (initial) setLoading(true);
    try { setItems(await listAttachments(refType, refId)); }
    catch { if (initial) setItems([]); }
    finally { if (initial) setLoading(false); }
  };
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [refType, refId]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      // 기존 목록은 그대로 두고, 업로드된 것만 하나씩 뒤에 추가 (전체 재조회로 인한 깜빡임 없음)
      for (const f of files) {
        const a = await uploadAttachment(f, workspaceId, refType, refId);
        setItems(prev => [...prev, a]);
      }
    } catch (err) {
      alert('업로드 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally { setBusy(false); }
  };

  const onDelete = async (a: Attachment) => {
    if (!confirm(`"${a.filename}" 을(를) 삭제할까요?`)) return;
    setItems(list => list.filter(x => x.id !== a.id)); // 낙관적 제거
    try { await deleteAttachment(a); } catch { load(); /* 실패 시 조용히 복구(스피너 없음) */ }
  };

  // 읽기 전용(뷰 모드)인데 첨부가 하나도 없으면 섹션 자체를 숨긴다
  if (!canManage && !loading && items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
        <h2 className="text-base text-foreground">첨부파일{items.length > 0 && <span className="ml-1.5 text-sm text-foreground-faint">{items.length}</span>}</h2>
        {canManage && (
          <label className={`text-xs px-3 py-1.5 rounded-lg border border-line text-foreground-muted hover:border-foreground hover:text-foreground transition-colors cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
            {busy ? '올리는 중…' : '＋ 파일 추가'}
            <input type="file" multiple onChange={onPick} className="hidden" />
          </label>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-foreground-faint py-3">불러오는 중…</p>
      ) : items.length === 0 ? null : (
        <ul className="space-y-1">
          {items.map(a => (
            <li key={a.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-line hover:bg-surface-muted transition-colors group">
              <button onClick={() => setViewing(a)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                <FileGlyph a={a} />
                <span className="text-sm text-foreground truncate">{a.filename}</span>
                <span className="text-[11px] text-foreground-faint flex-shrink-0">{fmtBytes(a.sizeBytes)}</span>
              </button>
              {canManage && (
                <button onClick={() => onDelete(a)} className="text-[11px] text-foreground-faint hover:text-rose-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">삭제</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {viewing && <AttachmentViewer att={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

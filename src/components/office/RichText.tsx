/**
 * @file src/components/office/RichText.tsx
 * @description 오피스 리치텍스트 공용 헬퍼 (Tiptap JSON ↔ 텍스트 컬럼 하위호환)
 * - 회의 본문·인사이트·기록 등 text 컬럼에 Tiptap JSON을 문자열로 저장하고,
 *   과거 plain text 값도 깨지지 않게 렌더한다.
 * - parseDoc: 저장값(string) → Tiptap JSON doc.  serializeDoc: JSON → 저장 문자열.
 * - docToText: 미리보기/한 줄 요약용 평문 추출.
 * - RichText: 저장값을 읽기전용 렌더(에디터 문서면 TiptapReadOnly, 아니면 평문).
 */
import { TiptapReadOnly } from '../tiptap/TiptapReadOnly';

type Doc = Record<string, unknown>;
const EMPTY_DOC: Doc = { type: 'doc', content: [{ type: 'paragraph' }] };

function isTiptapDoc(v: unknown): v is Doc {
  return !!v && typeof v === 'object' && (v as Doc).type === 'doc' && Array.isArray((v as Doc).content);
}

/** 저장값(문자열/객체/null) → Tiptap JSON doc. 평문이면 문단으로 감싼다. */
export function parseDoc(value: unknown): Doc {
  if (isTiptapDoc(value)) return value as Doc;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return { ...EMPTY_DOC };
    if (s.startsWith('{')) {
      try { const j = JSON.parse(s); if (isTiptapDoc(j)) return j; } catch { /* 평문으로 처리 */ }
    }
    // 평문 → 줄바꿈 단위 문단
    return {
      type: 'doc',
      content: s.split(/\n/).map(line => ({
        type: 'paragraph',
        ...(line ? { content: [{ type: 'text', text: line }] } : {}),
      })),
    };
  }
  return { ...EMPTY_DOC };
}

/** Tiptap JSON doc → 저장 문자열 */
export function serializeDoc(json: Doc): string {
  return JSON.stringify(json);
}

/** 미리보기/요약용 평문 추출 (에디터 문서면 텍스트만, 평문이면 그대로) */
export function docToText(value: unknown): string {
  if (typeof value === 'string' && !value.trim().startsWith('{')) return value;
  const doc = parseDoc(value);
  const parts: string[] = [];
  const walk = (n: any) => {
    if (!n) return;
    if (typeof n.text === 'string') parts.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return parts.join(' ').trim();
}

/** 저장값 읽기전용 렌더 — 에디터 문서면 TiptapReadOnly, 아니면 평문. 비었으면 null. */
export function RichText({ value, className = '' }: { value: unknown; className?: string }) {
  const text = docToText(value);
  if (!text) return null;
  // 에디터로 작성된 문서만 리치 렌더, 그 외(AI 자동생성 평문 등)는 평문 표시
  const isDoc = isTiptapDoc(value) || (typeof value === 'string' && value.trim().startsWith('{') && isTiptapDoc(safeParse(value)));
  if (isDoc) return <div className={className}><TiptapReadOnly content={parseDoc(value)} /></div>;
  return <p className={`whitespace-pre-wrap ${className}`}>{text}</p>;
}

function safeParse(s: string): unknown { try { return JSON.parse(s); } catch { return null; } }

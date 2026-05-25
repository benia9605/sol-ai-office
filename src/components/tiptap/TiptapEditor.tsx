/**
 * @file src/components/tiptap/TiptapEditor.tsx
 * @description Tiptap 리치텍스트 에디터 (편집 모드)
 * - 툴바: 볼드/이탤릭/취소선, H1/H2/H3, 하이라이트, 인용문, 리스트, 체크리스트, 링크, 이미지, 테이블
 * - 마크다운 붙여넣기 자동 변환
 * - JSON 포맷으로 콘텐츠 저장
 */
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { useCallback, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { uploadImage } from '../../services/storage.service';
import { marked } from 'marked';
import './tiptap.css';

export interface TiptapEditorHandle {
  insertClaudeBlock: () => void;
  insertQABlock: () => void;
}

/** 노션 컬러 팔레트 — 텍스트 10색 / 배경 10색 */
const NOTION_TEXT_COLORS: { label: string; value: string }[] = [
  { label: '기본',   value: '#37352F' },
  { label: '회색',   value: '#787774' },
  { label: '갈색',   value: '#976D57' },
  { label: '주황',   value: '#CC782F' },
  { label: '노랑',   value: '#C29343' },
  { label: '초록',   value: '#548164' },
  { label: '파랑',   value: '#477DA5' },
  { label: '보라',   value: '#A48BBE' },
  { label: '핑크',   value: '#B35488' },
  { label: '빨강',   value: '#C4554D' },
];

const NOTION_HIGHLIGHT_COLORS: { label: string; value: string }[] = [
  { label: '기본',   value: '#F1F1EF' },
  { label: '회색',   value: '#E3E2E0' },
  { label: '갈색',   value: '#EEE0DA' },
  { label: '주황',   value: '#FADEC9' },
  { label: '노랑',   value: '#FDECC8' },
  { label: '초록',   value: '#DBEDDB' },
  { label: '파랑',   value: '#D3E5EF' },
  { label: '보라',   value: '#E8DEEE' },
  { label: '핑크',   value: '#F5E0E9' },
  { label: '빨강',   value: '#FFE2DD' },
];

/** 색상 팔레트 popover */
function ColorPalette({
  kind, onPick, onReset, onClose, anchorClass = '',
}: {
  kind: 'text' | 'highlight';
  onPick: (color: string) => void;
  onReset: () => void;
  onClose: () => void;
  /** popover 위치/배치 (top-full mt-1 등) */
  anchorClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const colors = kind === 'text' ? NOTION_TEXT_COLORS : NOTION_HIGHLIGHT_COLORS;
  const title = kind === 'text' ? '글자색' : '배경 형광';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`tiptap-color-palette ${anchorClass}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="palette-title">{title}</div>
      <div className="palette-grid">
        {colors.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => { onPick(c.value); onClose(); }}
            className="palette-swatch"
            style={
              kind === 'text'
                ? { color: c.value, background: '#ffffff' }
                : { background: c.value, color: '#1a1a1a' }
            }
            title={c.label}
            aria-label={c.label}
          >
            A
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => { onReset(); onClose(); }}
        className="palette-reset"
      >
        ✕ 색상 해제
      </button>
    </div>
  );
}

/** 마크다운 텍스트인지 감지 */
function looksLikeMarkdown(text: string): boolean {
  const patterns = [
    /^#{1,3}\s/m,          // 제목
    /^\s*[-*]\s/m,         // 리스트
    /^\s*-\s\[[ x]\]/m,   // 체크박스
    /\|---/,               // 테이블
    /\*\*.+?\*\*/,         // 볼드
    /^---$/m,              // 구분선
    /^```/m,               // 코드블록
    /^>\s/m,               // 인용문
    /^\d+\.\s/m,           // 번호 리스트
  ];
  let matches = 0;
  for (const p of patterns) {
    if (p.test(text)) matches++;
    if (matches >= 2) return true;
  }
  return false;
}

interface TiptapEditorProps {
  content?: Record<string, unknown>;
  onChange: (json: Record<string, unknown>) => void;
  placeholder?: string;
  /** 사용자 이름 (Claude 대화 템플릿에 표시) */
  userName?: string;
}

export const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(function TiptapEditor({
  content, onChange,
  placeholder = '스터디 노트를 작성하세요...',
  userName = '나',
}: TiptapEditorProps, ref) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: true, allowBase64: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
    ],
    content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON() as Record<string, unknown>);
    },
    editorProps: {
      handlePaste(view, event) {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        // HTML이 있으면 Tiptap 기본 처리 (노션 등에서 복사 시)
        const html = clipboardData.getData('text/html');
        if (html && html.trim().length > 10) return false;

        // plain text에서 마크다운 감지
        const text = clipboardData.getData('text/plain');
        if (!text || !looksLikeMarkdown(text)) return false;

        // 마크다운 → HTML 변환
        event.preventDefault();
        const converted = marked.parse(text, { breaks: true, gfm: true });
        // task list 변환: <li><input checked> → Tiptap taskList 호환
        const taskHtml = (typeof converted === 'string' ? converted : '')
          .replace(/<li>\s*<input[^>]*checked[^>]*>\s*/g, '<li data-type="taskItem" data-checked="true">')
          .replace(/<li>\s*<input[^>]*type="checkbox"[^>]*>\s*/g, '<li data-type="taskItem" data-checked="false">');

        const editor = view.state;
        if (editor) {
          // @ts-ignore - view에서 editor 접근
          const tiptapEditor = (view as any).editor || (view as any)._tiptapEditor;
          if (tiptapEditor?.commands) {
            tiptapEditor.commands.insertContent(taskHtml);
            return true;
          }
        }
        return false;
      },
    },
  });

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('URL을 입력하세요');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const imageFileRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);

  // 툴바 색상 팔레트 popover (text/highlight 둘 다)
  const [toolbarPalette, setToolbarPalette] = useState<'text' | 'highlight' | null>(null);
  // BubbleMenu 색상 팔레트 popover
  const [bubblePalette, setBubblePalette] = useState<'text' | 'highlight' | null>(null);

  // 최근 사용한 색상 (단축키 재사용용)
  const [lastTextColor, setLastTextColor] = useState<string>('#37352F');
  const [lastHighlight, setLastHighlight] = useState<string>('#FDECC8');

  // 현재 선택 영역의 색상 (A/H 버튼 미리보기) — 선택 해제 시 null → 기본값
  const [selColors, setSelColors] = useState<{ text: string | null; highlight: string | null }>({
    text: null,
    highlight: null,
  });

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { empty } = editor.state.selection;
      if (empty) {
        setSelColors({ text: null, highlight: null });
        return;
      }
      const textColor = (editor.getAttributes('textStyle')?.color as string) || null;
      const highlight = (editor.getAttributes('highlight')?.color as string) || null;
      setSelColors({ text: textColor, highlight });
    };
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  // Cmd/Ctrl + Shift + H: 최근 형광 색 토글
  // Cmd/Ctrl + Shift + E: 최근 글자색 적용 (E for "Emphasis")
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!editor || !editor.isFocused) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || !e.shiftKey) return;
      if (e.code === 'KeyH') {
        e.preventDefault();
        editor.chain().focus().toggleHighlight({ color: lastHighlight }).run();
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        if (editor.isActive('textStyle', { color: lastTextColor })) {
          editor.chain().focus().unsetColor().run();
        } else {
          editor.chain().focus().setColor(lastTextColor).run();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editor, lastHighlight, lastTextColor]);

  const addImage = useCallback(() => {
    imageFileRef.current?.click();
  }, []);

  const handleImageFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setImageUploading(true);
    try {
      const url = await uploadImage(file, 'notes');
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      alert(err instanceof Error ? err.message : '이미지 업로드 실패');
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  }, [editor]);

  // 외부 노출 커맨드 — Claude 대화 / 질문 답변 블록 삽입
  useImperativeHandle(ref, () => ({
    insertClaudeBlock: () => {
      editor?.chain().focus().insertContent([
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'image', attrs: { src: '/images/heart-sol.svg', alt: '' } },
                { type: 'text', marks: [{ type: 'bold' }], text: userName },
              ],
            },
            { type: 'paragraph' },
          ],
        },
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'image', attrs: { src: '/images/claude.png', alt: '' } },
                { type: 'text', marks: [{ type: 'bold' }], text: 'Claude' },
              ],
            },
            { type: 'paragraph' },
          ],
        },
        { type: 'paragraph' },
      ]).run();
    },
    insertQABlock: () => {
      editor?.chain().focus().insertContent([
        {
          type: 'blockquote',
          content: [
            { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: '질문' }] },
            { type: 'paragraph' },
          ],
        },
        {
          type: 'blockquote',
          content: [
            { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: '답변' }] },
            { type: 'paragraph' },
          ],
        },
        { type: 'paragraph' },
      ]).run();
    },
  }), [editor, userName]);

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      {/* 툴바 */}
      <div className="tiptap-toolbar">
        {/* 텍스트 스타일 */}
        <button onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''} data-tip="볼드 ⌘B">
          <strong>B</strong>
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''} data-tip="이탤릭 ⌘I">
          <em>I</em>
        </button>
        <button onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'is-active' : ''} data-tip="취소선">
          <s>S</s>
        </button>

        <div className="divider" />

        {/* 제목 */}
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''} data-tip="제목 1">
          H1
        </button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''} data-tip="제목 2">
          H2
        </button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''} data-tip="제목 3">
          H3
        </button>

        <div className="divider" />

        {/* 글자색 (팔레트 popover) — 마지막 색 미리보기 */}
        <div className="relative inline-flex">
          <button
            onClick={() => setToolbarPalette(toolbarPalette === 'text' ? null : 'text')}
            data-tip="글자색 ⌘⇧E"
            style={{ color: selColors.text || '#1a1a1a' }}
          >
            <span className="text-xs font-bold">A</span>
          </button>
          {toolbarPalette === 'text' && (
            <ColorPalette
              kind="text"
              onPick={(c) => { setLastTextColor(c); editor.chain().focus().setColor(c).run(); }}
              onReset={() => editor.chain().focus().unsetColor().run()}
              onClose={() => setToolbarPalette(null)}
              anchorClass="top-full left-0 mt-1"
            />
          )}
        </div>

        {/* 형광펜 (팔레트 popover) — 마지막 색 미리보기 */}
        <div className="relative inline-flex">
          <button
            onClick={() => setToolbarPalette(toolbarPalette === 'highlight' ? null : 'highlight')}
            data-tip="형광 ⌘⇧H"
          >
            <span
              className="px-1 text-xs"
              style={selColors.highlight ? { background: selColors.highlight, color: '#1a1a1a' } : undefined}
            >H</span>
          </button>
          {toolbarPalette === 'highlight' && (
            <ColorPalette
              kind="highlight"
              onPick={(c) => { setLastHighlight(c); editor.chain().focus().toggleHighlight({ color: c }).run(); }}
              onReset={() => editor.chain().focus().unsetHighlight().run()}
              onClose={() => setToolbarPalette(null)}
              anchorClass="top-full left-0 mt-1"
            />
          )}
        </div>

        <div className="divider" />

        {/* 블록 요소 */}
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'is-active' : ''} data-tip="인용문">
          <span className="text-xs">"</span>
        </button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'is-active' : ''} data-tip="목록">
          <span className="text-xs">•</span>
        </button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'is-active' : ''} data-tip="번호 목록">
          <span className="text-xs">1.</span>
        </button>
        <button onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={editor.isActive('taskList') ? 'is-active' : ''} data-tip="체크리스트">
          <span className="text-xs">☑</span>
        </button>

        <div className="divider" />

        {/* 삽입 */}
        <button onClick={addLink} className={editor.isActive('link') ? 'is-active' : ''} data-tip="링크">
          <span className="text-xs">🔗</span>
        </button>
        <button onClick={addImage} disabled={imageUploading} data-tip="이미지 업로드">
          {imageUploading
            ? <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
            : <span className="text-xs">🖼</span>}
        </button>
        <input ref={imageFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleImageFile} />
        <button onClick={() => editor.chain().focus().setHorizontalRule().run()} data-tip="구분선">
          <span className="text-xs">—</span>
        </button>

        <div className="divider" />

        {/* 실행취소 */}
        <button onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()} data-tip="실행취소 ⌘Z">
          <span className="text-xs">↩</span>
        </button>
        <button onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()} data-tip="다시실행 ⌘⇧Z">
          <span className="text-xs">↪</span>
        </button>
      </div>

      {/* 드래그 선택 시 표시되는 인라인 팝업 (볼드/이탤릭/취소선/하이라이트/색) */}
      <BubbleMenu
        editor={editor}
        options={{ placement: 'top' }}
        className="tiptap-bubble-menu"
      >
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
          aria-label="볼드"
          data-tip="볼드 ⌘B"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
          aria-label="이탤릭"
          data-tip="이탤릭 ⌘I"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'is-active' : ''}
          aria-label="취소선"
          data-tip="취소선"
        >
          <s>S</s>
        </button>
        <span className="bubble-divider" />

        {/* 글자색 (팔레트 popover) — 마지막 색 미리보기 */}
        <div className="relative inline-flex">
          <button
            type="button"
            onClick={() => setBubblePalette(bubblePalette === 'text' ? null : 'text')}
            className="bubble-color-btn"
            aria-label="글자색"
            data-tip="글자색 ⌘⇧E"
            style={{ color: selColors.text || '#1a1a1a' }}
          >
            A
          </button>
          {bubblePalette === 'text' && (
            <ColorPalette
              kind="text"
              onPick={(c) => { setLastTextColor(c); editor.chain().focus().setColor(c).run(); }}
              onReset={() => editor.chain().focus().unsetColor().run()}
              onClose={() => setBubblePalette(null)}
              anchorClass="top-full left-1/2 -translate-x-1/2 mt-2"
            />
          )}
        </div>

        {/* 형광 (팔레트 popover) — 마지막 색 미리보기 */}
        <div className="relative inline-flex">
          <button
            type="button"
            onClick={() => setBubblePalette(bubblePalette === 'highlight' ? null : 'highlight')}
            aria-label="형광"
            data-tip="형광 ⌘⇧H"
          >
            <span className="bubble-highlight-icon" style={selColors.highlight ? { background: selColors.highlight, color: '#1a1a1a' } : undefined}>H</span>
          </button>
          {bubblePalette === 'highlight' && (
            <ColorPalette
              kind="highlight"
              onPick={(c) => { setLastHighlight(c); editor.chain().focus().toggleHighlight({ color: c }).run(); }}
              onReset={() => editor.chain().focus().unsetHighlight().run()}
              onClose={() => setBubblePalette(null)}
              anchorClass="top-full left-1/2 -translate-x-1/2 mt-2"
            />
          )}
        </div>
      </BubbleMenu>

      {/* 에디터 본문 */}
      <EditorContent editor={editor} />
    </div>
  );
});

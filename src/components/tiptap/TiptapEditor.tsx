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
import { YoutubeNode, toYoutubeEmbed } from './youtube';
import { RawHtml } from './rawHtml';
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
  // 구조적(강한) 신호 — 하나만 있어도 마크다운으로 본다 (예: "## 제목" 한 줄)
  const strong = [
    /^#{1,6}\s/m,             // 제목 h1~h6
    /^\s*[-*+]\s+\S/m,        // 불릿 리스트
    /^\s*\d+\.\s+\S/m,        // 번호 리스트
    /^\s*[-*]\s\[[ xX]\]/m,   // 체크박스
    /^\s*>\s/m,               // 인용문
    /^```/m,                  // 코드블록
    /^(-{3,}|\*{3,}|_{3,})$/m,// 구분선
    /\|.*\|/m,                // 테이블 행(파이프)
  ];
  if (strong.some((p) => p.test(text))) return true;
  // 약한(인라인) 신호 — 볼드/인라인코드/링크는 2개 이상일 때만
  const weak = [/\*\*.+?\*\*/, /`[^`]+`/, /\[.+?\]\(.+?\)/];
  return weak.filter((p) => p.test(text)).length >= 2;
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
  // handlePaste 클로저에서 editor 인스턴스에 안전하게 접근하기 위한 ref
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
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
      YoutubeNode,
      RawHtml,
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
      handlePaste(_view, event) {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        // 진짜 서식 있는 HTML(노션 등)만 기본 처리로 넘긴다.
        // 일부 앱은 마크다운 텍스트를 <p>/<span>로만 감싼 무의미한 HTML을 함께 넣는데,
        // 그건 무시하고 아래 마크다운 변환을 태운다.
        const html = clipboardData.getData('text/html');
        const htmlHasFormatting = !!html && /<(h[1-6]|ul|ol|li|table|pre|blockquote|strong|b|em|i|code|img)\b/i.test(html);
        if (htmlHasFormatting) return false;

        // plain text에서 마크다운 감지
        const text = clipboardData.getData('text/plain');
        if (!text || !looksLikeMarkdown(text)) return false;

        const ed = editorRef.current;
        if (!ed?.commands) return false;

        // 마크다운 → HTML 변환
        event.preventDefault();
        const converted = marked.parse(text, { breaks: true, gfm: true });
        // task list 변환: <li><input checked> → Tiptap taskList 호환
        const taskHtml = (typeof converted === 'string' ? converted : '')
          .replace(/<li>\s*<input[^>]*checked[^>]*>\s*/g, '<li data-type="taskItem" data-checked="true">')
          .replace(/<li>\s*<input[^>]*type="checkbox"[^>]*>\s*/g, '<li data-type="taskItem" data-checked="false">');

        ed.chain().focus().insertContent(taskHtml).run();
        return true;
      },
    },
  });

  // URL 입력 팝오버 (링크/유튜브 공용) — 버튼 아래 말풍선으로 입력
  const [urlMode, setUrlMode] = useState<null | 'link' | 'youtube'>(null);
  const [urlVal, setUrlVal] = useState('');

  const addLink = useCallback(() => {
    if (!editor) return;
    setUrlVal(editor.getAttributes('link').href || '');  // 기존 링크면 프리필
    setUrlMode('link');
  }, [editor]);

  const applyUrl = useCallback(() => {
    if (!editor) return;
    const v = urlVal.trim();
    if (urlMode === 'link') {
      // 드래그한 선택영역(또는 커서가 놓인 링크 범위)에 정확히 적용
      const chain = editor.chain().focus().extendMarkRange('link');
      if (v) chain.setLink({ href: v }).run(); else chain.unsetLink().run();
    } else if (urlMode === 'youtube') {
      const embed = toYoutubeEmbed(v);
      if (!embed) { alert('유튜브 링크를 인식하지 못했어요. (예: youtube.com/watch?v=… 또는 youtu.be/…)'); return; }
      editor.chain().focus().insertContent({ type: 'youtube', attrs: { src: embed } }).run();
    }
    setUrlMode(null); setUrlVal('');
  }, [editor, urlMode, urlVal]);

  // 버튼 바로 아래 작은 팝오버 (함수 호출로 렌더 — 컴포넌트로 두면 입력 시 리마운트로 포커스 유실)
  const urlPopover = () => (
    <div className="absolute top-full left-0 mt-1.5 z-[100] w-80 max-w-[86vw] bg-white rounded-xl border border-gray-200 shadow-lg p-2 flex flex-nowrap items-center gap-1.5"
      onMouseDown={e => e.stopPropagation()}>
      <input autoFocus value={urlVal} onChange={e => setUrlVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(); } if (e.key === 'Escape') { setUrlMode(null); setUrlVal(''); } }}
        placeholder={urlMode === 'link' ? 'https://…' : '유튜브 링크'}
        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:border-foreground" />
      <button onMouseDown={e => e.preventDefault()} onClick={applyUrl} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 flex-shrink-0 whitespace-nowrap">적용</button>
    </div>
  );

  // handlePaste에서 쓸 수 있도록 editor 인스턴스를 ref에 동기화
  useEffect(() => { editorRef.current = editor; }, [editor]);

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

  const addYoutube = useCallback(() => {
    if (!editor) return;
    setUrlVal(''); setUrlMode('youtube');
  }, [editor]);

  // HTML 코드 삽입 팝오버 (툴바 아래 열리는 textarea) — 이식 킷 06
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [htmlSrc, setHtmlSrc] = useState('');
  const insertHtml = useCallback(() => {
    if (!editor) return;
    const src = htmlSrc.trim();
    if (!src) return;
    editor.chain().focus().insertContent({ type: 'rawHtml', attrs: { html: src } }).run();
    setHtmlSrc(''); setHtmlOpen(false);
  }, [editor, htmlSrc]);

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
        <span className="relative inline-flex">
          <button onClick={addLink} className={editor.isActive('link') ? 'is-active' : ''} data-tip="링크">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></svg>
          </button>
          {urlMode === 'link' && urlPopover()}
        </span>
        <button onClick={addImage} disabled={imageUploading} data-tip="이미지 업로드">
          {imageUploading
            ? <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-4.5-4.5L4 21" /></svg>}
        </button>
        <input ref={imageFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleImageFile} />
        <span className="relative inline-flex">
          <button onClick={addYoutube} data-tip="유튜브 영상 삽입">
            <svg width="18" height="14" viewBox="0 0 24 18" aria-hidden><rect x="0" y="0" width="24" height="18" rx="4" fill="#FF0000" /><path d="M9.6 12.3 15.6 9 9.6 5.7v6.6Z" fill="#fff" /></svg>
          </button>
          {urlMode === 'youtube' && urlPopover()}
        </span>
        <button onClick={() => editor.chain().focus().setHorizontalRule().run()} data-tip="구분선">
          <span className="text-xs">—</span>
        </button>
        <button onClick={() => setHtmlOpen(v => !v)} className={htmlOpen ? 'is-active' : ''} data-tip="HTML 코드 삽입">
          <span className="text-[11px] font-bold tracking-tight">&lt;/&gt;</span>
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

      {/* HTML 코드 삽입 패널 — 붙인 그대로 sandbox iframe으로 렌더 (이식 킷 06) */}
      {htmlOpen && (
        <div className="border-t border-gray-200 bg-white px-2.5 py-2.5 space-y-2">
          <textarea
            autoFocus
            value={htmlSrc}
            onChange={e => setHtmlSrc(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') { setHtmlOpen(false); }
              else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); insertHtml(); }
            }}
            rows={5}
            placeholder={'<table>…</table> 같은 HTML 코드를 붙여넣으세요. 붙인 그대로 렌더링됩니다.'}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-mono leading-relaxed focus:outline-none focus:border-foreground resize-y"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-400">⌘/Ctrl+Enter 로 삽입</p>
            <div className="flex items-center gap-2">
              <button onClick={() => { setHtmlOpen(false); setHtmlSrc(''); }} className="px-2.5 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100">취소</button>
              <button onClick={insertHtml} disabled={!htmlSrc.trim()} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 disabled:opacity-40">삽입</button>
            </div>
          </div>
        </div>
      )}

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

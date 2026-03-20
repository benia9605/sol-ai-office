/**
 * @file src/components/tiptap/TiptapEditor.tsx
 * @description Tiptap 리치텍스트 에디터 (편집 모드)
 * - 툴바: 볼드/이탤릭/취소선, H1/H2/H3, 하이라이트, 인용문, 리스트, 체크리스트, 링크, 이미지, 테이블
 * - 마크다운 붙여넣기 자동 변환
 * - JSON 포맷으로 콘텐츠 저장
 */
import { useEditor, EditorContent } from '@tiptap/react';
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
import { useCallback, useRef, useState } from 'react';
import { uploadImage } from '../../services/storage.service';
import { marked } from 'marked';
import './tiptap.css';

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
}

export function TiptapEditor({ content, onChange, placeholder = '스터디 노트를 작성하세요...' }: TiptapEditorProps) {
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
      Image,
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

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* 툴바 */}
      <div className="tiptap-toolbar">
        {/* 텍스트 스타일 */}
        <button onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''} title="볼드">
          <strong>B</strong>
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''} title="이탤릭">
          <em>I</em>
        </button>
        <button onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'is-active' : ''} title="취소선">
          <s>S</s>
        </button>

        <div className="divider" />

        {/* 제목 */}
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''} title="제목 1">
          H1
        </button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''} title="제목 2">
          H2
        </button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''} title="제목 3">
          H3
        </button>

        <div className="divider" />

        {/* 하이라이트 */}
        <button onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={editor.isActive('highlight') ? 'is-active' : ''} title="하이라이트">
          <span className="bg-yellow-200 px-1 rounded text-xs">H</span>
        </button>

        <div className="divider" />

        {/* 블록 요소 */}
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'is-active' : ''} title="인용문">
          <span className="text-xs">"</span>
        </button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'is-active' : ''} title="목록">
          <span className="text-xs">•</span>
        </button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'is-active' : ''} title="번호 목록">
          <span className="text-xs">1.</span>
        </button>
        <button onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={editor.isActive('taskList') ? 'is-active' : ''} title="체크리스트">
          <span className="text-xs">☑</span>
        </button>

        <div className="divider" />

        {/* 삽입 */}
        <button onClick={addLink} className={editor.isActive('link') ? 'is-active' : ''} title="링크">
          <span className="text-xs">🔗</span>
        </button>
        <button onClick={addImage} disabled={imageUploading} title="이미지 업로드">
          {imageUploading
            ? <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
            : <span className="text-xs">🖼</span>}
        </button>
        <input ref={imageFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleImageFile} />
        <button onClick={() => editor.chain().focus().setHorizontalRule().run()} title="구분선">
          <span className="text-xs">—</span>
        </button>

        <div className="divider" />

        {/* 실행취소 */}
        <button onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()} title="실행취소">
          <span className="text-xs">↩</span>
        </button>
        <button onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()} title="다시실행">
          <span className="text-xs">↪</span>
        </button>
      </div>

      {/* 에디터 본문 */}
      <EditorContent editor={editor} />
    </div>
  );
}

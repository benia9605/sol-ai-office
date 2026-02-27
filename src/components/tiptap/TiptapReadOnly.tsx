/**
 * @file src/components/tiptap/TiptapReadOnly.tsx
 * @description Tiptap 읽기전용 렌더러
 * - 저장된 JSON 콘텐츠를 블로그 스타일로 렌더링
 * - 스터디 노트 타임라인에서 사용
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
import './tiptap.css';

interface TiptapReadOnlyProps {
  content: Record<string, unknown>;
}

export function TiptapReadOnly({ content }: TiptapReadOnlyProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: true }),
      Image,
    ],
    content,
    editable: false,
  });

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}

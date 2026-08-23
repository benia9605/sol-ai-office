/**
 * @file src/components/tiptap/TiptapReadOnly.tsx
 * @description Tiptap 읽기전용 렌더러
 * - 저장된 JSON 콘텐츠를 블로그 스타일로 렌더링
 * - 스터디 노트 타임라인에서 사용
 * - 테이블, H1 지원
 */
import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { YoutubeNode } from './youtube';
import { RawHtml } from './rawHtml';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import './tiptap.css';

interface TiptapReadOnlyProps {
  content: Record<string, unknown>;
}

export function TiptapReadOnly({ content }: TiptapReadOnlyProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: true }),
      Image.configure({ inline: true, allowBase64: true }),
      YoutubeNode,
      RawHtml,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editable: false,
  });

  // useEditor는 content prop 변경 시 자동 갱신을 안 함 — 재사용 인스턴스가 옛 내용을
  // 계속 보여주는 버그(저장 후 이미지·HTML 안 보임) 방지. 내용이 바뀌면 다시 주입.
  useEffect(() => {
    if (!editor) return;
    const next = JSON.stringify(content ?? {});
    const cur = JSON.stringify(editor.getJSON());
    if (next !== cur) editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}

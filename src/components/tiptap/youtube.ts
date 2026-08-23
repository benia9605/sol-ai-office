/**
 * @file src/components/tiptap/youtube.ts
 * @description Tiptap 유튜브 임베드 노드 (확장 패키지 없이 최소 구현)
 * - 본문 어디든 커서 위치에 16:9 iframe 삽입. 에디터/읽기전용 양쪽에서 렌더.
 */
import { Node } from '@tiptap/core';

/** 유튜브 URL(watch?v=, youtu.be/, shorts/, embed/)에서 embed URL 추출. 실패 시 null. */
export function toYoutubeEmbed(input: string): string | null {
  const url = input.trim();
  if (!url) return null;
  const m =
    url.match(/[?&]v=([\w-]{11})/) ||
    url.match(/youtu\.be\/([\w-]{11})/) ||
    url.match(/youtube\.com\/shorts\/([\w-]{11})/) ||
    url.match(/youtube\.com\/embed\/([\w-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  return null;
}

export const YoutubeNode = Node.create({
  name: 'youtube',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null as string | null } };
  },
  parseHTML() {
    return [
      { tag: 'div[data-youtube] iframe', getAttrs: (el) => ({ src: (el as HTMLElement).getAttribute('src') }) },
      { tag: 'iframe[src*="youtube.com/embed"]', getAttrs: (el) => ({ src: (el as HTMLElement).getAttribute('src') }) },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      { 'data-youtube': '', class: 'tiptap-youtube' },
      ['iframe', {
        src: HTMLAttributes.src,
        frameborder: '0',
        allowfullscreen: 'true',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      }],
    ];
  },
});

/**
 * @file src/components/office/MarkdownView.tsx
 * @description AI 리포트·산출물 마크다운 뷰어
 * - 개인공간 채팅방(MessageBubble)과 동일한 전역 CSS 클래스 `.markdown-body` 사용 → 통일된 가독성.
 * - 링크만 새 탭으로 커스텀, 나머지(h1~3·표·리스트·여백)는 .markdown-body가 처리.
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownView({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`text-sm text-gray-700 markdown-body ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">{children}</a>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

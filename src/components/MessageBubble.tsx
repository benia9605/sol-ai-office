/**
 * @file src/components/MessageBubble.tsx
 * @description 채팅 메시지 버블 컴포넌트
 * - AI 메시지(좌측, 아바타 포함) / 유저 메시지(우측) 표시
 * - AI 메시지 hover 시 ⋯ 버튼 표시
 * - ⋯ 클릭 시 저장 드롭다운 메뉴 (일정/할일/인사이트/일기/복사/중요표시)
 * - 외부 클릭 시 메뉴 자동 닫힘
 */
import { useState, useRef, useEffect, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, Room, SaveType } from '../types';
import { ExtractedAction } from '../utils/actionExtractor';

/** 코드 블록 래퍼 — hover 시 우하단에 복사 아이콘 표시 */
function CodeBlockWrapper({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = extractText(children);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code">
      <pre>{children}</pre>
      <button
        onClick={handleCopy}
        className="absolute bottom-2 right-2 p-1.5 rounded-lg
          bg-gray-200/80 hover:bg-gray-300 text-gray-500 hover:text-gray-700
          opacity-0 group-hover/code:opacity-100 transition-all"
        title="복사"
      >
        {copied ? (
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}

/** ReactNode에서 텍스트만 재귀적으로 추출 */
function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return extractText((node as any).props.children);
  }
  return '';
}

/** 방별 아이콘 컬러 (각 방 파스텔 톤의 진한 버전) */
const roomIconColor: Record<string, string> = {
  strategy: '#9333ea',   // purple
  marketing: '#ec4899',  // pink
  dev: '#65a30d',        // lime
  research: '#b07a4b',   // brown
  meeting: '#ca8a04',    // yellow
  secretary: '#ca8a04',  // yellow
};

/** AI 이름별 accent color (회의실에서 발언자 구분용) */
const aiNameColor: Record<string, string> = {
  '플래니': '#9333ea',
  '마키': '#ec4899',
  '데비': '#65a30d',
  '서치': '#b07a4b',
  '모디': '#ca8a04',
};

/** 시간 포맷 (오전/오후 h:mm) */
function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  const period = h < 12 ? '오전' : '오후';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${hour12}:${m}`;
}

/** 날짜 포맷 (M/D 요일) */
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
export function formatDateSeparator(date: Date): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const day = DAY_NAMES[date.getDay()];
  return `${m}/${d} (${day}요일)`;
}

/** 같은 날짜인지 비교 */
export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

interface MessageBubbleProps {
  message: ChatMessage;
  room: Room;
  onSave?: (type: SaveType, message: ChatMessage) => void;
  onStar?: (message: ChatMessage) => void;
  onSaveAction?: (action: ExtractedAction, message: ChatMessage) => void;
  onBulkSaveActions?: (actions: ExtractedAction[], message: ChatMessage) => void;
}

const saveMenuItems: { type: SaveType; image: string; label: string }[] = [
  { type: 'task', image: '/images/todo.png', label: '할일 추가' },
  { type: 'insight', image: '/images/insight.png', label: '인사이트 저장' },
];

export function MessageBubble({ message, room, onSave, onStar, onSaveAction, onBulkSaveActions }: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const isAi = message.sender === 'ai';

  // 회의실에서는 message.aiName/aiImage 우선, 아니면 room 기본값
  const displayName = message.aiName || room.aiName;
  const displayImage = message.aiImage || room.image;
  const nameColor = message.aiName ? (aiNameColor[message.aiName] || '#a855f7') : (roomIconColor[room.id] || '#a855f7');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setMenuOpen(false);
  };

  const handleStar = () => {
    onStar?.(message);
    setMenuOpen(false);
  };

  const handleSave = (type: SaveType) => {
    onSave?.(type, message);
    setMenuOpen(false);
  };

  return (
    <div className={`group flex ${isAi ? 'justify-start' : 'justify-end'}`}>
      {/* AI 아바타 */}
      {isAi && (
        <img
          src={displayImage}
          alt={displayName}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover mr-2 mt-1 flex-shrink-0"
        />
      )}

      {/* 메시지 영역 */}
      <div className="relative max-w-[85%] sm:max-w-[80%]">
        {/* ⋯ 버튼 (AI 메시지 hover 시) */}
        {isAi && (
          <div ref={menuRef} className="absolute -right-2 -top-2 z-10">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-7 h-7 rounded-full bg-white shadow-md border border-gray-100
                flex items-center justify-center text-gray-400 hover:text-gray-600
                hover:shadow-lg transition-all text-xs
                opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              ⋯
            </button>

            {/* 드롭다운 메뉴 */}
            {menuOpen && (
              <div
                className="absolute right-0 top-8 w-44 bg-white rounded-2xl shadow-hover
                  border border-gray-100 py-2 z-20 animate-in fade-in slide-in-from-top-1"
              >
                {saveMenuItems.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => handleSave(item.type)}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700
                      hover:bg-primary-50 transition-colors flex items-center gap-2.5"
                  >
                    <img src={item.image} alt={item.label} className="w-4 h-4 object-contain" />
                    <span>{item.label}</span>
                  </button>
                ))}

                <div className="border-t border-gray-100 my-1" />

                <button
                  onClick={handleCopy}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700
                    hover:bg-primary-50 transition-colors flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4" style={{ color: roomIconColor[room.id] || '#a855f7' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  <span>복사</span>
                </button>
                <button
                  onClick={handleStar}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700
                    hover:bg-primary-50 transition-colors flex items-center gap-2.5"
                >
                  {message.isStarred ? (
                    <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ) : (
                    <svg className="w-4 h-4" style={{ color: roomIconColor[room.id] || '#a855f7' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  )}
                  <span>{message.isStarred ? '즐겨찾기 해제' : '즐겨찾기'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 메시지 본문 */}
        <div
          className={`relative px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl ${
            isAi
              ? 'bg-white shadow-soft rounded-bl-md'
              : 'bg-primary-500 text-white rounded-br-md whitespace-pre-wrap'
          }`}
        >
          {/* 즐겨찾기 별 */}
          {message.isStarred && (
            <svg className="absolute -bottom-2.5 -left-2.5 w-5 h-5 text-amber-400 drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          )}
          {isAi && (
            <p className="text-xs font-medium mb-1" style={{ color: nameColor }}>
              {displayName}
            </p>
          )}
          {isAi ? (
            <div className="text-sm text-gray-700 markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                      {children}
                    </a>
                  ),
                  pre: ({ children }) => <CodeBlockWrapper>{children}</CodeBlockWrapper>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-white">
              {message.content}
            </p>
          )}
        </div>

        {/* 액션 아이템 칩 */}
        {isAi && message.extractedActions && message.extractedActions.length > 0 && (
          <div className="mt-1.5 space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {message.extractedActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => onSaveAction?.(action, message)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                    bg-green-50 text-green-600 text-[11px] font-medium
                    hover:bg-green-100 transition-colors border border-green-100"
                >
                  <img src="/images/todo.png" alt="" className="w-3 h-3 object-contain" />
                  {action.title}
                </button>
              ))}
            </div>
            {message.extractedActions.length > 1 && (
              <button
                onClick={() => onBulkSaveActions?.(message.extractedActions!, message)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                  bg-green-500 text-white text-[11px] font-semibold
                  hover:bg-green-600 transition-colors shadow-sm"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                전체 추가 ({message.extractedActions.length}개)
              </button>
            )}
          </div>
        )}

        {/* 시간 표시 */}
        <p className={`text-[10px] mt-1 ${isAi ? 'text-gray-300' : 'text-gray-300 text-right'}`}>
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { Node as TiptapNode, mergeAttributes } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Blockquote from "@tiptap/extension-blockquote";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Youtube from "@tiptap/extension-youtube";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { marked } from "marked";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { uploadVisionImage } from "@/lib/data/vision-uploads";

// 노션 톤 10색 팔레트 — 글자색
const TEXT_COLORS: { label: string; value: string }[] = [
  { label: "기본", value: "#1a1a1a" },
  { label: "회색", value: "#787774" },
  { label: "갈색", value: "#976D57" },
  { label: "주황", value: "#CC782F" },
  { label: "노랑", value: "#C29343" },
  { label: "초록", value: "#0f5258" },
  { label: "파랑", value: "#477DA5" },
  { label: "보라", value: "#A48BBE" },
  { label: "핑크", value: "#B35488" },
  { label: "빨강", value: "#C4554D" },
];

// 노션 톤 10색 팔레트 — 형광 배경
const HIGHLIGHT_COLORS: { label: string; value: string }[] = [
  { label: "기본", value: "#F1F1EF" },
  { label: "회색", value: "#E3E2E0" },
  { label: "갈색", value: "#EEE0DA" },
  { label: "주황", value: "#FADEC9" },
  { label: "노랑", value: "#FDECC8" },
  { label: "초록", value: "#DBEDDB" },
  { label: "파랑", value: "#D3E5EF" },
  { label: "보라", value: "#E8DEEE" },
  { label: "핑크", value: "#F5E0E9" },
  { label: "빨강", value: "#FFE2DD" },
];

const DEFAULT_TEXT_COLOR = TEXT_COLORS[5].value;    // 초록 (accent-teal)
const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[4].value;  // 노랑

/** YouTube URL 인식 — 일반/짧은/임베드 모두. */
const YT_RE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i;
function youtubeIdFromUrl(url: string): string | null {
  const m = url.trim().match(YT_RE);
  return m ? m[1] : null;
}

marked.setOptions({ gfm: true, breaks: false });

/**
 * 인용블록 확장 — `data-speaker` 속성으로 말풍선 역할을 구분한다.
 *   me      → 오른쪽 말풍선 (나)
 *   claude  → 왼쪽 말풍선 (Claude)
 *   q / a   → 질문 / 답변 회색 박스
 * 일반 인용("버튼)은 speaker 가 없어 기존 좌측 라인 스타일 그대로 유지.
 * 실제 좌/우 배치·꼬리는 prose-meetup CSS(blockquote[data-speaker])가 그린다.
 */
const SpeakerBlockquote = Blockquote.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      speaker: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-speaker"),
        renderHTML: (attrs) =>
          attrs.speaker ? { "data-speaker": attrs.speaker } : {},
      },
    };
  },
});

/**
 * 원본 HTML 블록 — 사용자가 붙여넣은 HTML 코드를 그대로 보관하고
 * 에디터·뷰어 양쪽에서 렌더한다. atom 노드라 한 덩어리로 다뤄지고
 * backspace 로 삭제 가능. 저장 시 `<div data-raw-html>…raw…</div>` 로
 * 직렬화되어 RichRender 의 dangerouslySetInnerHTML 로 그대로 그려진다.
 *
 * 주의: 신뢰된 내부(6인 비공개 모임) 전용. 외부 공개 입력엔 새니타이즈 필요.
 */
/**
 * iframe 내부에서 자기 높이를 부모로 postMessage 하는 리포터 스크립트.
 * 모바일 사파리는 부모가 sandbox iframe 의 contentDocument 를 못 읽어
 * 높이가 0 으로 깔리는데(→ 안 보임), 내부에서 알려주면 해결된다.
 */
const RAW_HTML_REPORTER =
  `<script>(function(){` +
  `function s(){var h=Math.max(` +
  `document.documentElement?document.documentElement.scrollHeight:0,` +
  `document.body?document.body.scrollHeight:0,` +
  `document.body?document.body.offsetHeight:0);` +
  // 0 은 보내지 않음 — 모바일에서 높이 0 으로 접히는 것 방지(항상 키우기만)
  `if(h>0)parent.postMessage({__rawHtmlHeight:h},'*');}` +
  // 레이아웃 끝난 다음 측정(double rAF)
  `function soon(){requestAnimationFrame(function(){requestAnimationFrame(s);});}` +
  `window.addEventListener('load',soon);` +
  `document.addEventListener('DOMContentLoaded',soon);` +
  `if(window.ResizeObserver){try{new ResizeObserver(s).observe(document.documentElement);}catch(e){}}` +
  `if(document.fonts&&document.fonts.ready){document.fonts.ready.then(s);}` +
  // 폰트/이미지 늦게 떠도 보정 (0.5s 간격 15회)
  `var n=0,t=setInterval(function(){s();if(++n>15)clearInterval(t);},500);soon();` +
  `})();<\/script>`;

/**
 * raw HTML 을 완전한 문서로 감싸고 + 높이 리포터 주입.
 * 사용자 스크립트는 살린다 — sandbox="allow-scripts"(고유 origin)라 앱/세션엔
 * 접근 못 하지만, 도장 클릭 같은 자체 인터랙션은 정상 작동한다.
 * body/배경/폰트 선택자가 정상 동작하도록 완전한 문서로 만든다.
 */
function wrapRawHtmlDoc(html: string): string {
  if (/<html[\s>]|<body[\s>]/i.test(html)) {
    // 이미 전체 문서 — </body> 직전(없으면 끝)에 리포터 삽입
    if (/<\/body>/i.test(html)) {
      return html.replace(/<\/body>/i, `${RAW_HTML_REPORTER}</body>`);
    }
    return html + RAW_HTML_REPORTER;
  }
  // 조각 HTML — 앱과 동일한 시스템 폰트 기본값으로 감싼다.
  const baseFont =
    '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR","Segoe UI",sans-serif';
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>html,body{margin:0;padding:0}` +
    `body{font-family:${baseFont};-webkit-font-smoothing:antialiased}` +
    `img{max-width:100%;height:auto}</style>` +
    `</head><body>${html}${RAW_HTML_REPORTER}</body></html>`
  );
}

/**
 * 호스트 엘리먼트 안에 raw HTML 을 sandbox iframe 으로 격리 렌더.
 * - iframe 은 진짜 문서라 `body{...}`·배경·폰트가 그대로 적용됨.
 * - sandbox="allow-scripts allow-same-origin" — 사용자 스크립트 실행(도장 클릭
 *   같은 인터랙션 동작) + 부모가 contentDocument 로 높이를 직접 측정 가능.
 *   (신뢰된 내부 모임 전용. 외부 공개 입력이면 새니타이즈 필요.)
 * - 높이: ① 부모에서 contentDocument.scrollHeight 직접 측정(주력)
 *        ② 내부 리포터 postMessage(백업/모바일/인터랙션 후 변동) — 둘 중 큰 값.
 * @param interactive false 면 pointer-events 차단(에디터에서 블록 선택/삭제 쉽게).
 */
export function renderRawHtmlInto(
  host: HTMLElement,
  html: string,
  opts?: { interactive?: boolean },
) {
  host.textContent = "";
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  iframe.setAttribute("title", "HTML 미리보기");
  iframe.setAttribute("scrolling", "no");
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.style.height = "200px"; // 로딩 중에도 보이도록 초기 높이
  if (!opts?.interactive) iframe.style.pointerEvents = "none";

  const setH = (h: number) => {
    if (h > 0) iframe.style.height = `${h}px`;
  };
  // ① 부모에서 직접 측정 (same-origin 이라 가능 — 데스크탑/모바일 모두 신뢰성↑)
  const measure = () => {
    try {
      const d = iframe.contentDocument;
      if (!d) return;
      setH(
        Math.max(
          d.documentElement ? d.documentElement.scrollHeight : 0,
          d.body ? d.body.scrollHeight : 0,
        ),
      );
    } catch {
      /* 무시 */
    }
  };
  // ② 내부 리포터 메시지 (백업)
  const onMsg = (e: MessageEvent) => {
    if (!iframe.isConnected) {
      window.removeEventListener("message", onMsg);
      return;
    }
    if (e.source !== iframe.contentWindow) return;
    const h = (e.data as { __rawHtmlHeight?: number })?.__rawHtmlHeight;
    if (typeof h === "number") setH(h);
  };
  window.addEventListener("message", onMsg);

  iframe.addEventListener("load", () => {
    measure();
    try {
      const d = iframe.contentDocument;
      if (d && "ResizeObserver" in window) {
        const ro = new ResizeObserver(() => measure());
        ro.observe(d.documentElement);
        if (d.body) ro.observe(d.body);
      }
    } catch {
      /* 무시 */
    }
    // 폰트/이미지 늦게 떠도 보정
    [100, 400, 1000, 2500].forEach((t) => setTimeout(measure, t));
  });

  iframe.srcdoc = wrapRawHtmlDoc(html);
  host.appendChild(iframe);
}

const RawHtml = TiptapNode.create({
  name: "rawHtml",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      html: {
        default: "",
        // 저장본은 data-html 속성에 보관(직렬화 안전). 구버전(template/innerHTML) 폴백.
        parseHTML: (el) => {
          const e = el as HTMLElement;
          const attr = e.getAttribute("data-html");
          if (attr != null) return attr;
          const tpl = e.querySelector("template");
          return tpl ? tpl.innerHTML : e.innerHTML;
        },
        renderHTML: (attrs) => ({ "data-html": (attrs.html as string) || "" }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-raw-html]" }];
  },
  // 직렬화(getHTML) — 배열 스펙으로 안전하게. raw 는 data-html 속성에 escape 되어 보관.
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-raw-html": "" }, HTMLAttributes),
    ];
  },
  // 에디터 내 표시 — Shadow DOM 으로 격리.
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("div");
      dom.setAttribute("data-raw-html", "");
      dom.className = "raw-html-block border border-line";
      dom.contentEditable = "false";
      renderRawHtmlInto(dom, (node.attrs.html as string) || "", {
        interactive: false,
      });
      return { dom };
    };
  },
});

/** Heuristic — true if the string contains common markdown syntax. */
function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  return (
    /^#{1,6}\s+\S/m.test(text) ||              // # heading
    /^\s*[-*+]\s+\S/m.test(text) ||            // - / * / + list
    /^\s*\d+\.\s+\S/m.test(text) ||            // 1. ordered list
    /^>\s+\S/m.test(text) ||                   // > quote
    /```[\s\S]+?```/m.test(text) ||            // ``` code fence
    /`[^`\n]+`/.test(text) ||                  // inline code
    /\*\*[^*\n]+\*\*/.test(text) ||            // **bold**
    /(?:^|\s)_[^_\n]+_(?:\s|$)/.test(text) ||  // _italic_
    /\[[^\]]+\]\([^)]+\)/.test(text)           // [link](url)
  );
}

/** Convert markdown → HTML safely; falls back to original text on error. */
function markdownToHtml(text: string): string {
  try {
    const out = marked.parse(text, { async: false });
    return typeof out === "string" ? out : text;
  } catch {
    return text;
  }
}

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Minimum height of the editor canvas. */
  minHeight?: number;
  autoFocus?: boolean;
};

export function RichEditor({
  value,
  onChange,
  placeholder = "내용을 입력하세요...",
  minHeight = 240,
  autoFocus = false,
}: Props) {
  const editorRef = useRef<Editor | null>(null);
  const { user } = useAuth();

  // 마지막 사용 색 — 툴바 A/H 미리보기 + ⌘⇧E/⌘⇧H 단축키 재적용에 공유
  const [lastTextColor, setLastTextColor] = useState<string>(DEFAULT_TEXT_COLOR);
  const [lastHighlight, setLastHighlight] = useState<string>(DEFAULT_HIGHLIGHT_COLOR);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // StarterKit 가 자체 포함하는 link 를 끄고, 아래 커스텀 Link 설정만 사용
        // (중복 'link' extension 경고 제거).
        link: false,
        // 기본 blockquote 대신 data-speaker 를 지원하는 SpeakerBlockquote 사용.
        blockquote: false,
      }),
      SpeakerBlockquote,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-accent-teal underline underline-offset-2",
        },
      }),
      Youtube.configure({
        width: 640,
        height: 360,
        nocookie: true,
        HTMLAttributes: {
          class:
            "w-full aspect-video my-3 border border-line bg-surface-muted",
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: "max-w-full h-auto my-3 border border-line",
        },
      }),
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      RawHtml,
    ],
    content: renderInitial(value),
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Empty editor returns <p></p> — normalize to '' so the
      // database column stays clean.
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class: "prose-meetup focus:outline-none",
      },
      // 붙여넣기 핸들러:
      //   1) YouTube URL 단독이면 → 임베드 노드로 삽입
      //   2) 마크다운 텍스트면 → HTML 로 변환해 삽입
      //   3) HTML 이면 → Tiptap 기본 동작
      handlePaste(_view, event) {
        const cd = event.clipboardData;
        if (!cd) return false;
        const text = cd.getData("text/plain")?.trim() ?? "";
        const html = cd.getData("text/html");

        // 1) YouTube URL 만 단독으로 붙여넣은 경우 — 임베드 노드 삽입
        const ytId = text && !html ? youtubeIdFromUrl(text) : null;
        if (ytId) {
          const ed = editorRef.current;
          if (!ed) return false;
          event.preventDefault();
          ed.chain()
            .focus()
            .setYoutubeVideo({ src: `https://www.youtube.com/watch?v=${ytId}` })
            .run();
          return true;
        }

        if (html) return false;
        if (!text || !looksLikeMarkdown(text)) return false;
        const ed = editorRef.current;
        if (!ed) return false;
        event.preventDefault();
        ed.chain().focus().insertContent(markdownToHtml(text)).run();
        return true;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // When `value` changes from the outside (e.g. switching tasks), sync.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (current === next || (current === "<p></p>" && next === "")) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  // Ctrl/Cmd+B / I / U 가 브라우저 단축키 (Firefox 북마크 사이드바
  // 등) 로 가로채여 화면이 흔들리는 문제 방어. 에디터가 포커스된
  // 상태일 때만 capture 단계에서 가로채서 preventDefault + 직접 토글.
  useEffect(() => {
    if (!editor) return;
    const onKey: EventListener = (evt) => {
      const e = evt as globalThis.KeyboardEvent;
      if (!editor.isFocused) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        editor.chain().focus().toggleBold().run();
      } else if (key === "i") {
        e.preventDefault();
        editor.chain().focus().toggleItalic().run();
      } else if (key === "u") {
        // u 는 underline (현재 미설치) — 단축키만이라도 막아 사이드바 방지.
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [editor]);

  // ⌘⇧E / ⌘⇧H — 마지막 사용 색 재적용 단축키
  useEffect(() => {
    if (!editor) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (!editor.isFocused) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || !e.shiftKey) return;
      if (e.code === "KeyE") {
        e.preventDefault();
        if (editor.isActive("textStyle", { color: lastTextColor })) {
          editor.chain().focus().unsetColor().run();
        } else {
          editor.chain().focus().setColor(lastTextColor).run();
        }
      } else if (e.code === "KeyH") {
        e.preventDefault();
        editor.chain().focus().toggleHighlight({ color: lastHighlight }).run();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, lastTextColor, lastHighlight]);

  if (!editor) return null;

  // 글이 길어져도 툴바가 항상 보이도록 wrapper 는 sticky 툴바 + 스크롤
  // 가능한 본문 영역으로 구성. 본문은 max-height 까지만 늘고 그 이후는
  // 내부 스크롤.
  return (
    <div className="border border-line-strong bg-surface flex flex-col">
      <div className="sticky top-0 z-10 bg-surface">
        <Toolbar
          editor={editor}
          userId={user?.id ?? null}
          lastTextColor={lastTextColor}
          setLastTextColor={setLastTextColor}
          lastHighlight={lastHighlight}
          setLastHighlight={setLastHighlight}
        />
      </div>
      <div
        className="overflow-y-auto max-h-[50vh] sm:max-h-[60vh] cursor-text"
        style={{ minHeight }}
        onMouseDown={(e) => {
          // ProseMirror 본문 안을 직접 누른 게 아니면 (패딩/여백 클릭)
          // 에디터 끝으로 포커스해 어디를 눌러도 입력이 시작되도록.
          const target = e.target as HTMLElement;
          if (target.closest(".ProseMirror")) return;
          e.preventDefault();
          editor.chain().focus("end").run();
        }}
      >
        <EditorContent
          editor={editor}
          className="px-4 py-3 text-sm leading-[1.85] text-foreground"
        />
      </div>
      {/* 선택 영역 위에 뜨는 노션 스타일 버블 메뉴 — 모달 위에도 안 가리게 z-index 최상위 */}
      <BubbleMenu
        editor={editor}
        options={{ placement: "top" }}
        shouldShow={({ state, from, to }) => {
          if (from === to) return false;
          const text = state.doc.textBetween(from, to);
          return text.trim().length > 0;
        }}
        style={{ zIndex: 9999 }}
      >
        <SelectionBubble
          editor={editor}
          lastTextColor={lastTextColor}
          setLastTextColor={setLastTextColor}
          lastHighlight={lastHighlight}
          setLastHighlight={setLastHighlight}
        />
      </BubbleMenu>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// ColorPalette — 글자색/형광 공통 popover
// kind: 'text' | 'highlight' 로 두 용도 모두 처리.
// ───────────────────────────────────────────────────────────────

function ColorPalette({
  kind,
  onPick,
  onReset,
  onClose,
  anchorClass = "",
}: {
  kind: "text" | "highlight";
  onPick: (color: string) => void;
  onReset: () => void;
  onClose: () => void;
  /** popover 위치/배치 (top-full mt-1, top-full left-1/2 -translate-x-1/2 mt-2 등) */
  anchorClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const colors = kind === "text" ? TEXT_COLORS : HIGHLIGHT_COLORS;
  const title = kind === "text" ? "글자색" : "형광";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`absolute border border-line bg-surface p-2.5 min-w-[200px] ${anchorClass}`}
      style={{ zIndex: 10000, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="label mb-2 px-0.5">{title}</div>
      <div className="grid grid-cols-5 gap-1">
        {colors.map((c) => (
          <button
            key={c.value}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onPick(c.value);
              onClose();
            }}
            className="w-7 h-7 inline-flex items-center justify-center border border-line hover:border-foreground transition-colors text-sm font-bold"
            style={
              kind === "text"
                ? { color: c.value, background: "var(--surface)" }
                : { background: c.value, color: "var(--foreground)" }
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
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onReset();
          onClose();
        }}
        className="mt-2 w-full border border-line px-2 py-1.5 text-[11px] text-foreground-muted hover:text-danger hover:border-danger/60 transition-colors"
      >
        × 색상 해제
      </button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// LinkPopover — 링크 아이콘 바로 아래에 뜨는 URL 입력 팝업
// 선택 영역(extendMarkRange)에 링크를 건다. 빈 값이면 아무 것도 안 함.
// ───────────────────────────────────────────────────────────────

function LinkPopover({
  editor,
  onClose,
  anchorClass = "",
}: {
  editor: Editor;
  onClose: () => void;
  anchorClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const existing =
    (editor.getAttributes("link") as { href?: string }).href ?? "";
  const [url, setUrl] = useState(existing || "https://");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  function apply() {
    const u = url.trim();
    if (!u || u === "https://") {
      onClose();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: u }).run();
    onClose();
  }

  return (
    <div
      ref={ref}
      className={`absolute border border-line bg-surface p-2 min-w-[240px] ${anchorClass}`}
      style={{ zIndex: 10000, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="label mb-1.5 px-0.5">링크 주소</div>
      <div className="flex items-center gap-1.5">
        <input
          type="url"
          value={url}
          autoFocus
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          placeholder="https://example.com"
          className="flex-1 border border-line-strong bg-surface px-2.5 py-1.5 text-xs focus:border-foreground outline-none"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={apply}
          className="shrink-0 border border-accent bg-accent px-3 py-1.5 text-xs text-accent-foreground hover:bg-foreground-muted hover:border-foreground-muted"
        >
          적용
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// SelectionBubble — 드래그 선택 시 floating 메뉴
// ───────────────────────────────────────────────────────────────

function SelectionBubble({
  editor,
  setLastTextColor,
  setLastHighlight,
}: {
  editor: Editor;
  lastTextColor: string;
  setLastTextColor: (c: string) => void;
  lastHighlight: string;
  setLastHighlight: (c: string) => void;
}) {
  const [palette, setPalette] = useState<"text" | "highlight" | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const linkActive = editor.isActive("link");
  const currentTextColor =
    (editor.getAttributes("textStyle") as { color?: string }).color ?? null;
  const currentHighlight =
    (editor.getAttributes("highlight") as { color?: string }).color ?? null;

  return (
    <div className="flex items-center gap-0.5 bg-surface border border-line px-2 py-1.5"
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.10)" }}
    >
      <BubbleBtn
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        label="B"
        tip="볼드 ⌘B"
        style={{ fontWeight: 700 }}
      />
      <BubbleBtn
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        label="I"
        tip="이탤릭 ⌘I"
        style={{ fontStyle: "italic" }}
      />
      <BubbleBtn
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        label="S"
        tip="취소선"
        style={{ textDecoration: "line-through" }}
      />
      <BubbleDivider />

      {/* 글자색 — 선택 영역의 실제 색을 미리보기. 색이 없으면 검정. */}
      <div className="relative inline-flex">
        <button
          type="button"
          data-tip="글자색 ⌘⇧E"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            setPalette((p) => (p === "text" ? null : "text"))
          }
          className="editor-tip px-2 py-1 text-xs font-bold transition-colors min-w-[1.75rem] hover:bg-surface-muted"
          style={{ color: currentTextColor ?? "var(--foreground)" }}
        >
          A
        </button>
        {palette === "text" && (
          <ColorPalette
            kind="text"
            onPick={(c) => {
              setLastTextColor(c);
              editor.chain().focus().setColor(c).run();
            }}
            onReset={() => editor.chain().focus().unsetColor().run()}
            onClose={() => setPalette(null)}
            anchorClass="top-full left-1/2 -translate-x-1/2 mt-2"
          />
        )}
      </div>

      {/* 형광 — 선택 영역의 실제 형광색을 미리보기. 없으면 H 만. */}
      <div className="relative inline-flex">
        <button
          type="button"
          data-tip="형광 ⌘⇧H"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            setPalette((p) => (p === "highlight" ? null : "highlight"))
          }
          className="editor-tip px-2 py-1 text-xs transition-colors min-w-[1.75rem] text-foreground hover:bg-surface-muted"
        >
          <span
            className="px-1 font-bold"
            style={{ background: currentHighlight ?? "transparent" }}
          >
            H
          </span>
        </button>
        {palette === "highlight" && (
          <ColorPalette
            kind="highlight"
            onPick={(c) => {
              setLastHighlight(c);
              editor.chain().focus().toggleHighlight({ color: c }).run();
            }}
            onReset={() => editor.chain().focus().unsetHighlight().run()}
            onClose={() => setPalette(null)}
            anchorClass="top-full left-1/2 -translate-x-1/2 mt-2"
          />
        )}
      </div>

      <BubbleDivider />
      {/* 링크: 이미 링크면 누르면 해제, 아니면 아래에 URL 입력 팝업 */}
      <div className="relative inline-flex">
        <BubbleBtn
          active={linkActive || linkOpen}
          onClick={() => {
            if (linkActive) {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              setLinkOpen(false);
              return;
            }
            setLinkOpen((v) => !v);
          }}
          label={<LinkIcon className="w-3.5 h-3.5" />}
          tip={linkActive ? "링크 해제" : "링크"}
        />
        {linkOpen && !linkActive && (
          <LinkPopover
            editor={editor}
            onClose={() => setLinkOpen(false)}
            anchorClass="top-full left-1/2 -translate-x-1/2 mt-2"
          />
        )}
      </div>
    </div>
  );
}

function BubbleBtn({
  active,
  onClick,
  label,
  tip,
  style,
}: {
  active: boolean;
  onClick: () => void;
  label: React.ReactNode;
  tip?: string;
  style?: React.CSSProperties;
}) {
  const tipText = tip ?? (typeof label === "string" ? label : undefined);
  return (
    <button
      type="button"
      data-tip={tipText}
      aria-label={tipText}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={style}
      className={`editor-tip inline-flex items-center justify-center px-2 py-1 text-xs transition-colors min-w-[1.75rem] ${
        active
          ? "bg-accent-teal text-accent-foreground"
          : "text-foreground hover:bg-surface-muted"
      }`}
    >
      {label}
    </button>
  );
}

function BubbleDivider() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-line-strong/60" />;
}

/**
 * Read-only render of saved content. Accepts:
 *  - HTML produced by RichEditor → rendered as-is
 *  - Markdown (legacy fixtures / AI-pasted content) → converted to HTML
 *  - Plain text → wrapped in <p>
 */
export function RichRender({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const safe = toRenderableHtml(html);

  // raw-HTML 블록을 Shadow DOM 으로 옮겨 격리 렌더 — 안의 <style> 가
  // 페이지 전역(폰트/네비)에 새는 것을 차단.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // 멱등 hydrate — iframe 이 이미 있으면 skip. React(StrictMode/리렌더)가
    // dangerouslySetInnerHTML 을 다시 적용해 iframe 을 지워도 MutationObserver
    // 가 감지해 자동 복구.
    const hydrate = () => {
      root.querySelectorAll("[data-raw-html]").forEach((node) => {
        const host = node as HTMLElement;
        if (host.querySelector("iframe")) return; // 이미 hydrate 됨
        const attr = host.getAttribute("data-html");
        const tpl = host.querySelector("template");
        const raw = attr != null ? attr : tpl ? tpl.innerHTML : host.innerHTML;
        renderRawHtmlInto(host, raw, { interactive: true });
      });
    };
    hydrate();
    const mo = new MutationObserver(() => hydrate());
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [safe]);

  if (!safe) return null;
  return (
    <div
      ref={ref}
      className="prose-meetup text-base leading-[1.85] text-foreground-muted"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

/**
 * Tiptap's initial `content` accepts an HTML string. If the stored value is
 * markdown (older data, fixtures), convert it first so the editor opens with
 * the correct structure instead of literal "## title" text.
 */
function renderInitial(value: string): string {
  if (!value) return "";
  if (isHtml(value)) return value;
  if (looksLikeMarkdown(value)) return markdownToHtml(value);
  return value;
}

function toRenderableHtml(input: string): string {
  if (!input || input === "<p></p>") return "";
  if (isHtml(input)) return input;
  if (looksLikeMarkdown(input)) return markdownToHtml(input);
  // Plain text — preserve linebreaks.
  return `<p>${escapeHtml(input).replace(/\n/g, "<br/>")}</p>`;
}

function isHtml(s: string): boolean {
  return /^\s*<(p|h\d|ul|ol|blockquote|pre|hr|div|figure|table|img|span|mark)/i.test(
    s,
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ───────────────────────────────────────────────────────────────
// Toolbar
// ───────────────────────────────────────────────────────────────

function Toolbar({
  editor,
  userId,
  setLastTextColor,
  setLastHighlight,
}: {
  editor: Editor;
  userId: string | null;
  lastTextColor: string;
  setLastTextColor: (c: string) => void;
  lastHighlight: string;
  setLastHighlight: (c: string) => void;
}) {
  const [ytOpen, setYtOpen] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const [ytError, setYtError] = useState<string | null>(null);
  const [palette, setPalette] = useState<"text" | "highlight" | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [htmlSrc, setHtmlSrc] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function insertHtml() {
    const src = htmlSrc.trim();
    if (!src) return;
    editor
      .chain()
      .focus()
      .insertContent({ type: "rawHtml", attrs: { html: src } })
      .run();
    setHtmlSrc("");
    setHtmlOpen(false);
  }

  // 라벨이 붙은 인용블록 한 쌍을 삽입하는 헬퍼. 클로드 대화·질문답변
  // 모두 「라벨 + 빈 줄」 인용블록 두 개 + 뒤에 빈 단락(블록 밖으로 빠져나갈
  // 자리) 구조라 한 함수로 묶는다. speaker 가 좌/우 말풍선·박스 모양을 정함.
  function insertQuotePair(
    first: { label: string; speaker: string },
    second: { label: string; speaker: string },
  ) {
    const block = ({ label, speaker }: { label: string; speaker: string }) => ({
      type: "blockquote",
      attrs: { speaker },
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", marks: [{ type: "bold" }], text: label }],
        },
        { type: "paragraph" },
      ],
    });
    editor
      .chain()
      .focus()
      .insertContent([block(first), block(second), { type: "paragraph" }])
      .run();
  }

  // 클로드 대화 세트 — 나(오른쪽 말풍선) + Claude(왼쪽 말풍선).
  // 모두가 쓰는 공용 기능이라 작성자 이름이 아니라 항상 "나" 로 표기.
  const insertClaudeBlock = () =>
    insertQuotePair(
      { label: "나", speaker: "me" },
      { label: "Claude", speaker: "claude" },
    );
  // 질문 + 답변 세트 — 회색 박스.
  const insertQABlock = () =>
    insertQuotePair(
      { label: "질문", speaker: "q" },
      { label: "답변", speaker: "a" },
    );

  const selectionEmpty = editor.state.selection.empty;
  const linkActive = editor.isActive("link");
  // 링크 버튼은 글자를 드래그로 선택했을 때(또는 이미 링크 안일 때)만 활성.
  const linkDisabled = selectionEmpty && !linkActive;

  async function handleImageFile(file: File) {
    if (!userId) {
      setImgError("로그인 후 이미지를 올릴 수 있어요.");
      return;
    }
    setUploading(true);
    setImgError(null);
    const result = await uploadVisionImage(userId, file);
    setUploading(false);
    if (!result.ok) {
      setImgError(result.error);
      return;
    }
    editor.chain().focus().setImage({ src: result.url }).run();
  }

  // 현재 선택/커서 위치의 색 — 미리보기는 이것만 따라감.
  // 없으면 A 는 검정, H 는 배경 없음.
  const currentTextColor =
    (editor.getAttributes("textStyle") as { color?: string }).color ?? null;
  const currentHighlight =
    (editor.getAttributes("highlight") as { color?: string }).color ?? null;

  function submitYoutube() {
    const id = youtubeIdFromUrl(ytUrl);
    if (!id) {
      setYtError("올바른 YouTube URL 이 아닙니다.");
      return;
    }
    const ok = editor
      .chain()
      .focus()
      .setYoutubeVideo({ src: `https://www.youtube.com/watch?v=${id}` })
      .run();
    if (!ok) {
      setYtError("임베드 삽입에 실패했습니다.");
      return;
    }
    setYtUrl("");
    setYtError(null);
    setYtOpen(false);
  }

  return (
    <div className="border-b border-line bg-surface-muted/60">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5">
        <Btn
          label="B"
          tip="볼드 ⌘B"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          style={{ fontWeight: 700 }}
        />
        <Btn
          label="I"
          tip="이탤릭 ⌘I"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          style={{ fontStyle: "italic" }}
        />
        <Btn
          label="S"
          tip="취소선"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          style={{ textDecoration: "line-through" }}
        />
        <Divider />
        <Btn
          label="H1"
          tip="제목 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />
        <Btn
          label="H2"
          tip="제목 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <Btn
          label="H3"
          tip="제목 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <Divider />

        {/* 글자색 — 선택 영역의 실제 색을 미리보기. 색이 없으면 검정. */}
        <div className="relative inline-flex">
          <button
            type="button"
            data-tip="글자색 ⌘⇧E"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              setPalette((p) => (p === "text" ? null : "text"))
            }
            className={`editor-tip px-2 py-1 text-xs transition-colors flex items-center gap-1 font-bold ${
              palette === "text" ? "bg-surface" : "hover:bg-surface"
            }`}
            style={{ color: currentTextColor ?? "var(--foreground)" }}
          >
            A
          </button>
          {palette === "text" && (
            <ColorPalette
              kind="text"
              onPick={(c) => {
                setLastTextColor(c);
                editor.chain().focus().setColor(c).run();
              }}
              onReset={() => editor.chain().focus().unsetColor().run()}
              onClose={() => setPalette(null)}
              anchorClass="top-full left-0 mt-1"
            />
          )}
        </div>

        {/* 형광 — 선택 영역의 실제 형광색을 미리보기. 없으면 H 만 (배경 X). */}
        <div className="relative inline-flex">
          <button
            type="button"
            data-tip="형광 ⌘⇧H"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() =>
              setPalette((p) => (p === "highlight" ? null : "highlight"))
            }
            className={`editor-tip px-2 py-1 text-xs transition-colors flex items-center min-w-[1.75rem] ${
              palette === "highlight" ? "bg-surface" : "hover:bg-surface"
            }`}
          >
            <span
              className="px-1 text-foreground"
              style={{
                background: currentHighlight ?? "transparent",
                fontWeight: 700,
              }}
            >
              H
            </span>
          </button>
          {palette === "highlight" && (
            <ColorPalette
              kind="highlight"
              onPick={(c) => {
                setLastHighlight(c);
                editor.chain().focus().setHighlight({ color: c }).run();
              }}
              onReset={() => editor.chain().focus().unsetHighlight().run()}
              onClose={() => setPalette(null)}
              anchorClass="top-full left-0 mt-1"
            />
          )}
        </div>

        <Divider />
        <Btn
          label="·"
          tip="글머리 기호"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <Btn
          label="1."
          tip="번호 매기기"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <Btn
          label="☑"
          tip="체크리스트"
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        />
        <Btn
          label={'"'}
          tip="인용"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <Btn
          label="<|>"
          tip="코드 블록"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
        <Divider />
        {/* 링크 — 글자를 드래그로 선택해야 활성. 누르면 아이콘 아래 URL 팝업.
            이미 링크가 걸린 선택이면 누르는 즉시 해제. */}
        <div className="relative inline-flex">
          <Btn
            label={<LinkIcon />}
            tip={
              linkDisabled
                ? "글자를 선택한 뒤 누르세요"
                : linkActive
                ? "링크 해제"
                : "링크"
            }
            disabled={linkDisabled}
            active={linkActive || linkOpen}
            onClick={() => {
              if (linkActive) {
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .unsetLink()
                  .run();
                setLinkOpen(false);
                return;
              }
              setLinkOpen((v) => !v);
            }}
          />
          {linkOpen && !linkActive && (
            <LinkPopover
              editor={editor}
              onClose={() => setLinkOpen(false)}
              anchorClass="top-full left-0 mt-1"
            />
          )}
        </div>
        <Btn
          label={<ImageIcon className={`w-4 h-4 ${uploading ? "animate-pulse" : ""}`} />}
          tip={uploading ? "이미지 올리는 중..." : "이미지 첨부"}
          active={false}
          disabled={uploading}
          onClick={() => {
            if (uploading) return;
            setImgError(null);
            fileInputRef.current?.click();
          }}
        />
        <Btn
          label={<YoutubeIcon />}
          tip="유튜브 임베드"
          active={ytOpen}
          onClick={() => {
            setYtOpen((v) => !v);
            setYtError(null);
          }}
        />
        <Btn
          label="HTML"
          tip="HTML 코드 삽입"
          active={htmlOpen}
          onClick={() => setHtmlOpen((v) => !v)}
        />
        <Divider />
        {/* 클로드 대화 / 질문답변 빠른 삽입 — AI 호출이 아니라 정해진
            인용블록 틀을 넣어주는 버튼(내용은 직접 채워 넣음). */}
        <Btn
          label="클로드"
          tip="클로드 대화 말풍선 (나 오른쪽 / Claude 왼쪽)"
          active={false}
          onClick={insertClaudeBlock}
        />
        <Btn
          label="질문"
          tip="질문 + 답변 틀"
          active={false}
          onClick={insertQABlock}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // 같은 파일 다시 선택해도 onChange 가 뜨도록 값 초기화
            e.target.value = "";
            if (file) void handleImageFile(file);
          }}
        />
      </div>

      {imgError && (
        <div className="border-t border-line bg-surface px-3 py-2">
          <p className="text-[11px] text-danger">{imgError}</p>
        </div>
      )}

      {ytOpen && (
        <div className="border-t border-line bg-surface px-2 py-2">
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitYoutube();
                } else if (e.key === "Escape") {
                  setYtOpen(false);
                  setYtError(null);
                }
              }}
              placeholder="https://www.youtube.com/watch?v=... (또는 그냥 본문에 붙여넣기)"
              className="flex-1 border border-line-strong bg-surface px-3 py-1.5 text-xs focus:border-foreground outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={submitYoutube}
              disabled={!ytUrl.trim()}
              className="border border-accent bg-accent px-3 py-1.5 text-xs text-accent-foreground disabled:opacity-60"
            >
              임베드
            </button>
            <button
              type="button"
              onClick={() => {
                setYtOpen(false);
                setYtError(null);
              }}
              className="text-xs text-foreground-muted hover:text-foreground px-2"
            >
              취소
            </button>
          </div>
          {ytError && (
            <p className="mt-1.5 text-[11px] text-danger">{ytError}</p>
          )}
        </div>
      )}

      {htmlOpen && (
        <div className="border-t border-line bg-surface px-2 py-2 space-y-2">
          <textarea
            value={htmlSrc}
            onChange={(e) => setHtmlSrc(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Escape") {
                setHtmlOpen(false);
              } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                insertHtml();
              }
            }}
            rows={5}
            placeholder={"<table>…</table> 같은 HTML 코드를 붙여넣으세요. 붙인 그대로 렌더링됩니다."}
            className="w-full border border-line-strong bg-surface px-3 py-2 text-xs font-mono leading-relaxed focus:border-foreground outline-none resize-y"
            autoFocus
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-foreground-faint">
              ⌘/Ctrl+Enter 로 삽입 · 스크립트 등은 보안상 실행되지 않아요
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setHtmlOpen(false);
                  setHtmlSrc("");
                }}
                className="text-xs text-foreground-muted hover:text-foreground px-2"
              >
                취소
              </button>
              <button
                type="button"
                onClick={insertHtml}
                disabled={!htmlSrc.trim()}
                className="border border-accent bg-accent px-3 py-1.5 text-xs text-accent-foreground disabled:opacity-60"
              >
                삽입
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Btn({
  label,
  active,
  onClick,
  style,
  tip,
  disabled = false,
}: {
  label: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  tip?: string;
  disabled?: boolean;
}) {
  const tipText = tip ?? (typeof label === "string" ? label : undefined);
  return (
    <button
      type="button"
      data-tip={tipText}
      aria-label={tipText}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep editor selection
      onClick={onClick}
      style={style}
      className={`editor-tip inline-flex items-center justify-center px-2 py-1 text-xs transition-colors min-w-[1.75rem] ${
        disabled
          ? "text-foreground-faint/50 cursor-not-allowed"
          : active
          ? "bg-foreground text-accent-foreground"
          : "text-foreground-muted hover:text-foreground hover:bg-surface"
      }`}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-line" />;
}

// ───────────────────────────────────────────────────────────────
// 툴바 아이콘 (currentColor stroke — MUJI 무채색 톤 유지)
// ───────────────────────────────────────────────────────────────

function LinkIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 17H7.5a5 5 0 010-10H9" />
      <path d="M15 7h1.5a5 5 0 010 10H15" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

function ImageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M5 18l4.5-4.5 3 3 3.5-3.5L21 17" />
    </svg>
  );
}

/** 유튜브 로고 — 빨간 둥근 사각형 + 흰 재생 삼각형 (브랜드 컬러). */
function YoutubeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <rect x="2" y="5.5" width="20" height="13" rx="3.6" fill="#FF0000" />
      <path d="M10 9.1l5.4 2.9L10 14.9z" fill="#ffffff" />
    </svg>
  );
}

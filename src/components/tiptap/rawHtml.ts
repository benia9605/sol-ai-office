/**
 * @file src/components/tiptap/rawHtml.ts
 * @description 원본 HTML 블록 노드 (이식 킷 06 rich-editor의 RawHtml 이식)
 * - 사용자가 붙여넣은 HTML 코드를 그대로 보관하고 sandbox iframe으로 격리 렌더한다.
 * - atom 노드 → 한 덩어리로 다뤄지고 backspace로 삭제 가능.
 * - JSON 저장: attrs.html 에 원본 문자열이 그대로 들어간다(직렬화 안전).
 * - 편집기·읽기전용 양쪽에서 같은 nodeView(iframe)로 렌더된다.
 *
 * 주의: 신뢰된 내부(소규모 비공개 워크스페이스) 전용. 외부 공개 입력엔 새니타이즈 필요.
 */
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';

/**
 * iframe 내부에서 자기 높이를 부모로 postMessage 하는 리포터 스크립트.
 * 모바일 사파리는 부모가 sandbox iframe의 contentDocument를 못 읽어
 * 높이가 0으로 깔리는데, 내부에서 알려주면 해결된다.
 */
const RAW_HTML_REPORTER =
  `<script>(function(){` +
  `function s(){var h=Math.max(` +
  `document.documentElement?document.documentElement.scrollHeight:0,` +
  `document.body?document.body.scrollHeight:0,` +
  `document.body?document.body.offsetHeight:0);` +
  `if(h>0)parent.postMessage({__rawHtmlHeight:h},'*');}` +
  `function soon(){requestAnimationFrame(function(){requestAnimationFrame(s);});}` +
  `window.addEventListener('load',soon);` +
  `document.addEventListener('DOMContentLoaded',soon);` +
  `if(window.ResizeObserver){try{new ResizeObserver(s).observe(document.documentElement);}catch(e){}}` +
  `if(document.fonts&&document.fonts.ready){document.fonts.ready.then(s);}` +
  `var n=0,t=setInterval(function(){s();if(++n>15)clearInterval(t);},500);soon();` +
  `})();<\/script>`;

/** raw HTML을 완전한 문서로 감싸고 + 높이 리포터 주입. */
function wrapRawHtmlDoc(html: string): string {
  if (/<html[\s>]|<body[\s>]/i.test(html)) {
    if (/<\/body>/i.test(html)) {
      return html.replace(/<\/body>/i, `${RAW_HTML_REPORTER}</body>`);
    }
    return html + RAW_HTML_REPORTER;
  }
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
 * 호스트 엘리먼트 안에 raw HTML을 sandbox iframe으로 격리 렌더.
 * 높이: ① 부모에서 contentDocument.scrollHeight 직접 측정(주력)
 *      ② 내부 리포터 postMessage(백업/모바일) — 둘 중 큰 값.
 * @param interactive false면 pointer-events 차단(에디터에서 블록 선택/삭제 쉽게).
 */
export function renderRawHtmlInto(
  host: HTMLElement,
  html: string,
  opts?: { interactive?: boolean },
) {
  host.textContent = '';
  const iframe = document.createElement('iframe');
  // ★ 보안: allow-same-origin 을 절대 함께 주지 않는다. srcdoc iframe은 부모 origin을
  //   물려받으므로 same-origin을 허용하면 붙여넣은 스크립트가 부모 localStorage(Supabase
  //   세션 토큰)·쿠키·DOM에 접근 → 다른 멤버 계정 탈취(저장형 XSS)가 된다.
  //   allow-scripts만 주면 iframe은 불투명(opaque) origin이라 스크립트는 자체 인터랙션만
  //   돌고 부모엔 접근 못 한다. 높이는 아래 postMessage 리포터로만 받는다.
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('title', 'HTML 미리보기');
  iframe.setAttribute('scrolling', 'no');
  iframe.style.width = '100%';
  iframe.style.border = '0';
  iframe.style.display = 'block';
  iframe.style.height = '200px';
  if (!opts?.interactive) iframe.style.pointerEvents = 'none';

  const setH = (h: number) => { if (h > 0) iframe.style.height = `${h}px`; };
  const measure = () => {
    try {
      const d = iframe.contentDocument;
      if (!d) return;
      setH(Math.max(
        d.documentElement ? d.documentElement.scrollHeight : 0,
        d.body ? d.body.scrollHeight : 0,
      ));
    } catch { /* 무시 */ }
  };
  const onMsg = (e: MessageEvent) => {
    if (!iframe.isConnected) { window.removeEventListener('message', onMsg); return; }
    if (e.source !== iframe.contentWindow) return;
    const h = (e.data as { __rawHtmlHeight?: number })?.__rawHtmlHeight;
    if (typeof h === 'number') setH(h);
  };
  window.addEventListener('message', onMsg);

  iframe.addEventListener('load', () => {
    measure();
    try {
      const d = iframe.contentDocument;
      if (d && 'ResizeObserver' in window) {
        const ro = new ResizeObserver(() => measure());
        ro.observe(d.documentElement);
        if (d.body) ro.observe(d.body);
      }
    } catch { /* 무시 */ }
    [100, 400, 1000, 2500].forEach((t) => setTimeout(measure, t));
  });

  iframe.srcdoc = wrapRawHtmlDoc(html);
  host.appendChild(iframe);
}

export const RawHtml = TiptapNode.create({
  name: 'rawHtml',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      html: {
        default: '',
        parseHTML: (el) => {
          const e = el as HTMLElement;
          const attr = e.getAttribute('data-html');
          if (attr != null) return attr;
          const tpl = e.querySelector('template');
          return tpl ? tpl.innerHTML : e.innerHTML;
        },
        renderHTML: (attrs) => ({ 'data-html': (attrs.html as string) || '' }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-raw-html]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-raw-html': '' }, HTMLAttributes)];
  },
  addNodeView() {
    return ({ node, editor }) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-raw-html', '');
      dom.className = 'raw-html-block border border-line';
      dom.contentEditable = 'false';
      // 편집기에선 클릭 방해 없이 블록 선택/삭제, 읽기전용에선 인터랙션 허용
      renderRawHtmlInto(dom, (node.attrs.html as string) || '', {
        interactive: !editor.isEditable,
      });
      return { dom };
    };
  },
});

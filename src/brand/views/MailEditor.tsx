/**
 * @file src/brand/views/MailEditor.tsx
 * @description 메일 서식 편집기 (Tiptap · HTML) - 초안 · 템플릿 · 서명이 같이 쓴다 (2026-10-31 시안 3·4판)
 *  도구줄 2줄: 1줄 본문/크기 · B · I · U · 글자색 / 2줄 목록 · 링크 · 이미지 · 서명 ▾ · 템플릿 ▾
 *  보낼 때는 본부가 인라인 스타일로 바꾸고 글자판(text)도 같이 보낸다 - 여기서는 HTML 만 만든다
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';

const COLORS = ['#1f2421', '#787774', '#976D57', '#CC782F', '#548164', '#477DA5', '#A48BBE', '#C4554D'];
const SIZES = ['12px', '14px', '16px', '18px', '22px'];

/** 그림 → 긴 변 1200 JPEG data URL (메일 안 그림 · 보낼 때 본부가 첨부 그림으로 바꾼다) */
async function fileToDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}

export interface Pick { key: string; label: string; sub?: string }

export function MailEditor({ html, onChange, signatures, onSignature, templates, onTemplate, minHeight = 260, placeholder }: {
  html: string; onChange: (html: string) => void;
  signatures?: Pick[]; onSignature?: (key: string) => void;
  templates?: Pick[]; onTemplate?: (key: string, ed: Editor) => void;
  minHeight?: number; placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: true } }), TextStyle, Color, FontSize, Image.configure({ inline: false, allowBase64: true }), Placeholder.configure({ placeholder: placeholder ?? '' })],
    content: html || '',
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
    editorProps: { attributes: { class: 'm-body' } },
  });
  // 밖에서 내용을 통째로 바꿀 때 (다른 초안 열기)
  const last = useRef(html);
  useEffect(() => {
    if (!editor) return;
    if (html !== last.current && html !== editor.getHTML()) editor.commands.setContent(html || '', { emitUpdate: false });
    last.current = html;
  }, [html, editor]);

  const [menu, setMenu] = useState<'' | 'color' | 'sig' | 'tpl' | 'link'>('');
  const [link, setLink] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  if (!editor) return <div className="m-ed" style={{ minHeight }} />;

  const B = ({ on, label, title, onClick, children }: { on?: boolean; label?: string; title: string; onClick: () => void; children?: ReactNode }) => (
    <button type="button" className={on ? 'sel' : ''} title={title} aria-label={title} onMouseDown={e => e.preventDefault()} onClick={onClick}>{children ?? label}</button>
  );
  const block = editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p';
  const size = (editor.getAttributes('textStyle').fontSize as string) || '';
  const toggle = (m: typeof menu) => setMenu(cur => cur === m ? '' : m);

  return (
    <div className="m-ed">
      <div className="m-tb">
        <div className="r">
          <select aria-label="문단" value={block} onChange={e => {
            const v = e.target.value; const c = editor.chain().focus();
            (v === 'p' ? c.setParagraph() : c.toggleHeading({ level: v === 'h2' ? 2 : 3 })).run();
          }}>
            <option value="p">본문</option><option value="h2">큰 제목</option><option value="h3">작은 제목</option>
          </select>
          <select aria-label="글자 크기" value={size} onChange={e => { const v = e.target.value; const c = editor.chain().focus(); (v ? c.setFontSize(v) : c.unsetFontSize()).run(); }}>
            <option value="">크기</option>{SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <em />
          <B title="굵게" on={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></B>
          <B title="기울임" on={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></B>
          <B title="밑줄" on={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></B>
          <em />
          <span className="m-pop">
            <B title="글자색" on={menu === 'color'} onClick={() => toggle('color')}><span className="m-cdot" style={{ background: (editor.getAttributes('textStyle').color as string) || '#1f2421' }} />글자색</B>
            {menu === 'color' && <span className="m-menu colors">{COLORS.map(c => <button key={c} type="button" aria-label={c} style={{ background: c }} onMouseDown={e => e.preventDefault()} onClick={() => { editor.chain().focus().setColor(c).run(); setMenu(''); }} />)}
              <button type="button" className="txt" onMouseDown={e => e.preventDefault()} onClick={() => { editor.chain().focus().unsetColor().run(); setMenu(''); }}>기본</button></span>}
          </span>
        </div>
        <div className="r">
          <B title="목록" on={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label="• 목록" />
          <B title="번호 목록" on={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="1. 번호" />
          <em />
          <span className="m-pop">
            <B title="링크" on={editor.isActive('link') || menu === 'link'} onClick={() => { setLink((editor.getAttributes('link').href as string) || ''); toggle('link'); }} label="🔗 링크" />
            {menu === 'link' && <span className="m-menu link">
              <input className="n-in" value={link} onChange={e => setLink(e.target.value)} placeholder="https://" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (link ? editor.chain().focus().extendMarkRange('link').setLink({ href: link }) : editor.chain().focus().unsetLink()).run(); setMenu(''); } }} />
              <button type="button" className="txt" onClick={() => { (link ? editor.chain().focus().extendMarkRange('link').setLink({ href: link }) : editor.chain().focus().unsetLink()).run(); setMenu(''); }}>넣기</button>
            </span>}
          </span>
          <B title="이미지" onClick={() => fileRef.current?.click()} label="🖼 이미지" />
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={async e => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (f) editor.chain().focus().setImage({ src: await fileToDataUrl(f) }).run();
          }} />
          {signatures && <>
            <em />
            <span className="m-pop">
              <B title="서명" on={menu === 'sig'} onClick={() => toggle('sig')} label="서명 ▾" />
              {menu === 'sig' && <span className="m-menu list">
                {signatures.length ? signatures.map(s => <button key={s.key} type="button" onClick={() => { onSignature?.(s.key); setMenu(''); }}><b>{s.label}</b>{s.sub && <small>{s.sub}</small>}</button>)
                  : <span className="none">저장된 서명이 없습니다</span>}
              </span>}
            </span>
          </>}
          {templates && <span className="m-pop">
            <B title="템플릿" on={menu === 'tpl'} onClick={() => toggle('tpl')} label="템플릿 ▾" />
            {menu === 'tpl' && <span className="m-menu list">
              {templates.length ? templates.map(t => <button key={t.key} type="button" onClick={() => { onTemplate?.(t.key, editor); setMenu(''); }}><b>{t.label}</b>{t.sub && <small>{t.sub}</small>}</button>)
                : <span className="none">등록된 템플릿이 없습니다</span>}
            </span>}
          </span>}
        </div>
      </div>
      {/* 길어지면 본문 칸 안에서만 스크롤 - 도구줄이 계속 보이게 */}
      <div className="m-edc" style={{ minHeight }} onClick={() => editor.chain().focus().run()}><EditorContent editor={editor} /></div>
    </div>
  );
}

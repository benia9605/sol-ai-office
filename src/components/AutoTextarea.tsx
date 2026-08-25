/**
 * @file src/components/AutoTextarea.tsx
 * @description 내용에 따라 높이가 자동으로 자라는 textarea (밑줄/구분선이 내용을 따라 내려감)
 *
 * 배경: 기존 입력창들은 `rows={2~7}`로 초기 높이가 여러 줄로 고정돼 있어서, 한 줄만
 *   입력해도 아래 구분선(밑줄/박스 하단)이 2~3줄 아래에 떠 있었다. 이 컴포넌트는
 *   기본 1줄에서 시작해 입력한 만큼만 높이가 늘어난다.
 *
 * 사용: <textarea .../> 를 <AutoTextarea .../> 로 바꾸기만 하면 된다. 기존 `rows`는
 *   무시하고 `minRows`(기본 1)를 최소 높이로 쓴다. value(제어형)·onChange 모두 대응.
 */
import { forwardRef, useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> & {
  /** 최소 줄 수(초기 높이). 기본 1 */
  minRows?: number;
  /** 기존 코드 호환용 — 무시됨(초기 높이는 minRows가 결정) */
  rows?: number;
};

export const AutoTextarea = forwardRef<HTMLTextAreaElement, Props>(function AutoTextarea(
  { minRows = 1, rows: _ignoredRows, className = '', style, value, onChange, ...rest }, ref,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const setRef = (el: HTMLTextAreaElement | null) => {
    innerRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
  };

  const resize = () => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = 'auto';                 // 먼저 줄여서 scrollHeight 재계산
    el.style.height = `${el.scrollHeight}px`;  // 내용 높이만큼
  };

  // 마운트 시 + value(제어형) 변경 시 재계산. layout 타이밍이라 깜빡임 없음.
  useLayoutEffect(() => { resize(); }, [value]);
  // 폰트/레이아웃 늦게 잡히는 경우(모달 오픈 등) 한 프레임 뒤 보정
  useEffect(() => { const id = requestAnimationFrame(resize); return () => cancelAnimationFrame(id); }, []);

  return (
    <textarea
      {...rest}
      ref={setRef}
      rows={minRows}
      value={value}
      onChange={(e) => { onChange?.(e); resize(); }}
      className={className}
      style={{ resize: 'none', overflow: 'hidden', ...style }}
    />
  );
});

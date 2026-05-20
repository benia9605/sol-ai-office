/**
 * @file src/components/ThemePicker.tsx
 * @description 테마 선택 UI — 모디/모던 양쪽 SettingsPage에서 동일하게 사용
 * - 헤더 + 모디/모던 카드 2개 (미리보기 + 라벨)
 * - 클릭 즉시 useTheme().setTheme로 변경
 */
import { useTheme } from '../contexts/ThemeContext';

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const isModi = theme === 'modi';

  return (
    <section className={isModi ? 'bg-white/80 backdrop-blur-sm rounded-3xl shadow-soft p-4 sm:p-6' : 'space-y-3'}>
      {isModi ? (
        <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r="1" fill="currentColor" />
            <circle cx="17.5" cy="10.5" r="1" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r="1" fill="currentColor" />
            <circle cx="6.5" cy="12.5" r="1" fill="currentColor" />
            <path d="M12 22c-5.5 0-10-4.5-10-10S6.5 2 12 2c5.5 0 10 4 10 9 0 3-2.5 5.5-5.5 5.5h-2a1.7 1.7 0 0 0-1.7 1.7c0 .5.2.9.4 1.1.3.3.4.7.4 1.1 0 .9-.7 1.6-1.6 1.6Z" />
          </svg>
          화면 테마
        </h2>
      ) : (
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <div className="flex items-baseline gap-3">
            <p className="label">Theme</p>
            <h2 className="text-base font-normal text-foreground-muted">화면 테마</h2>
          </div>
          <p className="text-xs text-foreground-faint">즉시 적용 · 다음 로그인 유지</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <ThemeOption
          active={theme === 'modi'}
          onClick={() => setTheme('modi')}
          labelEn="Modi"
          labelKo="모디"
          description="친근한 보라 톤"
          previewKind="modi"
        />
        <ThemeOption
          active={theme === 'modern'}
          onClick={() => setTheme('modern')}
          labelEn="Modern"
          labelKo="모던"
          description="흰 배경 + 진초록"
          previewKind="modern"
        />
      </div>
    </section>
  );
}

/* ─── 테마 옵션 카드 ─── */

function ThemeOption({
  active, onClick, labelEn, labelKo, description, previewKind,
}: {
  active: boolean;
  onClick: () => void;
  labelEn: string;
  labelKo: string;
  description: string;
  previewKind: 'modi' | 'modern';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left border transition-colors ${
        active ? 'border-primary-500' : 'border-line hover:border-foreground'
      }`}
    >
      <ThemePreview kind={previewKind} />
      <div className="px-4 py-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <p className={`text-[10px] tracking-[0.22em] uppercase ${
              active ? 'text-primary-500' : 'text-foreground-faint'
            }`}>
              {labelEn}
            </p>
            <p className="text-sm">{labelKo}</p>
          </div>
          {active && (
            <span className="text-[10px] tracking-[0.18em] uppercase text-primary-500">
              Active
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-foreground-faint">{description}</p>
      </div>
    </button>
  );
}

/* ─── 미리보기 ─── */

function ThemePreview({ kind }: { kind: 'modi' | 'modern' }) {
  if (kind === 'modi') {
    return (
      <div
        className="h-20 px-4 py-3 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #f3e8ff 0%, #ffffff 50%, #fed7e2 100%)' }}
      >
        <div className="w-8 h-8 rounded-full" style={{ background: '#a855f7', opacity: 0.85 }} />
        <div className="absolute right-3 bottom-3 w-12 h-6 rounded-xl bg-white/70 backdrop-blur-sm shadow-sm flex items-center justify-center">
          <span className="text-[9px] font-bold" style={{ color: '#a855f7' }}>Aa</span>
        </div>
      </div>
    );
  }
  return (
    <div className="h-20 px-4 py-3 relative" style={{ background: '#ffffff' }}>
      <div
        className="w-9 h-9"
        style={{ background: '#ffffff', border: '1.5px solid #1b4332' }}
      />
      <div
        className="absolute right-3 top-3 px-2 py-1 flex items-center"
        style={{ background: '#ffffff', border: '1px solid #e8e6e1' }}
      >
        <span className="text-[9px] tracking-[0.18em]" style={{ color: '#1b4332', fontWeight: 500 }}>
          Aa
        </span>
      </div>
    </div>
  );
}

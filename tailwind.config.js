/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'focus:ring-orange-200',
    'focus:ring-fuchsia-200',
    'focus:ring-amber-200',
    'focus:ring-pink-200',
  ],
  theme: {
    extend: {
      colors: {
        // ── 의미 기반 토큰 (모던 테마 친화) ──
        surface:    'var(--color-surface)',
        'surface-muted': 'var(--color-surface-muted)',
        foreground: 'var(--color-foreground)',
        'foreground-muted': 'var(--color-foreground-muted)',
        'foreground-faint': 'var(--color-foreground-faint)',
        line:       'var(--color-line)',
        'line-strong': 'var(--color-line-strong)',

        // ── Primary (테마별로 보라/진초록 자동 전환) ──
        primary: {
          50:  'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
        },

        // ── Pastel (모디=파스텔, 모던=흰색) ──
        pastel: {
          purple: 'var(--color-pastel-purple)',
          pink:   'var(--color-pastel-pink)',
          lime:   'var(--color-pastel-lime)',
          brown:  'var(--color-pastel-brown)',
          yellow: 'var(--color-pastel-yellow)',
        },

        // ── Gray (text-gray-*, bg-gray-* 압도적 사용처 — 테마별 톤 자동 변환) ──
        gray: {
          50:  'var(--color-gray-50)',
          100: 'var(--color-gray-100)',
          200: 'var(--color-gray-200)',
          300: 'var(--color-gray-300)',
          400: 'var(--color-gray-400)',
          500: 'var(--color-gray-500)',
          600: 'var(--color-gray-600)',
          700: 'var(--color-gray-700)',
          800: 'var(--color-gray-800)',
          900: 'var(--color-gray-900)',
        },
      },
      borderRadius: {
        card:   'var(--radius-card)',
        'card-sm': 'var(--radius-card-sm)',
        button: 'var(--radius-button)',
        input:  'var(--radius-input)',
      },
      boxShadow: {
        'soft':  'var(--shadow-soft)',
        'hover': 'var(--shadow-hover)',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.25s ease-out',
      }
    },
  },
  plugins: [],
}

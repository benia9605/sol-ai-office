/**
 * @file src/components/ModiFAB.tsx
 * @description 모디 FAB (플로팅 액션 버튼)
 * - 우하단 고정 위치
 * - 모디 캐릭터 이미지 표시
 * - 클릭 시 모디 비서 1:1 ChatModal 열기
 */

interface ModiFABProps {
  onClick: () => void;
}

export function ModiFAB({ onClick }: ModiFABProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-6 lg:bottom-6 w-14 h-14 rounded-full bg-pastel-yellow
        shadow-hover hover:scale-110 transition-all duration-300 z-30
        flex items-center justify-center group"
      title="모디에게 물어보기"
    >
      <img
        src="/images/modi.png"
        alt="모디"
        className="w-10 h-10 rounded-full object-cover"
      />
      {/* 툴팁 */}
      <span className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-800 text-white
        text-xs rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        모디에게 물어보기 💛
      </span>
    </button>
  );
}

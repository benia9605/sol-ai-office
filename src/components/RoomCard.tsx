/**
 * @file src/components/RoomCard.tsx
 * @description 오피스 방 카드 컴포넌트
 * - 각 방(전략실, 마케팅룸 등)을 카드 형태로 표시
 * - 캐릭터 이미지, 방 이름, AI 이름, 역할, 성격, 모델 정보 표시
 * - 클릭 시 해당 방의 ChatModal 열기 (onClick 콜백)
 * - 방별 파스텔 색상 배경 적용 (room.color)
 * - 모바일: 가로 레이아웃 (이미지 좌측 + 텍스트 우측)
 * - PC: 세로 레이아웃 (이미지 상단 + 텍스트 하단)
 */
import { Room } from '../types';

interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

export function RoomCard({ room, onClick }: RoomCardProps) {
  return (
    <button
      onClick={onClick}
      className={`${room.color} p-4 sm:p-6 rounded-3xl shadow-soft hover:shadow-hover
        hover:scale-[1.03] transition-all duration-300 cursor-pointer w-full
        flex items-center gap-4 sm:flex-col sm:items-center sm:text-center`}
    >
      <img
        src={room.image}
        alt={room.aiName}
        className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover flex-shrink-0 sm:mb-1"
      />
      <div className="flex-1 text-left sm:text-center min-w-0">
        <h3 className="text-base sm:text-lg font-bold text-gray-800">{room.name}</h3>
        <p className="text-sm font-medium text-primary-600 mb-1">"{room.aiName}"</p>
        <p className="text-xs text-gray-600 truncate sm:whitespace-normal">{room.role}</p>
        <p className="text-xs text-gray-500 italic hidden sm:block">{room.personality}</p>
      </div>
      <span className="text-xs px-3 py-1 bg-white/60 rounded-full text-gray-600 flex-shrink-0 sm:mt-2">
        {room.aiModel}
      </span>
    </button>
  );
}

import { Room } from '../types';

interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

export function RoomCard({ room, onClick }: RoomCardProps) {
  return (
    <button
      onClick={onClick}
      className={`${room.color} p-6 rounded-3xl shadow-soft hover:shadow-hover
        hover:scale-105 transition-all duration-300 cursor-pointer
        flex flex-col items-center text-center w-full`}
    >
      <span className="text-5xl mb-3">{room.emoji}</span>
      <h3 className="text-lg font-bold text-gray-800 mb-1">{room.name}</h3>
      <p className="text-sm font-medium text-primary-600 mb-2">"{room.aiName}"</p>
      <p className="text-xs text-gray-600 mb-1">{room.role}</p>
      <p className="text-xs text-gray-500 italic">{room.personality}</p>
      <span className="mt-3 text-xs px-3 py-1 bg-white/60 rounded-full text-gray-600">
        {room.aiModel}
      </span>
    </button>
  );
}

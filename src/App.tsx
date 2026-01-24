import { useState } from 'react';
import { Room, ChatHistory } from './types';
import { rooms, dummyChatHistory } from './data';
import { RoomCard } from './components/RoomCard';
import { Sidebar } from './components/Sidebar';
import { ChatModal } from './components/ChatModal';

function App() {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [chatHistory] = useState<ChatHistory[]>(dummyChatHistory);

  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room);
  };

  const handleHistorySelect = (history: ChatHistory) => {
    const room = rooms.find((r) => r.id === history.roomId);
    if (room) {
      setSelectedRoom(room);
    }
  };

  const handleCloseModal = () => {
    setSelectedRoom(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-100 via-white to-pastel-pink/30">
      {/* 헤더 */}
      <header className="py-6 px-8">
        <h1 className="text-3xl font-bold text-gray-800 text-center">
          <span className="mr-2">🏢</span>
          Sol AI Office
        </h1>
        <p className="text-center text-gray-500 mt-2 text-sm">
          1인 사업가를 위한 AI 팀 오피스
        </p>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex gap-6 px-8 pb-8 h-[calc(100vh-140px)]">
        {/* 사이드바 */}
        <Sidebar history={chatHistory} onSelectHistory={handleHistorySelect} />

        {/* 오피스 레이아웃 */}
        <section className="flex-1 bg-white/60 backdrop-blur-sm rounded-3xl shadow-soft p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
            우리 오피스의 방들
          </h2>

          {/* 방 카드들 */}
          <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* 첫째 줄: 3개 */}
            {rooms.slice(0, 3).map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onClick={() => handleRoomClick(room)}
              />
            ))}

            {/* 둘째 줄: 2개 (중앙 정렬) */}
            <div className="col-span-3 flex justify-center gap-6">
              {rooms.slice(3, 5).map((room) => (
                <div key={room.id} className="w-1/3">
                  <RoomCard
                    room={room}
                    onClick={() => handleRoomClick(room)}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* 채팅 모달 */}
      {selectedRoom && (
        <ChatModal room={selectedRoom} onClose={handleCloseModal} />
      )}
    </div>
  );
}

export default App;

/**
 * @file src/pages/HomePage.tsx
 * @description 홈 페이지
 * - 테마별 분기: 모던 → HomePage.modern.tsx (MUJI 톤), 모디 → 아래 기본 렌더
 * - 모디 테마: 보라 그라데이션 배경 + DashboardWidgets + BriefingCard + RoomCard 그리드
 */
import { useOutletContext } from 'react-router-dom';
import { rooms, modiSecretary } from '../data';
import { RoomCard } from '../components/RoomCard';
import { DashboardWidgets } from '../components/DashboardWidgets';
import { BriefingCard } from '../components/BriefingCard';
import { LayoutContext } from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { HomePageModern } from './HomePage.modern';

export function HomePage() {
  const { theme } = useTheme();
  if (theme === 'modern') {
    return <HomePageModern />;
  }

  return <HomePageModi />;
}

function HomePageModi() {
  const { openRoom } = useOutletContext<LayoutContext>();

  return (
    <div className="min-h-full bg-gradient-to-br from-primary-50 via-white to-pastel-pink/15 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 대시보드 위젯 */}
        <DashboardWidgets />

        {/* 모디 아침 브리핑 */}
        <BriefingCard onOpenModi={() => openRoom(modiSecretary)} />

        {/* 오피스 방 */}
        <section className="bg-white/60 backdrop-blur-sm rounded-3xl shadow-soft p-4 sm:p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">
            오피스룸
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onClick={() => openRoom(room)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

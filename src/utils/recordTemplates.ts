/**
 * @file src/utils/recordTemplates.ts
 * @description 기록 템플릿 유틸리티
 * - 빈 템플릿 생성 함수
 * - 기록 유형별 레이블/설정 상수
 */
import { RecordType, MorningTemplate, EveningTemplate, WeeklyTemplate, ListField } from '../types';

/** 새 ListField 생성 */
export const newListField = (text = ''): ListField => ({
  id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
  text,
});

/** 빈 아침 일기 템플릿 */
export const emptyMorningTemplate = (): MorningTemplate => ({
  gratitude: [newListField()],
  goodThings: [newListField()],
  affirmation: '',
  ideaTopics: [newListField()],
  ideaFirstSteps: [newListField()],
});

/** 빈 저녁 일기 템플릿 */
export const emptyEveningTemplate = (): EveningTemplate => ({
  greatThings: [newListField()],
  improvement: '',
  extra: '',
});

/** 빈 주간 회고 템플릿 */
export const emptyWeeklyTemplate = (): WeeklyTemplate => ({
  achievements: [newListField()],
  regrets: [newListField()],
  nextGoals: [newListField()],
  lessons: '',
});

/** 기록 유형별 설정 (에너지바 톤 테마) */
export const recordTypeConfig: Record<RecordType, {
  label: string;
  description: string;
  // 타입별 테마 색상
  color: string;         // 도트/강조 (solid)
  bgColor: string;       // 배지/태그 배경
  textColor: string;     // 배지/태그 텍스트
  iconText: string;      // 아이콘 색상
  sectionBg: string;     // 폼 섹션 배경
  labelColor: string;    // 섹션 라벨 텍스트
  accent: string;        // 색상명 (ListFieldEditor용)
  btnBg: string;         // 저장 버튼 배경
  btnHover: string;      // 저장 버튼 hover
  borderAccent: string;  // 인용 보더
  bulletColor: string;   // 리스트 불릿 도트
}> = {
  morning: {
    label: '아침 일기',
    description: '감사, 다짐, 아이디어로 하루 시작',
    color: 'bg-orange-400',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-600',
    iconText: 'text-orange-500',
    sectionBg: 'bg-gray-50/60',
    labelColor: 'text-orange-400',
    accent: 'orange',
    btnBg: 'bg-orange-500',
    btnHover: 'hover:bg-orange-600',
    borderAccent: 'border-orange-200',
    bulletColor: 'bg-orange-300',
  },
  evening: {
    label: '저녁 일기',
    description: '오늘 하루를 돌아보는 시간',
    color: 'bg-fuchsia-400',
    bgColor: 'bg-fuchsia-100',
    textColor: 'text-fuchsia-600',
    iconText: 'text-fuchsia-500',
    sectionBg: 'bg-gray-50/60',
    labelColor: 'text-fuchsia-400',
    accent: 'fuchsia',
    btnBg: 'bg-fuchsia-500',
    btnHover: 'hover:bg-fuchsia-600',
    borderAccent: 'border-fuchsia-200',
    bulletColor: 'bg-fuchsia-300',
  },
  weekly: {
    label: '주간 회고',
    description: '한 주의 성취와 다음 주 목표',
    color: 'bg-pink-400',
    bgColor: 'bg-pink-100',
    textColor: 'text-pink-600',
    iconText: 'text-pink-500',
    sectionBg: 'bg-gray-50/60',
    labelColor: 'text-pink-400',
    accent: 'pink',
    btnBg: 'bg-pink-500',
    btnHover: 'hover:bg-pink-600',
    borderAccent: 'border-pink-200',
    bulletColor: 'bg-pink-300',
  },
  memo: {
    label: '메모',
    description: '자유롭게 기록하는 메모',
    color: 'bg-amber-400',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-600',
    iconText: 'text-amber-500',
    sectionBg: 'bg-amber-50/50',
    labelColor: 'text-amber-400',
    accent: 'amber',
    btnBg: 'bg-amber-500',
    btnHover: 'hover:bg-amber-600',
    borderAccent: 'border-amber-200',
    bulletColor: 'bg-amber-300',
  },
};

/** 기분 이모지 목록 */
export const moods = ['😊', '🤔', '🔥', '😢', '😤', '🥰', '😴'];

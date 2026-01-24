import { Room, ChatHistory } from './types';

export const rooms: Room[] = [
  {
    id: 'strategy',
    name: '전략실',
    emoji: '🎯',
    aiName: '전략이',
    aiModel: 'Claude',
    role: '전략 총괄, 의사결정 서포트',
    personality: '신중하고 구조적',
    color: 'bg-pastel-purple',
  },
  {
    id: 'marketing',
    name: '마케팅룸',
    emoji: '📣',
    aiName: '마케오',
    aiModel: 'GPT',
    role: '마케팅, 콘텐츠 아이디어',
    personality: '창의적, 트렌드 민감',
    color: 'bg-pastel-pink',
  },
  {
    id: 'dev',
    name: '개발실',
    emoji: '💻',
    aiName: '데브',
    aiModel: 'Claude',
    role: '개발, 기술 구현',
    personality: '꼼꼼하고 실용적',
    color: 'bg-pastel-blue',
  },
  {
    id: 'research',
    name: '리서치랩',
    emoji: '🔍',
    aiName: '서치',
    aiModel: 'Perplexity',
    role: '시장조사, 경쟁사 분석, 실시간 정보 검색',
    personality: '꼼꼼하고 데이터 기반, 출처 잘 달음',
    color: 'bg-pastel-mint',
  },
  {
    id: 'meeting',
    name: '회의실',
    emoji: '🏛️',
    aiName: '전체 회의',
    aiModel: 'All',
    role: '여러 AI가 함께 토론',
    personality: '주제 던지면 AI들이 순서대로 의견 냄',
    color: 'bg-pastel-yellow',
  },
];

export const dummyChatHistory: ChatHistory[] = [
  {
    id: '1',
    roomId: 'strategy',
    roomName: '전략실',
    roomEmoji: '🎯',
    lastMessage: '다음 분기 목표에 대해 논의했습니다.',
    timestamp: new Date('2024-01-20T14:30:00'),
  },
  {
    id: '2',
    roomId: 'marketing',
    roomName: '마케팅룸',
    roomEmoji: '📣',
    lastMessage: '인스타그램 콘텐츠 아이디어를 브레인스토밍했어요.',
    timestamp: new Date('2024-01-20T11:00:00'),
  },
  {
    id: '3',
    roomId: 'dev',
    roomName: '개발실',
    roomEmoji: '💻',
    lastMessage: 'API 설계 리뷰를 완료했습니다.',
    timestamp: new Date('2024-01-19T16:45:00'),
  },
  {
    id: '4',
    roomId: 'meeting',
    roomName: '회의실',
    roomEmoji: '🏛️',
    lastMessage: '신규 서비스 런칭 전략 회의',
    timestamp: new Date('2024-01-19T10:00:00'),
  },
  {
    id: '5',
    roomId: 'research',
    roomName: '리서치랩',
    roomEmoji: '🔍',
    lastMessage: '경쟁사 분석 보고서를 작성했습니다.',
    timestamp: new Date('2024-01-18T15:20:00'),
  },
];

export const getDummyResponse = (aiName: string): string => {
  const responses: Record<string, string> = {
    '전략이': `안녕하세요, 저는 전략이입니다! 🎯\n\n전략 총괄을 담당하고 있어요. 비즈니스 의사결정이나 장기 계획에 대해 신중하고 구조적으로 도와드릴게요.\n\n어떤 전략적 고민이 있으신가요?`,
    '마케오': `안녕하세요! 마케오예요! 📣\n\n마케팅과 콘텐츠 아이디어를 담당하고 있어요. 최신 트렌드를 반영한 창의적인 아이디어로 도와드릴게요!\n\n어떤 마케팅 고민이 있으세요?`,
    '데브': `안녕하세요, 데브입니다. 💻\n\n개발과 기술 구현을 담당하고 있습니다. 꼼꼼하고 실용적인 솔루션으로 도와드리겠습니다.\n\n어떤 기술적인 부분을 도와드릴까요?`,
    '서치': `안녕하세요, 서치입니다! 🔍\n\n시장조사와 경쟁사 분석을 담당하고 있어요. 데이터 기반으로 꼼꼼하게 분석하고, 출처도 명확하게 정리해드릴게요.\n\n어떤 정보를 찾아드릴까요?`,
    '전체 회의': `회의실에 오신 것을 환영합니다! 🏛️\n\n이곳에서는 전략이, 마케오, 데브, 서치가 모두 모여 토론을 진행합니다.\n\n주제를 던져주시면 각 AI가 순서대로 의견을 제시할게요. 어떤 주제로 회의를 시작할까요?`,
  };
  return responses[aiName] || '안녕하세요!';
};

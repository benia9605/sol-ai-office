/**
 * @file src/data.ts
 * @description 방/AI 캐릭터 데이터 및 더미 응답
 * - rooms: 5개 방 정보 (이름, AI캐릭터, 모델, 역할, 색상, 이미지 경로)
 * - dummyChatHistory: 사이드바에 표시할 더미 대화 기록
 * - getDummyResponse(): AI API 연동 전 테스트용 더미 응답 생성 함수
 * - AI 연동 후에는 getDummyResponse()가 실제 API 호출로 대체될 예정
 */
import {
  Room, ChatHistory, MenuItem, Project,
  ScheduleItem, TaskItem, InsightItem, ReadingItem, RecordItem,
  ScheduleCategory, InsightSource, ReadingCategory, StudyNote,
} from './types';

export const rooms: Room[] = [
  {
    id: 'strategy',
    name: '전략실',
    emoji: '🎯',
    image: '/images/plani.png',
    aiName: '플래니',
    aiModel: 'Claude',
    role: '전략 총괄, 의사결정 서포트, 우선순위 정리',
    personality: '신중하고 구조적',
    color: 'bg-pastel-purple',
  },
  {
    id: 'marketing',
    name: '마케팅룸',
    emoji: '📣',
    image: '/images/maki.png',
    aiName: '마키',
    aiModel: 'GPT-4',
    role: '마케팅, 콘텐츠 아이디어, 카피라이팅',
    personality: '창의적, 에너지 넘침',
    color: 'bg-pastel-pink',
  },
  {
    id: 'dev',
    name: '개발실',
    emoji: '💻',
    image: '/images/devi.png',
    aiName: '데비',
    aiModel: 'Claude',
    role: '개발, 기술 구현, 코드 리뷰',
    personality: '꼼꼼하고 실용적',
    color: 'bg-pastel-lime',
  },
  {
    id: 'research',
    name: '리서치랩',
    emoji: '🔍',
    image: '/images/searchi.png',
    aiName: '서치',
    aiModel: 'Perplexity',
    role: '시장조사, 경쟁사 분석, 실시간 정보 검색',
    personality: '팩트 중심, 출처 제공',
    color: 'bg-pastel-brown',
  },
  {
    id: 'meeting',
    name: '회의실',
    emoji: '🏛️',
    image: '/images/modi.png',
    aiName: '모디',
    aiModel: 'All',
    role: '회의 진행 & 정리, 비서/회장',
    personality: '정리 잘함, 친근함',
    color: 'bg-pastel-yellow',
  },
];

/** 모디 비서 1:1 채팅용 Room (회의실과 별도) */
export const modiSecretary: Room = {
  id: 'secretary',
  name: '모디 비서',
  emoji: '💛',
  image: '/images/modi.png',
  aiName: '모디',
  aiModel: 'Claude',
  role: '비서, 스케줄 관리, 빠른 질문 응답',
  personality: '친근하고 정리 잘함',
  color: 'bg-pastel-yellow',
};

export const dummyChatHistory: ChatHistory[] = [
  {
    id: '1',
    roomId: 'strategy',
    roomName: '전략실',
    roomEmoji: '🎯',
    roomImage: '/images/plani.png',
    lastMessage: '다음 분기 목표에 대해 논의했습니다.',
    timestamp: new Date('2024-01-20T14:30:00'),
  },
  {
    id: '2',
    roomId: 'marketing',
    roomName: '마케팅룸',
    roomEmoji: '📣',
    roomImage: '/images/maki.png',
    lastMessage: '인스타그램 콘텐츠 아이디어를 브레인스토밍했어요.',
    timestamp: new Date('2024-01-20T11:00:00'),
  },
  {
    id: '3',
    roomId: 'dev',
    roomName: '개발실',
    roomEmoji: '💻',
    roomImage: '/images/devi.png',
    lastMessage: 'API 설계 리뷰를 완료했습니다.',
    timestamp: new Date('2024-01-19T16:45:00'),
  },
  {
    id: '4',
    roomId: 'meeting',
    roomName: '회의실',
    roomEmoji: '🏛️',
    roomImage: '/images/modi.png',
    lastMessage: '신규 서비스 런칭 전략 회의',
    timestamp: new Date('2024-01-19T10:00:00'),
  },
  {
    id: '5',
    roomId: 'research',
    roomName: '리서치랩',
    roomEmoji: '🔍',
    roomImage: '/images/searchi.png',
    lastMessage: '경쟁사 분석 보고서를 작성했습니다.',
    timestamp: new Date('2024-01-18T15:20:00'),
  },
];

// ── 메뉴 & 프로젝트 ──

export const menuItems: MenuItem[] = [
  { id: 'home',      label: '홈',       emoji: '🏠', image: '/images/home.png',     path: '/' },
  { id: 'schedules', label: '일정',     emoji: '📅', image: '/images/schedule.png', path: '/schedules' },
  { id: 'tasks',     label: '할일',     emoji: '✅', image: '/images/todo.png',     path: '/tasks' },
  { id: 'insights',  label: '인사이트', emoji: '💡', image: '/images/insight.png',  path: '/insights' },
  { id: 'readings',  label: '스터디', emoji: '📚', image: '/images/book.png',     path: '/readings' },
  { id: 'records',   label: '기록',     emoji: '📝', image: '/images/diary.png',    path: '/records' },
  { id: 'summaries', label: '대화 요약', emoji: '📋', image: '/images/modi.png',     path: '/summaries' },
];

export const projects: Project[] = [
  { id: 'unmyunglab', name: '운명랩',       emoji: '🔮', color: 'bg-pastel-purple', image: '/images/unmyunglab.png', description: '사주 리포트 자동화 서비스', status: 'active', priority: 1 },
  { id: 'pte',        name: 'PTE',          emoji: '📊', color: 'bg-pastel-lime',   image: '/images/pte.png',        description: 'PTE 한국어 학습 플랫폼',    status: 'active', priority: 2 },
  { id: 'solning',    name: '쏠닝포인트',   emoji: '⚡', color: 'bg-pastel-yellow', image: '/images/solningpoint.png', description: '1인 사업가 성장 플랫폼',   status: 'active', priority: 3 },
];

// ── 일정 카테고리 ──

export const defaultScheduleCategories: ScheduleCategory[] = [
  { id: 'cat-meeting', label: '미팅',  color: '#60a5fa' },
  { id: 'cat-personal', label: '개인', color: '#4ade80' },
  { id: 'cat-routine', label: '루틴',  color: '#c084fc' },
  { id: 'cat-deadline', label: '마감', color: '#f87171' },
  { id: 'cat-etc', label: '기타',      color: '#9ca3af' },
];

export const categoryColorPresets = [
  '#60a5fa', '#4ade80', '#c084fc', '#f87171',
  '#fbbf24', '#f472b6', '#2dd4bf', '#9ca3af',
];

// ── 할일 카테고리 ──

export const defaultTaskCategories: ScheduleCategory[] = [
  { id: 'tcat-dev',      label: '개발',    color: '#4ade80' },
  { id: 'tcat-design',   label: '디자인',  color: '#60a5fa' },
  { id: 'tcat-content',  label: '콘텐츠',  color: '#c084fc' },
  { id: 'tcat-meeting',  label: '미팅',    color: '#fbbf24' },
  { id: 'tcat-admin',    label: '행정',    color: '#9ca3af' },
];

// ── 더미 데이터: 일정 ──

export const dummySchedules: ScheduleItem[] = [
  { id: 's1', title: '운명랩 콘텐츠 기획 회의',  date: '2026-02-20', time: '10:00', project: '운명랩',     color: 'bg-pastel-purple', category: 'cat-meeting',  repeat: 'none',   reminder: 'none', notes: '', tags: ['콘텐츠'] },
  { id: 's2', title: 'PTE 마케팅 전략 미팅',      date: '2026-02-20', time: '14:00', project: 'PTE',        color: 'bg-pastel-lime',   category: 'cat-meeting',  repeat: 'none',   reminder: '10min', notes: '', tags: ['마케팅'] },
  { id: 's3', title: '쏠닝포인트 런칭 준비',       date: '2026-02-21', time: '11:00', project: '쏠닝포인트', color: 'bg-pastel-yellow', category: 'cat-deadline', repeat: 'none',   reminder: '1hour', notes: '베타 테스트 포함', tags: ['런칭'] },
  { id: 's4', title: '주간 회고',                   date: '2026-02-22', time: '09:00', project: '운명랩',     color: 'bg-pastel-purple', category: 'cat-routine',  repeat: 'weekly', reminder: '30min', notes: '', tags: ['회고'] },
];

// ── 더미 데이터: 할일 ──

export const dummyTasks: TaskItem[] = [
  { id: 't1',  title: '운명랩 랜딩페이지 카피 수정',  project: '운명랩',     status: 'in_progress', priority: 'high',   starred: true,  date: '2026-02-21', category: 'tcat-content', pomodoroEstimate: 4, pomodoroCompleted: 2, tags: ['카피'] },
  { id: 't2',  title: 'PTE 광고 소재 제작',            project: 'PTE',        status: 'pending',     priority: 'high',   starred: true,  date: '2026-02-22', category: 'tcat-design',  pomodoroEstimate: 3, pomodoroCompleted: 0, tags: ['마케팅'] },
  { id: 't3',  title: '쏠닝포인트 베타 테스트 준비',    project: '쏠닝포인트', status: 'pending',     priority: 'medium', starred: false, date: '2026-02-25', category: 'tcat-dev' },
  { id: 't4',  title: '블로그 포스트 작성',              project: '운명랩',     status: 'completed',   priority: 'low',    starred: false, date: '2026-02-18', category: 'tcat-content' },
  { id: 't5',  title: '경쟁사 리서치 정리',              project: 'PTE',        status: 'completed',   priority: 'medium', starred: false, date: '2026-02-19' },
  { id: 't6',  title: 'API 문서 업데이트',               project: '쏠닝포인트', status: 'pending',     priority: 'high',   starred: true,  date: '2026-02-19', category: 'tcat-dev', notes: '인증 엔드포인트 추가 반영', tags: ['API', '문서'] },
  { id: 't7',  title: '인스타 콘텐츠 캘린더 작성',       project: '운명랩',     status: 'in_progress', priority: 'medium', starred: false, date: '2026-02-23', category: 'tcat-content', repeat: 'weekly', pomodoroEstimate: 2, pomodoroCompleted: 1 },
  { id: 't8',  title: '서비스 약관 검토',                 project: '쏠닝포인트', status: 'pending',     priority: 'low',    starred: false, date: '2026-02-28', category: 'tcat-admin' },
  { id: 't9',  title: 'UI 디자인 리뷰',                  project: 'PTE',        status: 'pending',     priority: 'medium', starred: false, date: '2026-02-20', category: 'tcat-design', notes: '모바일 반응형 검증 필요' },
  { id: 't10', title: '팀 회의 자료 준비',                project: '운명랩',     status: 'completed',   priority: 'medium', starred: false, date: '2026-02-17', category: 'tcat-meeting' },
  // 매일 루틴
  { id: 't11', title: '아침 운동 30분',                  project: '',           status: 'pending',     priority: 'medium', starred: false, repeat: 'daily' },
  { id: 't12', title: '독서 30분',                        project: '운명랩',     status: 'pending',     priority: 'low',    starred: false, repeat: 'daily' },
  { id: 't13', title: '일기 쓰기',                        project: '',           status: 'pending',     priority: 'low',    starred: false, repeat: 'daily' },
  { id: 't14', title: '코드 리뷰',                        project: '쏠닝포인트', status: 'pending',     priority: 'medium', starred: false, repeat: 'daily' },
  { id: 't15', title: '인스타 콘텐츠 포스팅',              project: '운명랩',     status: 'pending',     priority: 'high',   starred: true,  repeat: 'daily' },
];

// ── 인사이트 출처 ──

export const defaultInsightSources: InsightSource[] = [
  { id: 'plani',     label: '플래니',     image: '/images/plani.png' },
  { id: 'maki',      label: '마키',       image: '/images/maki.png' },
  { id: 'devi',      label: '데비',       image: '/images/devi.png' },
  { id: 'searchi',   label: '서치',       image: '/images/searchi.png' },
  { id: 'modi',      label: '모디',       image: '/images/modi.png' },
];

/**
 * 출처 이미지 선택 시 사용 가능한 이미지 목록
 * - src/assets/sources/ 에 이미지 파일을 넣으면 자동 인식
 * - png, webp, jpg, jpeg, svg, gif 지원
 * - 파일명(확장자 제외)이 hover 시 표시됨
 */
const sourceImageModules = import.meta.glob<string>(
  './assets/sources/*.{png,jpg,jpeg,webp,svg,gif}',
  { eager: true, import: 'default' },
);

// AI 프로필 이미지도 출처 선택 시 사용 가능
const aiProfileImages = [
  '/images/plani.png',
  '/images/maki.png',
  '/images/devi.png',
  '/images/searchi.png',
  '/images/modi.png',
];

export const availableSourceImages: string[] = [
  ...Object.values(sourceImageModules),
  ...aiProfileImages,
];

// ── 더미 데이터: 인사이트 ──

export const dummyInsights: InsightItem[] = [
  { id: 'i1', title: '1인 사업가 AI 도구 트렌드',     content: 'AI 기반 생산성 도구 시장이 2026년 급성장 중. 특히 1인 사업가 대상 맞춤형 솔루션 수요 증가.', source: 'plani',   tags: ['트렌드', 'AI'],         createdAt: '2026-02-19', project: '운명랩',     priority: 'high' },
  { id: 'i2', title: '인스타그램 릴스 알고리즘 변화',  content: '2026년 릴스 노출 알고리즘이 "시청 완료율"에서 "공유 횟수" 중심으로 변경됨.', source: 'maki',    tags: ['마케팅', '인스타그램'], createdAt: '2026-02-18', project: '운명랩',     priority: 'medium' },
  { id: 'i3', title: 'Supabase vs Firebase 비교',      content: 'Supabase가 PostgreSQL 기반으로 더 유연한 쿼리 지원. 실시간 기능도 안정적.', source: 'devi',    tags: ['개발', '백엔드'],       createdAt: '2026-02-17', project: '쏠닝포인트', priority: 'medium' },
];

// ── 독서 카테고리 ──

export const defaultReadingCategories: ReadingCategory[] = [
  { id: 'rcat-book',    label: '도서',    color: '#60a5fa' },
  { id: 'rcat-course',  label: '강좌',    color: '#4ade80' },
  { id: 'rcat-article', label: '아티클',  color: '#fbbf24' },
  { id: 'rcat-podcast', label: '팟캐스트', color: '#c084fc' },
];

// ── 더미 데이터: 독서 ──

export const dummyReadings: ReadingItem[] = [
  { id: 'r1', title: '린 스타트업', author: '에릭 리스', category: 'rcat-book', totalPages: 320, currentPage: 230, status: 'reading', coverEmoji: '🚀', startDate: '2026-02-01', tags: ['스타트업', '린'] },
  { id: 'r2', title: '마케팅 불변의 법칙', author: '알 리스', category: 'rcat-book', totalPages: 250, currentPage: 250, status: 'completed', coverEmoji: '📈', startDate: '2026-01-10', completedDate: '2026-02-15', rating: 4, review: '마케팅의 핵심 원칙을 잘 정리한 명저', tags: ['마케팅'] },
  { id: 'r3', title: 'React 완벽 가이드', author: 'Udemy', category: 'rcat-course', totalLessons: 420, currentLesson: 189, status: 'reading', coverEmoji: '⚛️', startDate: '2026-02-05', tags: ['개발', 'React'], link: 'https://udemy.com' },
  { id: 'r4', title: '부의 추월차선', author: 'MJ 드마코', category: 'rcat-book', status: 'planned', coverEmoji: '💰', tags: ['재테크'] },
];

// ── 더미 데이터: 스터디 노트 ──

export const dummyStudyNotes: StudyNote[] = [
  {
    id: 'sn1', readingId: 'r1', date: '2026-02-20', chapter: '3장 - 검증된 학습',
    content: { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'MVP를 통한 빠른 가설 검증이 핵심' }] },
      { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: '"성공적인 스타트업의 생산성은 물건이나 기능을 많이 만드는 것이 아니라, 어떤 것을 만들어야 할지 학습하는 속도로 측정해야 한다."' }] }] },
      { type: 'paragraph', content: [{ type: 'text', text: '린 방법론의 핵심은 Build-Measure-Learn 사이클을 최대한 빠르게 돌리는 것이다. 가설을 세우고, 최소한의 제품으로 검증하고, 결과를 분석해서 다음 스텝을 결정한다.' }] },
    ] },
    createdAt: '2026-02-20T10:30:00Z',
  },
  {
    id: 'sn2', readingId: 'r1', date: '2026-02-18', chapter: '2장 - 린의 원칙',
    content: { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: '낭비를 줄이고 학습 주기를 짧게 만드는 것이 핵심이다.' }] },
      { type: 'taskList', content: [
        { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '현재 프로젝트에 린 원칙 적용점 정리하기' }] }] },
        { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: '불필요한 기능 목록 작성하기' }] }] },
      ] },
    ] },
    createdAt: '2026-02-18T14:00:00Z',
  },
  {
    id: 'sn3', readingId: 'r3', date: '2026-02-19', chapter: 'Section 12 - useEffect 심화',
    content: {},
    rawText: 'useEffect의 cleanup 함수는 컴포넌트가 unmount 될 때와 다음 effect가 실행되기 전에 호출됩니다. 이는 메모리 누수를 방지하고 이전 구독을 정리하는 데 중요합니다.',
    sections: [
      {
        id: 'sec1',
        title: 'cleanup 함수 실행 타이밍',
        content: { type: 'doc', content: [
          { type: 'paragraph', content: [
            { type: 'text', text: 'cleanup 함수의 실행 타이밍이 중요하다. ' },
            { type: 'text', marks: [{ type: 'highlight' }], text: '컴포넌트 unmount 시와 다음 effect 실행 전에 호출됨.' },
          ] },
        ] },
      },
      {
        id: 'sec2',
        title: '의존성 배열 패턴',
        content: { type: 'doc', content: [
          { type: 'bulletList', content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: '빈 배열 []' }, { type: 'text', text: ' → mount 시 1회만 실행' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: '배열 생략' }, { type: 'text', text: ' → 매 렌더마다 실행' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: '[dep1, dep2]' }, { type: 'text', text: ' → 의존성 변경 시 실행' }] }] },
          ] },
        ] },
      },
    ],
    actionItems: [
      { id: 'ai1', text: '프로젝트 내 useEffect cleanup 누락된 곳 점검', checked: false },
      { id: 'ai2', text: 'WebSocket 구독 해제 패턴 적용', checked: true },
    ],
    createdAt: '2026-02-19T16:00:00Z',
  },
];

// ── 더미 데이터: 기록 ──

export const dummyRecords: RecordItem[] = [
  {
    id: 'rec1', recordType: 'morning', date: '2026-02-25', time: '07:30',
    title: '새로운 한 주의 시작', mood: '😊', energy: 4,
    tags: ['루틴', '감사'],
    morningData: {
      gratitude: [
        { id: 'g1', text: '건강한 몸으로 아침을 맞이할 수 있어서' },
        { id: 'g2', text: 'Teamie가 점점 완성되어 가는 것' },
      ],
      goodThings: [
        { id: 'gt1', text: '맑은 날씨에 아침 산책' },
        { id: 'gt2', text: '좋아하는 커피 한 잔' },
      ],
      affirmation: '오늘도 집중해서 의미 있는 한 걸음을 내딛자',
      ideaTopics: [
        { id: 'it1', text: '기록 페이지에 AI 요약 기능 추가' },
      ],
      ideaFirstSteps: [
        { id: 'if1', text: 'Claude API로 주간 회고 자동 요약 프로토타입' },
      ],
    },
    createdAt: '2026-02-25T07:30:00Z',
  },
  {
    id: 'rec2', recordType: 'evening', date: '2026-02-24', time: '22:00',
    title: '생산적인 하루', mood: '🥰', energy: 3,
    tags: ['개발', '회고'],
    eveningData: {
      greatThings: [
        { id: 'et1', text: '기록 페이지 디자인 완성' },
        { id: 'et2', text: '운동 30분 달성' },
      ],
      improvement: '점심 후 집중력이 떨어졌다. 짧은 낮잠을 시도해볼 것.',
      extra: '구조화된 기록이 생각 정리에 큰 도움이 된다는 걸 느꼈다.',
    },
    createdAt: '2026-02-24T22:00:00Z',
  },
  {
    id: 'rec3', recordType: 'weekly', date: '2026-02-23',
    title: '2월 4주차 회고', mood: '🔥', energy: 4,
    tags: ['주간회고', '성장'],
    weeklyData: {
      achievements: [
        { id: 'wa1', text: '인사이트 페이지 완성' },
        { id: 'wa2', text: '독서 페이지 + 스터디 노트 기능 구현' },
        { id: 'wa3', text: '린 스타트업 70% 읽기' },
      ],
      regrets: [
        { id: 'wr1', text: '운동을 3일밖에 못 했다' },
        { id: 'wr2', text: 'PTE 마케팅 일정 지연' },
      ],
      nextGoals: [
        { id: 'wn1', text: '기록 페이지 구현 완료' },
        { id: 'wn2', text: '매일 운동 30분 실천' },
        { id: 'wn3', text: 'AI API 연동 시작' },
      ],
      lessons: '작은 성취도 기록으로 남기면 동기부여가 된다. MVP 마인드셋으로 빠르게 완성하고 개선하자.',
    },
    createdAt: '2026-02-23T21:00:00Z',
  },
  {
    id: 'rec4', recordType: 'memo', date: '2026-02-22',
    title: '회의 아이디어 메모',
    memoBody: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: '회의실 기능 브레인스토밍' }] },
        { type: 'bulletList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '멀티 AI 순차 응답 구현' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '회의록 자동 생성 (모디가 정리)' }] }] },
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '액션 아이템 추출 → 할일 자동 연동' }] }] },
        ] },
      ],
    },
    createdAt: '2026-02-22T15:30:00Z',
  },
  {
    id: 'rec5', recordType: 'morning', date: '2026-02-21', time: '08:00',
    title: '금요일 아침', mood: '🤔', energy: 3,
    tags: ['루틴'],
    morningData: {
      gratitude: [
        { id: 'g3', text: '이번 주도 건강하게 보낸 것' },
      ],
      goodThings: [
        { id: 'gt3', text: '금요일이라 마음이 가벼움' },
      ],
      affirmation: '이번 주 마무리를 잘 짓자',
      ideaTopics: [
        { id: 'it2', text: '노션 연동 우선순위 검토' },
      ],
      ideaFirstSteps: [
        { id: 'if2', text: 'Notion API 문서 읽기' },
      ],
    },
    createdAt: '2026-02-21T08:00:00Z',
  },
];

export const getDummyResponse = (aiName: string, roomId?: string): string => {
  // 비서 모디 (FAB) vs 회의실 모디 구분
  if (aiName === '모디' && roomId === 'secretary') {
    return `안녕하세요 Sol님! 비서 모디입니다 💛\n\n무엇이든 물어보세요. 일정 확인, 할일 정리, 빠른 질문 등 도와드릴게요!\n\n오늘 하루도 파이팅이에요!`;
  }

  const responses: Record<string, string> = {
    '플래니': `안녕하세요, 저는 플래니입니다!\n\n전략 총괄을 담당하고 있어요. 비즈니스 의사결정이나 장기 계획에 대해 신중하고 구조적으로 도와드릴게요.\n\n어떤 전략적 고민이 있으신가요?`,
    '마키': `안녕하세요! 마키예요!\n\n마케팅과 콘텐츠 아이디어를 담당하고 있어요. 최신 트렌드를 반영한 창의적인 아이디어로 도와드릴게요!\n\n어떤 마케팅 고민이 있으세요?`,
    '데비': `안녕하세요, 데비입니다.\n\n개발과 기술 구현을 담당하고 있습니다. 꼼꼼하고 실용적인 솔루션으로 도와드리겠습니다.\n\n어떤 기술적인 부분을 도와드릴까요?`,
    '서치': `안녕하세요, 서치입니다!\n\n시장조사와 경쟁사 분석을 담당하고 있어요. 데이터 기반으로 꼼꼼하게 분석하고, 출처도 명확하게 정리해드릴게요.\n\n어떤 정보를 찾아드릴까요?`,
    '모디': `회의실에 오신 것을 환영합니다!\n\n저는 모디, 회의 진행을 맡고 있어요. 이곳에서는 플래니, 마키, 데비, 서치가 모두 모여 토론을 진행합니다.\n\n주제를 던져주시면 각 AI가 순서대로 의견을 제시할게요. 어떤 주제로 회의를 시작할까요?`,
  };
  return responses[aiName] || '안녕하세요!';
};

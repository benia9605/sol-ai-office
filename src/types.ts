/**
 * @file src/types.ts
 * @description 전역 TypeScript 타입 정의
 * - Room: 각 방(전략실, 마케팅룸 등)의 데이터 구조
 * - ChatMessage: 채팅 메시지 (유저/AI 구분, 중요 표시)
 * - ChatHistory: 사이드바에 표시되는 대화 히스토리 항목
 * - SaveType: 메시지 저장 메뉴 종류
 * - SaveData: 저장 모달에서 사용하는 데이터 구조
 * - 모든 컴포넌트에서 import하여 사용
 */
export interface Room {
  id: string;
  name: string;
  emoji: string;
  image: string;
  aiName: string;
  aiModel: string;
  role: string;
  personality: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: Date;
  isStarred?: boolean;
  aiName?: string;      // 회의실: 어떤 AI가 보낸 메시지인지
  aiImage?: string;     // 회의실: AI 아바타 이미지
  isSystem?: boolean;   // 시스템 메시지 (새 회의 구분선 등)
  extractedActions?: import('./utils/actionExtractor').ExtractedAction[];  // 자동 추출된 액션
}

export interface ChatHistory {
  id: string;
  roomId: string;
  roomName: string;
  roomEmoji: string;
  roomImage: string;
  lastMessage: string;
  timestamp: Date;
}

/** 일정 카테고리 */
export interface ScheduleCategory {
  id: string;
  label: string;
  color: string;
}

/** 반복 유형 */
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/** 메시지 저장 메뉴 종류 */
export type SaveType = 'schedule' | 'task' | 'insight' | 'record' | 'study';

/** 저장 모달 설정 */
export interface SaveModalConfig {
  type: SaveType;
  message: ChatMessage;
  room: Room;
  prefilledTitle?: string;
  prefilledDate?: string;
  prefilledPriority?: 'high' | 'medium' | 'low';
}

/** 저장 모달 공통 데이터 */
export interface SaveData {
  title: string;
  content: string;
  source: string;
  project: string;
  tags: string[];
  date?: string;
  time?: string;
  category?: string;
  repeat?: RepeatType;
  reminder?: string;
  notes?: string;
  priority?: 'high' | 'medium' | 'low';
  pomodoroEstimate?: number;
  goalId?: string;
  link?: string;
  readingId?: string;            // 스터디 기록: 연결할 독서 아이템
  chapter?: string;              // 스터디 기록: 챕터
}

/** 사이드바 메뉴 항목 */
export interface MenuItem {
  id: string;
  label: string;
  emoji: string;
  image: string;
  path: string;
}

/** 프로젝트 */
export interface Project {
  id: string;
  name: string;
  emoji: string;
  color: string;
  image?: string;
  description?: string;
  status?: string;       // 'active' | 'paused' | 'completed'
  priority?: number;
  startDate?: string;    // YYYY-MM-DD
  endDate?: string;      // YYYY-MM-DD
}

/** 목표 유형 */
export type GoalType = 'kpi' | 'task' | 'mixed';

/** 목표 (프로젝트 하위) */
export interface GoalItem {
  id: string;
  projectId: string;
  title: string;
  type: GoalType;
  startDate?: string;    // YYYY-MM-DD
  endDate?: string;      // YYYY-MM-DD
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold';
  progress: number;      // 0-100
  notes?: string;
  createdAt: string;
}

/** KPI (목표 하위, 수치 추적) */
export interface KpiItem {
  id: string;
  goalId: string;
  name: string;
  currentValue: number;
  targetValue: number;
  startValue: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

/** KPI 기록 */
export interface KpiLog {
  id: string;
  kpiId: string;
  value: number;
  date: string;
  note?: string;
  createdAt: string;
}

/** 일정 항목 */
export interface ScheduleItem {
  id: string;
  title: string;
  date: string;
  time: string;
  project: string;
  color: string;
  category?: string;
  repeat?: RepeatType;
  reminder?: string;
  notes?: string;
  tags?: string[];
}

/** 할일 상태 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

/** 할일 항목 */
export interface TaskItem {
  id: string;
  title: string;
  project: string;
  goalId?: string;
  status: TaskStatus;
  priority: 'high' | 'medium' | 'low';
  starred: boolean;
  date?: string;
  category?: string;
  notes?: string;
  repeat?: RepeatType;
  tags?: string[];
  pomodoroEstimate?: number;
  pomodoroBreakMin?: number;
  pomodoroCompleted?: number;
  conversationId?: string;
}

/** 인사이트 출처 */
export interface InsightSource {
  id: string;
  label: string;
  image: string;              // 이미지 경로 (public/ 기준)
}

/** 인사이트 항목 */
export interface InsightItem {
  id: string;
  title: string;
  content: string;
  source: string;             // 출처 ID (plani, youtube, web 등)
  link?: string;              // 참고 URL
  tags: string[];
  createdAt: string;          // 기록일 (YYYY-MM-DD)
  time?: string;              // 기록시간 (HH:MM)
  project?: string;           // 프로젝트
  priority?: 'high' | 'medium' | 'low';  // 중요도
}

/** 독서 종류 카테고리 */
export interface ReadingCategory {
  id: string;
  label: string;
  color: string;
}

/** 독서/학습 항목 */
export interface ReadingItem {
  id: string;
  title: string;
  author: string;
  category: string;              // 카테고리 ID (도서, 강좌, 커스텀 등)
  totalPages?: number;           // 책: 총 페이지
  currentPage?: number;          // 책: 현재 페이지
  totalLessons?: number;         // 강의: 총 강수
  currentLesson?: number;        // 강의: 현재 강
  status: 'reading' | 'completed' | 'planned';
  coverEmoji: string;
  coverImage?: string;             // 커버 이미지 (base64 또는 Supabase URL)
  startDate?: string;
  completedDate?: string;        // 완료일
  rating?: number;               // 1~5 별점
  review?: string;               // 한줄평
  tags?: string[];
  link?: string;                 // 외부 URL
  price?: number;                // 가격
  toc?: string;                  // 목차 원본 (HTML)
  chapters?: string[];           // 파싱된 챕터 목록 (노트 작성 시 드롭다운용)
  isbn13?: string;               // ISBN13 (알라딘 연동용)
}

/** 강좌 노트 요약 섹션 */
export interface NoteSection {
  id: string;
  title: string;
  content: Record<string, unknown>;  // Tiptap JSON
}

/** 강좌 노트 액션 아이템 */
export interface NoteActionItem {
  id: string;
  text: string;
  checked: boolean;
}

/** 스터디 노트 (독서 아이템에 연결) */
export interface StudyNote {
  id: string;
  readingId: string;             // 연결된 ReadingItem ID
  date: string;                  // YYYY-MM-DD
  time?: string;                 // HH:mm
  chapter?: string;              // 챕터/섹션명
  content: Record<string, unknown>;  // Tiptap JSON (도서용)
  // 강좌용 필드
  rawText?: string;              // 원본 텍스트 (녹음 텍스트 등)
  sections?: NoteSection[];      // 요약 섹션들
  actionItems?: NoteActionItem[]; // 액션 아이템 체크리스트
  createdAt: string;
  updatedAt?: string;
}

/** 기록 유형 */
export type RecordType = 'morning' | 'evening' | 'weekly' | 'memo';

/** 리스트 필드 (템플릿 내 항목) */
export interface ListField { id: string; text: string; }

/** 아침 일기 템플릿 */
export interface MorningTemplate {
  gratitude: ListField[];       // 감사하게 여기는 것들
  goodThings: ListField[];      // 오늘을 기분 좋게 만드는 것
  affirmation: string;          // 오늘의 다짐
  ideaTopics: ListField[];      // 아이디어 주제
  ideaFirstSteps: ListField[];  // 실행할 첫 단계
}

/** 저녁 일기 템플릿 */
export interface EveningTemplate {
  greatThings: ListField[];     // 굉장한 일
  improvement: string;          // 더 좋은 날로 만들었나
  extra: string;                // 추가 / 오늘의 배움
}

/** 주간 회고 템플릿 */
export interface WeeklyTemplate {
  achievements: ListField[];    // 이번 주 성취
  regrets: ListField[];         // 아쉬웠던 점
  nextGoals: ListField[];       // 다음 주 목표
  lessons: string;              // 배운 것
}

/** 기록 항목 */
export interface RecordItem {
  id: string;
  recordType: RecordType;
  date: string;
  time?: string;
  title: string;
  mood?: string;
  energy?: number;              // 1-5
  tags?: string[];
  conversationId?: string;
  morningData?: MorningTemplate;
  eveningData?: EveningTemplate;
  weeklyData?: WeeklyTemplate;
  memoBody?: Record<string, unknown>; // Tiptap JSON
  createdAt: string;
}

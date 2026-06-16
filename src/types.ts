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

// ── 공유 워크스페이스 ──

/** 워크스페이스 종류: 개인 공간(자기계발) / 회사 오피스 */
export type WorkspaceType = 'personal' | 'office';

/** 워크스페이스 (사람 묶음 = 권한 경계) */
export interface Workspace {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  imageUrl?: string;     // 프로필 이미지 (URL 또는 base64)
  bizInfo?: string;      // 사업 정보 (어디서 하는 사업인지 · office용)
  type: WorkspaceType;
  inviteCode?: string;
  credits?: number;      // 코인 잔액 (직원 실행 시 토큰 비용만큼 차감)
  createdBy: string;
  createdAt: string;
}

/** 워크스페이스 멤버 */
export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: 'owner' | 'member';
  nickname?: string;
  joinedAt: string;
  // 표시용(조인) — 선택
  email?: string;
  name?: string;
}

/** 이메일 초대 (가입 전 pending) */
export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
}

/**
 * 현재 선택된 워크스페이스 컨텍스트.
 * - null = 🌐 통합(모든 워크스페이스 모아보기)
 * - 그 외 = 해당 워크스페이스만
 */
export type ActiveWorkspace = string | null;

// ── AI 직원 시스템 (회사 오피스) ──

/** 직원 산출물 종류 — 상세 UI 분기 키 */
export type OutputKind =
  | 'sourcing_brief' | 'detail_builder' | 'ticket_list'
  | 'sns_queue' | 'copy_variants' | 'monitor_digest' | 'image_brief'
  | 'generation_log' | 'keyword_table' | 'metric_digest' | 'review_diff'
  | 'ops_digest';

/** 직접 시키기(수동) 입력 폼 필드 */
export interface StaffInputField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'duration';
  options?: string[];
  placeholder?: string;
  required?: boolean;
  showFor?: string[];  // 특정 모드에서만 표시 (없으면 항상 표시)
}

/** 직원 타입 정의 (코드 카탈로그 상수) */
/**
 * 직원이 쓰는 AI 모델
 * - sonnet/haiku/opus: Anthropic Claude
 * - gpt: OpenAI GPT-4o (마케팅 카피 강점)
 * - research: Perplexity 검색 → Claude 구조화 2단계 (실시간 시장조사)
 */
export type StaffModel = 'sonnet' | 'haiku' | 'opus' | 'gpt' | 'research';

export interface StaffTypeDef {
  key: string;
  label: string;
  emoji: string;
  roleLine: string;           // 역할 한 줄
  features: string[];         // 3대 기능
  outputKind: OutputKind;
  defaultModel: StaffModel;   // 타입별 기본 모델(채용 시 적용, 변경 가능)
  defaultRoutines: string[];  // 기본 일과
  defaultPrompt: string;      // 채용 시 미리 채워지는 기본 프롬프트(편집 가능)
  promptPlaceholder: string;  // 비었을 때 힌트
}

/** 고용된 직원 (DB) */
export interface Staff {
  id: string;
  workspaceId: string;
  typeKey: string;
  name: string;
  prompt: string;
  model: StaffModel;
  state: 'working' | 'idle';
  createdAt: string;
}

/** 직원 실행 사용 로그 (코인/토큰 기록 · DB staff_usage) */
export interface StaffUsage {
  id: string;
  workspaceId: string;
  staffId?: string;
  reportId?: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  coins: number;
  createdAt: string;
}

/** 직원 보관함 항목 (DB staff_saved_items) — 리포트에서 ⭐로 저장한 산출물 */
export interface StaffSavedItem {
  id: string;
  workspaceId: string;
  staffId?: string;
  outputKind?: string;
  itemType?: string;
  payload: Record<string, unknown>;
  note?: string;
  createdAt: string;
}

/** 직원 일과 (DB) */
export interface StaffRoutine {
  id: string;
  staffId: string;
  label: string;
  schedule: 'realtime' | 'daily' | 'weekly' | 'monthly';
  runAt?: string;         // 'HH:MM'
  dayOfWeek?: number;     // weekly: 0(일)~6(토)
  dayOfMonth?: number;    // monthly: 1~31
  enabled: boolean;
}

/**
 * 회사 브레인 (워크스페이스 1:1) — AI 직원 시스템 프롬프트 ①계층
 * 사장이 직접 입력. brand_contexts 테이블(009).
 */
export interface BrandContext {
  id: string;
  workspaceId: string;
  identity?: string;       // 정체성 한 줄
  category?: string;       // 카테고리
  tone?: string;           // 톤앤매너
  target?: string;         // 주요 타겟
  usp?: string;            // 핵심 USP (줄바꿈 구분)
  channels?: string;       // 판매 채널
  pricePosition?: string;  // 가격 포지셔닝
  adAngle?: string;        // 광고 소구점
  compliance?: string;     // 금지표현/컴플라이언스 (줄바꿈 구분)
  mainProducts?: string;   // 주력 상품
  priceRange?: string;     // 대표 가격대
  competitors?: string;    // 주요 경쟁사
  story?: string;          // 창업 스토리/차별점
  csPolicies?: string;     // CS 정책 (배송/교환/환불/파손 기준)
  csTone?: string;         // CS 응대 톤 (공감강도·이모지·환불태도)
  raw?: string;            // 자유 서술
  version?: number;
  updatedAt?: string;
}

/** 리포트 트리거 / 상태 */
export type ReportTrigger = 'auto' | 'manual';
export type ReportStatus = 'done' | 'failed';

/** 리포트 코멘트 (사장 의견) */
export interface ReportComment { text: string; at: string; }

/** 직원 일일 리포트 (DB) — 실행 원장 + 산출물 통합 */
export interface DailyReport {
  id: string;
  workspaceId: string;
  staffId: string;
  date: string;          // YYYY-MM-DD
  title: string;
  summary: string;
  body: string;          // 마크다운 본문
  trigger?: ReportTrigger;            // auto(일과) | manual(지금 시키기)
  outputKind?: OutputKind;
  contentJson?: Record<string, unknown> | null;  // 구조화 출력
  input?: Record<string, unknown> | null;        // 수동 입력
  status?: ReportStatus;
  error?: string;
  model?: string;
  comments?: ReportComment[];
  createdAt: string;
}

/** AI 액션 상태 / 종류 */
export type ActionStatus = 'suggested' | 'approved' | 'dismissed';
export type ActionType = 'schedule' | 'task' | 'insight';

/** AI 직원이 제안한 액션 (승인 큐 — HITL) */
export interface StaffOutputAction {
  id: string;
  workspaceId: string;
  staffId?: string;
  reportId?: string;
  type: ActionType;
  status: ActionStatus;
  payload: Record<string, unknown>;   // 액션 내용(제목·날짜·우선순위 등)
  promotedId?: string;                // 승인 시 생성된 실제 row id
  approvedAt?: string;
  createdAt: string;
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
  workspaceId?: string;  // 소속 워크스페이스 (개인/팀)
  isShared?: boolean;
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
  endDate?: string;
  time: string;
  project: string;
  color: string;
  category?: string;
  repeat?: RepeatType;
  reminder?: string;
  notes?: string;
  tags?: string[];
  workspaceId?: string;
  isShared?: boolean;
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
  // ── 공유 워크스페이스 ──
  workspaceId?: string;
  isShared?: boolean;
  assigneeId?: string;     // 담당자(추천받은 사람)
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
  starred?: boolean;          // 즐겨찾기 (상단 고정용)
  workspaceId?: string;
  isShared?: boolean;
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
  workspaceId?: string;
  isShared?: boolean;
  recommendedBy?: string;        // 추천한 멤버
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
  chapter?: string[];            // 챕터/섹션명 (복수 선택 가능)
  content: Record<string, unknown>;  // Tiptap JSON (도서용)
  // 강좌용 필드
  rawText?: string;              // 원본 텍스트 (녹음 텍스트 등)
  sections?: NoteSection[];      // 요약 섹션들
  actionItems?: NoteActionItem[]; // 액션 아이템 체크리스트
  createdAt: string;
  updatedAt?: string;
  workspaceId?: string;
  isShared?: boolean;
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
  project?: string;             // 연결된 프로젝트명
  conversationId?: string;
  morningData?: MorningTemplate;
  eveningData?: EveningTemplate;
  weeklyData?: WeeklyTemplate;
  memoBody?: Record<string, unknown>; // Tiptap JSON
  createdAt: string;
  workspaceId?: string;
  isShared?: boolean;             // 일기는 기본 false(비공개)
}

// ── 콘텐츠 (유튜브) ──

/** 연결된 유튜브 채널 */
export interface YoutubeChannel {
  id: string;                  // 내부 row id
  channelId: string;           // 유튜브 채널 ID (UC...)
  title: string;
  thumbnail?: string;
  subscriberCount?: number;
  videoCount?: number;
  connectedAt?: string;
}

/** 유튜브 영상 (채널 하위) */
export interface YoutubeVideo {
  id: string;
  channelId: string;           // 유튜브 채널 ID
  videoId: string;             // 유튜브 영상 ID
  title: string;
  thumbnail?: string;
  publishedAt: string;         // ISO
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  script?: string;             // 영상 자막/스크립트 (답글 생성 맥락용)
}

/** 답글 상태: 없음 / 초안 작성됨 / 발행됨 */
export type YoutubeReplyStatus = 'none' | 'draft' | 'published';

/** 유튜브 댓글 (영상 하위) */
export interface YoutubeComment {
  id: string;
  commentId: string;           // 유튜브 댓글 ID
  videoId: string;             // 유튜브 영상 ID
  channelId: string;           // 유튜브 채널 ID
  author: string;
  authorThumbnail?: string;
  text: string;
  publishedAt: string;         // ISO
  likeCount?: number;
  replyStatus: YoutubeReplyStatus;
  replyDraft?: string;         // AI 초안 또는 수동 수정본
  repliedAt?: string;          // 발행 시각
}

/** 주간 콘텐츠 집계 (그래프 추이용) */
export interface YoutubeWeeklyStat {
  week: string;                // 'YYYY-Www' 또는 'M월 N주' 라벨
  views: number;
  comments: number;
  videos: number;
}

/** 알림 설정 (프론트 camelCase) */
export interface NotificationPreferences {
  taskDeadline: boolean;       // 마감 D-1, D-Day
  taskOverdue: boolean;        // 미완료 자정 알림
  morningRoutine: boolean;     // 매일 9시 루틴 체크
  scheduleReminder: boolean;   // 일정 N분전
  morningBriefing: boolean;    // 매일 8시 브리핑
  pomodoroDone: boolean;       // 뽀모도로 종료
  morningJournal: boolean;     // 아침 일기 리마인더 (9시)
  eveningJournal: boolean;     // 저녁 일기 리마인더 (9시)
}

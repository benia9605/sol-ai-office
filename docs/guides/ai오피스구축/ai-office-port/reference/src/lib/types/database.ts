// ============================================================
// DB types — mirrors supabase/migrations/*.sql.
// When schema changes, update this file + fixtures + data layer.
// ============================================================

export type WorkspaceRole = "owner" | "admin" | "member" | "guest";
export type ProfileRole = "member" | "admin";

export type UserProfile = {
  user_id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  industry: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  terms_agreed: boolean;
  privacy_agreed: boolean;
  marketing_agreed: boolean;
  role: ProfileRole;
  /** 가입 출처 — 'dangil'(딴길 비전보드 경유) | 'meetup' | null(미상). 마이그레이션 053. */
  signup_source?: string | null;
  created_at: string;
  updated_at: string;
};

export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  invite_code: string;
  /** 가입 승인 후 멤버가 처음 들어왔을 때 모달로 보여줄 환영 메시지. */
  welcome_message: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  nickname: string | null;
  joined_at: string;
};

/**
 * 일정 종류 — 모임/인터뷰/컨텐츠/촬영 ... 워크스페이스 관리자가 관리.
 * 캘린더 / 리스트 / 폼에서 컬러 배지로 구분된다.
 */
export type MeetingType = {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/**
 * 일정 — 미팅(모임) 자체. 시간·장소·참석자.
 * 회의 내용(아젠다 · 본문)은 분리되어 MeetingNote 에 산다.
 */
export type Meeting = {
  id: string;
  workspace_id: string;
  type_id: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

/**
 * 회의록 — 일정 안에서 또는 카톡 등에서 나눈 회의 기록.
 * `meeting_id` 가 비어 있으면 어떤 일정에도 묶이지 않은 단독 회의록.
 */
export type MeetingNote = {
  id: string;
  workspace_id: string;
  meeting_id: string | null;
  title: string;
  agenda: string | null;
  content: string | null;
  summary: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type MeetingAttendeeStatus = "attending" | "absent" | "late";

export type MeetingAttendee = {
  meeting_id: string;
  user_id: string;
  status: MeetingAttendeeStatus;
  /** 지각/불참 사유 (041). */
  reason?: string | null;
  /** 응답 작성 시각 (041). null 이면 아직 응답 안 함. */
  responded_at?: string | null;
};

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type ProjectStatus = "active" | "paused" | "done";

export type Project = {
  id: string;
  workspace_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  status: ProjectStatus;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
};

export type GoalStatus = "active" | "paused" | "done";

export type Goal = {
  id: string;
  project_id: string;
  title: string;
  type: string | null;
  progress: number;
  status: GoalStatus;
  owner_id: string | null;
  created_at: string;
};

export type Kpi = {
  id: string;
  goal_id: string;
  name: string;
  current_value: number;
  target_value: number;
  unit: string | null;
  created_at: string;
};

/**
 * 활동 로그. 도메인 변경 시 append-only 로 한 줄 남긴다.
 *
 *  action 키는 string 으로 유연하게 두지만, 코드에서 자주 쓰는 값은:
 *    'created_task' | 'completed_task'
 *    'created_meeting' | 'created_meeting_note'
 *    'shared_insight' | 'liked_insight' | 'commented_insight'
 *    'joined_workspace'
 */
export type Activity = {
  id: string;
  workspace_id: string;
  user_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/**
 * 비전보드 카드 — 네 가지 타입.
 *  - text:  자유 메모 (북극성, 가치관 등)
 *  - goal:  진행률 0~100 의 목표
 *  - image: 이미지 카드 (URL + 캡션)
 *  - quote: 명언 / 좌우명 (본문 + 출처)
 *
 * `emoji` / `accent` 는 모든 타입에 옵션. 표시는 카드 좌상단.
 */
export type VisionAccent = "teal" | "rose" | "sage" | "tan" | "slate";
export type VisionTheme = "cream" | "mist" | "sage" | "rose" | "stone";

/**
 * 카드 옵션 — 좌표(x,y,w,h) 는 데스크탑 자유 배치 모드에서만 사용.
 * 모바일은 좌표 무시하고 자동 그리드로 폴백.
 */
type VisionBaseExtras = {
  emoji?: string;
  accent?: VisionAccent;
  /** 자유 배치 좌표 (px). null 이면 자동 그리드. */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  /** 이 카드에서 다른 카드로 향하는 연결선 (target item id 리스트). */
  connections?: string[];
};

export type VisionBoardItem =
  | ({
      type: "text";
      id: string;
      title: string;
      body: string;
    } & VisionBaseExtras)
  | ({
      type: "goal";
      id: string;
      title: string;
      progress: number;
    } & VisionBaseExtras)
  | ({
      type: "image";
      id: string;
      title: string;
      url: string;
      caption?: string;
    } & VisionBaseExtras)
  | ({
      type: "quote";
      id: string;
      body: string;
      attribution?: string;
    } & VisionBaseExtras);

export type VisionBoard = {
  /** 037 — UUID PK. 사용자당 여러 보드 가능. */
  id: string;
  user_id: string;
  title: string;
  items: VisionBoardItem[];
  is_public: boolean;
  /** 031 — 보드 배경 테마. */
  theme: VisionTheme;
  created_at: string;
  updated_at: string;
};

export type VisionLinkTargetType = "task" | "insight" | "meeting_note";

export type VisionItemLink = {
  id: string;
  owner_user_id: string;
  item_id: string;
  target_type: VisionLinkTargetType;
  target_id: string;
  created_at: string;
};

export type InsightStatus = "draft" | "published";

export type Insight = {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  content: string | null;
  source: string | null;
  tags: string[];
  is_shared: boolean;
  /** 029 — 임시저장(draft) 또는 발행(published). */
  status: InsightStatus;
  created_at: string;
  updated_at: string;
};

export type InsightLike = {
  insight_id: string;
  user_id: string;
  created_at: string;
};

export type InsightComment = {
  id: string;
  insight_id: string;
  user_id: string;
  content: string;
  /** 048 — null 이면 최상위 댓글, 값 있으면 그 댓글에 대한 답글. */
  parent_id?: string | null;
  created_at: string;
};

export type WritingStatus = "draft" | "published";
export type WritingSourceType = "editor" | "external_blog";

export type Writing = {
  id: string;
  workspace_id: string;
  user_id: string;
  /** Legacy 013 컬럼 — 새 코드는 template_id 사용. */
  template_key: string;
  /** 024 — DB writing_templates 참조. */
  template_id: string | null;
  /** 027 — 속한 챌린지(readings.id). null 이면 자유 글. */
  challenge_id: string | null;
  title: string;
  content: string;
  source_type: WritingSourceType;
  external_url: string | null;
  external_thumbnail: string | null;
  external_excerpt: string | null;
  written_date: string;
  word_count: number | null;
  is_shared: boolean;
  status: WritingStatus;
  created_at: string;
  updated_at: string;
};

export type WritingTemplate = {
  id: string;
  /** null = 시스템 전체 템플릿. */
  workspace_id: string | null;
  name: string;
  description: string | null;
  emoji: string | null;
  category: string | null;
  /** { body: string } 형태 (Tiptap 도입 후 doc 필드 추가 예정). */
  structure: { body?: string; [k: string]: unknown };
  is_system: boolean;
  created_by: string | null;
  created_at: string;
};

/** Legacy from migration 012 — 새 코드에선 사용 안 함 (recommended_by 가 대체). */
export type ReadingKind = "personal" | "recommended";

/** v2 스펙: planned / reading / completed (마이그레이션 022 에서 교체). */
export type ReadingStatus = "planned" | "reading" | "completed";

/**
 * 챌린지 종류:
 *  - rcat-book   책 (알라딘 검색 / 페이지 진행)
 *  - rcat-course 강의 (회차 진행)
 *  - rcat-writing 글쓰기 챌린지 (예: '이번 분기 회고 10편') — 책/강의 메타 없음
 */
export type ReadingCategory =
  | "rcat-book"
  | "rcat-course"
  | "rcat-writing"
  | (string & {});

/** 노트 본문 소스 — 앱 에디터 / 외부 블로그 불러오기. */
export type ReadingNoteSourceType = "editor" | "external_blog";

export type WritingLike = {
  writing_id: string;
  user_id: string;
  created_at: string;
};

export type WritingComment = {
  id: string;
  writing_id: string;
  user_id: string;
  content: string;
  parent_id?: string | null;
  created_at: string;
};

export type ReadingLike = {
  reading_id: string;
  user_id: string;
  created_at: string;
};

export type ReadingComment = {
  id: string;
  reading_id: string;
  user_id: string;
  content: string;
  parent_id?: string | null;
  created_at: string;
};

export type Reading = {
  id: string;
  workspace_id: string;
  user_id: string;
  // 기본
  title: string;
  author: string | null;
  category: ReadingCategory;
  cover_emoji: string;
  cover_image: string | null;
  // 진행률
  status: ReadingStatus;
  current_page: number | null;
  total_pages: number | null;
  current_lesson: number | null;
  total_lessons: number | null;
  start_date: string | null;
  /** 챌린지 목표 완료일 (026). null 이면 무기한. */
  target_end_date: string | null;
  completed_date: string | null;
  // 후기
  rating: number | null;
  review: string | null;
  // 외부 메타 (알라딘 응답 기반)
  tags: string[] | null;
  link: string | null;
  price: number | null;
  isbn13: string | null;
  // 목차 (chapters 가 source-of-truth, toc 는 원본 raw 디버깅용)
  toc: string | null;
  chapters: string[] | null;
  // 챌린지/공유
  is_shared: boolean;
  recommended_by: string | null;
  // legacy (012, 더 이상 사용 안 함)
  kind: ReadingKind;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export type ReadingNoteLike = {
  note_id: string;
  user_id: string;
  created_at: string;
};

export type ReadingNoteComment = {
  id: string;
  note_id: string;
  user_id: string;
  content: string;
  parent_id?: string | null;
  created_at: string;
};

/** 챌린지 참여자 (049) — 한 챌린지에 합류한 멤버. */
export type ReadingParticipant = {
  reading_id: string;
  user_id: string;
  joined_at: string;
};

/**
 * 독서 노트 — Sol AI Office study_notes 확장.
 * 도서/강좌 분기 + external_blog 신규.
 */
export type ReadingNote = {
  id: string;
  workspace_id: string;
  reading_id: string;
  user_id: string;
  /** 036 — 노트별 자유 제목 (선택). */
  title: string | null;
  date: string;
  time: string | null;
  chapter: string[] | null;
  source_type: ReadingNoteSourceType;
  // editor 본문
  content: unknown | null; // Tiptap JSON
  raw_text: string | null;
  sections: unknown | null;
  action_items: unknown | null;
  // external_blog 본문
  external_url: string | null;
  external_title: string | null;
  external_excerpt: string | null;
  external_thumbnail: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
};

export type AttachmentRefType =
  | "meeting"
  | "meeting_note"
  | "task"
  | "insight";

export type Attachment = {
  id: string;
  workspace_id: string;
  ref_type: AttachmentRefType;
  ref_id: string;
  storage_path: string;
  filename: string;
  mime: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  created_at: string;
};

export type Task = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  created_by: string;
  /** Optional link back to the 일정 the task was discussed in. */
  meeting_id: string | null;
  /** Optional link to the 회의록 that captured this as an action item. */
  note_id: string | null;
  category: string | null;
  created_at: string;
  completed_at: string | null;
};

/** 공지사항 (035) — RichEditor HTML content. */
export type Notice = {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  show_on_home: boolean;
  created_at: string;
  updated_at: string;
};

// ─── 할일 좋아요 + 댓글 (047) ──────────────────────────────────
export type TaskLike = {
  task_id: string;
  user_id: string;
  created_at: string;
};

export type TaskComment = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  parent_id?: string | null;
  created_at: string;
};

// ─── 개발자에게 한마디 (043) ───────────────────────────────────
export type DevMessageStatus = "open" | "done";

export type DevMessage = {
  id: string;
  workspace_id: string;
  author_id: string;
  body: string;
  page_url: string | null;
  user_agent: string | null;
  status: DevMessageStatus;
  created_at: string;
};

// ─── 안건 + 투표 (040) ─────────────────────────────────────────
export type AgendaPollType = "single" | "multi" | "text";

export type AgendaOption = {
  /** 클라이언트에서 randomUUID 로 발급, 변경 시 안정성 위해 keep. */
  id: string;
  label: string;
};

export type Agenda = {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  description: string | null;
  poll_type: AgendaPollType;
  /** poll_type === "text" 면 빈 배열. */
  options: AgendaOption[];
  deadline: string;
  /** 작성자/운영자가 수동 마감했을 때만. 아니면 null. */
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AgendaVote = {
  id: string;
  agenda_id: string;
  user_id: string;
  /** 객관식 — 선택한 option id 배열 (단일이면 1개). */
  choices: string[];
  /** 주관식 — 자유 응답. */
  text_answer: string | null;
  created_at: string;
  updated_at: string;
};

export type AgendaComment = {
  id: string;
  agenda_id: string;
  user_id: string;
  content: string;
  parent_id?: string | null;
  created_at: string;
};

// ============================================================
// 채널 지표 (SNS 콘텐츠 성과) — 044_channel_stats.sql
// 모임 공용 유튜브/스레드/인스타 계정을 어드민이 연결, Edge Function 이
// 주간 스냅샷 수집. 토큰은 테이블이 아닌 Vault 에 — token_ref 만 보관.
// 자세한 설계: docs/guides/sns/구현-플랜.md
// ============================================================

export type ChannelPlatform = "youtube" | "threads" | "instagram";

/** 워크스페이스당 플랫폼별 1개. 어드민이 OAuth 로 최초 연결. */
export type ChannelConnection = {
  id: string;
  workspace_id: string;
  platform: ChannelPlatform;
  channel_handle: string | null;
  channel_name: string | null;
  platform_channel_id: string | null;
  /** Vault secret 참조 — 토큰 평문은 테이블에 저장하지 않음. */
  token_ref: string | null;
  token_expires_at: string | null;
  is_active: boolean;
  connected_at: string;
  connected_by: string | null;
};

/**
 * 모임 레벨 주간 스냅샷 — 한 주에 한 행, 세 플랫폼 컬럼을 함께 담는다
 * (현황판이 주차별로 한 번에 읽기 좋게). _delta 는 수집 시 직전 주 대비 계산.
 */
export type ChannelWeeklyStat = {
  id: string;
  workspace_id: string;
  /** 해당 주 월요일 (YYYY-MM-DD). */
  week_start: string;
  /** 해당 주 일요일. */
  week_end: string;

  // YouTube
  yt_subscribers: number | null;
  yt_subscribers_delta: number | null;
  yt_total_channel_views: number | null;
  yt_weekly_views: number | null;
  yt_search_traffic_pct: number | null;
  yt_browse_traffic_pct: number | null;

  // Threads
  th_followers: number | null;
  th_followers_delta: number | null;
  th_post_count_weekly: number | null;
  th_total_views_weekly: number | null;
  th_total_likes_weekly: number | null;

  // Instagram
  ig_followers: number | null;
  ig_followers_delta: number | null;
  ig_weekly_reach: number | null;
  ig_post_count_weekly: number | null;
  ig_reel_count_weekly: number | null;
  ig_total_reach_weekly: number | null;

  collected_at: string;
};

/** 게시물 레벨 지표 — 해당 주 게시물 + 플랫폼별 전용 컬럼. */
export type ChannelContentStat = {
  id: string;
  workspace_id: string;
  channel_id: string;
  platform: ChannelPlatform;
  platform_content_id: string;
  content_type: string | null; // video/short/reel/post/carousel
  title: string | null;
  url: string | null;
  published_at: string | null;
  week_start: string | null;

  // 공통
  views: number;
  likes: number;
  comments: number;

  // YouTube 전용
  yt_avg_view_duration: number | null; // 초
  yt_ctr: number | null;
  yt_is_short: boolean;

  // Instagram 전용
  ig_saves: number;
  ig_shares: number;
  ig_reposts: number;
  ig_reach: number;
  ig_reel_skip_rate: number | null;

  // Threads 전용
  th_reposts: number;
  th_quotes: number;
  th_shares: number;
  th_replies: number;

  collected_at: string;
};

// ────────────────────────────────────────────────────────────────
// 055 — 딴길청년 게스트 신청
// 공개 랜딩(public/dangil-interview.html)에서 익명으로 들어오고,
// 밋업 정식 멤버가 /guest-applications 에서 처리한다.
// ────────────────────────────────────────────────────────────────

export type GuestApplicationStatus =
  | "new"
  | "contacted"
  | "scheduled"
  | "done"
  | "rejected";

export type GuestApplication = {
  id: string;
  workspace_id: string;
  name: string;
  contact: string;
  activity: string | null;
  story: string | null;
  status: GuestApplicationStatus;
  memo: string | null;
  handled_by: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

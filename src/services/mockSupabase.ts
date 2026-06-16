/**
 * @file src/services/mockSupabase.ts
 * @description Mock Supabase 클라이언트 (로컬 개발용)
 * - Supabase query builder API를 흉내내는 인메모리 구현
 * - .env.local에 VITE_SUPABASE_URL이 비어있으면 이 클라이언트 사용
 */

import {
  dummySchedules, dummyTasks, dummyInsights,
  dummyReadings, dummyStudyNotes, dummyRecords,
  projects, defaultScheduleCategories, defaultTaskCategories,
  defaultReadingCategories,
  dummyYoutubeChannels, dummyYoutubeVideos, dummyYoutubeComments,
} from '../data';

// ── 테이블별 인메모리 데이터 ──

const mockData: Record<string, any[]> = {
  user_profiles: [
    { id: 'dev-profile', user_id: 'dev', name: '솔', bio: '1인 사업가', tone: 'friendly', response_length: 'medium', emoji_usage: 'moderate', active_theme: 'modern', email: 'dev@test.com' },
  ],
  // ── 공유 워크스페이스 (로컬 테스트용: 개인 + 시목 팀) ──
  workspaces: [
    { id: 'ws-personal', user_id: 'dev', name: '내 오피스', emoji: '👤', color: null, image_url: null, biz_info: null, type: 'personal', invite_code: null, created_by: 'dev', created_at: new Date().toISOString() },
    { id: 'ws-simok', user_id: 'dev', name: '시목', emoji: '🪵', color: '#8d6e63', image_url: null, biz_info: '원목 가구/소품 · 스마트스토어·자사몰', type: 'office', invite_code: 'SIMOK1', created_by: 'dev', created_at: new Date().toISOString() },
  ],
  workspace_members: [
    { workspace_id: 'ws-personal', user_id: 'dev', role: 'owner', nickname: null, joined_at: new Date().toISOString() },
    { workspace_id: 'ws-simok', user_id: 'dev', role: 'owner', nickname: null, joined_at: new Date().toISOString() },
  ],
  workspace_invites: [],
  workspace_activities: [],
  // ── 회사 브레인 (시목 초안 시드: 빈 4필드는 사장이 직접 채움) ──
  brand_contexts: [
    {
      id: 'bc-simok', workspace_id: 'ws-simok', user_id: 'dev',
      identity: '시목 — 오래 쓰는 원목 가구·소품. 기준 있는 선택, 장인정신과 자연.',
      category: '원목 인테리어 가구/소품 (도마·식탁·생활소품)',
      tone: '장인·자연·따뜻·담백·정중. 과장/최저가 강조 금지.',
      target: '원목 인테리어를 선호하는 2030 신혼·자취 + 친환경/자연소재 니즈',
      usp: '통원목 한 장 (집성 아님)\n천연오일 마감\n국내 수작업 / 제작과정 투명 공개',
      channels: '네이버 스마트스토어, 인스타그램, 유튜브',
      price_position: '프리미엄 (가격 정당화 필요)',
      ad_angle: '품질 · 원목 · 오래가는',
      compliance: "내구성 '평생 보장' 식 단정 금지\n'100% 무독성/친환경'은 근거(인증) 있을 때만\n효능·기능 과장 단정 금지",
      main_products: '', price_range: '', competitors: '', story: '', raw: '',
      version: 1, updated_at: new Date().toISOString(), created_at: new Date().toISOString(),
    },
  ],
  staff: [
    { id: 'staff-1', workspace_id: 'ws-simok', user_id: 'dev', type_key: 'sns', name: 'SNS 운영', prompt: '인스타 감성 톤, 원목 무드. 첫 줄 훅 강하게.', model: 'gpt', state: 'working', created_at: new Date().toISOString() },
    { id: 'staff-2', workspace_id: 'ws-simok', user_id: 'dev', type_key: 'monitor', name: '경쟁사 감시', prompt: '원목 가구 카테고리 경쟁사 가격/리뷰 변화 추적.', model: 'research', state: 'idle', created_at: new Date().toISOString() },
  ],
  staff_routines: [
    { id: 'sr-1', staff_id: 'staff-1', workspace_id: 'ws-simok', label: '매일 09:00 게시물 초안 1건', schedule: 'daily', run_at: '09:00', enabled: true, created_at: new Date().toISOString() },
    { id: 'sr-2', staff_id: 'staff-1', workspace_id: 'ws-simok', label: '주간 콘텐츠 캘린더 정리', schedule: 'weekly', run_at: null, enabled: true, created_at: new Date().toISOString() },
    { id: 'sr-3', staff_id: 'staff-2', workspace_id: 'ws-simok', label: '매일 08:00 경쟁사 가격 스캔', schedule: 'daily', run_at: '08:00', enabled: true, created_at: new Date().toISOString() },
  ],
  daily_reports: [
    { id: 'dr-seed-1', workspace_id: 'ws-simok', staff_id: 'staff-1', user_id: 'dev', date: '2026-06-13', title: '인스타 게시물 초안 1건 · 원목 무드', summary: '신상 도마 라이프스타일 컷 캡션 작성 완료', body: '## 오늘 한 일\n- 원목 도마 라이프스타일 게시물 초안 1건\n- 첫 줄 훅: "도마 하나 바꿨을 뿐인데"\n- 해시태그 12개 + 이미지 브리프 첨부\n\n## 내일 제안\n- 브런치 플레이팅 컷 릴스 스크립트', trigger: 'auto', output_kind: 'sns_queue', content_json: { posts: [{ date: '2026-06-13', channel: '인스타', format: '피드', objective: '저장', hook: { type: '공감', text: '도마 하나 바꿨을 뿐인데', score: 8 }, body: '매일 쓰는 도마일수록 관리가 중요하죠. 오일 한 번이면 새것처럼.', hashtags: { large: ['#원목도마'], medium: ['#주방살림'], small: ['#티크도마'], brand: ['#시목'] }, imageBrief: '자연광 주방, 도마 위 플레이팅 클로즈업', variants: ['A', 'B'], status: 'draft' }] }, input: null, status: 'done', model: 'sonnet', comments: [], created_at: new Date().toISOString() },
  ],
  // AI 액션 승인 큐 (suggested→approved→dismissed)
  staff_output_actions: [],
  projects: projects.map(p => ({
    id: p.id, user_id: 'dev', name: p.name, emoji: p.emoji, color: p.color,
    image: p.image, description: p.description, status: p.status ?? 'active',
    priority: p.priority ?? 0, start_date: p.startDate, end_date: p.endDate,
    workspace_id: 'ws-personal', is_shared: false,
    created_at: new Date().toISOString(),
  })),
  goals: [
    { id: 'g1', user_id: 'dev', project_id: 'unmyunglab', title: '월 매출 500만원', type: 'kpi', status: 'in_progress', progress: 40, created_at: new Date().toISOString() },
    { id: 'g2', user_id: 'dev', project_id: 'pte', title: 'PTE 학생 100명 확보', type: 'kpi', status: 'in_progress', progress: 25, created_at: new Date().toISOString() },
  ],
  kpis: [
    { id: 'k1', user_id: 'dev', goal_id: 'g1', name: '월 매출', current_value: 200, target_value: 500, start_value: 0, unit: '만원', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ],
  kpi_logs: [],
  conversations: [],
  messages: [],
  conversation_summaries: [],
  daily_briefings: [],
  schedules: dummySchedules.map(s => ({
    id: s.id, user_id: 'dev', title: s.title, date: s.date, end_date: s.endDate ?? null, time: s.time,
    project: s.project, color: s.color, category: s.category,
    repeat: s.repeat ?? 'none', reminder: s.reminder, notes: s.notes, tags: s.tags,
    workspace_id: 'ws-personal', is_shared: true,
    created_at: new Date().toISOString(),
  })),
  tasks: dummyTasks.map(t => ({
    id: t.id, user_id: 'dev', title: t.title, project: t.project,
    goal_id: t.goalId, status: t.status === 'pending' ? 'todo' : t.status === 'completed' ? 'done' : t.status,
    priority: t.priority, starred: t.starred, due_date: t.date,
    category: t.category, notes: t.notes, repeat: t.repeat, tags: t.tags,
    estimated_time: t.pomodoroEstimate, actual_time: t.pomodoroCompleted,
    conversation_id: t.conversationId,
    workspace_id: 'ws-personal', is_shared: true, assignee_id: null,
    created_at: new Date().toISOString(),
  })),
  insights: dummyInsights.map(i => ({
    id: i.id, user_id: 'dev', title: i.title, content: i.content,
    source: i.source, link: i.link, tags: i.tags, created_at: i.createdAt,
    time: i.time, project: i.project, priority: i.priority,
    starred: i.starred ?? false,
    workspace_id: 'ws-personal', is_shared: true,
  })),
  readings: dummyReadings.map(r => ({
    id: r.id, user_id: 'dev', title: r.title, author: r.author,
    category: r.category, total_pages: r.totalPages, current_page: r.currentPage,
    total_lessons: r.totalLessons, current_lesson: r.currentLesson,
    status: r.status, cover_emoji: r.coverEmoji, cover_image: r.coverImage,
    start_date: r.startDate, completed_date: r.completedDate,
    rating: r.rating, review: r.review, tags: r.tags, link: r.link,
    price: r.price, toc: r.toc, chapters: r.chapters, isbn13: r.isbn13,
    workspace_id: 'ws-personal', is_shared: true, recommended_by: null,
    created_at: new Date().toISOString(),
  })),
  // 실제 테이블명은 reading_logs (스터디/독서 노트). action_items_json 컬럼 사용.
  reading_logs: dummyStudyNotes.map(sn => ({
    id: sn.id, user_id: 'dev', reading_id: sn.readingId,
    date: sn.date, time: sn.time, chapter: sn.chapter,
    content: sn.content, raw_text: sn.rawText,
    sections: sn.sections, action_items_json: sn.actionItems,
    workspace_id: 'ws-personal', is_shared: true,
    created_at: sn.createdAt, updated_at: sn.updatedAt,
  })),
  journals: dummyRecords.map(r => ({
    id: r.id, user_id: 'dev', record_type: r.recordType, date: r.date,
    time: r.time, title: r.title, mood: r.mood, energy: r.energy,
    tags: r.tags, project: r.project, conversation_id: r.conversationId,
    morning_data: r.morningData, evening_data: r.eveningData,
    weekly_data: r.weeklyData, memo_body: r.memoBody,
    workspace_id: 'ws-personal', is_shared: false,
    created_at: r.createdAt,
  })),
  youtube_channels: dummyYoutubeChannels.map(c => ({
    id: c.id, user_id: 'dev', channel_id: c.channelId, title: c.title,
    thumbnail: c.thumbnail ?? null, subscriber_count: c.subscriberCount ?? null,
    video_count: c.videoCount ?? null, connected_at: c.connectedAt ?? null,
  })),
  youtube_videos: dummyYoutubeVideos.map(v => ({
    id: v.id, user_id: 'dev', channel_id: v.channelId, video_id: v.videoId,
    title: v.title, thumbnail: v.thumbnail ?? null, published_at: v.publishedAt,
    view_count: v.viewCount ?? null, like_count: v.likeCount ?? null,
    comment_count: v.commentCount ?? null, script: v.script ?? null,
  })),
  youtube_comments: dummyYoutubeComments.map(c => ({
    id: c.id, user_id: 'dev', comment_id: c.commentId, video_id: c.videoId,
    channel_id: c.channelId, author: c.author, author_thumbnail: c.authorThumbnail ?? null,
    text: c.text, published_at: c.publishedAt, like_count: c.likeCount ?? null,
    reply_status: c.replyStatus, reply_draft: c.replyDraft ?? null, replied_at: c.repliedAt ?? null,
  })),
  push_subscriptions: [],
  notification_preferences: [{
    id: 'np-dev',
    user_id: 'dev',
    task_deadline: true,
    task_overdue: true,
    morning_routine: true,
    schedule_reminder: true,
    morning_briefing: true,
    pomodoro_done: true,
    morning_journal: true,
    evening_journal: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }],
  notification_log: [],
  daily_completions: [],
  custom_options: [
    ...defaultScheduleCategories.map(c => ({ id: c.id, user_id: 'dev', option_type: 'schedule_category', value: JSON.stringify(c) })),
    ...defaultTaskCategories.map(c => ({ id: c.id, user_id: 'dev', option_type: 'task_category', value: JSON.stringify(c) })),
    ...defaultReadingCategories.map(c => ({ id: c.id, user_id: 'dev', option_type: 'reading_category', value: JSON.stringify(c) })),
  ],
};

// ── 로컬 영속화 (새로고침해도 추가/수정 유지) ──
// Mock 모드는 메모리 전용이라 리셋됨 → localStorage에 저장해 보존.
// 시드를 바꾸면 _LS_KEY 버전을 올려 초기화.
const _LS_KEY = 'mock-db-v2';
try {
  const saved = typeof localStorage !== 'undefined' && localStorage.getItem(_LS_KEY);
  if (saved) {
    const obj = JSON.parse(saved);
    for (const k in obj) mockData[k] = obj[k];
  } else if (typeof localStorage !== 'undefined') {
    localStorage.setItem(_LS_KEY, JSON.stringify(mockData));
  }
} catch { /* 파싱/쿼터 오류 무시 */ }

function persistMock() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(_LS_KEY, JSON.stringify(mockData)); }
  catch { /* 쿼터 초과 등 무시 */ }
}

// ── 유니크 ID (새로고침해도 충돌 안 나게 timestamp 기반) ──
// 과거: 1000부터 카운트 → 새로고침마다 리셋되어 다른 직원이 같은 id를 받아 데이터가 섞이는 버그.
let _seq = 0;
function nextId() { return `mock-${Date.now().toString(36)}-${++_seq}`; }

// ── Mock Query Builder ──

class MockQueryBuilder {
  private table: string;
  private data: any[];
  private filters: Array<(row: any) => boolean> = [];
  private _order: { col: string; asc: boolean }[] = [];
  private _limit: number | null = null;
  private _single = false;
  private _maybeSingle = false;
  private _count: 'exact' | null = null;
  private _head = false;

  // 쓰기 연산 상태 (체이닝 지원)
  private _op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private _payload: any = null;

  constructor(table: string) {
    this.table = table;
    this.data = mockData[table] || [];
    if (!mockData[table]) mockData[table] = [];
  }

  select(_columns?: string, opts?: { count?: 'exact'; head?: boolean }) {
    if (opts?.count) this._count = opts.count;
    if (opts?.head) this._head = opts.head;
    return this;
  }

  eq(col: string, val: any) { this.filters.push(r => r[col] === val); return this; }
  neq(col: string, val: any) { this.filters.push(r => r[col] !== val); return this; }
  gt(col: string, val: any) { this.filters.push(r => r[col] > val); return this; }
  gte(col: string, val: any) { this.filters.push(r => r[col] >= val); return this; }
  lt(col: string, val: any) { this.filters.push(r => r[col] < val); return this; }
  lte(col: string, val: any) { this.filters.push(r => r[col] <= val); return this; }
  like(col: string, pattern: string) {
    const regex = new RegExp(pattern.replace(/%/g, '.*'), 'i');
    this.filters.push(r => regex.test(String(r[col] ?? '')));
    return this;
  }
  ilike(col: string, pattern: string) { return this.like(col, pattern); }
  is(col: string, val: any) { this.filters.push(r => r[col] === val); return this; }
  in(col: string, vals: any[]) { this.filters.push(r => vals.includes(r[col])); return this; }
  contains(col: string, val: any) {
    this.filters.push(r => Array.isArray(r[col]) && r[col].some((v: any) => val.includes(v)));
    return this;
  }
  or(_expr: string) { return this; } // 간소화: or 필터는 패스

  order(col: string, opts?: { ascending?: boolean }) {
    this._order.push({ col, asc: opts?.ascending !== false });
    return this;
  }

  limit(n: number) { this._limit = n; return this; }
  range(from: number, to: number) {
    this._limit = to - from + 1;
    return this;
  }

  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }

  // ── 쓰기 연산 (체이닝 가능, 실행은 _resolve에서) ──

  insert(payload: any | any[], _opts?: { onConflict?: string }) {
    this._op = 'insert';
    this._payload = payload;
    return this;
  }

  update(payload: any) {
    this._op = 'update';
    this._payload = payload;
    return this;
  }

  delete() {
    this._op = 'delete';
    return this;
  }

  upsert(payload: any | any[], _opts?: { onConflict?: string }) {
    this._op = 'upsert';
    this._payload = payload;
    return this;
  }

  // await 시 자동 실행
  then(resolve: (val: any) => void, reject?: (err: any) => void) {
    return this._resolve().then(resolve, reject);
  }

  private async _resolve() {
    // ── INSERT ──
    if (this._op === 'insert') {
      const items = Array.isArray(this._payload) ? this._payload : [this._payload];
      const inserted = items.map(item => ({
        ...item,
        id: item.id || nextId(),
        user_id: item.user_id || 'dev',
        created_at: item.created_at || new Date().toISOString(),
      }));
      mockData[this.table].push(...inserted);
      persistMock();
      const result = inserted.length === 1 ? inserted[0] : inserted;

      if (this._single) return { data: result, error: null };
      if (this._maybeSingle) return { data: result, error: null };
      return { data: result, error: null, count: inserted.length };
    }

    // ── UPDATE ──
    if (this._op === 'update') {
      let rows = [...this.data];
      for (const f of this.filters) rows = rows.filter(f);
      rows.forEach(row => {
        Object.assign(row, this._payload, { updated_at: new Date().toISOString() });
      });
      persistMock();

      if (this._single) return { data: rows[0] ?? null, error: null };
      if (this._maybeSingle) return { data: rows[0] ?? null, error: null };
      return { data: rows, error: null };
    }

    // ── DELETE ──
    if (this._op === 'delete') {
      let rows = [...this.data];
      for (const f of this.filters) rows = rows.filter(f);
      const ids = new Set(rows.map(r => r.id));
      mockData[this.table] = mockData[this.table].filter(r => !ids.has(r.id));
      this.data = mockData[this.table];
      persistMock();
      return { data: rows, error: null };
    }

    // ── UPSERT ──
    if (this._op === 'upsert') {
      const items = Array.isArray(this._payload) ? this._payload : [this._payload];
      for (const item of items) {
        const idx = mockData[this.table].findIndex(r => r.id === item.id);
        if (idx >= 0) {
          Object.assign(mockData[this.table][idx], item, { updated_at: new Date().toISOString() });
        } else {
          mockData[this.table].push({ ...item, id: item.id || nextId(), user_id: item.user_id || 'dev', created_at: new Date().toISOString() });
        }
      }
      persistMock();
      const result = items.length === 1 ? items[0] : items;
      if (this._single) return { data: result, error: null };
      if (this._maybeSingle) return { data: result, error: null };
      return { data: result, error: null };
    }

    // ── SELECT (기본) ──
    let rows = [...this.data];
    for (const f of this.filters) rows = rows.filter(f);

    if (this._head && this._count) {
      return { data: null, count: rows.length, error: null };
    }

    for (const { col, asc } of [...this._order].reverse()) {
      rows.sort((a, b) => {
        const va = a[col], vb = b[col];
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return asc ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
      });
    }

    if (this._limit != null) rows = rows.slice(0, this._limit);
    const count = this._count ? rows.length : undefined;

    if (this._single) {
      return { data: rows[0] ?? null, count, error: rows.length === 0 ? { message: 'No rows found', code: 'PGRST116' } : null };
    }
    if (this._maybeSingle) {
      return { data: rows[0] ?? null, count, error: null };
    }

    return { data: rows, count, error: null };
  }
}

// ── Mock Auth ──

const mockAuth = {
  getSession: async () => ({ data: { session: { user: { id: 'dev', email: 'dev@test.com' } } }, error: null }),
  getUser: async () => ({ data: { user: { id: 'dev', email: 'dev@test.com' } }, error: null }),
  onAuthStateChange: (_cb: any) => ({
    data: { subscription: { unsubscribe: () => {} } },
  }),
  signInWithOAuth: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
};

// ── Mock Storage ──

const mockStorage = {
  from: (_bucket: string) => ({
    upload: async () => ({ data: { path: 'mock-path' }, error: null }),
    getPublicUrl: (path: string) => ({ data: { publicUrl: `/mock-storage/${path}` } }),
    remove: async () => ({ data: null, error: null }),
  }),
};

// ── createMockClient ──

export function createMockClient() {
  return {
    from: (table: string) => new MockQueryBuilder(table),
    auth: mockAuth,
    storage: mockStorage,
    channel: () => ({ on: () => ({ subscribe: () => {} }) }),
    removeChannel: () => {},
    rpc: async (_fn: string, _params?: any) => ({ data: null, error: null }),
  };
}

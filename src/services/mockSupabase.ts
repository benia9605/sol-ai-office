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
} from '../data';

// ── 테이블별 인메모리 데이터 ──

const mockData: Record<string, any[]> = {
  user_profiles: [
    { id: 'dev-profile', user_id: 'dev', name: '솔', bio: '1인 사업가', tone: 'friendly', response_length: 'medium', emoji_usage: 'moderate', email: 'dev@test.com' },
  ],
  projects: projects.map(p => ({
    id: p.id, user_id: 'dev', name: p.name, emoji: p.emoji, color: p.color,
    image: p.image, description: p.description, status: p.status ?? 'active',
    priority: p.priority ?? 0, start_date: p.startDate, end_date: p.endDate,
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
    created_at: new Date().toISOString(),
  })),
  tasks: dummyTasks.map(t => ({
    id: t.id, user_id: 'dev', title: t.title, project: t.project,
    goal_id: t.goalId, status: t.status === 'pending' ? 'todo' : t.status === 'completed' ? 'done' : t.status,
    priority: t.priority, starred: t.starred, due_date: t.date,
    category: t.category, notes: t.notes, repeat: t.repeat, tags: t.tags,
    estimated_time: t.pomodoroEstimate, actual_time: t.pomodoroCompleted,
    conversation_id: t.conversationId,
    created_at: new Date().toISOString(),
  })),
  insights: dummyInsights.map(i => ({
    id: i.id, user_id: 'dev', title: i.title, content: i.content,
    source: i.source, link: i.link, tags: i.tags, created_at: i.createdAt,
    time: i.time, project: i.project, priority: i.priority,
  })),
  readings: dummyReadings.map(r => ({
    id: r.id, user_id: 'dev', title: r.title, author: r.author,
    category: r.category, total_pages: r.totalPages, current_page: r.currentPage,
    total_lessons: r.totalLessons, current_lesson: r.currentLesson,
    status: r.status, cover_emoji: r.coverEmoji, cover_image: r.coverImage,
    start_date: r.startDate, completed_date: r.completedDate,
    rating: r.rating, review: r.review, tags: r.tags, link: r.link,
    price: r.price, toc: r.toc, chapters: r.chapters, isbn13: r.isbn13,
    created_at: new Date().toISOString(),
  })),
  study_notes: dummyStudyNotes.map(sn => ({
    id: sn.id, user_id: 'dev', reading_id: sn.readingId,
    date: sn.date, time: sn.time, chapter: sn.chapter,
    content: sn.content, raw_text: sn.rawText,
    sections: sn.sections, action_items: sn.actionItems,
    created_at: sn.createdAt, updated_at: sn.updatedAt,
  })),
  journals: dummyRecords.map(r => ({
    id: r.id, user_id: 'dev', type: r.recordType, date: r.date,
    time: r.time, title: r.title, mood: r.mood, energy: r.energy,
    tags: r.tags, project: r.project, conversation_id: r.conversationId,
    morning_data: r.morningData, evening_data: r.eveningData,
    weekly_data: r.weeklyData, memo_body: r.memoBody,
    created_at: r.createdAt,
  })),
  daily_completions: [],
  custom_options: [
    ...defaultScheduleCategories.map(c => ({ id: c.id, user_id: 'dev', option_type: 'schedule_category', value: JSON.stringify(c) })),
    ...defaultTaskCategories.map(c => ({ id: c.id, user_id: 'dev', option_type: 'task_category', value: JSON.stringify(c) })),
    ...defaultReadingCategories.map(c => ({ id: c.id, user_id: 'dev', option_type: 'reading_category', value: JSON.stringify(c) })),
  ],
};

// ── auto increment ID ──
let _nextId = 1000;
function nextId() { return `mock-${++_nextId}`; }

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

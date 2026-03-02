# Google 로그인 + 유저별 데이터 분리 구현

## 현재 상황
- Supabase Auth에 Google Provider 연동 완료
- 기존 데이터 전부 삭제 예정 (깔끔하게 시작)
- 로그인 UI 없음
- user_profiles 테이블에 user_id 컬럼 이미 있음

---

## 앱 이름 변경

**Sol AI Office → Teamie**

변경 필요한 곳:
- 로그인 페이지 타이틀
- 상단바 로고/타이틀
- 브라우저 탭 타이틀 (index.html)
- 기타 "Sol AI Office" 문구 있는 곳

---

## 구현 목표

1. Google 로그인 UI 추가
2. 테이블에 user_id 컬럼 추가
3. 데이터 조회/저장 시 user_id 필터링
4. 로그인한 유저별로 데이터 분리

---

## Part 1: 로그인 UI

### 1-1. 로그인 페이지 (LoginPage.tsx)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                       ✨ Teamie                             │
│                                                             │
│                  AI 팀과 함께 일하세요                       │
│                                                             │
│              ┌─────────────────────────────┐                │
│              │  [G] Google로 계속하기      │                │
│              └─────────────────────────────┘                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**[G]** = 실제 Google 브랜드 로고 SVG 사용

```tsx
// Google 로고 SVG (공식 브랜드 컬러)
const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>
);

// 버튼 사용
<button className="flex items-center gap-3 px-6 py-3 border rounded-lg hover:bg-gray-50">
  <GoogleLogo />
  <span>Google로 계속하기</span>
</button>
```

### 1-2. 로그인 로직

```typescript
import { supabase } from '@/services/supabase';

// Google 로그인
const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) console.error('Login error:', error);
};

// 로그아웃
const signOut = async () => {
  await supabase.auth.signOut();
};

// 현재 유저 가져오기
const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
```

### 1-3. Auth 상태 관리

```typescript
// App.tsx 또는 AuthProvider
import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { User } from '@supabase/supabase-js';

const [user, setUser] = useState<User | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  // 현재 세션 확인
  supabase.auth.getSession().then(({ data: { session } }) => {
    setUser(session?.user ?? null);
    setLoading(false);
  });

  // Auth 상태 변화 리스너
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setUser(session?.user ?? null);
    }
  );

  return () => subscription.unsubscribe();
}, []);

// 로그인 안 됐으면 LoginPage, 됐으면 메인
if (loading) return <LoadingSpinner />;
if (!user) return <LoginPage />;
return <MainApp />;
```

### 1-4. 상단바에 로그아웃 버튼

```
┌─────────────────────────────────────────────────────────────┐
│  ✨ Teamie                           [Sol ▼]  [⚙️]          │
│                                       └─ 로그아웃           │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 2: DB 작업

### 2-1. 기존 데이터 삭제 + milestones 테이블 삭제

```sql
-- 1. 기존 데이터 전부 삭제
TRUNCATE projects, goals, kpis, kpi_logs, 
         conversations, messages, conversation_summaries,
         schedules, tasks, insights, readings, reading_logs, 
         journals, user_profiles, options, daily_completions
CASCADE;

-- 2. milestones 테이블 삭제 (더 이상 사용 안 함)
DROP TABLE IF EXISTS milestones CASCADE;
```

### 2-2. user_id 컬럼 추가

```sql
-- projects
ALTER TABLE projects ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_projects_user ON projects(user_id);

-- goals
ALTER TABLE goals ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_goals_user ON goals(user_id);

-- kpis
ALTER TABLE kpis ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_kpis_user ON kpis(user_id);

-- kpi_logs
ALTER TABLE kpi_logs ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_kpi_logs_user ON kpi_logs(user_id);

-- conversations
ALTER TABLE conversations ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_conversations_user ON conversations(user_id);

-- messages
ALTER TABLE messages ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_messages_user ON messages(user_id);

-- conversation_summaries
ALTER TABLE conversation_summaries ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_conversation_summaries_user ON conversation_summaries(user_id);

-- schedules
ALTER TABLE schedules ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_schedules_user ON schedules(user_id);

-- tasks
ALTER TABLE tasks ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_tasks_user ON tasks(user_id);

-- insights
ALTER TABLE insights ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_insights_user ON insights(user_id);

-- readings
ALTER TABLE readings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_readings_user ON readings(user_id);

-- reading_logs
ALTER TABLE reading_logs ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_reading_logs_user ON reading_logs(user_id);

-- journals
ALTER TABLE journals ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_journals_user ON journals(user_id);

-- options
ALTER TABLE options ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_options_user ON options(user_id);

-- daily_completions
ALTER TABLE daily_completions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_daily_completions_user ON daily_completions(user_id);

-- user_profiles는 이미 user_id 있음 (스킵)
```

### 2-3. 테이블 목록 (user_id 추가 대상)

| 테이블 | 설명 |
|--------|------|
| projects | 프로젝트 |
| goals | 목표 |
| kpis | KPI |
| kpi_logs | KPI 기록 |
| conversations | 대화 세션 |
| messages | 메시지 |
| conversation_summaries | 대화 요약 |
| schedules | 일정 |
| tasks | 할일 |
| insights | 인사이트 |
| readings | 독서/스터디 |
| reading_logs | 독서 기록 |
| journals | 기록(일기) |
| options | 옵션 |
| daily_completions | 일일 완료 |
| user_profiles | 유저 프로필 (이미 있음) |

---

## Part 3: 서비스 파일 수정

### 3-1. 유저 ID 가져오기 헬퍼

```typescript
// services/auth.ts
import { supabase } from './supabase';

export const getCurrentUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
};
```

### 3-2. 데이터 조회 시 user_id 필터 추가

**예시: projects**

```typescript
// 기존
export const getProjects = async () => {
  const { data } = await supabase
    .from('projects')
    .select('*')
    .order('priority');
  return data;
};

// 변경
export const getProjects = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('priority');
  return data;
};
```

### 3-3. 데이터 저장 시 user_id 추가

```typescript
// 기존
export const createProject = async (project) => {
  const { data } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single();
  return data;
};

// 변경
export const createProject = async (project) => {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');
  
  const { data } = await supabase
    .from('projects')
    .insert({ ...project, user_id: userId })
    .select()
    .single();
  return data;
};
```

### 3-4. 수정해야 할 서비스 파일

모든 서비스 파일에서 조회/저장 시 user_id 처리:

- projects 관련
- goals 관련
- kpis 관련
- tasks 관련
- schedules 관련
- insights 관련
- readings 관련
- journals 관련
- conversations 관련
- user_profiles 관련
- options 관련

---

## 구현 순서

1. **DB 작업** - 기존 데이터 삭제 + milestones 삭제 + user_id 컬럼 추가
2. **LoginPage.tsx** 생성 - Google 로그인 버튼
3. **App.tsx** 수정 - Auth 상태 체크, 로그인 안 되면 LoginPage
4. **상단바** 수정 - 유저 이름 + 로그아웃 버튼
5. **auth.ts** - getCurrentUserId 헬퍼 생성
6. **모든 서비스 파일** - user_id 필터/추가 적용

---

## 참고: Supabase Auth 설정

- Google Provider: ✅ 연동 완료
- Redirect URL: `https://[프로젝트ID].supabase.co/auth/v1/callback`

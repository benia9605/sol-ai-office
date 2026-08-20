 ---                                                                                                
  1. .env.local — 빈 값으로 dev 모드 트리거                                                        

  # 로컬 개발용: 로그인 우회
  VITE_SUPABASE_URL=
  VITE_SUPABASE_ANON_KEY=

  프로덕션 .env에는 진짜 값이 들어있고, .env.local이 우선순위가 높아서 로컬에선 자동으로 빈 값이
  적용됨.

  ---
  2. src/lib/supabase.ts — mock/real 분기

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

  export const isConfigured = !!(supabaseUrl && supabaseAnonKey)

  export const supabase: any = isConfigured
    ? createClient(supabaseUrl, supabaseAnonKey, { ... })
    : createMockClient()   // ← env 비면 mock 클라이언트

  ---
  3. src/lib/mockSupabase.ts — 가짜 Supabase 클라이언트

  Supabase의 query builder API를 흉내내는 인메모리 구현:

  // 테이블별 mock 데이터
  const mockData: Record<string, any[]> = {
    profiles: [{ id: 'dev', name: '솔', email: 'dev@test.com' }],
    categories: [...],
    transactions: [...],
    // ...
  }

  // Supabase 쿼리 체이닝 흉내
  class MockQueryBuilder {
    select() / eq() / gte() / lte() / order() / limit()
    single() / maybeSingle()
    insert() / update() / delete() / upsert()
  }

  // mock auth - 세션 없음, 로그인 안 함
  const mockAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (_cb) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({ error: null }),
  }

  export function createMockClient() {
    return {
      from: (table: string) => new MockQueryBuilder(table),
      auth: mockAuth,
      channel: () => ({ on: () => ({ subscribe: () => {} }) }),
      removeChannel: () => {},
    }
  }

  ---
  4. src/App.tsx — 로그인 화면 스킵 + dev 유저 주입

  const DEV_BYPASS = !import.meta.env.VITE_SUPABASE_URL

  // dev 모드면 가짜 유저/프로필 주입
  const devUser = DEV_BYPASS ? { id: 'dev' } : user
  const devProfile = DEV_BYPASS ? { name: '솔', email: 'dev@test.com', avatar_url: null } : profile

  // 로그인/로딩 체크를 통째로 건너뜀
  if (!DEV_BYPASS) {
    if (loading) return <스피너 />
    if (!user) return <Login />
  }

  // 항상 앱 렌더링
  return <UserProvider value={{ user: devUser, profile: devProfile, ... }}>
    <앱 라우트 />
  </UserProvider>

  ---
  5. src/hooks/useAuth.ts — auth 플로우 스킵

  useEffect(() => {
    if (!isConfigured) {
      setState(s => ({ ...s, loading: false }))  // 즉시 로딩 끝
      return  // 실제 auth 로직 실행 안 함
    }
    // ... 진짜 Supabase auth 플로우
  }, [])

  ---
  요약: 다른 앱에 적용할 때

  ┌──────┬──────────────────────────────────────────────────────────────────────────┐
  │ 순서 │                                  할 일                                   │
  ├──────┼──────────────────────────────────────────────────────────────────────────┤
  │ 1    │ .env.local에 Supabase 변수를 빈 값으로 설정                              │
  ├──────┼──────────────────────────────────────────────────────────────────────────┤
  │ 2    │ supabase.ts에서 isConfigured 플래그 만들고, false면 mock 클라이언트 반환 │
  ├──────┼──────────────────────────────────────────────────────────────────────────┤
  │ 3    │ mockSupabase.ts에 필요한 테이블/mock 데이터 + 쿼리 빌더 구현             │
  ├──────┼──────────────────────────────────────────────────────────────────────────┤
  │ 4    │ App.tsx에서 DEV_BYPASS면 로그인 건너뛰고 가짜 유저 주입                  │
  ├──────┼──────────────────────────────────────────────────────────────────────────┤
  │ 5    │ auth hook에서 isConfigured false면 즉시 loading 해제                     │
  └──────┴──────────────────────────────────────────────────────────────────────────┘

  토글 방법: .env.local 삭제하면 진짜 Supabase 연결, 복원하면 다시 mock 모드.
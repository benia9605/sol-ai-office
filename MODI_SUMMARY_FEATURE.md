# 모디방 - 오늘 대화 전체 요약 기능

## 개요

모디방에서 [오늘 대화 전체 요약] 버튼 클릭 시
→ 모든 AI방의 오늘 대화를 한번에 요약
→ 각 방별로 conversation_summaries 테이블에 저장

---

## UI

### 모디방 하단에 버튼 추가

```
┌─────────────────────────────────────────────────────────────┐
│ 💛 모디                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  (대화 내용)                                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [메시지 입력...]                              [전송]        │
├─────────────────────────────────────────────────────────────┤
│ [📋 오늘 대화 전체 요약]                                    │
└─────────────────────────────────────────────────────────────┘
```

### 버튼 클릭 시 흐름

1. 로딩 표시 "요약 중..."
2. 각 방별 오늘 대화 가져오기
3. AI에게 요약 요청 (방별로)
4. conversation_summaries에 저장
5. 완료 표시 "오늘 요약 저장 완료!"

---

## 로직

### 1. 오늘 대화 가져오기

```typescript
const getTodayMessages = async (roomId: string) => {
  const today = new Date().toISOString().split('T')[0];
  
  // 오늘 생성된 대화 세션 가져오기
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id')
    .eq('room_id', roomId)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`);

  if (!conversations?.length) return [];

  const conversationIds = conversations.map(c => c.id);

  // 해당 대화들의 메시지 가져오기
  const { data: messages } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at');

  return messages || [];
};
```

### 2. AI에게 요약 요청

```typescript
const generateSummary = async (roomId: string, messages: any[]) => {
  if (messages.length === 0) return null;

  // 대화 내용을 텍스트로 변환
  const conversationText = messages
    .map(m => `${m.role === 'user' ? '유저' : 'AI'}: ${m.content}`)
    .join('\n');

  const prompt = `
다음은 오늘 하루 동안의 대화 내용입니다. 
핵심 내용을 3-5문장으로 요약해주세요.
결정된 사항, 논의된 주제, 다음 할 일 위주로 정리해주세요.

대화 내용:
${conversationText}
`;

  // Claude Sonnet으로 요약 (빠르고 저렴)
  const summary = await sendMessageClaude(
    '대화 내용을 요약하는 역할입니다. 간결하고 핵심만 정리해주세요.',
    [{ role: 'user', content: prompt }],
    'sonnet'
  );

  return summary;
};
```

### 3. 요약 저장

```typescript
const saveSummary = async (roomId: string, summary: string) => {
  const today = new Date().toISOString().split('T')[0];

  // 오늘 날짜 요약이 이미 있으면 업데이트, 없으면 삽입
  const { data: existing } = await supabase
    .from('conversation_summaries')
    .select('id')
    .eq('room_id', roomId)
    .eq('date', today)
    .single();

  if (existing) {
    await supabase
      .from('conversation_summaries')
      .update({ summary, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('conversation_summaries')
      .insert({
        room_id: roomId,
        date: today,
        summary
      });
  }
};
```

### 4. 전체 요약 실행 함수

```typescript
const summarizeAllRooms = async () => {
  const rooms = ['plani', 'maki', 'devi', 'searchi', 'modi'];
  const results = [];

  for (const roomId of rooms) {
    // 1. 오늘 대화 가져오기
    const messages = await getTodayMessages(roomId);
    
    if (messages.length === 0) {
      results.push({ roomId, status: 'skipped', reason: '오늘 대화 없음' });
      continue;
    }

    // 2. 요약 생성
    const summary = await generateSummary(roomId, messages);
    
    if (!summary) {
      results.push({ roomId, status: 'failed', reason: '요약 생성 실패' });
      continue;
    }

    // 3. 저장
    await saveSummary(roomId, summary);
    results.push({ roomId, status: 'success', messageCount: messages.length });
  }

  return results;
};
```

---

## 컴포넌트

### 모디방에 버튼 추가

```typescript
// ModiRoom.tsx 또는 ChatRoom.tsx (modi일 때)

const [isSummarizing, setIsSummarizing] = useState(false);
const [summaryResult, setSummaryResult] = useState<string | null>(null);

const handleSummarizeAll = async () => {
  setIsSummarizing(true);
  setSummaryResult(null);

  try {
    const results = await summarizeAllRooms();
    
    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    
    setSummaryResult(`✅ ${successCount}개 방 요약 완료, ${skippedCount}개 방 대화 없음`);
  } catch (error) {
    setSummaryResult('❌ 요약 저장 실패');
  } finally {
    setIsSummarizing(false);
  }
};

// JSX
{roomId === 'modi' && (
  <div className="p-4 border-t">
    <button
      onClick={handleSummarizeAll}
      disabled={isSummarizing}
      className="w-full py-2 px-4 bg-yellow-100 hover:bg-yellow-200 rounded-lg text-yellow-800 font-medium disabled:opacity-50"
    >
      {isSummarizing ? '📋 요약 중...' : '📋 오늘 대화 전체 요약'}
    </button>
    {summaryResult && (
      <p className="mt-2 text-sm text-center text-gray-600">{summaryResult}</p>
    )}
  </div>
)}
```

---

## conversation_summaries 테이블 구조 확인

```sql
-- 이미 있는 테이블 (확인용)
conversation_summaries (
  id UUID,
  room_id TEXT,           -- 'plani', 'maki', 'devi', 'searchi', 'modi'
  conversation_id UUID,   -- nullable (전체 요약이면 null)
  date DATE,
  summary TEXT,
  key_points ARRAY,       -- 선택
  action_items JSONB,     -- 선택
  decisions ARRAY,        -- 선택
  topics ARRAY,           -- 선택
  created_at TIMESTAMP
)
```

---

## 요약 결과 예시

```
플래니방 요약:
"와디즈 펀딩 전략 논의. 2월 말 오픈 목표 확정. 
프롬프트 작업 우선순위 1순위로 결정. 
리스크: 프롬프트 지연 시 일정 영향."

마키방 요약:
"스레드 콘텐츠 방향 논의. 정보성보다 공감 콘텐츠로 결정.
재미테스트 활용한 유입 전략 수립.
이번 주 콘텐츠 3개 기획 완료."

...
```

---

## 파일 구조

```
src/
├── services/
│   └── summary.service.ts    # 요약 관련 함수들
├── components/
│   └── ChatRoom/
│       └── SummaryButton.tsx  # 요약 버튼 컴포넌트 (선택)
```

---

## 구현 순서

1. `summary.service.ts` 생성 - getTodayMessages, generateSummary, saveSummary, summarizeAllRooms
2. 모디방 컴포넌트에 버튼 추가
3. 버튼 클릭 시 summarizeAllRooms 호출
4. 결과 표시

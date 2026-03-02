/**
 * @file src/utils/actionExtractor.ts
 * @description AI 응답에서 할일/액션 아이템 자동 추출
 * - 명시적 할일 섹션이 있는 응답에서만 추출
 * - 회의 액션 아이템 패턴 (모디 정리)
 * - 체크리스트 패턴 (- [ ])
 * - 일반 할일 패턴 (~하기, ~완료 등)
 * - 중복 제거, 최대 5개 반환
 */

export interface ExtractedAction {
  type: 'task';
  title: string;
  date?: string;
  priority?: 'high' | 'medium' | 'low';
  originalText: string;
}

/** 날짜 추출 */
function extractDate(text: string): string | undefined {
  // "3월 5일", "3/5", "내일", "이번 주" 등
  const match = text.match(/(\d{1,2}월\s*\d{1,2}일)/);
  if (match) {
    const [, dateStr] = match;
    const mMatch = dateStr.match(/(\d{1,2})월\s*(\d{1,2})일/);
    if (mMatch) {
      const year = new Date().getFullYear();
      const month = parseInt(mMatch[1], 10);
      const day = parseInt(mMatch[2], 10);
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return undefined;
}

/** 긴급도 감지 */
function detectPriority(text: string): 'high' | 'medium' | 'low' | undefined {
  if (/긴급|급|ASAP|즉시|당장|시급|최우선/.test(text)) return 'high';
  return undefined;
}

/** 텍스트 정리 (마크다운 제거, 트림) */
function cleanTitle(raw: string): string {
  return raw
    .replace(/\*\*/g, '')           // bold 제거
    .replace(/`/g, '')              // code 제거
    .replace(/^[-•→▶]\s*/, '')      // 리스트 마커 제거
    .replace(/\[?\s*\]?\s*/, '')    // 체크박스 제거
    .replace(/기한:\s*.+$/, '')     // 기한 부분 제거
    .replace(/담당:\s*\S+\s*[—-]\s*/, '') // 담당 부분 제거
    .trim();
}

/** 할일 추출 대상인지 판별 (명시적 할일 섹션이 있는 응답만) */
function hasActionSection(text: string): boolean {
  return /액션\s*아이템|할\s*일|체크리스트|To-?Do|다음\s*단계|실행\s*항목|\[\s*\]/.test(text);
}

export function extractActionItems(text: string): ExtractedAction[] {
  // 명시적 할일 섹션이 없으면 추출하지 않음
  if (!hasActionSection(text)) return [];

  const actions: ExtractedAction[] = [];
  const seen = new Set<string>();

  const addAction = (title: string, originalText: string) => {
    const cleaned = cleanTitle(title);
    if (cleaned.length < 3 || cleaned.length > 80) return;
    // 중복 방지 (유사한 제목)
    const key = cleaned.slice(0, 20).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    actions.push({
      type: 'task',
      title: cleaned,
      date: extractDate(originalText),
      priority: detectPriority(originalText),
      originalText,
    });
  };

  // 1. 회의 액션 아이템 (모디 정리)
  //    "- [ ] 담당: 플래니 — 사주궁합 프롬프트 마무리 — 기한: 3월 5일"
  const meetingPattern = /[-•]\s*\[?\s*\]?\s*담당:\s*\S+\s*[—-]\s*(.+?)(?:\s*[—-]\s*기한:\s*(.+))?$/gm;
  let match;
  while ((match = meetingPattern.exec(text)) !== null) {
    addAction(match[1], match[0]);
  }

  // 2. 체크리스트 패턴 "- [ ] ..."
  const checklistPattern = /[-•]\s*\[\s*\]\s+(.+)/gm;
  while ((match = checklistPattern.exec(text)) !== null) {
    // 이미 회의 패턴에서 잡힌 건 skip
    if (!/담당:/.test(match[0])) {
      addAction(match[1], match[0]);
    }
  }

  // 3. "~해야", "~하기", "~완료", "~작성", "~확인", "~준비", "~마무리" 패턴
  const taskEndPattern = /[-•→▶]\s*(.+(?:하기|완료|작성|제출|확인|준비|마무리|시작|진행|검토|업데이트))\s*$/gm;
  while ((match = taskEndPattern.exec(text)) !== null) {
    addAction(match[1], match[0]);
  }

  return actions.slice(0, 5);
}

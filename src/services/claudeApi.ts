/**
 * @file src/services/claudeApi.ts
 * @description Claude API + YES24 크롤링 연동
 * - YES24에서 ISBN으로 목차 원본 크롤링
 * - Claude API로 형식 정리만 수행
 * - Vite 프록시: /api/claude → api.anthropic.com, /api/yes24 → yes24.com
 */

import { searchBooks } from './aladinApi';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

/**
 * YES24에서 ISBN으로 검색 → 상품 ID 추출
 */
async function searchYes24(isbn: string): Promise<string[]> {
  const res = await fetch(`/api/yes24/Product/Search?domain=BOOK&query=${isbn}`);
  if (!res.ok) {
    console.warn('[TOC] YES24 검색 실패:', res.status);
    return [];
  }

  const html = await res.text();
  const matches = html.match(/goods\/(\d+)/gi) || [];
  const ids = [...new Set(matches.map((m) => m.replace(/goods\//i, '')))];
  console.log('[TOC] YES24 상품 IDs:', ids);
  return ids.slice(0, 3);
}

/**
 * YES24 상품 페이지에서 목차 텍스트 추출
 */
async function fetchYes24Toc(goodsId: string): Promise<string | null> {
  const res = await fetch(`/api/yes24/Product/Goods/${goodsId}`);
  if (!res.ok) {
    console.warn('[TOC] YES24 상품 페이지 실패:', goodsId, res.status);
    return null;
  }

  const html = await res.text();
  const tocIdx = html.indexOf('infoset_toc');
  if (tocIdx === -1) {
    console.warn('[TOC] infoset_toc 섹션 없음:', goodsId);
    return null;
  }

  const chunk = html.slice(tocIdx, tocIdx + 10000);
  const match = chunk.match(/<textarea[^>]*class="txtContentText"[^>]*>([\s\S]*?)<\/textarea>/);
  if (!match) {
    console.warn('[TOC] textarea 매칭 실패:', goodsId);
    return null;
  }

  const raw = match[1]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();

  console.log('[TOC] 크롤링 성공:', goodsId, '줄 수:', raw.split('\n').length);
  return raw || null;
}

/**
 * ISBN으로 YES24에서 목차 크롤링
 */
export async function crawlBookToc(isbn: string): Promise<string | null> {
  const goodsIds = await searchYes24(isbn);
  if (goodsIds.length === 0) return null;

  // 여러 상품 중 목차가 있는 첫 번째 사용
  for (const id of goodsIds) {
    const toc = await fetchYes24Toc(id);
    if (toc) return toc;
  }
  return null;
}

/**
 * Claude API로 목차 형식 정리
 */
async function formatTocWithClaude(rawToc: string, title: string): Promise<string[]> {
  const res = await fetch('/api/claude/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `아래 목차 원본을 '챕터번호-세부번호 제목' 형식으로 정리해줘. 규칙:
- 서문, 추천사, 개정판 서문 등은 완전히 제외 (목차에 넣지 마)
- 프롤로그/들어가며가 0장의 시작. 프롤로그 자체는 제목에서 빼고 그 뒤 소제목부터 0-1
  예: "프롤로그 | 30대 초반..." → 0-1 30대 초반...
- 챕터 이름(CHAPTER1, 1장, Part1 등)은 제외하고 소제목만 넣어
- 에필로그/맺음말은 마지막 챕터+1 번호로. 에필로그 뒤 소제목만 넣기
- 부록/참고/독자후기 등은 완전히 제외
- 각 챕터 안의 소제목은 챕터번호-순서로
- 소제목의 "1막/", "2막/" 같은 접두사는 제거하고 본제목만
- 각 줄에 하나씩, 다른 설명 없이 목차만 출력해

예시:
원본: 프롤로그 | 30대 초반, 일하지 않아도... / 인생에도 공략집이 있다면 / CHAPTER1 ... / 1막/ 3개의 벽_ 설명
결과:
0-1 30대 초반, 일하지 않아도 월 1억씩 버는 자동 수익이 완성되다
0-2 인생에도 공략집이 있다면
1-1 3개의 벽_ 인생에서 절대 넘을 수 없을 거라 믿었던 것

책: ${title}

목차 원본:
${rawToc}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Claude API 호출 실패');
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text || '';

  return text
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => /^\d+-\d+\s/.test(line));
}

/**
 * 도서 목차 생성 (메인 함수)
 * 1. YES24에서 목차 크롤링
 * 2. Claude로 형식 정리
 * 3. 크롤링 실패 시 Claude가 추측으로 생성 (폴백)
 */
export async function generateBookToc(title: string, author: string, isbn?: string): Promise<string[]> {
  let rawToc: string | null = null;
  let resolvedIsbn = isbn;

  // 0. ISBN 없으면 알라딘에서 제목으로 검색해서 확보
  if (!resolvedIsbn && title) {
    console.log('[TOC] ISBN 없음, 알라딘에서 검색:', title);
    const results = await searchBooks(title).catch(() => []);
    if (results.length > 0) {
      resolvedIsbn = results[0].isbn13;
      console.log('[TOC] 알라딘에서 ISBN 확보:', resolvedIsbn);
    }
  }

  // 1. ISBN이 있으면 YES24에서 크롤링 시도
  if (resolvedIsbn) {
    console.log('[TOC] YES24 크롤링 시도, ISBN:', resolvedIsbn);
    rawToc = await crawlBookToc(resolvedIsbn).catch((e) => {
      console.warn('[TOC] 크롤링 에러:', e);
      return null;
    });
  }

  console.log('[TOC] 크롤링 결과:', rawToc ? `성공 (${rawToc.length}자)` : '실패 → Claude 폴백');

  // 2. 크롤링 성공 → Claude로 형식 정리만
  if (rawToc) {
    return formatTocWithClaude(rawToc, title);
  }

  // 3. 크롤링 실패 → Claude가 추측으로 생성 (폴백)
  const res = await fetch('/api/claude/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `이 책의 목차를 '챕터번호-세부번호 제목' 형식으로 정리해줘.
프롤로그/들어가며는 0장으로.
에필로그/나가며는 마지막 장 다음 번호로.
각 줄에 하나씩, 다른 설명 없이 목차만 출력해.

형식 예시:
0-1 프롤로그
1-1 첫 번째 소제목
1-2 두 번째 소제목

책: ${title}
저자: ${author}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Claude API 호출 실패');
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text || '';

  return text
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => /^\d+-\d+\s/.test(line));
}

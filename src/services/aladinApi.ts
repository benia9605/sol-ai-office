/**
 * @file src/services/aladinApi.ts
 * @description 알라딘 API 연동 서비스
 * - 도서 검색 (ItemSearch)
 * - 도서 상세 조회 (ItemLookUp) - 목차, 페이지수
 * - Vite 프록시를 통해 CORS 우회 (/api/aladin → aladin.co.kr/ttb/api)
 */

const TTB_KEY = import.meta.env.VITE_ALADIN_TTB_KEY;

/** 알라딘 검색 결과 아이템 */
export interface AladinSearchItem {
  title: string;
  author: string;
  isbn13: string;
  cover: string;          // 이미지 URL
  categoryName: string;   // "국내도서>자기계발>성공학" 형태
  priceStandard: number;
  priceSales: number;
  link: string;
  pubDate: string;
  publisher: string;
  description: string;
}

/** 알라딘 상세 결과 */
export interface AladinDetailItem extends AladinSearchItem {
  subInfo?: {
    itemPage?: number;
    toc?: string;
  };
}

/**
 * 도서 검색
 */
export async function searchBooks(query: string): Promise<AladinSearchItem[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    ttbkey: TTB_KEY,
    Query: query,
    QueryType: 'Keyword',
    MaxResults: '10',
    output: 'js',
    Version: '20131101',
    Cover: 'Big',
  });

  const res = await fetch(`/api/aladin/ItemSearch.aspx?${params}`);
  if (!res.ok) throw new Error('알라딘 검색 실패');

  const data = await res.json();
  return data.item || [];
}

/**
 * 도서 상세 조회 (목차, 페이지수)
 */
export async function getBookDetail(isbn13: string): Promise<AladinDetailItem | null> {
  const params = new URLSearchParams({
    ttbkey: TTB_KEY,
    itemIdType: 'ISBN13',
    ItemId: isbn13,
    output: 'js',
    Version: '20131101',
    OptResult: 'Toc,itemPage',
    Cover: 'Big',
  });

  const res = await fetch(`/api/aladin/ItemLookUp.aspx?${params}`);
  if (!res.ok) throw new Error('알라딘 상세 조회 실패');

  const data = await res.json();
  return data.item?.[0] || null;
}

/**
 * 카테고리 문자열을 태그 배열로 파싱
 * "국내도서>자기계발>성공학" → ["자기계발", "성공학"]
 */
export function parseCategoryToTags(categoryName: string): string[] {
  if (!categoryName) return [];
  const parts = categoryName.split('>').map((s) => s.trim());
  // 첫 번째("국내도서" 등)를 제외한 나머지
  return parts.slice(1).filter(Boolean);
}

/**
 * 알라딘 TOC HTML을 챕터 배열로 파싱
 * 알라딘 TOC는 보통 "<br/>" 구분 또는 줄바꿈으로 챕터가 나열됨
 * 예: "1장 제목<br/>2장 제목<br/>..." → ["1장 제목", "2장 제목", ...]
 */
export function parseTocToChapters(toc: string): string[] {
  if (!toc) return [];
  return toc
    .replace(/<br\s*\/?>/gi, '\n')     // <br/> → 줄바꿈
    .replace(/<[^>]*>/g, '')            // 나머지 HTML 태그 제거
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

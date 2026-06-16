````markdown
# AI 직원 #2 — 상세페이지 자동 생성 담당

## 역할 정의
"정보만 넣으면 알아서 상세페이지 제작해주는 직원"
상품 정보와 사진 1장만 주면, 실제 사용 가능한 상세페이지 기획안을
마크다운/Word 형식으로 바로 출력한다.
→ 이게 3개 브랜드 통틀어 **가장 임팩트 큰 AI 직원**

## 브랜드별 상세페이지 스타일

| 브랜드 | 히어로 섹션 | 강조 포인트 | 톤 |
|--------|------------|------------|-----|
| 운명랩 | 감성 카피 + 무드샷 | "이 제품이 있는 일상" 스토리텔링 | 말랑말랑, 따뜻함 |
| 쏠닝포인트 | 성분/효능 넘버링 | 임상 근거, 원료 원산지, mg 수치 | 신뢰, 전문적 |
| 시목 | 원목 결 클로즈업 | 제작 과정, 소재 설명, 사이즈 도면 | 장인, 자연, 따뜻 |

## 주요 기능

### 기능 1: 상세페이지 기획안 생성
- 인풋:
  - 상품명
  - 핵심 특장점 (3-5개 불릿)
  - 타겟 고객
  - 가격
  - 참고 이미지 (선택, 업로드)
- 아웃풋 (마크다운):
[브랜드] 상품명 상세페이지 기획안
1. 히어로 섹션

메인 카피:
서브 카피:
추천 이미지 컨셉:

2. 문제 제기 섹션

고객 페인포인트:
공감 카피:

3. 솔루션 섹션

핵심 특장점 1: [카피]
핵심 특장점 2: [카피]
핵심 특장점 3: [카피]

4. 신뢰/증거 섹션

추천 콘텐츠 유형:
인증/수상 내용:

5. 사용 후기 섹션 (템플릿)

리뷰 수집 포인트:

6. CTA 섹션

마무리 카피:
구매 혜택 문구:


### 기능 2: 섹션별 카피 재생성
- 마음에 안 드는 섹션만 선택 → 재생성
- "더 감성적으로", "더 전문적으로" 톤 조정

### 기능 3: 스마트스토어 상품 설명 텍스트 변환
- 기획안 → 실제 스마트스토어에 붙여넣기 가능한 HTML 텍스트 형식으로 변환

## API 설계

### POST /api/agents/detail-page

```typescript
// Request
{
  brandId: string,
  mode: 'generate' | 'regenerate-section' | 'convert-html',
  input: {
    productName: string,
    features: string[],      // 핵심 특장점
    targetCustomer: string,
    price: number,
    additionalInfo?: string,
    imageUrl?: string        // Supabase Storage URL
  },
  // regenerate-section 모드일 때
  sectionName?: string,
  toneAdjustment?: 'more-emotional' | 'more-professional' | 'shorter' | 'longer',
  existingContent?: string
}
```

### POST /api/upload/image
```typescript
// 이미지 → Supabase Storage 업로드 → URL 반환
```

## 시스템 프롬프트 구조

```typescript
/lib/prompts/detailPage.ts

export const DETAIL_PAGE_SYSTEM_PROMPT = (brand: BrandConfig) => `
당신은 ${brand.name}의 상세페이지 전문 카피라이터 AI 직원입니다.

[브랜드 컨텍스트]
${brand.detailPageStyle}

[핵심 원칙]
1. 고객이 스크롤을 멈추는 카피를 먼저 씁니다
2. 특장점은 "기능" 말고 "고객 이익"으로 표현합니다
   (예: "경량 소재" → "하루종일 들어도 손목이 안 아파요")
3. 국내 이커머스 구매 심리에 맞게 신뢰/증거를 중간에 배치합니다
4. 결과물은 바로 복사해서 쓸 수 있는 완성본으로 줍니다

[출력 형식]
마크다운으로 섹션별 구분하여 출력합니다.
각 섹션에 카피 + 이미지 컨셉 제안을 함께 제공합니다.
`
```

## UI 컴포넌트 명세
<DetailPageAgent>
  ├── <BrandSelector />
  ├── <ProductInfoForm>
  │     ├── <ProductNameInput />
  │     ├── <FeaturesInput />        ← 태그 형태로 특장점 추가
  │     ├── <TargetCustomerInput />
  │     ├── <PriceInput />
  │     ├── <ImageUploader />        ← 드래그앤드롭 이미지 업로드
  │     └── <GenerateButton />
  ├── <ResultPanel>
  │     ├── <SectionedResult>        ← 섹션별로 분리된 결과
  │     │     └── <SectionCard>      ← 각 섹션 + 재생성 버튼
  │     ├── <ToneAdjuster />         ← "더 감성적으로" 등 버튼
  │     ├── <CopyAllButton />
  │     ├── <DownloadWordButton />   ← .docx 다운로드
  │     └── <SaveButton />
  └── <HistoryList />
````
파일 출력 구현 (docx)
패키지: docx (npm)
결과 마크다운 → docx 변환 → Blob → 다운로드
DB 스키마
sqlCREATE TABLE detail_page_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  input JSONB NOT NULL,
  output TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
개발 난이도: ⭐⭐⭐ (중간)
Claude Code 구현 예상 시간: 4-6시간
핵심 난관: 이미지 업로드 + 섹션별 재생성 UX

/**
 * @file src/components/office/BrandView.tsx
 * @description 회사 브레인(brand_contexts) 입력 화면 — AI 직원 프롬프트 ①계층
 * - 사장이 회사 정체성/톤/USP/금지표현 등을 직접 입력 → 모든 직원이 공유.
 * - 설계: docs/guides/ai오피스구축/_직원별_실행스펙_시목.md §0
 */
import { useEffect, useState } from 'react';
import { Workspace, BrandContext } from '../../types';
import { fetchBrandContext, saveBrandContext } from '../../services/brandContexts.service';
import { ViewHead, Card } from './ui';

/** 사업을 잘 아는 AI(클로드/GPT)에게 회사 브레인 16개 항목을 최적으로 받아오는 프롬프트 */
function buildBrandPrompt(bizName: string): string {
  return `나는 "${bizName}"의 1인 AI 가상 오피스를 만들고 있어. 여기엔 마케팅·CS·콘텐츠 등 여러 AI 직원이 있고, 모두가 공유하는 "회사 브레인"(회사의 정체성·강점·규칙)을 먼저 채워야 해.

너는 우리(${bizName}) 사업에 대해 그동안 나눈 대화/맥락을 잘 알고 있으니, 그걸 바탕으로 아래 항목들을 우리 사업에 맞게 **구체적이고 실전적으로** 작성해줘. 내가 그대로 복사해서 칸에 붙여넣을 거야.

[작성 규칙]
- 각 항목을 "■ 항목명" 다음 줄에 내용만 적어줘 (설명·서론 없이 바로).
- 추상적 미사여구 말고, 실제 광고·CS·콘텐츠에 바로 쓸 수 있게 구체적으로.
- 여러 개를 적는 항목(USP, 금지표현)은 한 줄에 하나씩 줄바꿈.
- 확신이 안 서는 사실(가격·경쟁사 등)은 합리적으로 제안하되 끝에 "(확인 필요)"를 붙여줘.
- 모르는 건 지어내지 말고 "(확인 필요)"로 비워둬.

[채워줄 항목]
■ 정체성 한 줄  (브랜드를 한 문장으로)
■ 카테고리  (무엇을 파는 사업인지)
■ 톤앤매너  (말투·분위기 키워드 + 피해야 할 톤)
■ 주요 타겟  (핵심 고객층)
■ 핵심 USP  (경쟁사 대비 강점, 여러 개 줄바꿈)
■ 판매 채널  (스마트스토어/인스타 등)
■ 가격 포지셔닝  (저가/중가/프리미엄 + 이유)
■ 광고 소구점  (광고에서 밀 핵심 메시지)
■ 주력 상품  (대표 상품 몇 개)
■ 대표 가격대  (상품군별 가격 범위)
■ 주요 경쟁사  (비교될 브랜드/몰)
■ 창업 스토리·차별점  (시작 배경 + 결정적 차별점, 한 문단)
■ 금지표현  (광고법·브랜드상 쓰면 안 되는 표현, 여러 개 줄바꿈)
■ CS 정책  (배송/교환/환불/파손 기준)
■ CS 응대 톤  (고객 응대 말투·원칙)
■ 자유 서술  (위 항목에 안 담긴 중요한 맥락)`;
}

type Form = {
  identity: string; category: string; tone: string; target: string;
  usp: string; channels: string; pricePosition: string; adAngle: string;
  compliance: string; mainProducts: string; priceRange: string;
  competitors: string; story: string; csPolicies: string; csTone: string; raw: string;
};
const EMPTY: Form = {
  identity: '', category: '', tone: '', target: '', usp: '', channels: '',
  pricePosition: '', adAngle: '', compliance: '', mainProducts: '',
  priceRange: '', competitors: '', story: '', csPolicies: '', csTone: '', raw: '',
};

function fromBC(bc: BrandContext): Form {
  return {
    identity: bc.identity ?? '', category: bc.category ?? '', tone: bc.tone ?? '',
    target: bc.target ?? '', usp: bc.usp ?? '', channels: bc.channels ?? '',
    pricePosition: bc.pricePosition ?? '', adAngle: bc.adAngle ?? '',
    compliance: bc.compliance ?? '', mainProducts: bc.mainProducts ?? '',
    priceRange: bc.priceRange ?? '', competitors: bc.competitors ?? '',
    story: bc.story ?? '', csPolicies: bc.csPolicies ?? '', csTone: bc.csTone ?? '', raw: bc.raw ?? '',
  };
}

export function BrandView({ workspace }: { workspace: Workspace }) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildBrandPrompt(workspace.name));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('복사에 실패했어요. 직접 선택해서 복사해주세요.');
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchBrandContext(workspace.id)
      .then(bc => setForm(bc ? fromBC(bc) : EMPTY))
      .catch(() => setForm(EMPTY))
      .finally(() => setLoading(false));
  }, [workspace.id]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setForm(f => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await saveBrandContext(workspace.id, form);
      setSaved(true);
    } catch (err) {
      alert('저장에 실패했어요: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, k, hint, textarea, warn }: { label: string; k: keyof Form; hint?: string; textarea?: boolean; warn?: boolean }) => (
    <div>
      <label className={`block text-xs font-semibold mb-1 ${warn ? 'text-rose-500' : 'text-gray-600'}`}>{label}</label>
      {textarea ? (
        <textarea
          value={form[k]} onChange={set(k)} rows={3}
          placeholder={hint}
          className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-primary-400 focus:outline-none resize-none leading-relaxed"
        />
      ) : (
        <input
          value={form[k]} onChange={set(k)}
          placeholder={hint}
          className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-primary-400 focus:outline-none"
        />
      )}
    </div>
  );

  return (
    <>
      <ViewHead
        eyebrow="COMPANY BRAIN"
        title="회사 브레인"
        sub="모든 AI 직원이 공유하는 회사의 정체성 · 한 번 입력하면 전 직원 프롬프트에 자동 반영"
        action={
          <button
            onClick={copyPrompt}
            title="클로드·GPT에 붙여넣어 항목을 자동으로 채워보세요"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-gray-200 text-xs font-semibold text-gray-600 hover:border-primary-400 hover:text-primary-600 transition-all active:scale-95"
          >
            {copied ? (
              <>✓ 복사됨</>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
                AI로 채우기 프롬프트
              </>
            )}
          </button>
        }
      />

      {loading ? (
        <p className="text-xs text-gray-300 py-8 text-center">불러오는 중…</p>
      ) : (
        <div className="space-y-3">
          <Card className="p-5 space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">기본 정체성</div>
            <Field label="정체성 한 줄" k="identity" hint="예: 시목 — 오래 쓰는 원목 가구·소품. 기준 있는 선택." />
            <Field label="카테고리" k="category" hint="예: 원목 인테리어 가구/소품" />
            <Field label="톤앤매너" k="tone" hint="예: 장인·자연·따뜻·담백. 과장 금지." />
            <Field label="주요 타겟" k="target" hint="예: 2030 신혼·자취 + 친환경 니즈" />
          </Card>

          <Card className="p-5 space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">강점 · 판매</div>
            <Field label="핵심 USP (줄바꿈으로 여러 개)" k="usp" textarea hint={'예: 통원목 한 장\n천연오일 마감\n국내 수작업'} />
            <Field label="판매 채널" k="channels" hint="예: 네이버 스마트스토어, 인스타그램" />
            <Field label="가격 포지셔닝" k="pricePosition" hint="예: 프리미엄 (가격 정당화 필요)" />
            <Field label="광고 소구점" k="adAngle" hint="예: 품질 · 원목 · 오래가는" />
          </Card>

          <Card className="p-5 space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">상품 · 시장 <span className="text-gray-300 normal-case">(채울수록 직원이 똑똑해져요)</span></div>
            <Field label="주력 상품" k="mainProducts" hint="예: 티크 도마, OO 원목 식탁" />
            <Field label="대표 가격대" k="priceRange" hint="예: 3~5만원 (소품) / 20~40만원 (식탁)" />
            <Field label="주요 경쟁사" k="competitors" hint="예: OO몰, △△브랜드" />
            <Field label="창업 스토리 · 차별점" k="story" textarea hint="시목이 어떻게 시작됐고 결정적 차별점은 무엇인지 한 문단" />
          </Card>

          <Card className="p-5 space-y-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">규제 · 자유 입력</div>
            <Field label="⚠️ 금지표현 (줄바꿈으로 여러 개)" k="compliance" textarea warn hint={"예: '평생 보장' 단정 금지\n'100% 무독성'은 근거 있을 때만"} />
      <Field label="💬 CS 정책 (배송/교환/환불/파손 기준)" k="csPolicies" textarea hint={"예: 단순변심 교환은 수령 7일 내·왕복배송비 고객부담\n파손은 사진 확인 후 무료 재배송\n주문 제작품은 환불 불가"} />
      <Field label="💬 CS 응대 톤" k="csTone" textarea hint="예: 정중한 존댓말, 이모지 최소, 먼저 공감 후 해결책. 환불은 정책 내 최대한 수용적으로" />
            <Field label="자유 서술 (AI에 그대로 전달)" k="raw" textarea hint="위 항목으로 안 담기는 추가 맥락을 자유롭게" />
          </Card>

          <div className="flex items-center gap-3 pt-1 pb-6">
            <button
              onClick={onSave} disabled={saving}
              className="px-5 py-2.5 rounded-2xl bg-primary-500 text-white text-sm font-bold hover:bg-primary-600 transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '회사 브레인 저장'}
            </button>
            {saved && <span className="text-sm text-emerald-500 font-medium">✓ 저장됐어요 · 다음 실행부터 반영돼요</span>}
          </div>
        </div>
      )}
    </>
  );
}

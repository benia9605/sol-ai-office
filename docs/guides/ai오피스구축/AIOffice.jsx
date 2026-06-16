import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown, Plus, Check, Sparkles, FileText, Calendar,
  TrendingUp, Activity, Users, Settings, Search, Bell,
  Zap, Coffee, MoreHorizontal, ArrowUpRight, Cpu, Hash,
  LayoutDashboard, Bot, CheckSquare, BarChart3, Pause, Play,
  Clock, MessageSquare, ChevronRight, Filter, Flame,
  PenLine, Copy, Send, Image, Sun
} from "lucide-react";

/* ───────────────────────── data ───────────────────────── */

const WORKSPACES = [
  { id: "unmyunglab", name: "운명랩", tag: "정감메이트", color: "#8B6F47", accent: "#b89968", glyph: "運" },
  { id: "solning", name: "쏠닝포인트", tag: "쏠닝포인트", color: "#3B6FB0", accent: "#6a97d4", glyph: "S" },
  { id: "solningoz", name: "쏠닝오즈", tag: "쏠닝포인트", color: "#9B5DE5", accent: "#bb8af0", glyph: "OZ" },
  { id: "simok", name: "시목", tag: "우드 브랜드", color: "#5A7D5A", accent: "#83a883", glyph: "木" },
];

const NAV = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { id: "briefing", label: "오늘의 브리핑", icon: Sun },
  { id: "staff", label: "AI 직원", icon: Bot },
  { id: "todos", label: "할일", icon: CheckSquare },
  { id: "schedule", label: "일정", icon: Calendar },
  { id: "insights", label: "인사이트", icon: BarChart3 },
  { id: "log", label: "기록", icon: Activity },
  { id: "members", label: "멤버", icon: Users },
];

const STAFF = {
  unmyunglab: [
    { name: "마케터", role: "Threads · 콘텐츠 발행", state: "working", task: "2027 운명 캘린더 티저 작성 중", icon: TrendingUp, done: 142, today: 8, uptime: "37일" },
    { name: "SNS 콘텐츠 제작", role: "Threads · 인스타 게시물 작성", state: "working", task: "인스타 게시물 2건 초안 작성 중", icon: PenLine, done: 86, today: 4, uptime: "37일" },
    { name: "리서처", role: "트렌드 · 키워드 수집", state: "working", task: "사주 키워드 검색량 모니터링", icon: Search, done: 318, today: 24, uptime: "37일" },
    { name: "CS봇", role: "고객 문의 1차 대응", state: "idle", task: "대기 중 · 마지막 응답 12분 전", icon: MessageSquare, done: 891, today: 17, uptime: "37일" },
    { name: "리포트빌더", role: "궁합 리포트 생성", state: "working", task: "신규 주문 3건 렌더링", icon: FileText, done: 4821, today: 31, uptime: "37일" },
  ],
  solning: [
    { name: "콘텐츠 작가", role: "노션 템플릿 소개글", state: "working", task: "쏠닝노트 신규 템플릿 카피", icon: FileText, done: 56, today: 3, uptime: "21일" },
    { name: "SNS 매니저", role: "인스타 · 스레드", state: "idle", task: "예약 발행 대기 2건", icon: TrendingUp, done: 124, today: 0, uptime: "21일" },
  ],
  solningoz: [
    { name: "브랜드 보이스", role: "톤앤매너 관리", state: "working", task: "오즈 세계관 카피 정리", icon: Sparkles, done: 33, today: 5, uptime: "9일" },
  ],
  simok: [
    { name: "비주얼 기획", role: "인스타 스토리텔링", state: "idle", task: "민석 검수 대기 중", icon: Sparkles, done: 47, today: 0, uptime: "54일" },
  ],
};

const TODOS = {
  unmyunglab: [
    { t: "와디즈 72시간 이벤트 종료 정산", done: false, by: "auto", tag: "정산", prio: "high" },
    { t: "캘린더 PDF 최종 검수", done: false, by: "manual", tag: "제품", prio: "high" },
    { t: "리워드 발송 안내 문자 초안 작성", done: true, by: "auto", tag: "CS", prio: "mid" },
    { t: "Supabase 스키마 백업", done: true, by: "auto", tag: "개발", prio: "low" },
    { t: "신규 후기 이벤트 기획", done: false, by: "manual", tag: "마케팅", prio: "mid" },
  ],
  solning: [
    { t: "신규 템플릿 상세페이지 업로드", done: false, by: "manual", tag: "출시", prio: "high" },
    { t: "구매 후기 리마인드 발송", done: true, by: "auto", tag: "CS", prio: "low" },
  ],
  solningoz: [{ t: "오즈 런칭 시퀀스 기획", done: false, by: "manual", tag: "기획", prio: "high" }],
  simok: [{ t: "신상 가구 촬영 일정 조율", done: false, by: "manual", tag: "촬영", prio: "mid" }],
};

const SCHEDULE = {
  unmyunglab: [
    { time: "10:00", t: "캘린더 데이터 점검", who: "리서처", live: false },
    { time: "14:00", t: "이벤트 종료 — 정산 시작", who: "마케터", live: true },
    { time: "18:00", t: "리워드 발송 리뷰", who: "Sol", live: false },
    { time: "21:00", t: "야간 리포트 일괄 생성", who: "리포트빌더", live: false },
  ],
  solning: [{ time: "11:00", t: "템플릿 업로드 마감", who: "Sol", live: false }, { time: "16:00", t: "주간 판매 리포트", who: "SNS 매니저", live: false }],
  solningoz: [{ time: "15:00", t: "런칭 회의", who: "Sol", live: false }],
  simok: [{ time: "13:00", t: "민석 검수 콜", who: "민석", live: false }],
};

const INSIGHTS = {
  unmyunglab: [
    { k: "와디즈 달성률", v: "184", unit: "%", up: true, sub: "목표 대비 · +12%", spark: [40, 55, 48, 70, 88, 120, 184] },
    { k: "리포트 전환율", v: "6.4", unit: "%", up: true, sub: "무료→유료 · +0.8%", spark: [4.1, 4.8, 5.2, 5.0, 5.9, 6.1, 6.4] },
    { k: "Threads 도달", v: "23.1", unit: "K", up: true, sub: "주간 · +41%", spark: [8, 11, 9, 14, 16, 19, 23] },
    { k: "신규 가입", v: "312", unit: "", up: true, sub: "이번 주 · +24%", spark: [120, 180, 150, 210, 250, 280, 312] },
  ],
  solning: [
    { k: "템플릿 판매", v: "47", unit: "건", up: true, sub: "이번 주 · +15%", spark: [12, 18, 22, 30, 35, 41, 47] },
    { k: "방문자", v: "1.2", unit: "K", up: false, sub: "주간 · -3%", spark: [1.4, 1.3, 1.35, 1.3, 1.25, 1.22, 1.2] },
  ],
  solningoz: [{ k: "런칭 D-day", v: "9", unit: "일", up: false, sub: "예정일까지", spark: [16, 15, 14, 13, 12, 10, 9] }],
  simok: [{ k: "인스타 팔로워", v: "1,204", unit: "", up: true, sub: "주간 · +38", spark: [1100, 1130, 1150, 1166, 1180, 1190, 1204] }],
};

const LOG = {
  unmyunglab: [
    { who: "마케터", act: "Threads에 캘린더 티저 발행", ago: "방금" },
    { who: "리포트빌더", act: "궁합 리포트 #4821 전달 완료", ago: "3분 전" },
    { who: "CS봇", act: "환불 문의 1건 응답", ago: "12분 전" },
    { who: "리서처", act: "'2027 신년운세' 검색 급상승 감지", ago: "31분 전" },
    { who: "Sol", act: "캘린더 표지 시안 V3 승인", ago: "1시간 전" },
    { who: "리포트빌더", act: "야간 배치 24건 생성 완료", ago: "3시간 전" },
    { who: "마케터", act: "주간 콘텐츠 캘린더 초안 작성", ago: "5시간 전" },
  ],
  solning: [
    { who: "콘텐츠 작가", act: "템플릿 소개글 초안 생성", ago: "8분 전" },
    { who: "Sol", act: "가격 정책 수정", ago: "2시간 전" },
  ],
  solningoz: [{ who: "브랜드 보이스", act: "세계관 카피 정리", ago: "20분 전" }],
  simok: [{ who: "민석", act: "신상 입고 등록", ago: "어제" }],
};

const MEMBERS = {
  unmyunglab: [{ n: "Sol", r: "오너", c: "#2b2820" }, { n: "별이", r: "콘텐츠", c: "#8B6F47" }],
  solning: [{ n: "Sol", r: "오너", c: "#2b2820" }],
  solningoz: [{ n: "Sol", r: "오너", c: "#2b2820" }],
  simok: [{ n: "Sol", r: "오너", c: "#2b2820" }, { n: "민석", r: "운영 총괄", c: "#5A7D5A" }],
};

/* 직원별 일과(매일 1회 자동 실행) + 날짜별 일일 리포트 아카이브 */
const STAFF_DETAIL = {
  "운명랩-마케터": {
    routines: ["매일 09:00 Threads 콘텐츠 1건 발행", "매일 21:00 다음날 콘텐츠 초안 작성", "주간 콘텐츠 캘린더 정리"],
    metric: { label: "일 평균 도달", spark: [3.1, 4.2, 3.8, 5.5, 6.1, 7.3, 8.4], unit: "K" },
    reports: [
      { date: "6/12 (어제)", title: "Threads 발행 1건 · 도달 8.4K", tags: ["발행", "+15%"], lines: ["'2027 운명 캘린더' 티저 발행 → 좋아요 312, 저장 88", "댓글 24건 중 18건이 사전 알림 신청 문의", "다음날 '신년운세 vs 토정비결' 콘텐츠 초안 작성 완료"] },
      { date: "6/11", title: "Threads 발행 1건 · 도달 7.3K", tags: ["발행"], lines: ["캘린더 제작 비하인드 발행 → 도달 7.3K", "저장률 4.1%로 주간 최고치"] },
      { date: "6/10", title: "Threads 발행 1건 · 도달 6.1K", tags: ["발행"], lines: ["사주 입문 카드뉴스 발행", "팔로워 +38"] },
    ],
  },
  "운명랩-SNS 콘텐츠 제작": {
    routines: ["매일 10:00 Threads 게시물 1건 작성", "매일 인스타 게시물 초안 + 이미지 브리프 작성", "승인된 초안 발행 또는 복붙 대기열에 등록"],
    metric: { label: "일 작성 게시물", spark: [2, 3, 4, 3, 5, 4, 4], unit: "건" },
    reports: [
      { date: "6/12 (어제)", title: "게시물 4건 작성 · 발행 2건 / 대기 2건", tags: ["작성", "발행"], lines: ["Threads 2건 자동 발행 완료", "인스타 2건은 복붙 대기열로 (이미지 브리프 포함)", "Sol 승인 1건 대기 중"] },
      { date: "6/11", title: "게시물 5건 작성 · 발행 3건", tags: ["작성"], lines: ["릴스 스크립트 1건 포함", "해시태그 세트 자동 생성"] },
    ],
  },
  "운명랩-리서처": {
    routines: ["매일 08:00 사주 키워드 검색량 수집", "급상승 키워드 감지 시 알림", "주간 경쟁 콘텐츠 스캔"],
    metric: { label: "추적 키워드", spark: [120, 124, 128, 131, 135, 140, 142], unit: "개" },
    reports: [
      { date: "6/12 (어제)", title: "키워드 142개 수집 · 급상승 3건", tags: ["수집", "급상승"], lines: ["'2027 신년운세' 검색량 전일 대비 +210%", "'토정비결 무료' 신규 진입 (주간 4위)", "'궁합 보는법' 꾸준히 상위권 유지"] },
      { date: "6/11", title: "키워드 140개 수집 · 급상승 1건", tags: ["수집"], lines: ["'사주 풀이' 검색량 소폭 상승", "경쟁 서비스 3곳 신규 콘텐츠 12건 감지"] },
      { date: "6/10", title: "키워드 135개 수집", tags: ["수집"], lines: ["특이 변동 없음", "주말 검색량 평균 대비 -8%"] },
    ],
  },
  "운명랩-CS봇": {
    routines: ["실시간 문의 1차 응답", "매일 18:00 미해결 문의 요약", "FAQ 자동 업데이트 제안"],
    metric: { label: "일 응답 건수", spark: [9, 12, 14, 11, 16, 15, 17], unit: "건" },
    reports: [
      { date: "6/12 (어제)", title: "문의 17건 응답 · 자동 처리율 76%", tags: ["CS", "76%"], lines: ["환불 문의 4건 중 3건 자동 응답으로 해결", "리포트 지연 문의 5건 → Sol에게 에스컬레이션", "평균 첫 응답 2분 14초"] },
      { date: "6/11", title: "문의 15건 응답 · 자동 처리율 80%", tags: ["CS"], lines: ["배송(이메일 전달) 문의 다수", "불만 0건"] },
      { date: "6/10", title: "문의 16건 응답 · 자동 처리율 69%", tags: ["CS"], lines: ["주문 변경 문의 집중", "에스컬레이션 5건"] },
    ],
  },
  "운명랩-리포트빌더": {
    routines: ["주문 접수 시 리포트 즉시 생성", "매일 21:00 야간 배치 생성", "생성 품질 자동 검증"],
    metric: { label: "일 생성 건수", spark: [18, 22, 25, 21, 28, 30, 31], unit: "건" },
    reports: [
      { date: "6/12 (어제)", title: "리포트 31건 생성 · 실패 0건", tags: ["생성", "100%"], lines: ["주간 최다 생성 (31건)", "평균 생성 시간 1분 48초", "야간 배치 24건 무오류 완료"] },
      { date: "6/11", title: "리포트 30건 생성 · 실패 1건", tags: ["생성"], lines: ["1건 GPT 타임아웃 → 재시도 후 성공", "품질 점수 평균 4.6/5"] },
      { date: "6/10", title: "리포트 28건 생성 · 실패 0건", tags: ["생성"], lines: ["특이사항 없음"] },
    ],
  },
  "쏠닝포인트-콘텐츠 작가": {
    routines: ["신규 템플릿 소개글 작성", "주간 블로그 1건 발행"],
    metric: { label: "일 생성 카피", spark: [2, 3, 2, 4, 3, 3, 3], unit: "건" },
    reports: [
      { date: "6/12 (어제)", title: "소개글 3건 작성", tags: ["작성"], lines: ["쏠닝노트 신규 템플릿 3종 상세 카피 완성", "SEO 키워드 자동 삽입"] },
      { date: "6/11", title: "소개글 3건 작성", tags: ["작성"], lines: ["블로그 '노션으로 가계부 만들기' 초안"] },
    ],
  },
  "쏠닝포인트-SNS 매니저": {
    routines: ["예약 발행 관리", "주간 판매 리포트 작성"],
    metric: { label: "주간 발행", spark: [4, 5, 3, 6, 5, 7, 6], unit: "건" },
    reports: [
      { date: "6/12 (어제)", title: "예약 발행 2건 대기", tags: ["예약"], lines: ["인스타 2건 예약 등록", "발행 시점 최적화 (오후 8시 제안)"] },
    ],
  },
  "쏠닝오즈-브랜드 보이스": {
    routines: ["톤앤매너 일관성 검토", "세계관 카피 정리"],
    metric: { label: "검토 카피", spark: [3, 4, 5, 4, 6, 5, 5], unit: "건" },
    reports: [
      { date: "6/12 (어제)", title: "세계관 카피 5건 정리", tags: ["정리"], lines: ["오즈 브랜드 세계관 문서 v2 정리", "런칭 슬로건 후보 8개 제안"] },
    ],
  },
  "시목-비주얼 기획": {
    routines: ["인스타 스토리텔링 기획", "신상 콘텐츠 초안"],
    metric: { label: "주간 기획", spark: [2, 1, 2, 0, 1, 0, 0], unit: "건" },
    reports: [
      { date: "6/11", title: "신상 콘텐츠 초안 1건", tags: ["기획"], lines: ["원목 식탁 시리즈 스토리 초안", "민석 검수 대기 중"] },
    ],
  },
};

/* 인사이트 확장: 급상승 키워드 랭킹 */
const KEYWORDS = {
  unmyunglab: [
    { kw: "2027 신년운세", vol: "+210%", rank: 1, hot: true },
    { kw: "토정비결 무료", vol: "신규 진입", rank: 4, hot: true },
    { kw: "궁합 보는법", vol: "+34%", rank: 2, hot: false },
    { kw: "사주 풀이", vol: "+12%", rank: 5, hot: false },
    { kw: "올해의 운세", vol: "+8%", rank: 7, hot: false },
  ],
  solning: [
    { kw: "노션 가계부 템플릿", vol: "+45%", rank: 1, hot: true },
    { kw: "노션 다이어리", vol: "+18%", rank: 3, hot: false },
  ],
  solningoz: [{ kw: "오즈 굿즈", vol: "신규", rank: 1, hot: true }],
  simok: [{ kw: "원목 식탁", vol: "+22%", rank: 1, hot: true }, { kw: "1인 가구 가구", vol: "+9%", rank: 4, hot: false }],
};

/* 인사이트 확장: AI 제안 (소구점·마케팅 분석) */
const AI_SUGGESTIONS = {
  unmyunglab: [
    { from: "리서처", type: "소구점", title: "'신년운세' 소구점이 지금 가장 강합니다", body: "최근 7일 '2027 신년운세' 검색량이 +210%. 캘린더 상품과 직접 연결되는 키워드라 이번 주 콘텐츠 비중을 높이는 걸 제안해요." },
    { from: "마케터", type: "마케팅", title: "와디즈 종료 후 '앵콜 알림' 신청 유도", body: "댓글 24건 중 18건이 사전 알림 문의. 종료 시점에 앵콜 대기 명단을 받으면 다음 펀딩 초기 전환을 끌어올릴 수 있어요." },
    { from: "CS봇", type: "운영", title: "리포트 지연 문의가 반복됩니다", body: "이번 주 지연 관련 문의 5건. 주문 완료 화면에 예상 소요시간을 명시하면 문의를 줄일 수 있어요." },
  ],
  solning: [
    { from: "콘텐츠 작가", type: "소구점", title: "'가계부' 키워드 수요가 오르고 있어요", body: "노션 가계부 템플릿 검색 +45%. 관련 무료 미니 템플릿으로 유입을 만들고 유료로 연결하는 퍼널을 제안해요." },
  ],
  solningoz: [{ from: "브랜드 보이스", type: "마케팅", title: "런칭 전 세계관 티저 시리즈 제안", body: "D-9 시점. 세계관 카피 자산이 정리됐으니 짧은 티저 3부작으로 기대감을 쌓는 걸 추천해요." }],
  simok: [{ from: "비주얼 기획", type: "소구점", title: "'1인 가구' 앵글이 비어있어요", body: "원목 식탁 검색은 강한데 1인 가구향 콘텐츠가 부족. 소형 가구 스토리로 신규 세그먼트를 노려볼 수 있어요." }],
};

/* SNS 콘텐츠 제작 직원이 만든 게시물 초안 (발행 대기 / 복붙 대기) */
const SNS_DRAFTS = {
  unmyunglab: [
    { platform: "Threads", status: "published", body: "2027년, 당신의 운명 캘린더가 도착합니다 ✨\n매달 펼칠 때마다 그 달의 흐름을 미리 읽어보세요. 와디즈에서 만나요.", tags: ["#2027운세", "#운명캘린더", "#사주"], img: "캘린더 표지 + 따뜻한 조명, 손에 든 컷" },
    { platform: "Instagram", status: "waiting", body: "신년운세 vs 토정비결, 뭐가 다를까? 🤔\n둘 다 새해 흐름을 보지만 보는 '결'이 달라요. 카드 넘겨서 확인 👉", tags: ["#신년운세", "#토정비결", "#사주풀이", "#운명랩"], img: "3장 카드뉴스 — 비교 표 형식, 베이지 톤" },
    { platform: "Instagram", status: "waiting", body: "궁합, 좋고 나쁨이 전부가 아니에요.\n서로의 기운이 '어떻게' 만나는지가 진짜 핵심. 무료로 한번 봐볼까요?", tags: ["#궁합", "#커플운세", "#사주궁합"], img: "두 사람 실루엣 + 오방색 그라데이션" },
    { platform: "Threads", status: "draft", body: "오늘 사주에서 가장 많이 받은 질문 TOP 3 🔮\n1. 올해 이직해도 될까요\n2. 그 사람과 인연이 맞을까요\n3. 돈 들어올 시기는 언제일까요", tags: ["#사주", "#운세상담"], img: "텍스트 중심, 그래픽 없음" },
  ],
  solning: [
    { platform: "Instagram", status: "waiting", body: "노션 가계부, 작심삼일로 끝나는 이유 알려드려요 📓\n복잡하면 안 써져요. 3분이면 끝나는 템플릿 만들었어요.", tags: ["#노션템플릿", "#가계부", "#쏠닝노트"], img: "노션 화면 캡처 목업, 깔끔한 화이트" },
  ],
  solningoz: [
    { platform: "Threads", status: "draft", body: "곧 시작됩니다. 쏠닝오즈의 세계로.", tags: ["#쏠닝오즈", "#런칭예정"], img: "티저 — 어두운 배경 + 보랏빛 포인트" },
  ],
  simok: [
    { platform: "Instagram", status: "draft", body: "혼자 사는 집에도 '제대로 된 식탁' 하나쯤은.\n원목이 주는 온도를 1인 가구에게도.", tags: ["#원목가구", "#1인가구", "#시목"], img: "소형 원목 식탁, 자연광 인테리어 컷" },
  ],
};

/* 워크스페이스 전체 오늘의 브리핑 (직원 리포트 합산) */
const BRIEFING = {
  unmyunglab: {
    headline: "어제 운명랩은 조용히, 그러나 바쁘게 돌아갔어요.",
    summary: "AI 직원 5명이 어제 84건의 작업을 처리했어요. 와디즈 달성률이 184%까지 올랐고, '2027 신년운세' 키워드가 +210% 급상승했습니다. 리포트 31건은 오류 없이 생성됐고, CS 문의 17건 중 13건이 자동 처리됐어요. 지금 Sol이 봐야 할 건 두 가지: 인스타 게시물 2건 승인, 그리고 리포트 지연 문의 대응이에요.",
    needYou: ["인스타 게시물 2건 승인 → 복붙 대기열", "캘린더 PDF 최종 검수", "리포트 지연 문의 5건 정책 결정"],
    fromStaff: [
      { who: "리서처", line: "'2027 신년운세' +210%, '토정비결 무료' 신규 진입" },
      { who: "마케터", line: "캘린더 티저 발행 → 도달 8.4K, 사전 알림 문의 18건" },
      { who: "SNS 콘텐츠 제작", line: "게시물 4건 작성 (발행 2 / 대기 2)" },
      { who: "리포트빌더", line: "리포트 31건 생성, 실패 0건" },
      { who: "CS봇", line: "문의 17건 응답, 자동 처리율 76%" },
    ],
  },
  solning: {
    headline: "쏠닝포인트는 템플릿 판매가 꾸준히 늘고 있어요.",
    summary: "AI 직원 2명이 어제 6건을 처리했어요. 템플릿 판매가 이번 주 47건으로 +15%. '노션 가계부 템플릿' 검색이 +45%로 떴습니다. 방문자는 소폭 줄었어요(-3%). 지금 봐야 할 건 신규 템플릿 상세페이지 업로드예요.",
    needYou: ["신규 템플릿 상세페이지 업로드", "인스타 게시물 1건 승인"],
    fromStaff: [
      { who: "콘텐츠 작가", line: "소개글 3건 작성, 블로그 초안 1건" },
      { who: "SNS 매니저", line: "예약 발행 2건 등록 대기" },
    ],
  },
  solningoz: {
    headline: "쏠닝오즈는 런칭 준비 중이에요. D-9.",
    summary: "브랜드 보이스가 어제 세계관 카피 5건을 정리했고, 런칭 슬로건 후보 8개를 제안했어요. 런칭까지 9일 남았습니다. 지금은 티저 시리즈 기획을 시작할 타이밍이에요.",
    needYou: ["오즈 런칭 시퀀스 기획", "티저 게시물 방향 승인"],
    fromStaff: [{ who: "브랜드 보이스", line: "세계관 카피 v2 정리 + 슬로건 8개 제안" }],
  },
  simok: {
    headline: "시목은 어제 잔잔했어요. 민석 검수 대기 중.",
    summary: "비주얼 기획이 원목 식탁 시리즈 스토리 초안을 만들어 두고 민석 검수를 기다리고 있어요. 인스타 팔로워는 이번 주 +38. '1인 가구' 앵글이 비어있다는 제안이 올라와 있어요.",
    needYou: ["신상 가구 촬영 일정 조율 (민석)", "1인 가구 콘텐츠 방향 검토"],
    fromStaff: [{ who: "비주얼 기획", line: "원목 식탁 시리즈 스토리 초안 (검수 대기)" }],
  },
};

/* ───────────────────────── helpers ───────────────────────── */

function Spark({ data, color }) {
  const w = 88, h = 30, max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d - min) / (max - min || 1)) * (h - 4) - 2;
    return [x, y];
  });
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L${w} ${h} L0 ${h} Z`;
  const id = "g" + color.replace("#", "");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.22" /><stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.8" fill={color} />
    </svg>
  );
}

function BigSpark({ data, color }) {
  const w = 260, h = 70, max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((d, i) => [(i / (data.length - 1)) * w, h - ((d - min) / (max - min || 1)) * (h - 8) - 4]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L${w} ${h} L0 ${h} Z`;
  const id = "bg" + color.replace("#", "");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 3.5 : 0} fill={color} />)}
    </svg>
  );
}

/* ───────────────────────── component ───────────────────────── */

export default function AIOffice() {
  const [wsId, setWsId] = useState("unmyunglab");
  const [view, setView] = useState("dashboard");
  const [open, setOpen] = useState(false);
  const [selStaff, setSelStaff] = useState(null);
  const [now, setNow] = useState(new Date());
  const togRef = useRef(null);

  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);
  useEffect(() => {
    const h = (e) => { if (togRef.current && !togRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const ws = WORKSPACES.find((w) => w.id === wsId);
  const staff = STAFF[wsId] || [];
  const working = staff.filter((s) => s.state === "working").length;
  const clock = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });
  const C = ws.color, A = ws.accent;

  const openStaff = (s) => { setSelStaff(s); setView("staffDetail"); };
  const switchWs = (id) => { setWsId(id); setSelStaff(null); if (view === "staffDetail") setView("staff"); setOpen(false); };

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* ── left nav rail ── */}
      <aside style={S.rail}>
        <div style={S.railLogo}><span style={{ ...S.railLogoGlyph, background: `linear-gradient(135deg,${C},${A})` }}>{ws.glyph}</span></div>
        <div style={S.railNav}>
          {NAV.map((n) => {
            const Ic = n.icon, on = view === n.id;
            return (
              <button key={n.id} style={{ ...S.railBtn, ...(on ? { background: "#34312a", color: "#f4f1ea" } : {}) }}
                className="railbtn" onClick={() => setView(n.id)} title={n.label}>
                <Ic size={19} strokeWidth={1.8} />
                {on && <span style={{ ...S.railActiveBar, background: A }} />}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <button style={S.railBtn} className="railbtn"><Settings size={19} strokeWidth={1.8} /></button>
      </aside>

      {/* ── main ── */}
      <div style={S.main}>
        <header style={S.top}>
          <div ref={togRef} style={{ position: "relative" }}>
            <button style={S.toggle} className="toggle" onClick={() => setOpen(!open)}>
              <span style={{ ...S.wsGlyph, background: `linear-gradient(135deg,${C},${A})` }}>{ws.glyph}</span>
              <span style={S.wsMeta}><span style={S.wsName}>{ws.name}</span><span style={S.wsTag}>{ws.tag} · 워크스페이스</span></span>
              <ChevronDown size={16} strokeWidth={2} style={{ color: "#9a958c", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>
            {open && (
              <div style={S.dropdown} className="dd">
                <div style={S.ddLabel}>워크스페이스 전환</div>
                {WORKSPACES.map((w) => (
                  <button key={w.id} style={{ ...S.ddItem, ...(w.id === wsId ? { background: "#f4f1ea" } : {}) }} className="dditem"
                    onClick={() => switchWs(w.id)}>
                    <span style={{ ...S.wsGlyphSm, background: `linear-gradient(135deg,${w.color},${w.accent})` }}>{w.glyph}</span>
                    <span style={S.ddItemMeta}><span style={S.ddItemName}>{w.name}</span><span style={S.ddItemTag}>{w.tag}</span></span>
                    {w.id === wsId && <Check size={15} strokeWidth={2.4} style={{ color: w.color }} />}
                  </button>
                ))}
                <div style={S.ddDivider} />
                <button style={S.ddNew} className="dditem"><Plus size={15} strokeWidth={2.2} /> 새 워크스페이스</button>
              </div>
            )}
          </div>

          <div style={S.topRight}>
            <div style={S.liveClock}><span className="dot-live" style={S.clockDot} /> {clock}</div>
            <div style={S.searchBox}><Search size={15} strokeWidth={1.9} style={{ color: "#9a958c" }} /><span style={{ color: "#9a958c" }}>검색</span><kbd style={S.kbd}>⌘K</kbd></div>
            <button style={S.iconBtn} className="iconbtn"><Bell size={17} strokeWidth={1.8} /><span style={{ ...S.notifDot, background: C }} /></button>
            <div style={S.members}>
              {(MEMBERS[wsId] || []).map((m, i) => (<span key={i} style={{ ...S.avatar, background: m.c, marginLeft: i ? -8 : 0, zIndex: 5 - i }}>{m.n[0]}</span>))}
              <button style={{ ...S.avatar, ...S.avatarAdd, marginLeft: -8 }} className="iconbtn"><Plus size={13} strokeWidth={2.4} /></button>
            </div>
          </div>
        </header>

        <div style={S.body} key={wsId + view + (selStaff ? selStaff.name : "")}>
          {view === "dashboard" && <Dashboard {...{ ws, C, A, staff, working, dateStr, wsId, setView, openStaff }} />}
          {view === "briefing" && <BriefingView {...{ ws, C, A, wsId, dateStr, setView, openStaff, staff }} />}
          {view === "staff" && <StaffView {...{ ws, C, A, staff, openStaff }} />}
          {view === "staffDetail" && selStaff && <StaffDetailView {...{ ws, C, A, s: selStaff, wsId, back: () => setView("staff") }} />}
          {view === "todos" && <TodosView {...{ ws, C, A, wsId }} />}
          {view === "schedule" && <ScheduleView {...{ ws, C, A, wsId, clock }} />}
          {view === "insights" && <InsightsView {...{ ws, C, A, wsId }} />}
          {view === "log" && <LogView {...{ ws, C, A, wsId }} />}
          {view === "members" && <MembersView {...{ ws, C, A, wsId, staff, openStaff }} />}
        </div>
      </div>
    </div>
  );
}

/* ───────── view: dashboard ───────── */
function Dashboard({ ws, C, A, staff, working, dateStr, wsId, setView, openStaff }) {
  return (
    <>
      <div style={S.viewHead}>
        <div>
          <div style={S.eyebrow}><Cpu size={13} strokeWidth={2} /> AI OFFICE · 24시간 가동 중</div>
          <h1 style={S.h1}>{ws.name} 오피스</h1>
          <p style={S.viewSub}>{dateStr} · AI 직원 <b style={{ color: C }}>{working}명</b> 근무 중, {staff.length - working}명 대기</p>
        </div>
        <div style={{ ...S.statusBanner, borderColor: C + "33", background: C + "0d" }}>
          <span className="dot-live" style={{ ...S.bannerDot, background: C }} />
          <span style={{ color: C, fontWeight: 700, fontSize: 13 }}>시스템 정상</span>
        </div>
      </div>

      <div style={S.kpiStrip}>
        {(INSIGHTS[wsId] || []).slice(0, 4).map((ins, i) => (
          <div key={i} style={S.kpiCard} className="lift">
            <div style={S.kpiTop}><span style={S.kpiK}>{ins.k}</span><ArrowUpRight size={14} strokeWidth={2.6} style={{ color: ins.up ? "#3a8c5a" : "#c47b7b", transform: ins.up ? "none" : "rotate(90deg)" }} /></div>
            <div style={S.kpiV}>{ins.v}<span style={S.kpiUnit}>{ins.unit}</span></div>
            <div style={{ marginTop: 4 }}><Spark data={ins.spark} color={C} /></div>
          </div>
        ))}
      </div>

      <button style={{ ...S.briefBanner, background: `linear-gradient(135deg,${C},${A})` }} className="solid" onClick={() => setView("briefing")}>
        <span style={S.briefBannerIcon}><Sun size={20} strokeWidth={2} /></span>
        <span style={{ flex: 1, textAlign: "left" }}>
          <span style={S.briefBannerTitle}>오늘의 브리핑 읽기</span>
          <span style={S.briefBannerSub}>{BRIEFING[wsId] ? BRIEFING[wsId].headline : "어제 직원들이 한 일을 한 장으로"}</span>
        </span>
        <ChevronRight size={20} strokeWidth={2.4} />
      </button>

      <section style={{ ...S.panel, padding: 0, overflow: "hidden" }}>
        <div style={{ ...S.floorHead, background: `linear-gradient(135deg,${C}14,${A}08)` }}>
          <div style={S.panelHeadInline}>
            <span style={{ ...S.panelIcon, color: C }}><Bot size={16} strokeWidth={2} /></span>
            <span style={S.panelTitle}>오피스 플로어</span>
            <span style={S.panelSub}>실시간 근무 현황</span>
          </div>
          <button style={{ ...S.ghostBtn, color: C }} className="ghost" onClick={() => setView("staff")}>전체 보기 <ChevronRight size={14} strokeWidth={2.4} /></button>
        </div>
        <div style={S.floor}>
          {staff.map((s, i) => <DeskCard key={i} s={s} C={C} A={A} onClick={() => openStaff(s)} />)}
          <button style={S.deskAdd} className="desk"><Plus size={22} strokeWidth={1.6} /><span>빈 자리 · 채용</span></button>
        </div>
      </section>

      <section style={S.split}>
        <div style={{ ...S.panel, flex: 1.2 }}>
          <PanelHead icon={CheckSquare} title="오늘 할일" sub="수동 + 자동" C={C} action={() => setView("todos")} />
          <div style={{ marginTop: 6 }}>{(TODOS[wsId] || []).slice(0, 4).map((td, i) => <TodoRow key={i} td={td} C={C} />)}</div>
        </div>
        <div style={{ ...S.panel, flex: 1 }}>
          <PanelHead icon={Activity} title="최근 기록" sub="AI + 멤버" C={C} action={() => setView("log")} />
          <div style={{ marginTop: 6 }}>{(LOG[wsId] || []).slice(0, 5).map((l, i) => <LogRow key={i} l={l} C={C} />)}</div>
        </div>
      </section>
    </>
  );
}

/* ───────── view: today's briefing ───────── */
function BriefingView({ ws, C, A, wsId, dateStr, setView, openStaff, staff }) {
  const b = BRIEFING[wsId];
  if (!b) return null;
  const findStaff = (name) => staff.find((s) => s.name === name);
  return (
    <>
      <div style={S.viewHead}>
        <div>
          <div style={S.eyebrow}><Sun size={13} strokeWidth={2} /> 오늘의 브리핑 · {dateStr}</div>
          <h1 style={S.h1}>{ws.name}, 어제 이렇게 돌아갔어요</h1>
        </div>
      </div>

      {/* headline summary */}
      <div style={{ ...S.briefHero, background: `linear-gradient(135deg,${C}12,${A}06)`, borderColor: C + "22" }}>
        <div style={{ ...S.briefHeadline, color: C }}>{b.headline}</div>
        <p style={S.briefSummary}>{b.summary}</p>
      </div>

      <div style={S.briefGrid}>
        {/* need you */}
        <div style={S.panel}>
          <div style={S.panelHead}>
            <span style={{ ...S.panelIcon, color: C }}><CheckSquare size={16} strokeWidth={2} /></span>
            <span style={S.panelTitle}>Sol이 봐야 할 것</span>
            <span style={S.panelSub}>{b.needYou.length}건</span>
          </div>
          <div style={{ marginTop: 8 }}>
            {b.needYou.map((n, i) => (
              <div key={i} style={S.needRow} className="todorow">
                <span style={{ ...S.needNum, background: C + "1a", color: C }}>{i + 1}</span>
                <span style={S.needText}>{n}</span>
                <button style={{ ...S.ghostBtn, color: C, marginLeft: "auto" }} className="ghost" onClick={() => setView("todos")}>처리 <ChevronRight size={13} strokeWidth={2.4} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* from staff */}
        <div style={S.panel}>
          <div style={S.panelHead}>
            <span style={{ ...S.panelIcon, color: C }}><Bot size={16} strokeWidth={2} /></span>
            <span style={S.panelTitle}>직원별 요약</span>
            <span style={S.panelSub}>어제 한 일</span>
          </div>
          <div style={{ marginTop: 8 }}>
            {b.fromStaff.map((f, i) => {
              const s = findStaff(f.who);
              return (
                <div key={i} style={{ ...S.briefStaffRow, cursor: s ? "pointer" : "default" }} className="todorow" onClick={() => s && openStaff(s)}>
                  <span style={{ ...S.briefStaffAvatar, background: C + "1a", color: C }}>{s ? React.createElement(s.icon, { size: 15, strokeWidth: 1.9 }) : <Bot size={15} />}</span>
                  <span style={S.briefStaffWho}>{f.who}</span>
                  <span style={S.briefStaffLine}>{f.line}</span>
                  {s && <ChevronRight size={15} strokeWidth={2} style={{ color: "#c9c3b6", flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ───────── view: staff ───────── */
function StaffView({ ws, C, A, staff, openStaff }) {
  const working = staff.filter((s) => s.state === "working").length;
  const totalDone = staff.reduce((a, s) => a + s.done, 0);
  const todayDone = staff.reduce((a, s) => a + s.today, 0);
  return (
    <>
      <ViewTitle icon={Bot} eyebrow="HUMAN RESOURCES" title="AI 직원" sub={`${staff.length}명 고용 중 · ${working}명 근무 중 · 카드를 누르면 일일 리포트`} C={C}
        cta={<button style={{ ...S.solidBtn, background: C }} className="solid"><Plus size={15} strokeWidth={2.4} /> 직원 채용</button>} />
      <div style={S.kpiStrip}>
        <MiniStat label="총 처리 작업" value={totalDone.toLocaleString()} />
        <MiniStat label="오늘 처리" value={todayDone} />
        <MiniStat label="근무 중" value={`${working} / ${staff.length}`} />
        <MiniStat label="평균 가동" value={staff[0] ? staff[0].uptime : "—"} />
      </div>
      <div style={S.staffGrid}>
        {staff.map((s, i) => {
          const Ic = s.icon, live = s.state === "working";
          return (
            <div key={i} style={{ ...S.staffCard, ...(live ? { borderColor: C + "44" } : {}), cursor: "pointer" }} className="lift" onClick={() => openStaff(s)}>
              <div style={S.staffCardTop}>
                <span style={{ ...S.staffIcon, background: live ? C + "1a" : "#efece6", color: live ? C : "#a8a399" }}><Ic size={20} strokeWidth={1.9} /></span>
                <span style={{ ...S.statePill, ...(live ? { background: "#e8f3ec", color: "#3a8c5a" } : { background: "#f0eee9", color: "#a8a399" }) }}>
                  {live ? <><span className="dot-live" style={{ ...S.miniDot, background: "#3a8c5a" }} /> 근무 중</> : <><Coffee size={11} strokeWidth={2} /> 대기</>}
                </span>
              </div>
              <div style={S.staffName}>{s.name}</div>
              <div style={S.staffRole}>{s.role}</div>
              <div style={{ ...S.staffTask, ...(live ? { color: "#5c574e", background: C + "0d" } : {}) }}>
                {live && <Zap size={12} strokeWidth={2.2} style={{ color: C, flexShrink: 0, marginTop: 1 }} />}{s.task}
              </div>
              <div style={S.staffStats}>
                <span><b>{s.done.toLocaleString()}</b> 누적</span><span style={S.staffStatDiv} />
                <span><b>{s.today}</b> 오늘</span><span style={S.staffStatDiv} />
                <span>가동 <b>{s.uptime}</b></span>
              </div>
              <div style={{ ...S.staffViewReport, color: C, borderColor: C + "22" }}>
                <FileText size={13} strokeWidth={2} /> 일일 리포트 보기 <ChevronRight size={13} strokeWidth={2.4} style={{ marginLeft: "auto" }} />
              </div>
            </div>
          );
        })}
        <button style={S.staffAdd} className="desk">
          <span style={{ ...S.staffIcon, background: "#f0eee9", color: "#b4afa5" }}><Plus size={22} strokeWidth={1.6} /></span>
          <span style={{ marginTop: 12, fontWeight: 700, fontSize: 14, color: "#8a8578" }}>새 직원 채용</span>
          <span style={{ fontSize: 12, color: "#b4afa5", marginTop: 4 }}>역할을 정하고 24시간 맡겨보세요</span>
        </button>
      </div>
    </>
  );
}

/* ───────── view: staff detail (daily reports) ───────── */
function StaffDetailView({ ws, C, A, s, wsId, back }) {
  const Ic = s.icon, live = s.state === "working";
  const detail = STAFF_DETAIL[`${ws.name}-${s.name}`] || { routines: [], reports: [], metric: null };
  const isSns = s.name.includes("SNS 콘텐츠");
  const wsKey = wsId;
  return (
    <>
      <button style={S.backBtn} className="ghost" onClick={back}><ChevronRight size={15} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} /> AI 직원</button>
      <div style={{ ...S.detailHero, background: `linear-gradient(135deg,${C}14,${A}06)`, borderColor: C + "22" }}>
        <span style={{ ...S.detailIcon, background: `linear-gradient(135deg,${C},${A})` }}><Ic size={26} strokeWidth={1.8} color="#fff" /></span>
        <div style={{ flex: 1 }}>
          <div style={S.detailName}>{s.name}</div>
          <div style={S.detailRole}>{s.role}</div>
          <div style={S.detailStatRow}>
            <span style={{ ...S.statePill, ...(live ? { background: "#e8f3ec", color: "#3a8c5a" } : { background: "#f0eee9", color: "#a8a399" }) }}>
              {live ? <><span className="dot-live" style={{ ...S.miniDot, background: "#3a8c5a" }} /> 근무 중</> : <><Coffee size={11} strokeWidth={2} /> 대기</>}
            </span>
            <span style={S.detailStatItem}>누적 <b>{s.done.toLocaleString()}</b></span>
            <span style={S.detailStatItem}>오늘 <b>{s.today}</b></span>
            <span style={S.detailStatItem}>가동 <b>{s.uptime}</b></span>
          </div>
        </div>
        {detail.metric && (
          <div style={S.detailMetric}>
            <div style={S.detailMetricLabel}>{detail.metric.label}</div>
            <Spark data={detail.metric.spark} color={C} />
            <div style={S.detailMetricVal}>{detail.metric.spark[detail.metric.spark.length - 1]}<span style={S.kpiUnit}>{detail.metric.unit}</span></div>
          </div>
        )}
      </div>

      <div style={S.detailGrid}>
        <div>
          {isSns && (
            <div style={{ marginBottom: 20 }}>
              <div style={S.detailColLabel}>발행 대기 · 콘텐츠 초안</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(SNS_DRAFTS[wsKey] || []).map((d, i) => <SnsDraftCard key={i} d={d} C={C} />)}
              </div>
            </div>
          )}
          <div style={S.detailColLabel}>일일 리포트</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {detail.reports.map((r, i) => (
              <div key={i} style={{ ...S.reportCard, ...(i === 0 ? { borderColor: C + "44" } : {}) }} className="lift">
                <div style={S.reportTop}>
                  <span style={{ ...S.reportDate, ...(i === 0 ? { color: C } : {}) }}>{r.date}</span>
                  <div style={{ display: "flex", gap: 5 }}>
                    {r.tags.map((t, j) => <span key={j} style={{ ...S.reportTag, background: C + "12", color: C }}>{t}</span>)}
                  </div>
                </div>
                <div style={S.reportTitle}>{r.title}</div>
                <ul style={S.reportLines}>
                  {r.lines.map((l, j) => <li key={j} style={S.reportLine}><span style={{ ...S.reportBullet, background: C }} />{l}</li>)}
                </ul>
              </div>
            ))}
            {detail.reports.length === 0 && <div style={S.emptyBox}>아직 생성된 리포트가 없어요. 일과를 설정하면 매일 한 번씩 리포트가 쌓입니다.</div>}
          </div>
        </div>

        <div>
          <div style={S.detailColLabel}>매일 하는 일</div>
          <div style={S.routineBox}>
            {detail.routines.map((r, i) => (
              <div key={i} style={S.routineRow}>
                <span style={{ ...S.routineDot, background: C + "1a", color: C }}><Check size={12} strokeWidth={2.6} /></span>
                <span style={S.routineText}>{r}</span>
              </div>
            ))}
            <button style={S.routineAdd} className="ghost"><Plus size={13} strokeWidth={2} /> 일과 추가</button>
          </div>
          <div style={{ ...S.detailColLabel, marginTop: 18 }}>설정</div>
          <div style={S.routineBox}>
            <button style={S.detailSetBtn} className="ghost">{live ? <><Pause size={14} strokeWidth={2} /> 일시정지</> : <><Play size={14} strokeWidth={2} /> 가동 시작</>}</button>
            <button style={S.detailSetBtn} className="ghost"><Clock size={14} strokeWidth={2} /> 실행 시간 변경</button>
            <button style={S.detailSetBtn} className="ghost"><Settings size={14} strokeWidth={2} /> 역할 · 프롬프트 편집</button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ───────── view: todos ───────── */
function TodosView({ ws, C, A, wsId }) {
  const items = TODOS[wsId] || [];
  const cols = [
    { key: "todo", label: "할 일", filter: (t) => !t.done },
    { key: "done", label: "완료", filter: (t) => t.done },
  ];
  return (
    <>
      <ViewTitle icon={CheckSquare} eyebrow="TASKS" title="할일" sub={`${items.filter(t => !t.done).length}건 진행 · ${items.filter(t => t.done).length}건 완료`} C={C}
        cta={<div style={{ display: "flex", gap: 8 }}><button style={S.outlineBtn} className="ghost"><Filter size={14} strokeWidth={2} /> 필터</button><button style={{ ...S.solidBtn, background: C }} className="solid"><Plus size={15} strokeWidth={2.4} /> 추가</button></div>} />
      <div style={S.boardWrap}>
        {cols.map((col) => {
          const list = items.filter(col.filter);
          return (
            <div key={col.key} style={S.boardCol}>
              <div style={S.boardColHead}><span style={S.boardColTitle}>{col.label}</span><span style={S.boardCount}>{list.length}</span></div>
              <div style={S.boardCards}>
                {list.map((td, i) => (
                  <div key={i} style={S.boardCard} className="lift">
                    <div style={S.boardCardTop}>
                      <span style={{ ...S.prioPill, ...PRIO[td.prio] }}>{td.prio === "high" ? "긴급" : td.prio === "mid" ? "보통" : "낮음"}</span>
                      <span style={{ ...S.byBadge, ...(td.by === "auto" ? S.byAuto : S.byManual) }}>{td.by === "auto" ? <><Sparkles size={10} strokeWidth={2} /> 자동</> : "수동"}</span>
                    </div>
                    <div style={{ ...S.boardCardText, ...(td.done ? { color: "#b4afa5", textDecoration: "line-through" } : {}) }}>{td.t}</div>
                    <div style={S.boardCardFoot}><span style={S.todoTag}>#{td.tag}</span></div>
                  </div>
                ))}
                <button style={S.boardAdd} className="ghost"><Plus size={14} strokeWidth={2} /> 카드 추가</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ───────── view: schedule ───────── */
function ScheduleView({ ws, C, A, wsId, clock }) {
  const events = SCHEDULE[wsId] || [];
  return (
    <>
      <ViewTitle icon={Calendar} eyebrow="SCHEDULE" title="일정" sub={`오늘 ${events.length}건 · 현재 ${clock}`} C={C}
        cta={<button style={{ ...S.solidBtn, background: C }} className="solid"><Plus size={15} strokeWidth={2.4} /> 일정 추가</button>} />
      <div style={{ ...S.panel, padding: 28 }}>
        <div style={S.bigTimeline}>
          {events.map((ev, i) => (
            <div key={i} style={S.btRow}>
              <div style={{ ...S.btTime, ...(ev.live ? { color: C } : {}) }}>{ev.time}</div>
              <div style={S.btLine}>
                <span style={{ ...S.btDot, ...(ev.live ? { background: C, boxShadow: `0 0 0 5px ${C}22` } : {}) }} className={ev.live ? "dot-live" : ""} />
                {i < events.length - 1 && <span style={S.btBar} />}
              </div>
              <div style={{ ...S.btCard, ...(ev.live ? { borderColor: C + "44", background: C + "08" } : {}) }} className="lift">
                <div style={S.btCardMain}>
                  <span style={{ ...S.btText, ...(ev.live ? { color: "#2b2820" } : {}) }}>{ev.t}</span>
                  {ev.live && <span style={{ ...S.nowTag, color: C }}><span className="dot-live" style={{ ...S.miniDot, background: C }} /> 진행 중</span>}
                </div>
                <span style={S.btWho}><span style={{ ...S.btWhoAvatar, background: C + "1a", color: C }}>{ev.who[0]}</span>{ev.who}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ───────── view: insights ───────── */
function InsightsView({ ws, C, A, wsId }) {
  const items = INSIGHTS[wsId] || [];
  const keywords = KEYWORDS[wsId] || [];
  const suggestions = AI_SUGGESTIONS[wsId] || [];
  return (
    <>
      <ViewTitle icon={BarChart3} eyebrow="INSIGHTS" title="인사이트" sub="실시간 성과 지표 · 트렌드 키워드 · AI 제안" C={C}
        cta={<button style={S.outlineBtn} className="ghost"><Clock size={14} strokeWidth={2} /> 최근 7일</button>} />

      <div style={S.insightGrid}>
        {items.map((ins, i) => (
          <div key={i} style={S.bigInsight} className="lift">
            <div style={S.biTop}>
              <span style={S.biK}>{ins.k}</span>
              <span style={{ ...S.biTrend, color: ins.up ? "#3a8c5a" : "#c47b7b", background: ins.up ? "#e8f3ec" : "#f7ebeb" }}>
                <ArrowUpRight size={13} strokeWidth={2.6} style={{ transform: ins.up ? "none" : "rotate(90deg)" }} /> {ins.sub.split(" · ").pop()}
              </span>
            </div>
            <div style={S.biV}>{ins.v}<span style={S.biUnit}>{ins.unit}</span></div>
            <div style={S.biSub}>{ins.sub}</div>
            <div style={{ marginTop: 16 }}><BigSpark data={ins.spark} color={C} /></div>
          </div>
        ))}
      </div>

      {/* 트렌드 키워드 */}
      <div style={S.insightSection}>
        <div style={S.panelHead}>
          <span style={{ ...S.panelIcon, color: C }}><TrendingUp size={16} strokeWidth={2} /></span>
          <span style={S.panelTitle}>트렌드 키워드</span>
          <span style={S.panelSub}>리서처가 매일 08:00 수집 · 어제 기준</span>
        </div>
        <div style={{ ...S.panel, marginTop: 10, padding: 8 }}>
          {keywords.map((k, i) => (
            <div key={i} style={S.kwRow} className="todorow">
              <span style={{ ...S.kwRank, ...(k.hot ? { background: C, color: "#fff" } : { background: "#f0eee9", color: "#a8a399" }) }}>{k.rank}</span>
              <span style={S.kwName}>{k.kw}</span>
              {k.hot && <span style={{ ...S.kwHot, color: "#c0564e", background: "#fbeceb" }}><Flame size={11} strokeWidth={2.2} /> 급상승</span>}
              <span style={{ ...S.kwVol, color: k.vol.includes("신규") ? C : "#3a8c5a" }}>{k.vol}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI 제안 */}
      <div style={S.insightSection}>
        <div style={S.panelHead}>
          <span style={{ ...S.panelIcon, color: C }}><Sparkles size={16} strokeWidth={2} /></span>
          <span style={S.panelTitle}>AI 제안</span>
          <span style={S.panelSub}>직원들이 분석한 소구점 · 마케팅 인사이트</span>
        </div>
        <div style={S.suggestGrid}>
          {suggestions.map((sg, i) => (
            <div key={i} style={S.suggestCard} className="lift">
              <div style={S.suggestTop}>
                <span style={{ ...S.suggestType, background: C + "14", color: C }}>{sg.type}</span>
                <span style={S.suggestFrom}><Bot size={12} strokeWidth={2} /> {sg.from}</span>
              </div>
              <div style={S.suggestTitle}>{sg.title}</div>
              <div style={S.suggestBody}>{sg.body}</div>
              <div style={S.suggestActions}>
                <button style={{ ...S.suggestBtn, background: C, color: "#fff", border: "none" }} className="solid">할일로 추가</button>
                <button style={S.suggestBtn} className="ghost">나중에</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ───────── view: log ───────── */
function LogView({ ws, C, A, wsId }) {
  const items = LOG[wsId] || [];
  return (
    <>
      <ViewTitle icon={Activity} eyebrow="ACTIVITY" title="기록" sub="AI 직원 + 멤버 활동 로그" C={C}
        cta={<button style={S.outlineBtn} className="ghost"><Filter size={14} strokeWidth={2} /> 전체</button>} />
      <div style={{ ...S.panel, padding: 8 }}>{items.map((l, i) => <LogRow key={i} l={l} C={C} big />)}</div>
    </>
  );
}

/* ───────── view: members ───────── */
function MembersView({ ws, C, A, wsId, staff, openStaff }) {
  const members = MEMBERS[wsId] || [];
  return (
    <>
      <ViewTitle icon={Users} eyebrow="TEAM" title="멤버" sub={`사람 ${members.length}명 · AI 직원 ${staff.length}명`} C={C}
        cta={<button style={{ ...S.solidBtn, background: C }} className="solid"><Plus size={15} strokeWidth={2.4} /> 멤버 초대</button>} />
      <div style={S.panel}>
        <div style={S.memberSectionLabel}>사람</div>
        {members.map((m, i) => (
          <div key={i} style={S.memberRow} className="todorow">
            <span style={{ ...S.memberAvatar, background: m.c }}>{m.n[0]}</span>
            <div style={{ flex: 1 }}><div style={S.memberName}>{m.n}</div><div style={S.memberRole}>{m.r}</div></div>
            <span style={{ ...S.rolePill, background: i === 0 ? C + "1a" : "#f0eee9", color: i === 0 ? C : "#8a8578" }}>{i === 0 ? "관리자" : "멤버"}</span>
            <button style={S.iconBtnSm} className="iconbtn"><MoreHorizontal size={16} strokeWidth={2} /></button>
          </div>
        ))}
        <button style={S.inviteRow} className="todorow"><span style={{ ...S.memberAvatar, background: "#f0eee9", color: "#b4afa5" }}><Plus size={16} strokeWidth={2.2} /></span><span style={{ color: "#8a8578", fontWeight: 600, fontSize: 13.5 }}>이메일로 멤버 초대하기</span></button>

        <div style={{ ...S.memberSectionLabel, marginTop: 22 }}>AI 직원</div>
        {staff.map((s, i) => {
          const Ic = s.icon, live = s.state === "working";
          return (
            <div key={i} style={{ ...S.memberRow, cursor: "pointer" }} className="todorow" onClick={() => openStaff(s)}>
              <span style={{ ...S.memberAvatar, background: C + "1a", color: C }}><Ic size={17} strokeWidth={1.9} /></span>
              <div style={{ flex: 1 }}><div style={S.memberName}>{s.name}</div><div style={S.memberRole}>{s.role}</div></div>
              <span style={{ ...S.rolePill, ...(live ? { background: "#e8f3ec", color: "#3a8c5a" } : { background: "#f0eee9", color: "#a8a399" }) }}>{live ? "근무 중" : "대기"}</span>
              <ChevronRight size={16} strokeWidth={2} style={{ color: "#c9c3b6" }} />
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ───────────────────────── shared bits ───────────────────────── */

function ViewTitle({ icon: Ic, eyebrow, title, sub, C, cta }) {
  return (
    <div style={S.viewHead}>
      <div>
        <div style={S.eyebrow}><Ic size={13} strokeWidth={2} /> {eyebrow}</div>
        <h1 style={S.h1}>{title}</h1>
        <p style={S.viewSub}>{sub}</p>
      </div>
      {cta}
    </div>
  );
}
function PanelHead({ icon: Ic, title, sub, C, action }) {
  return (
    <div style={S.panelHead}>
      <span style={{ ...S.panelIcon, color: C }}><Ic size={16} strokeWidth={2} /></span>
      <span style={S.panelTitle}>{title}</span>
      <span style={S.panelSub}>{sub}</span>
      <button style={{ ...S.ghostBtn, color: C, marginLeft: "auto" }} className="ghost" onClick={action}>전체 <ChevronRight size={14} strokeWidth={2.4} /></button>
    </div>
  );
}
function DeskCard({ s, C, A, onClick }) {
  const Ic = s.icon, live = s.state === "working";
  return (
    <div style={{ ...S.deskCard, ...(live ? { borderColor: C + "44" } : {}), cursor: "pointer" }} className="desk" onClick={onClick}>
      <div style={S.deskTop}>
        <span style={{ ...S.deskIcon, background: live ? C + "1a" : "#efece6", color: live ? C : "#a8a399" }}><Ic size={18} strokeWidth={1.9} /></span>
        <span style={{ ...S.statePill, ...(live ? { background: "#e8f3ec", color: "#3a8c5a" } : { background: "#f0eee9", color: "#a8a399" }) }}>
          {live ? <><span className="dot-live" style={{ ...S.miniDot, background: "#3a8c5a" }} /> 근무 중</> : <><Coffee size={11} strokeWidth={2} /> 대기</>}
        </span>
      </div>
      <div style={S.deskName}>{s.name}</div>
      <div style={S.deskRole}>{s.role}</div>
      <div style={{ ...S.deskTask, ...(live ? { color: "#5c574e" } : {}) }}>{live && <Zap size={12} strokeWidth={2.2} style={{ color: C, flexShrink: 0, marginTop: 2 }} />}{s.task}</div>
    </div>
  );
}
function TodoRow({ td, C }) {
  return (
    <div style={S.todoRow} className="todorow">
      <span style={{ ...S.checkbox, ...(td.done ? { background: C, borderColor: C } : {}) }}>{td.done && <Check size={12} strokeWidth={3} style={{ color: "#fff" }} />}</span>
      <span style={{ ...S.todoText, ...(td.done ? { color: "#b4afa5", textDecoration: "line-through" } : {}) }}>{td.t}</span>
      <span style={{ ...S.byBadge, ...(td.by === "auto" ? S.byAuto : S.byManual) }}>{td.by === "auto" ? <><Sparkles size={10} strokeWidth={2} /> 자동</> : "수동"}</span>
      <span style={S.todoTag}>#{td.tag}</span>
    </div>
  );
}
function LogRow({ l, C, big }) {
  const human = l.who === "Sol" || l.who === "민석";
  return (
    <div style={{ ...S.logRow, ...(big ? { padding: "12px 10px" } : {}) }} className="logrow">
      <span style={{ ...S.logAvatar, ...(human ? { background: "#2b2820", color: "#f5f2ec" } : { background: C + "1a", color: C }) }}>{human ? l.who[0] : <Hash size={13} strokeWidth={2} />}</span>
      <span style={S.logWho}>{l.who}</span>
      <span style={S.logAct}>{l.act}</span>
      <span style={S.logAgo}>{l.ago}</span>
    </div>
  );
}
function MiniStat({ label, value }) {
  return <div style={S.miniStat}><div style={S.miniStatLabel}>{label}</div><div style={S.miniStatValue}>{value}</div></div>;
}
function SnsDraftCard({ d, C }) {
  const isPub = d.status === "published", isWait = d.status === "waiting";
  const statusMeta = isPub ? { label: "발행됨", bg: "#e8f3ec", fg: "#3a8c5a" }
    : isWait ? { label: "복붙 대기", bg: "#fbf4e8", fg: "#b08240" }
    : { label: "초안", bg: "#f0eee9", fg: "#a8a399" };
  const pIcon = d.platform === "Threads" ? Hash : Image;
  return (
    <div style={{ ...S.snsCard, ...(isWait ? { borderColor: C + "44" } : {}) }} className="lift">
      <div style={S.snsTop}>
        <span style={S.snsPlatform}>{React.createElement(pIcon, { size: 13, strokeWidth: 2 })} {d.platform}</span>
        <span style={{ ...S.snsStatus, background: statusMeta.bg, color: statusMeta.fg }}>{statusMeta.label}</span>
      </div>
      <div style={S.snsBody}>{d.body}</div>
      <div style={S.snsTags}>{d.tags.map((t, i) => <span key={i} style={{ ...S.snsTag, color: C }}>{t}</span>)}</div>
      <div style={S.snsImg}><Image size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} /> {d.img}</div>
      {!isPub && (
        <div style={S.snsActions}>
          <button style={{ ...S.snsBtn, border: "1px solid #ece7dc", background: "#fff", color: "#5c574e" }} className="ghost"><Copy size={13} strokeWidth={2} /> 본문 복사</button>
          <button style={{ ...S.snsBtn, background: C, color: "#fff", border: "none" }} className="solid">
            {isWait ? <><Check size={13} strokeWidth={2.4} /> 발행함 체크</> : <><Send size={13} strokeWidth={2} /> 발행 승인</>}
          </button>
        </div>
      )}
    </div>
  );
}

const PRIO = {
  high: { background: "#fbeceb", color: "#c0564e" },
  mid: { background: "#fbf4e8", color: "#b08240" },
  low: { background: "#eef0f3", color: "#7a8190" },
};

/* ───────────────────────── styles ───────────────────────── */

const FONT = `'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', system-ui, sans-serif`;

const S = {
  root: { display: "flex", height: "780px", maxHeight: "90vh", background: "#f4f1ea", borderRadius: 18, overflow: "hidden", fontFamily: FONT, color: "#2b2820", boxShadow: "0 28px 70px -24px rgba(60,50,30,.32)", border: "1px solid #e6e1d6" },

  rail: { width: 66, background: "linear-gradient(180deg,#26241f,#1c1a16)", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 8 },
  railLogo: { marginBottom: 12 },
  railLogoGlyph: { width: 38, height: 38, borderRadius: 11, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 17, boxShadow: "0 4px 14px -4px rgba(0,0,0,.5)" },
  railNav: { display: "flex", flexDirection: "column", gap: 4 },
  railBtn: { position: "relative", width: 42, height: 42, borderRadius: 12, border: "none", background: "transparent", color: "#7a766c", display: "grid", placeItems: "center", cursor: "pointer", transition: "all .15s" },
  railActiveBar: { position: "absolute", left: -16, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, borderRadius: 3 },

  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },

  top: { height: 66, borderBottom: "1px solid #e6e1d6", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", background: "#faf8f3", flexShrink: 0 },
  toggle: { display: "flex", alignItems: "center", gap: 11, padding: "7px 12px 7px 8px", borderRadius: 13, border: "1px solid #e6e1d6", background: "#fff", cursor: "pointer", transition: "all .15s" },
  wsGlyph: { width: 34, height: 34, borderRadius: 10, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15, flexShrink: 0, boxShadow: "0 3px 10px -3px rgba(0,0,0,.3)" },
  wsMeta: { display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.25 },
  wsName: { fontSize: 14.5, fontWeight: 800 },
  wsTag: { fontSize: 11, color: "#a8a399" },

  dropdown: { position: "absolute", top: "calc(100% + 8px)", left: 0, width: 280, background: "#fff", borderRadius: 16, border: "1px solid #e6e1d6", boxShadow: "0 18px 44px -12px rgba(60,50,30,.28)", padding: 8, zIndex: 50 },
  ddLabel: { fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", color: "#b4afa5", padding: "6px 10px 8px" },
  ddItem: { display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "9px 10px", borderRadius: 11, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", transition: "background .12s" },
  wsGlyphSm: { width: 32, height: 32, borderRadius: 9, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 },
  ddItemMeta: { display: "flex", flexDirection: "column", flex: 1, lineHeight: 1.25 },
  ddItemName: { fontSize: 14, fontWeight: 700, color: "#2b2820" },
  ddItemTag: { fontSize: 11, color: "#a8a399" },
  ddDivider: { height: 1, background: "#eee9df", margin: "6px 4px" },
  ddNew: { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 10px", borderRadius: 11, border: "none", background: "transparent", cursor: "pointer", color: "#8a8578", fontSize: 13, fontWeight: 600 },

  topRight: { display: "flex", alignItems: "center", gap: 12 },
  liveClock: { display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "#5c574e", fontVariantNumeric: "tabular-nums", letterSpacing: ".02em" },
  clockDot: { width: 7, height: 7, borderRadius: "50%", background: "#3a8c5a" },
  searchBox: { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 11, background: "#f0ede6", fontSize: 13, cursor: "text" },
  kbd: { fontSize: 10.5, fontWeight: 700, color: "#b4afa5", background: "#fff", borderRadius: 5, padding: "2px 5px", border: "1px solid #e6e1d6" },
  iconBtn: { position: "relative", width: 38, height: 38, borderRadius: 11, border: "1px solid transparent", background: "transparent", color: "#5c574e", display: "grid", placeItems: "center", cursor: "pointer", transition: "all .15s" },
  notifDot: { position: "absolute", top: 9, right: 9, width: 7, height: 7, borderRadius: "50%", border: "2px solid #faf8f3" },
  members: { display: "flex", alignItems: "center" },
  avatar: { width: 30, height: 30, borderRadius: "50%", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, border: "2px solid #faf8f3" },
  avatarAdd: { background: "#e6e1d6", color: "#8a8578" },

  body: { flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 18 },

  viewHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  eyebrow: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 800, letterSpacing: ".14em", color: "#a8a399", marginBottom: 9 },
  h1: { fontSize: 28, fontWeight: 800, letterSpacing: "-.025em", margin: 0, lineHeight: 1.1 },
  viewSub: { fontSize: 13.5, color: "#8a8578", margin: "8px 0 0" },
  statusBanner: { display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 11, border: "1px solid" },
  bannerDot: { width: 8, height: 8, borderRadius: "50%" },

  kpiStrip: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 },
  kpiCard: { background: "#fffefb", borderRadius: 15, border: "1px solid #ece7dc", padding: "15px 16px" },
  kpiTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  kpiK: { fontSize: 12, fontWeight: 600, color: "#8a8578" },
  kpiV: { fontSize: 25, fontWeight: 800, letterSpacing: "-.02em", marginTop: 6, fontVariantNumeric: "tabular-nums" },
  kpiUnit: { fontSize: 14, fontWeight: 700, color: "#a8a399", marginLeft: 2 },

  panel: { background: "#fffefb", borderRadius: 16, border: "1px solid #ece7dc", padding: 18, minWidth: 0 },
  panelHead: { display: "flex", alignItems: "center", gap: 8 },
  panelHeadInline: { display: "flex", alignItems: "center", gap: 8 },
  panelIcon: { display: "grid", placeItems: "center" },
  panelTitle: { fontSize: 15, fontWeight: 800, letterSpacing: "-.01em" },
  panelSub: { fontSize: 11, color: "#b4afa5", fontWeight: 600 },
  ghostBtn: { display: "inline-flex", alignItems: "center", gap: 3, padding: "6px 10px", borderRadius: 9, border: "none", background: "transparent", fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "all .15s" },
  solidBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 12, border: "none", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 16px -6px rgba(60,50,30,.4)", transition: "all .15s" },
  outlineBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 11, border: "1px solid #ddd7cb", background: "#fff", color: "#5c574e", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all .15s" },

  floorHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #ece7dc" },
  floor: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(195px,1fr))", gap: 13, padding: 18 },
  deskCard: { background: "#fff", borderRadius: 13, border: "1px solid #ece7dc", padding: 15, transition: "all .18s", cursor: "default" },
  deskTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  deskIcon: { width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center" },
  statePill: { display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700 },
  miniDot: { width: 6, height: 6, borderRadius: "50%" },
  deskName: { fontSize: 15, fontWeight: 700, marginBottom: 2 },
  deskRole: { fontSize: 11.5, color: "#a8a399", marginBottom: 11 },
  deskTask: { fontSize: 12.5, color: "#9a958c", lineHeight: 1.4, display: "flex", gap: 5, minHeight: 34 },
  deskAdd: { background: "transparent", borderRadius: 13, border: "1.5px dashed #d8d2c5", padding: 15, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "#b4afa5", fontSize: 12, fontWeight: 600, cursor: "pointer", minHeight: 132, transition: "all .15s" },

  split: { display: "flex", gap: 18 },

  staffGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 },
  staffCard: { background: "#fffefb", borderRadius: 16, border: "1px solid #ece7dc", padding: 18 },
  staffCardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 },
  staffIcon: { width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center" },
  staffName: { fontSize: 17, fontWeight: 800, marginBottom: 2 },
  staffRole: { fontSize: 12.5, color: "#a8a399", marginBottom: 13 },
  staffTask: { fontSize: 12.5, color: "#9a958c", lineHeight: 1.45, display: "flex", gap: 6, padding: "10px 12px", borderRadius: 10, background: "#f7f3ec", minHeight: 40 },
  staffStats: { display: "flex", alignItems: "center", gap: 9, fontSize: 11.5, color: "#a8a399", margin: "14px 0" },
  staffStatDiv: { width: 1, height: 11, background: "#e6e1d6" },
  staffActions: { display: "flex", gap: 8 },
  staffAct: { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px", borderRadius: 9, border: "1px solid #ece7dc", background: "#fff", color: "#5c574e", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s" },
  staffAdd: { background: "transparent", borderRadius: 16, border: "1.5px dashed #d8d2c5", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s", minHeight: 230 },

  miniStat: { background: "#fffefb", borderRadius: 14, border: "1px solid #ece7dc", padding: "14px 16px" },
  miniStatLabel: { fontSize: 11.5, color: "#a8a399", fontWeight: 600 },
  miniStatValue: { fontSize: 22, fontWeight: 800, marginTop: 5, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums" },

  boardWrap: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" },
  boardCol: { background: "#f4f1ea", borderRadius: 15, padding: 12, border: "1px solid #ece7dc" },
  boardColHead: { display: "flex", alignItems: "center", gap: 8, padding: "4px 6px 12px" },
  boardColTitle: { fontSize: 13, fontWeight: 800, color: "#5c574e" },
  boardCount: { fontSize: 11, fontWeight: 700, color: "#a8a399", background: "#e9e4d8", borderRadius: 20, padding: "1px 8px" },
  boardCards: { display: "flex", flexDirection: "column", gap: 9 },
  boardCard: { background: "#fff", borderRadius: 12, border: "1px solid #ece7dc", padding: 13, cursor: "grab" },
  boardCardTop: { display: "flex", alignItems: "center", gap: 6, marginBottom: 9 },
  prioPill: { fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6 },
  boardCardText: { fontSize: 13.5, fontWeight: 500, lineHeight: 1.4, color: "#2b2820" },
  boardCardFoot: { marginTop: 10 },
  boardAdd: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: 10, border: "1.5px dashed #d8d2c5", background: "transparent", color: "#b4afa5", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },

  bigTimeline: { display: "flex", flexDirection: "column" },
  btRow: { display: "flex", gap: 16, minHeight: 70 },
  btTime: { fontSize: 13, fontWeight: 800, color: "#a8a399", width: 46, paddingTop: 14, flexShrink: 0, fontVariantNumeric: "tabular-nums" },
  btLine: { display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 16 },
  btDot: { width: 11, height: 11, borderRadius: "50%", background: "#d8d2c5", flexShrink: 0 },
  btBar: { width: 2, flex: 1, background: "#ece7dc", marginTop: 4 },
  btCard: { flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", marginBottom: 14, borderRadius: 13, border: "1px solid #ece7dc", background: "#fff", transition: "all .15s" },
  btCardMain: { display: "flex", alignItems: "center", gap: 10 },
  btText: { fontSize: 14, fontWeight: 600, color: "#5c574e" },
  nowTag: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800 },
  btWho: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#8a8578", fontWeight: 600 },
  btWhoAvatar: { width: 24, height: 24, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 },

  insightGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 },
  bigInsight: { background: "#fffefb", borderRadius: 16, border: "1px solid #ece7dc", padding: 20 },
  biTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  biK: { fontSize: 13.5, fontWeight: 700, color: "#5c574e" },
  biTrend: { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 7 },
  biV: { fontSize: 36, fontWeight: 800, letterSpacing: "-.03em", marginTop: 14, fontVariantNumeric: "tabular-nums", lineHeight: 1 },
  biUnit: { fontSize: 17, fontWeight: 700, color: "#a8a399", marginLeft: 3 },
  biSub: { fontSize: 12, color: "#a8a399", marginTop: 6 },

  todoRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", borderRadius: 9, transition: "background .12s" },
  checkbox: { width: 19, height: 19, borderRadius: 6, border: "1.8px solid #d8d2c5", display: "grid", placeItems: "center", flexShrink: 0, transition: "all .15s" },
  todoText: { fontSize: 13.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  byBadge: { display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, flexShrink: 0 },
  byAuto: { background: "#eef0f7", color: "#5a6ea8" },
  byManual: { background: "#f0eee9", color: "#a8a399" },
  todoTag: { fontSize: 11, color: "#b4afa5", flexShrink: 0 },

  logRow: { display: "flex", alignItems: "center", gap: 11, padding: "9px 8px", borderRadius: 9, transition: "background .12s" },
  logAvatar: { width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 700, flexShrink: 0 },
  logWho: { fontSize: 13, fontWeight: 700, flexShrink: 0 },
  logAct: { fontSize: 13, color: "#8a8578", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  logAgo: { fontSize: 11.5, color: "#b4afa5", flexShrink: 0 },

  memberSectionLabel: { fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: "#b4afa5", padding: "0 8px 8px" },
  memberRow: { display: "flex", alignItems: "center", gap: 13, padding: "11px 10px", borderRadius: 11, transition: "background .12s" },
  memberAvatar: { width: 38, height: 38, borderRadius: "50%", color: "#fff", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 700, flexShrink: 0 },
  memberName: { fontSize: 14.5, fontWeight: 700 },
  memberRole: { fontSize: 12, color: "#a8a399", marginTop: 1 },
  rolePill: { fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 20 },
  iconBtnSm: { width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "#b4afa5", display: "grid", placeItems: "center", cursor: "pointer" },
  inviteRow: { display: "flex", alignItems: "center", gap: 13, padding: "11px 10px", borderRadius: 11, border: "1.5px dashed #ddd7cb", background: "transparent", cursor: "pointer", width: "100%", marginTop: 6, transition: "background .12s" },

  staffViewReport: { display: "flex", alignItems: "center", gap: 7, marginTop: 14, padding: "9px 12px", borderRadius: 10, border: "1px solid", fontSize: 12.5, fontWeight: 700 },

  backBtn: { display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px 6px 8px", borderRadius: 9, border: "none", background: "transparent", color: "#8a8578", fontSize: 13, fontWeight: 700, cursor: "pointer", alignSelf: "flex-start", marginBottom: 2 },
  detailHero: { display: "flex", alignItems: "flex-start", gap: 18, padding: 22, borderRadius: 18, border: "1px solid" },
  detailIcon: { width: 58, height: 58, borderRadius: 16, display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "0 6px 18px -6px rgba(0,0,0,.3)" },
  detailName: { fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" },
  detailRole: { fontSize: 13.5, color: "#8a8578", marginTop: 3 },
  detailStatRow: { display: "flex", alignItems: "center", gap: 14, marginTop: 14, flexWrap: "wrap" },
  detailStatItem: { fontSize: 12.5, color: "#a8a399" },
  detailMetric: { textAlign: "right", flexShrink: 0 },
  detailMetricLabel: { fontSize: 11, color: "#a8a399", fontWeight: 600, marginBottom: 4 },
  detailMetricVal: { fontSize: 20, fontWeight: 800, marginTop: 2, fontVariantNumeric: "tabular-nums" },

  detailGrid: { display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20, alignItems: "start" },
  detailColLabel: { fontSize: 11, fontWeight: 800, letterSpacing: ".08em", color: "#b4afa5", marginBottom: 12 },
  reportCard: { background: "#fffefb", borderRadius: 14, border: "1px solid #ece7dc", padding: 16 },
  reportTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  reportDate: { fontSize: 13, fontWeight: 800, color: "#8a8578" },
  reportTag: { fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6 },
  reportTitle: { fontSize: 15, fontWeight: 700, marginBottom: 10, letterSpacing: "-.01em" },
  reportLines: { margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 },
  reportLine: { fontSize: 13, color: "#6b665d", lineHeight: 1.5, display: "flex", gap: 9, alignItems: "flex-start" },
  reportBullet: { width: 5, height: 5, borderRadius: "50%", flexShrink: 0, marginTop: 7 },
  emptyBox: { padding: 24, borderRadius: 14, border: "1.5px dashed #ddd7cb", color: "#a8a399", fontSize: 13, textAlign: "center", lineHeight: 1.5 },

  routineBox: { background: "#fffefb", borderRadius: 14, border: "1px solid #ece7dc", padding: 12, display: "flex", flexDirection: "column", gap: 4 },
  routineRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 8px" },
  routineDot: { width: 22, height: 22, borderRadius: 7, display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 },
  routineText: { fontSize: 13, color: "#5c574e", lineHeight: 1.4, fontWeight: 500 },
  routineAdd: { display: "flex", alignItems: "center", gap: 6, padding: "9px 8px", borderRadius: 9, border: "none", background: "transparent", color: "#b4afa5", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  detailSetBtn: { display: "flex", alignItems: "center", gap: 9, padding: "11px 12px", borderRadius: 10, border: "none", background: "transparent", color: "#5c574e", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left", width: "100%" },

  insightSection: { marginTop: 4 },
  kwRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 10px", borderRadius: 10, transition: "background .12s" },
  kwRank: { width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 },
  kwName: { fontSize: 14, fontWeight: 600, flex: 1 },
  kwHot: { display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 800, padding: "3px 8px", borderRadius: 6 },
  kwVol: { fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums", minWidth: 70, textAlign: "right" },

  suggestGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14, marginTop: 10 },
  suggestCard: { background: "#fffefb", borderRadius: 15, border: "1px solid #ece7dc", padding: 17 },
  suggestTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  suggestType: { fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 7 },
  suggestFrom: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "#a8a399", fontWeight: 600 },
  suggestTitle: { fontSize: 15, fontWeight: 700, lineHeight: 1.35, marginBottom: 8, letterSpacing: "-.01em" },
  suggestBody: { fontSize: 13, color: "#6b665d", lineHeight: 1.55, marginBottom: 14 },
  suggestActions: { display: "flex", gap: 8 },
  suggestBtn: { flex: 1, padding: "9px", borderRadius: 9, border: "1px solid #ece7dc", background: "#fff", color: "#8a8578", fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "all .15s" },

  briefBanner: { display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 15, border: "none", color: "#fff", cursor: "pointer", boxShadow: "0 8px 22px -8px rgba(60,50,30,.4)", transition: "all .15s", width: "100%" },
  briefBannerIcon: { width: 40, height: 40, borderRadius: 11, background: "rgba(255,255,255,.18)", display: "grid", placeItems: "center", flexShrink: 0 },
  briefBannerTitle: { display: "block", fontSize: 15, fontWeight: 800 },
  briefBannerSub: { display: "block", fontSize: 12.5, opacity: 0.9, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 520 },

  briefHero: { padding: 24, borderRadius: 18, border: "1px solid" },
  briefHeadline: { fontSize: 19, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 12 },
  briefSummary: { fontSize: 14.5, lineHeight: 1.7, color: "#5c574e", margin: 0 },
  briefGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" },
  needRow: { display: "flex", alignItems: "center", gap: 11, padding: "11px 8px", borderRadius: 10, transition: "background .12s" },
  needNum: { width: 22, height: 22, borderRadius: 7, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 },
  needText: { fontSize: 13.5, fontWeight: 500, color: "#2b2820" },
  briefStaffRow: { display: "flex", alignItems: "center", gap: 11, padding: "11px 8px", borderRadius: 10, transition: "background .12s" },
  briefStaffAvatar: { width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0 },
  briefStaffWho: { fontSize: 13, fontWeight: 700, flexShrink: 0, minWidth: 92 },
  briefStaffLine: { fontSize: 12.5, color: "#8a8578", flex: 1, lineHeight: 1.4 },

  snsCard: { background: "#fffefb", borderRadius: 14, border: "1px solid #ece7dc", padding: 15 },
  snsTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  snsPlatform: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 800, color: "#5c574e" },
  snsStatus: { fontSize: 10.5, fontWeight: 800, padding: "3px 9px", borderRadius: 7 },
  snsBody: { fontSize: 13.5, lineHeight: 1.6, color: "#2b2820", whiteSpace: "pre-line", marginBottom: 10 },
  snsTags: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  snsTag: { fontSize: 12, fontWeight: 600 },
  snsImg: { display: "flex", gap: 6, fontSize: 11.5, color: "#a8a399", lineHeight: 1.4, padding: "8px 10px", background: "#f7f3ec", borderRadius: 9, marginBottom: 12 },
  snsActions: { display: "flex", gap: 8 },
  snsBtn: { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "9px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "all .15s" },
};

const CSS = `
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css');
.railbtn:hover{background:#34312a;color:#f4f1ea}
.toggle:hover{border-color:#d8d2c5;box-shadow:0 3px 10px -3px rgba(60,50,30,.12)}
.dditem:hover{background:#f4f1ea}
.iconbtn:hover{background:#f0ede6;color:#2b2820}
.ghost:hover{background:rgba(0,0,0,.045)}
.solid:hover{filter:brightness(1.06);transform:translateY(-1px)}
.lift{transition:transform .18s,box-shadow .18s}
.lift:hover{transform:translateY(-3px);box-shadow:0 14px 30px -14px rgba(60,50,30,.22)}
.desk:hover{transform:translateY(-2px);box-shadow:0 10px 24px -12px rgba(60,50,30,.18);border-color:#d8d2c5}
.todorow:hover{background:#f7f3ec}
.logrow:hover{background:#f7f3ec}
.dd{animation:pop .16s ease}
@keyframes pop{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}
.dot-live{animation:pulse 1.8s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
*::-webkit-scrollbar{width:8px}
*::-webkit-scrollbar-thumb{background:#dcd6c9;border-radius:4px}
*::-webkit-scrollbar-track{background:transparent}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
`;

/**
 * @file src/pages/ContentPage.tsx
 * @description 콘텐츠(유튜브) 관리 페이지
 * - 채널 직접 등록(URL/@핸들/채널ID) → API로 영상·댓글 수집 (VITE_YOUTUBE_API_KEY)
 * - 채널별 필터 + 주간 추이 그래프(조회수/댓글/영상) + 주간 시트
 * - 영상 그리드 → 클릭 시 임베드 플레이어 + 댓글 모달
 * - 댓글 답글 워크플로우: AI 생성(스크립트+자동 리서치) → 수동 수정 → 발행
 * - 모디/모던 테마 자동 대응 (토큰 + 글로벌 오버라이드)
 */
import { useState, useMemo } from 'react';
import { YoutubeVideo, YoutubeWeeklyStat } from '../types';
import { useYoutube } from '../hooks/useYoutube';
import { useTheme } from '../contexts/ThemeContext';
import { WeeklyTrendChart } from '../components/content/WeeklyTrendChart';
import { CommentReplyCard } from '../components/content/CommentReplyCard';
import { VideoModal } from '../components/content/VideoModal';
import { EyeIcon, CommentIcon } from '../components/content/icons';

// ── 주간 집계 유틸 ──

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function buildWeeklyStats(videos: YoutubeVideo[]): YoutubeWeeklyStat[] {
  const WEEKS = 6;
  const anchor = videos.length
    ? new Date(Math.max(...videos.map((v) => new Date(v.publishedAt).getTime())))
    : new Date();
  const lastWeekStart = startOfWeek(anchor);

  const buckets: YoutubeWeeklyStat[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const ws = new Date(lastWeekStart);
    ws.setDate(ws.getDate() - i * 7);
    buckets.push({ week: `${ws.getMonth() + 1}/${ws.getDate()}`, views: 0, comments: 0, videos: 0 });
  }
  const firstStart = lastWeekStart.getTime() - (WEEKS - 1) * 7 * 86400000;
  for (const v of videos) {
    const ws = startOfWeek(new Date(v.publishedAt));
    const idx = Math.round((ws.getTime() - firstStart) / (7 * 86400000));
    if (idx >= 0 && idx < WEEKS) {
      buckets[idx].views += v.viewCount ?? 0;
      buckets[idx].comments += v.commentCount ?? 0;
      buckets[idx].videos += 1;
    }
  }
  return buckets;
}

export function ContentPage({ embedded }: { embedded?: boolean } = {}) {
  const { theme } = useTheme();
  const modern = theme === 'modern';

  const {
    channels, videos, comments, loading, usingDummy, hasApiKey, hasOAuth,
    refreshFromApi, addChannel, removeChannel, saveDraft, publish, saveScript,
  } = useYoutube();

  const [activeChannel, setActiveChannel] = useState<string>('all');
  const [metric, setMetric] = useState<'views' | 'comments' | 'videos'>('views');
  const [commentFilter, setCommentFilter] = useState<'none' | 'draft' | 'published' | 'all'>('none');
  const [refreshing, setRefreshing] = useState(false);
  const [openVideoId, setOpenVideoId] = useState<string | null>(null);

  // 채널 등록 UI
  const [showAdd, setShowAdd] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // ── 테마 토큰 ──
  const T = {
    // embedded(오피스 셸 내부): 자체 배경/컨테이너 없이 오피스 레이아웃에 녹아듦
    page: embedded ? 'text-foreground' : (modern ? 'min-h-full bg-surface text-foreground' : 'min-h-full bg-[#fffef5]'),
    container: embedded
      ? 'space-y-6'
      : (modern ? 'mx-auto max-w-5xl px-5 sm:px-8 py-10 sm:py-14 space-y-10' : 'max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6'),
    accentText: modern ? 'text-primary-600' : 'text-amber-600',
    chipActive: modern ? 'bg-primary-500 text-white' : 'bg-amber-500 text-white',
    chipIdle: 'bg-gray-100 text-gray-500 hover:bg-gray-200',
  };

  const METRICS = modern
    ? [
        { key: 'views' as const, label: '조회수', color: '#1b4332' },
        { key: 'comments' as const, label: '댓글', color: '#6b6b6b' },
        { key: 'videos' as const, label: '영상', color: '#a1a1a1' },
      ]
    : [
        { key: 'views' as const, label: '조회수', color: '#ef4444' },
        { key: 'comments' as const, label: '댓글', color: '#a855f7' },
        { key: 'videos' as const, label: '영상', color: '#22c55e' },
      ];

  // ── 필터 적용 ──
  const filteredVideos = useMemo(
    () => (activeChannel === 'all' ? videos : videos.filter((v) => v.channelId === activeChannel)),
    [videos, activeChannel],
  );
  const filteredComments = useMemo(
    () => (activeChannel === 'all' ? comments : comments.filter((c) => c.channelId === activeChannel)),
    [comments, activeChannel],
  );

  const weeklyStats = useMemo(() => buildWeeklyStats(filteredVideos), [filteredVideos]);
  const chartData = useMemo(() => weeklyStats.map((w) => ({ label: w.week, value: w[metric] })), [weeklyStats, metric]);
  const activeMetric = METRICS.find((m) => m.key === metric)!;

  const videoMap = useMemo(() => {
    const m: Record<string, YoutubeVideo> = {};
    videos.forEach((v) => { m[v.videoId] = v; });
    return m;
  }, [videos]);

  const channelTitleMap = useMemo(() => {
    const m: Record<string, string> = {};
    channels.forEach((c) => { m[c.channelId] = c.title; });
    return m;
  }, [channels]);

  const commentsByVideo = useMemo(() => {
    const m: Record<string, number> = {};
    comments.forEach((c) => { m[c.videoId] = (m[c.videoId] ?? 0) + 1; });
    return m;
  }, [comments]);

  const visibleComments = useMemo(() => {
    let list = [...filteredComments];
    if (commentFilter !== 'all') list = list.filter((c) => c.replyStatus === commentFilter);
    return list.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }, [filteredComments, commentFilter]);

  const pendingCount = filteredComments.filter((c) => c.replyStatus === 'none').length;

  const openVideo = openVideoId ? videoMap[openVideoId] : null;
  const openVideoComments = useMemo(
    () => (openVideoId ? comments.filter((c) => c.videoId === openVideoId) : []),
    [comments, openVideoId],
  );

  // ── 핸들러 ──
  const handleSaveDraft = (id: string, draft: string, status: 'none' | 'draft' | 'published' = 'draft') => {
    saveDraft(id, draft, status);
    if (status === 'draft') setCommentFilter('draft');
  };
  const handlePublish = async (id: string, replyText: string) => {
    await publish(id, replyText);   // 실패 시 throw → 카드에서 에러 표시, 필터 안 바뀜
    setCommentFilter('published');
  };
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refreshFromApi(); } finally { setRefreshing(false); }
  };
  const handleAddChannel = async () => {
    if (!channelInput.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      await addChannel(channelInput.trim());
      setChannelInput('');
      setShowAdd(false);
    } catch (e: any) {
      setAddError(e?.message || '채널 등록 실패');
    } finally {
      setAdding(false);
    }
  };
  const handleRemoveChannel = (channelId: string, title: string) => {
    if (window.confirm(`"${title}" 채널을 등록 해제할까요? (수집된 영상·댓글도 삭제돼요)`)) {
      if (activeChannel === channelId) setActiveChannel('all');
      removeChannel(channelId);
    }
  };

  return (
    <div className={T.page}>
      <div className={T.container}>
        {/* ── 헤더 ── */}
        {embedded ? (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-primary-500 mb-1.5">CONTENT</div>
            <h1 className="text-2xl font-extrabold text-gray-800">콘텐츠</h1>
            <p className="text-sm text-gray-400 mt-1">채널 {channels.length} · 영상 {videos.length} · 댓글 {comments.length}{usingDummy && ' · 목업'}</p>
          </div>
        ) : modern ? (
          <section>
            <p className="label">Content</p>
            <h1 className="mt-4 text-4xl font-light leading-[1.25] sm:text-5xl">콘텐츠</h1>
            <p className="mt-4 text-sm text-foreground-muted">
              채널 {channels.length}개 · 영상 {videos.length}개 · 댓글 {comments.length}개
              {usingDummy && ' · 목업'}
            </p>
          </section>
        ) : (
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <img src="/images/content.svg" alt="콘텐츠" className="w-6 h-6 object-contain" />
              콘텐츠
              {usingDummy && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">목업</span>}
            </h1>
          </div>
        )}

        {/* ── 채널 줄: 필터 칩 + 등록 ── */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveChannel('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeChannel === 'all' ? T.chipActive : 'bg-white text-gray-600 shadow-soft hover:shadow-hover'}`}
          >전체</button>
          {channels.map((c) => (
            <span
              key={c.id}
              className={`group inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${activeChannel === c.channelId ? T.chipActive : 'bg-white text-gray-600 shadow-soft hover:shadow-hover'}`}
              onClick={() => setActiveChannel(c.channelId)}
            >
              {c.thumbnail && <img src={c.thumbnail} alt={c.title} className="w-4 h-4 rounded-full object-cover" />}
              {c.title}
              <button
                onClick={(e) => { e.stopPropagation(); handleRemoveChannel(c.channelId, c.title); }}
                className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-black/10 text-[10px]"
                title="등록 해제"
              >✕</button>
            </span>
          ))}
          <button
            onClick={() => { setShowAdd((v) => !v); setAddError(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border border-dashed transition-all ${modern ? 'border-line text-foreground-muted hover:border-foreground' : 'border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-600'}`}
          >+ 채널</button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`ml-auto px-2.5 py-1.5 text-xs font-medium ${T.accentText} bg-white rounded-lg shadow-soft hover:shadow-hover transition-all flex items-center gap-1 disabled:opacity-50`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className={refreshing ? 'animate-spin' : ''}>
              <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" /><path d="M13.5 2v3h-3" />
            </svg>
            새로고침
          </button>
        </div>

        {/* 채널 등록 입력 */}
        {showAdd && (
          <div className="bg-white rounded-2xl p-4 shadow-soft space-y-2">
            <div className="flex gap-2">
              <input
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAddChannel(); }}
                placeholder="채널 URL · @핸들 · 채널ID (예: @운명랩 또는 https://youtube.com/@...)"
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
              <button
                onClick={handleAddChannel}
                disabled={adding || !channelInput.trim()}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${modern ? 'bg-primary-500' : 'bg-amber-500 hover:bg-amber-600'}`}
              >{adding ? '등록 중…' : '등록'}</button>
            </div>
            {addError && <p className="text-xs text-red-500">{addError}</p>}
            {!hasApiKey && (
              <p className="text-xs text-gray-400">⚠️ 실제 등록하려면 <code>VITE_YOUTUBE_API_KEY</code>가 필요해요 (Google Cloud → YouTube Data API v3 키).</p>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-12">불러오는 중…</p>
        ) : channels.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 shadow-soft text-center space-y-3">
            <p className="text-sm text-gray-500">아직 등록된 채널이 없어요.</p>
            <button
              onClick={() => setShowAdd(true)}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${modern ? 'bg-primary-500' : 'bg-amber-500 hover:bg-amber-600'}`}
            >+ 채널 등록하기</button>
          </div>
        ) : (
          <>
            {/* ── 주간 추이 + 시트 ── */}
            <div className="bg-white rounded-2xl p-5 shadow-soft space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-700">주간 추이</h2>
                <div className="flex gap-1.5">
                  {METRICS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setMetric(m.key)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${metric === m.key ? 'text-white' : T.chipIdle}`}
                      style={metric === m.key ? { backgroundColor: m.color } : undefined}
                    >{m.label}</button>
                  ))}
                </div>
              </div>

              <WeeklyTrendChart data={chartData} color={activeMetric.color} />

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left font-medium py-1.5 pr-2">주차</th>
                      <th className="text-right font-medium py-1.5 px-2">조회수</th>
                      <th className="text-right font-medium py-1.5 px-2">댓글</th>
                      <th className="text-right font-medium py-1.5 pl-2">영상</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyStats.map((w) => (
                      <tr key={w.week} className="border-b border-gray-50 last:border-0 text-gray-600">
                        <td className="py-1.5 pr-2 font-medium">{w.week}</td>
                        <td className="py-1.5 px-2 text-right">{w.views.toLocaleString()}</td>
                        <td className="py-1.5 px-2 text-right">{w.comments.toLocaleString()}</td>
                        <td className="py-1.5 pl-2 text-right">{w.videos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── 영상 그리드 ── */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-gray-700">영상 {filteredVideos.length}개</h2>
              {filteredVideos.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">영상이 없어요</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredVideos.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setOpenVideoId(v.videoId)}
                      className="bg-white rounded-2xl overflow-hidden shadow-soft hover:shadow-hover transition-all text-left group"
                    >
                      <div className="relative w-full bg-gray-100" style={{ paddingTop: '56.25%' }}>
                        {v.thumbnail && <img src={v.thumbnail} alt={v.title} className="absolute inset-0 w-full h-full object-cover" />}
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                          <span className="text-white text-2xl">▶</span>
                        </span>
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-medium text-gray-700 line-clamp-2 leading-snug">{v.title}</p>
                        <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1"><EyeIcon size={11} /> {(v.viewCount ?? 0).toLocaleString()}</span>
                          <span className="inline-flex items-center gap-1"><CommentIcon size={11} /> {commentsByVideo[v.videoId] ?? 0}</span>
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── 댓글 워크플로우 ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                  댓글
                  {pendingCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">미답글 {pendingCount}</span>}
                  {!hasOAuth && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium" title="VITE_GOOGLE_CLIENT_ID 설정 시 실제 발행">발행 미연동</span>}
                </h2>
                <div className="flex gap-1.5">
                  {([['none', '미답글'], ['draft', '초안'], ['published', '발행됨'], ['all', '전체']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setCommentFilter(key)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${commentFilter === key ? T.chipActive : T.chipIdle}`}
                    >{label}</button>
                  ))}
                </div>
              </div>

              {visibleComments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">해당하는 댓글이 없어요</p>
              ) : (
                visibleComments.map((c) => (
                  <CommentReplyCard
                    key={c.id}
                    comment={c}
                    video={videoMap[c.videoId]}
                    channelTitle={channelTitleMap[c.channelId] || ''}
                    onSaveDraft={handleSaveDraft}
                    onPublish={handlePublish}
                    onSaveScript={saveScript}
                    canPublish={hasOAuth}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* 영상 모달 */}
      {openVideo && (
        <VideoModal
          video={openVideo}
          comments={openVideoComments}
          channelTitle={channelTitleMap[openVideo.channelId] || ''}
          onClose={() => setOpenVideoId(null)}
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
          onSaveScript={saveScript}
          canPublish={hasOAuth}
        />
      )}
    </div>
  );
}

/**
 * YouTube 답글 감지 진단 스크립트 (일회성)
 * 실행:  VITE_YOUTUBE_API_KEY=키값 node scripts/diag-youtube.cjs @쏠닝오즈
 * 목적:  댓글이 '미답글'로만 뜨는 원인 파악 — 채널 주인(나) 답글 감지가
 *        실제 API 응답에서 왜 안 잡히는지 그대로 출력.
 */
const KEY = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
const INPUT = process.argv[2] || '@쏠닝오즈';
const BASE = 'https://www.googleapis.com/youtube/v3';

if (!KEY) { console.error('❌ VITE_YOUTUBE_API_KEY 환경변수가 필요해요. 예) VITE_YOUTUBE_API_KEY=키값 node scripts/diag-youtube.cjs @쏠닝오즈'); process.exit(1); }

async function api(path, params) {
  const qs = new URLSearchParams({ ...params, key: KEY }).toString();
  const r = await fetch(`${BASE}/${path}?${qs}`);
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || `HTTP ${r.status}`); }
  return r.json();
}

async function resolveChannel(input) {
  const s = input.trim();
  let channelId = '';
  if (/^UC[\w-]{20,}$/.test(s)) channelId = s;
  else if (s.startsWith('@')) { const d = await api('channels', { part: 'id', forHandle: s }); channelId = d.items?.[0]?.id; }
  if (!channelId) { const d = await api('search', { part: 'snippet', type: 'channel', q: s.replace(/^@/, ''), maxResults: '1' }); channelId = d.items?.[0]?.snippet?.channelId || d.items?.[0]?.id?.channelId; }
  if (!channelId) throw new Error('채널을 못 찾음: ' + input);
  const d = await api('channels', { part: 'snippet,contentDetails', id: channelId });
  const ch = d.items?.[0];
  return { channelId, title: ch?.snippet?.title, uploads: ch?.contentDetails?.relatedPlaylists?.uploads };
}

(async () => {
  console.log('입력:', INPUT);
  const ch = await resolveChannel(INPUT);
  console.log(`✅ 채널: ${ch.title}  (channelId=${ch.channelId})\n`);

  const list = await api('playlistItems', { part: 'contentDetails', playlistId: ch.uploads, maxResults: '5' });
  const videoIds = (list.items || []).map((it) => it.contentDetails?.videoId).filter(Boolean);
  console.log(`최근 영상 ${videoIds.length}개 점검\n`);

  let totalComments = 0, withReplies = 0, ownerDetected = 0;

  for (const vid of videoIds) {
    let data;
    try { data = await api('commentThreads', { part: 'snippet,replies', videoId: vid, order: 'time', maxResults: '10', textFormat: 'plainText' }); }
    catch (e) { console.log(`  [${vid}] 댓글 조회 실패: ${e.message}`); continue; }
    const items = data.items || [];
    if (!items.length) continue;
    console.log(`▶ 영상 ${vid} — 댓글 ${items.length}개`);
    for (const it of items) {
      totalComments++;
      const top = it.snippet?.topLevelComment?.snippet || {};
      const totalReplyCount = Number(it.snippet?.totalReplyCount) || 0;
      const preview = it.replies?.comments || [];
      if (totalReplyCount > 0) withReplies++;
      const ownerInPreview = preview.find((r) => r.snippet?.authorChannelId?.value === ch.channelId);
      if (ownerInPreview) ownerDetected++;
      const replyAuthors = preview.map((r) => `${r.snippet?.authorDisplayName}(${r.snippet?.authorChannelId?.value})`).join(', ');
      console.log(`   · "${(top.textDisplay || '').slice(0, 28)}…"  totalReplyCount=${totalReplyCount}, preview=${preview.length}, 내답글감지=${ownerInPreview ? 'O' : 'X'}`);
      if (preview.length) console.log(`       답글들: ${replyAuthors}`);
    }
    console.log();
  }

  console.log('──────── 요약 ────────');
  console.log(`총 댓글: ${totalComments}, 답글 있는 댓글: ${withReplies}, 내 답글 감지: ${ownerDetected}`);
  console.log(`내 채널ID(비교 기준): ${ch.channelId}`);
  console.log('→ 위 "답글들"의 괄호 안 채널ID가 내 채널ID와 다르면 그게 미감지 원인입니다.');
})().catch((e) => { console.error('진단 실패:', e.message); process.exit(1); });

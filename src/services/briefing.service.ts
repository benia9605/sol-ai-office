/**
 * @file src/services/briefing.service.ts
 * @description 모디 아침 브리핑 서비스
 * - 오늘 일정, 긴급 할일, 프로젝트 진행률 수집
 * - 모디 AI 한마디 생성 (Claude API, secretary 모델)
 * - daily_briefings 테이블에 하루 1회 캐싱
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { sendChatMessage, ChatMessage } from './chatApi';
import { fetchProjects } from './projects.service';
import { fetchAllGoals } from './goals.service';
import { KpiRow } from './kpis.service';

/** 브리핑 데이터 타입 */
export interface BriefingSchedule {
  title: string;
  time: string;
  project?: string;
}

export interface BriefingTask {
  title: string;
  daysLeft: number;
  urgencyType: 'overdue' | 'imminent';
}

export interface BriefingProject {
  name: string;
  emoji: string;
  percent: number;
  goalTitle: string;
}

export interface BriefingData {
  schedules: BriefingSchedule[];
  urgentTasks: BriefingTask[];
  projectProgress: BriefingProject[];
  aiComment: string;
}

/** 오늘 날짜 문자열 (YYYY-MM-DD) */
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** 오늘 일정 조회 */
async function fetchTodaySchedules(userId: string): Promise<BriefingSchedule[]> {
  const today = todayStr();

  const { data } = await supabase
    .from('schedules')
    .select('title, time, project')
    .eq('user_id', userId)
    .eq('date', today)
    .order('time');

  return (data ?? []).map(s => ({
    title: s.title,
    time: s.time || '',
    project: s.project,
  }));
}

/** 긴급 할일 조회 (마감 3일 이내 + 지연) */
async function fetchUrgentTasks(userId: string): Promise<BriefingTask[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  const futureStr = threeDaysLater.toISOString().split('T')[0];

  const { data } = await supabase
    .from('tasks')
    .select('title, due_date, status')
    .eq('user_id', userId)
    .in('status', ['todo', 'in_progress'])
    .not('due_date', 'is', null)
    .lte('due_date', futureStr)
    .order('due_date');

  if (!data) return [];

  const urgent: BriefingTask[] = [];
  for (const task of data) {
    const target = new Date(task.due_date);
    target.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      urgent.push({ title: task.title, daysLeft, urgencyType: 'overdue' });
    } else {
      urgent.push({ title: task.title, daysLeft, urgencyType: 'imminent' });
    }
  }

  // overdue 먼저, 그 다음 imminent (날짜순)
  urgent.sort((a, b) => {
    if (a.urgencyType !== b.urgencyType) return a.urgencyType === 'overdue' ? -1 : 1;
    return a.daysLeft - b.daysLeft;
  });

  return urgent.slice(0, 5);
}

/** 프로젝트 진행률 계산 */
async function fetchProjectProgress(userId: string): Promise<BriefingProject[]> {
  const [projects, goals, kpisResult] = await Promise.all([
    fetchProjects(),
    fetchAllGoals(),
    supabase
      .from('kpis')
      .select('*')
      .eq('user_id', userId)
      .then(({ data }) => (data ?? []) as KpiRow[]),
  ]);

  const result: BriefingProject[] = [];

  for (const project of projects) {
    const projectGoals = goals.filter(g => g.project_id === project.id);
    if (projectGoals.length === 0) continue;

    // 목표별 진행률 평균
    let totalProgress = 0;
    let mainGoalTitle = projectGoals[0]?.title || '';

    for (const goal of projectGoals) {
      const goalKpis = kpisResult.filter(k => k.goal_id === goal.id);
      if (goalKpis.length > 0) {
        const kpiAvg = goalKpis.reduce((sum, k) => {
          const range = k.target_value - k.start_value;
          if (range <= 0) return sum + 100;
          return sum + Math.min(100, Math.round(((k.current_value - k.start_value) / range) * 100));
        }, 0) / goalKpis.length;
        totalProgress += kpiAvg;
      } else {
        totalProgress += goal.progress;
      }
    }

    const avgProgress = Math.round(totalProgress / projectGoals.length);

    result.push({
      name: project.name,
      emoji: project.emoji || '',
      percent: avgProgress,
      goalTitle: mainGoalTitle,
    });
  }

  return result;
}

/** DB에서 오늘 AI 한마디 조회 */
async function fetchTodayComment(userId: string): Promise<string | null> {
  const today = todayStr();

  const { data, error } = await supabase
    .from('daily_briefings')
    .select('ai_comment')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (error || !data) return null;
  return data.ai_comment;
}

/** 모디에게 한마디 생성 요청 */
async function generateModiComment(
  schedules: BriefingSchedule[],
  urgentTasks: BriefingTask[],
  projectProgress: BriefingProject[],
): Promise<string> {
  const scheduleText = schedules.length > 0
    ? schedules.map(s => `- ${s.time} ${s.title}${s.project ? ` [${s.project}]` : ''}`).join('\n')
    : '(오늘 일정 없음)';

  const taskText = urgentTasks.length > 0
    ? urgentTasks.map(t => {
        const dLabel = t.daysLeft < 0 ? `D+${Math.abs(t.daysLeft)}` : t.daysLeft === 0 ? 'D-Day' : `D-${t.daysLeft}`;
        return `- ${t.title} (${dLabel})`;
      }).join('\n')
    : '(긴급 할일 없음)';

  const projectText = projectProgress.length > 0
    ? projectProgress.map(p => `- ${p.emoji} ${p.name}: ${p.percent}% (${p.goalTitle})`).join('\n')
    : '(등록된 프로젝트 없음)';

  const systemPrompt = `당신은 모디입니다. Sol님의 AI 비서이자 회의 진행자입니다.
아래 데이터를 보고 오늘 하루를 위한 격려+우선순위 제안을 해주세요.

규칙:
- 딱 1-2문장만 작성
- 따뜻하고 실용적으로
- 가장 급한 것 1개를 콕 집어서 추천
- 이모지 1개 정도 자연스럽게 사용
- "안녕하세요" 같은 인사말 금지`;

  const apiMessages: ChatMessage[] = [{
    role: 'user',
    content: `오늘 일정:\n${scheduleText}\n\n긴급 할일:\n${taskText}\n\n프로젝트 진행률:\n${projectText}\n\n오늘의 한마디를 부탁해!`,
  }];

  return sendChatMessage(systemPrompt, apiMessages, 'secretary', 200);
}

/** AI 한마디 DB 저장 (upsert) */
async function saveComment(userId: string, comment: string): Promise<void> {
  const today = todayStr();

  const { data: existing } = await supabase
    .from('daily_briefings')
    .select('id')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  if (existing) {
    await supabase
      .from('daily_briefings')
      .update({ ai_comment: comment })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('daily_briefings')
      .insert({ user_id: userId, date: today, ai_comment: comment });
  }
}

/**
 * 전체 브리핑 데이터 로드
 * @param forceRefresh - true면 AI 한마디를 새로 생성
 */
export async function loadBriefing(forceRefresh = false): Promise<BriefingData> {
  const userId = await getCurrentUserId();

  // 1. 데이터 병렬 수집
  const [schedules, urgentTasks, projectProgress] = await Promise.all([
    fetchTodaySchedules(userId),
    fetchUrgentTasks(userId),
    fetchProjectProgress(userId),
  ]);

  // 2. AI 한마디 (캐시 → 없으면 생성)
  let aiComment: string;

  if (!forceRefresh) {
    const cached = await fetchTodayComment(userId);
    if (cached) {
      return { schedules, urgentTasks, projectProgress, aiComment: cached };
    }
  }

  try {
    aiComment = await generateModiComment(schedules, urgentTasks, projectProgress);
    await saveComment(userId, aiComment);
  } catch (e) {
    console.error('[briefing] AI 한마디 생성 실패:', e);
    aiComment = '오늘도 화이팅이에요! 할일 목록을 확인해보세요.';
  }

  return { schedules, urgentTasks, projectProgress, aiComment };
}

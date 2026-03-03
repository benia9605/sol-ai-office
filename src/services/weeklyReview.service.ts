/**
 * @file src/services/weeklyReview.service.ts
 * @description 주간 회고 AI 초안 생성 서비스
 * - 이번 주 완료 할일, KPI 변화, 대화 요약, 일정, 인사이트 수집
 * - Claude API로 주간 회고 초안 생성
 * - WeeklyTemplate 형식으로 파싱하여 반환
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { sendChatMessage, ChatMessage } from './chatApi';
import { fetchProjects } from './projects.service';
import { fetchAllGoals } from './goals.service';
import { KpiRow } from './kpis.service';
import { WeeklyTemplate, ListField } from '../types';

/** 이번 주 월~일 범위 계산 */
function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

/** ListField 배열 생성 */
function toListFields(items: string[]): ListField[] {
  if (items.length === 0) return [{ id: Date.now().toString(), text: '' }];
  return items.map((text, i) => ({
    id: (Date.now() + i).toString() + Math.random().toString(36).slice(2, 6),
    text,
  }));
}

/** 이번 주 데이터 수집 */
async function collectWeeklyData(): Promise<string> {
  const userId = await getCurrentUserId();
  const { start, end } = getWeekRange();

  const [completedTasks, inProgressTasks, schedules, summaries, insights, projects, goals, kpis] = await Promise.all([
    // 이번 주 완료된 할일
    supabase
      .from('tasks')
      .select('title, completed_at, project, priority')
      .eq('user_id', userId)
      .in('status', ['done', 'completed'])
      .gte('completed_at', `${start}T00:00:00`)
      .lte('completed_at', `${end}T23:59:59`)
      .order('completed_at')
      .then(({ data }) => data ?? []),

    // 아직 진행 중인 할일
    supabase
      .from('tasks')
      .select('title, due_date, project, priority')
      .eq('user_id', userId)
      .in('status', ['todo', 'in_progress'])
      .order('due_date')
      .then(({ data }) => (data ?? []).slice(0, 10)),

    // 이번 주 일정
    supabase
      .from('schedules')
      .select('title, date, time, project')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date')
      .then(({ data }) => data ?? []),

    // 이번 주 대화 요약
    supabase
      .from('conversation_summaries')
      .select('room_id, summary, date')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })
      .then(({ data }) => data ?? []),

    // 이번 주 인사이트
    supabase
      .from('insights')
      .select('title, content, source')
      .eq('user_id', userId)
      .gte('created_at', `${start}T00:00:00`)
      .lte('created_at', `${end}T23:59:59`)
      .order('created_at', { ascending: false })
      .then(({ data }) => (data ?? []).slice(0, 10)),

    fetchProjects(),
    fetchAllGoals(),
    supabase
      .from('kpis')
      .select('*')
      .eq('user_id', userId)
      .then(({ data }) => (data ?? []) as KpiRow[]),
  ]);

  // 텍스트 조합
  let text = '';

  // 완료 할일
  text += `## 이번 주 완료한 할일 (${completedTasks.length}개)\n`;
  if (completedTasks.length > 0) {
    for (const t of completedTasks) {
      text += `- ${t.title}`;
      if (t.project) text += ` [${t.project}]`;
      if (t.priority === 'high') text += ' (높은 우선순위)';
      text += '\n';
    }
  } else {
    text += '(완료한 할일 없음)\n';
  }

  // 미완료 할일
  text += `\n## 아직 진행 중인 할일 (${inProgressTasks.length}개)\n`;
  if (inProgressTasks.length > 0) {
    for (const t of inProgressTasks) {
      text += `- ${t.title}`;
      if (t.due_date) text += ` (마감: ${t.due_date})`;
      text += '\n';
    }
  } else {
    text += '(진행 중인 할일 없음)\n';
  }

  // 일정
  text += `\n## 이번 주 일정 (${schedules.length}개)\n`;
  if (schedules.length > 0) {
    for (const s of schedules) {
      text += `- ${s.date} ${s.time || ''} ${s.title}`;
      if (s.project) text += ` [${s.project}]`;
      text += '\n';
    }
  } else {
    text += '(일정 없음)\n';
  }

  // 프로젝트 & KPI
  text += '\n## 프로젝트 & KPI 현황\n';
  for (const project of projects) {
    const projectGoals = goals.filter(g => g.project_id === project.id);
    if (projectGoals.length === 0) continue;
    text += `### ${project.emoji || ''} ${project.name}\n`;
    for (const goal of projectGoals) {
      text += `- ${goal.title} (진행률: ${goal.progress}%)\n`;
      const goalKpis = kpis.filter(k => k.goal_id === goal.id);
      for (const kpi of goalKpis) {
        text += `  - ${kpi.name}: ${kpi.current_value}/${kpi.target_value}${kpi.unit}\n`;
      }
    }
  }

  // 대화 요약
  if (summaries.length > 0) {
    const roomLabels: Record<string, string> = {
      strategy: '플래니', marketing: '마키', dev: '데비',
      research: '서치', meeting: '회의실', secretary: '모디',
    };
    text += '\n## 이번 주 AI 대화 요약\n';
    for (const s of summaries) {
      text += `- [${roomLabels[s.room_id] || s.room_id}] ${s.summary}\n`;
    }
  }

  // 인사이트
  if (insights.length > 0) {
    text += '\n## 이번 주 저장한 인사이트\n';
    for (const ins of insights) {
      text += `- ${ins.title}: ${ins.content.slice(0, 100)}\n`;
    }
  }

  return text;
}

/** AI 주간 회고 초안 생성 */
export async function generateWeeklyDraft(): Promise<WeeklyTemplate> {
  const weeklyData = await collectWeeklyData();
  const { start, end } = getWeekRange();

  const systemPrompt = `당신은 주간 회고를 도와주는 AI입니다.
아래 데이터를 분석하여 주간 회고 초안을 작성해주세요.

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "achievements": ["성취 1", "성취 2", ...],
  "regrets": ["아쉬운 점 1", ...],
  "nextGoals": ["다음 주 목표 1", ...],
  "lessons": "배운 점 한 문장"
}

규칙:
- achievements: 완료한 할일, KPI 변화, 일정 수행 등에서 성취를 3-5개 추출
- regrets: 미완료 할일, 부족한 부분에서 1-3개 추출 (없으면 빈 배열)
- nextGoals: 다음 주 해야 할 일을 2-4개 제안 (미완료 할일 + 자연스러운 다음 단계)
- lessons: 이번 주 전체를 돌아보며 배운 점 1문장
- 각 항목은 간결하게 (1줄 이내)
- Sol님에게 자연스러운 한국어로 작성`;

  const apiMessages: ChatMessage[] = [{
    role: 'user',
    content: `이번 주 (${start} ~ ${end}) 데이터입니다. 주간 회고 초안을 만들어주세요.\n\n${weeklyData}`,
  }];

  const response = await sendChatMessage(systemPrompt, apiMessages, 'secretary', 1024);

  // JSON 파싱
  try {
    // ```json ... ``` 또는 순수 JSON 처리
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON not found');

    const parsed = JSON.parse(jsonMatch[0]) as {
      achievements?: string[];
      regrets?: string[];
      nextGoals?: string[];
      lessons?: string;
    };

    return {
      achievements: toListFields(parsed.achievements || []),
      regrets: toListFields(parsed.regrets || []),
      nextGoals: toListFields(parsed.nextGoals || []),
      lessons: parsed.lessons || '',
    };
  } catch (e) {
    console.warn('[weeklyReview] JSON 파싱 실패, 원본 텍스트로 폴백:', e);
    // 파싱 실패 시 전체 응답을 lessons에 넣고 나머지는 빈 템플릿
    return {
      achievements: toListFields([]),
      regrets: toListFields([]),
      nextGoals: toListFields([]),
      lessons: response,
    };
  }
}

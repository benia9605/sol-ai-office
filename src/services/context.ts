/**
 * @file src/services/context.ts
 * @description 시스템 프롬프트 조합 로직
 * - 기본 프롬프트(md 파일) + 유저 정보 + 프로젝트/목표/KPI + 일정 + 할일 + 대화 요약
 * - buildSystemPrompt(roomId)로 최종 시스템 프롬프트 반환
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { fetchUserProfile } from './userProfile.service';
import { fetchProjects, ProjectRow } from './projects.service';
import { fetchAllGoals, GoalRow } from './goals.service';
import { KpiRow } from './kpis.service';

/** roomId → 프롬프트 파일명 매핑 */

const PROMPT_FILES: Record<string, string> = {
  strategy: 'plani',
  marketing: 'maki',
  dev: 'devi',
  research: 'searchi',
  meeting: 'meeting',
  secretary: 'modi',
};

/** roomId → AI 이름 매핑 */
const AI_NAMES: Record<string, string> = {
  strategy: '플래니',
  marketing: '마키',
  dev: '데비',
  research: '서치',
  meeting: '모디',
  secretary: '모디',
};

/** 기본 프롬프트 파일 로드 */
async function loadBasePrompt(roomId: string): Promise<string> {
  const fileName = PROMPT_FILES[roomId] || 'modi';
  try {
    const res = await fetch(`/prompts/${fileName}.md`);
    if (!res.ok) throw new Error(`프롬프트 로드 실패: ${res.status}`);
    return await res.text();
  } catch (e) {
    console.warn('[context] 프롬프트 파일 로드 실패:', e);
    return `당신은 ${AI_NAMES[roomId] || 'AI 팀원'}입니다.`;
  }
}

/** N일 후/전 날짜 문자열 (YYYY-MM-DD) */
function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** 유저 대화 스타일 포맷 */
function formatStyle(profile: { tone: string; response_length: string; emoji_usage: string }): string {
  const tone: Record<string, string> = { friendly: '친근하게 (반말 OK)', polite: '친근한 존댓말', formal: '격식있게' };
  const length: Record<string, string> = { short: '짧고 핵심만', medium: '적당히', detailed: '자세하게 설명' };
  const emoji: Record<string, string> = { many: '이모지 많이', moderate: '이모지 적당히', few: '이모지 거의 안 씀' };

  return `${tone[profile.tone] || '존댓말'}, ${length[profile.response_length] || '짧게'}, ${emoji[profile.emoji_usage] || '적당히'}`;
}

/** 프로젝트 + 목표 + KPI 포맷 */
function formatProjects(
  projects: ProjectRow[],
  goals: GoalRow[],
  kpis: KpiRow[],
): string {
  if (!projects.length) return '(등록된 프로젝트 없음)\n';

  let text = '';
  for (const project of projects) {
    text += `### ${project.emoji || '📁'} ${project.name}\n`;
    if (project.description) text += `${project.description}\n`;

    const projectGoals = goals.filter(g => g.project_id === project.id);
    if (projectGoals.length === 0) {
      text += '- (목표 없음)\n';
    } else {
      for (const goal of projectGoals) {
        text += `- 🎯 ${goal.title} (${goal.progress}%)`;
        if (goal.status === 'completed') text += ' ✅';
        text += '\n';

        // 해당 목표의 KPI
        const goalKpis = kpis.filter(k => k.goal_id === goal.id);
        for (const kpi of goalKpis) {
          const pct = kpi.target_value > 0
            ? Math.round((kpi.current_value / kpi.target_value) * 100)
            : 0;
          text += `  - 📊 ${kpi.name}: ${kpi.current_value}/${kpi.target_value}${kpi.unit} (${pct}%)\n`;
        }

      }
    }
  }
  return text;
}

/**
 * 시스템 프롬프트 빌드
 * @param roomId - 방 ID (strategy, marketing, dev, research, meeting, secretary)
 */
export async function buildSystemPrompt(roomId: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0];
  const userId = await getCurrentUserId();

  // 병렬로 데이터 로드
  const [basePrompt, profile, projects, goals, kpis, schedules, tasks, summaries] = await Promise.all([
    loadBasePrompt(roomId),
    fetchUserProfile(),
    fetchProjects(),
    fetchAllGoals(),
    // 전체 KPI
    supabase
      .from('kpis')
      .select('*')
      .eq('user_id', userId)
      .order('created_at')
      .then(({ data }) => (data ?? []) as KpiRow[]),
    // 다가오는 일정 (7일)
    supabase
      .from('schedules')
      .select('*')
      .eq('user_id', userId)
      .gte('date', today)
      .lte('date', addDays(new Date(), 7))
      .order('date')
      .then(({ data }) => data ?? []),
    // 진행 중 할일
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['todo', 'in_progress'])
      .order('due_date')
      .then(({ data }) => data ?? []),
    // 대화 요약 (해당 방, 최근 7일)
    supabase
      .from('conversation_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('room_id', roomId)
      .gte('date', addDays(new Date(), -7))
      .order('date', { ascending: false })
      .then(({ data }) => data ?? []),
  ]);

  // 컨텍스트 조합
  let context = '\n\n---\n\n';

  // 1. 유저 정보
  if (profile) {
    context += `## 유저 정보\n`;
    context += `- 이름: ${profile.name}\n`;
    context += `- 소개: ${profile.bio || '없음'}\n`;
    context += `- 대화 스타일: ${formatStyle(profile)}\n\n`;
  }

  // 2. 프로젝트 & 목표 & KPI
  context += `## 현재 프로젝트 & 목표\n`;
  context += formatProjects(projects, goals, kpis);
  context += '\n';

  // 3. 일정
  if (schedules.length > 0) {
    context += `## 다가오는 일정 (7일 이내)\n`;
    for (const s of schedules.slice(0, 10)) {
      context += `- ${s.date}${s.time ? ' ' + s.time : ''}: ${s.title}`;
      if (s.project) context += ` [${s.project}]`;
      context += '\n';
    }
    context += '\n';
  }

  // 4. 할일
  if (tasks.length > 0) {
    context += `## 진행 중인 할일\n`;
    for (const t of tasks.slice(0, 15)) {
      const icon = t.status === 'in_progress' ? '🔄' : '⬜';
      const priority = t.priority === 'high' ? ' 🔴' : t.priority === 'urgent' ? ' 🔥' : '';
      context += `- ${icon} ${t.title}${priority}`;
      if (t.due_date) context += ` (마감: ${t.due_date})`;
      if (t.project) context += ` [${t.project}]`;
      context += '\n';
    }
    context += '\n';
  }

  // 5. 대화 요약
  if (summaries.length > 0) {
    context += `## 최근 대화 요약 (이 방)\n`;
    context += summaries[0].summary + '\n\n';
  }

  // 6. 모디/회의실 전용: 전체 방 요약
  if (roomId === 'secretary' || roomId === 'meeting') {
    const { data: allSummaries } = await supabase
      .from('conversation_summaries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', addDays(new Date(), -7))
      .order('date', { ascending: false });

    if (allSummaries && allSummaries.length > 0) {
      const roomLabels: Record<string, string> = {
        strategy: '💜 플래니',
        marketing: '💗 마키',
        dev: '🤎 데비',
        research: '💚 서치',
      };

      context += `## 전체 AI방 최근 요약\n`;
      const grouped: Record<string, string> = {};
      for (const s of allSummaries) {
        if (!grouped[s.room_id]) {
          grouped[s.room_id] = s.summary;
        }
      }
      for (const [rid, label] of Object.entries(roomLabels)) {
        context += `${label}: ${grouped[rid] || '최근 대화 없음'}\n`;
      }
      context += '\n';
    }
  }

  return basePrompt + context;
}

/** AI 이름 조회 */
export function getAIName(roomId: string): string {
  return AI_NAMES[roomId] || 'AI';
}

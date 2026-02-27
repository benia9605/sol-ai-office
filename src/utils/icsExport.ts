/**
 * @file src/utils/icsExport.ts
 * @description iCalendar(.ics) 파일 생성 및 다운로드 유틸
 * - generateIcs(): ScheduleItem → .ics 문자열 생성
 * - downloadIcs(): .ics 파일 다운로드 트리거
 * - macOS에서 .ics 더블클릭 시 Apple 캘린더 자동 연동
 */
import { ScheduleItem, RepeatType } from '../types';

/** 날짜+시간 → iCalendar DTSTART/DTEND 형식 (로컬 시간) */
function formatIcsDateTime(date: string, time: string): string {
  // date: '2026-02-20', time: '10:00'
  const d = date.replace(/-/g, '');
  const t = time.replace(/:/g, '') + '00';
  return `${d}T${t}`;
}

/** RepeatType → RRULE 문자열 */
function getRRule(repeat?: RepeatType): string | null {
  if (!repeat || repeat === 'none') return null;
  const freqMap: Record<string, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY',
  };
  const freq = freqMap[repeat];
  return freq ? `RRULE:FREQ=${freq}` : null;
}

/** reminder 값 → VALARM 블록 */
function getVAlarm(reminder?: string): string | null {
  if (!reminder || reminder === 'none') return null;
  const triggerMap: Record<string, string> = {
    '10min': '-PT10M',
    '30min': '-PT30M',
    '1hour': '-PT1H',
    '1day': '-P1D',
  };
  const trigger = triggerMap[reminder];
  if (!trigger) return null;
  return [
    'BEGIN:VALARM',
    'TRIGGER:' + trigger,
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
  ].join('\r\n');
}

/** UID 생성 (간단한 유니크 ID) */
function generateUid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}@solaioffice`;
}

/** ScheduleItem → .ics 문자열 생성 */
export function generateIcs(item: ScheduleItem): string {
  const dtStart = formatIcsDateTime(item.date, item.time);

  // 기본 1시간 duration
  const startDate = new Date(`${item.date}T${item.time}:00`);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const endTime = endDate.toTimeString().slice(0, 5); // 'HH:MM'
  const dtEnd = formatIcsDateTime(item.date, endTime);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Teamie//Schedule Export//KO',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${generateUid()}`,
    `DTSTAMP:${formatIcsDateTime(new Date().toISOString().slice(0, 10), new Date().toTimeString().slice(0, 5))}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(item.title)}`,
  ];

  if (item.notes) {
    lines.push(`DESCRIPTION:${escapeIcsText(item.notes)}`);
  }

  if (item.project) {
    lines.push(`CATEGORIES:${escapeIcsText(item.project)}`);
  }

  const rrule = getRRule(item.repeat);
  if (rrule) {
    lines.push(rrule);
  }

  const valarm = getVAlarm(item.reminder);
  if (valarm) {
    lines.push(valarm);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}

/** iCalendar 텍스트 이스케이프 (콤마, 세미콜론, 줄바꿈) */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** .ics 파일 다운로드 */
export function downloadIcs(item: ScheduleItem): void {
  const icsContent = generateIcs(item);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${item.title.replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const attendanceLabels = {
  unmarked: '未点名',
  present: '出勤',
  late: '迟到',
  leave: '请假',
  absent: '缺勤',
} as const;

export const submissionLabels = {
  pending: '待检查',
  completed: '已完成',
  missing: '未完成',
} as const;

function parseLocalDateTime(value: string): Date {
  return new Date(value.includes('T') ? value : `${value}T00:00:00`);
}

export function formatDateChinese(date: string): string {
  const value = parseLocalDateTime(date);
  if (Number.isNaN(value.getTime())) return date;
  return `${value.getMonth() + 1}月${value.getDate()}日`;
}

export function formatFullDate(date: Date = new Date()): string {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatDateTimeSeconds(value: string): string {
  const date = parseLocalDateTime(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

export function formatTimeSeconds(value: string): string {
  const date = parseLocalDateTime(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

export function relativeDue(date: string): { text: string; tone: 'normal' | 'soon' | 'overdue' } {
  const now = new Date();
  const due = parseLocalDateTime(date);
  if (Number.isNaN(due.getTime())) return { text: '未设置截止时间', tone: 'normal' };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

  if (due.getTime() < now.getTime()) {
    return { text: `已逾期 · ${formatDateTimeSeconds(date)}`, tone: 'overdue' };
  }
  if (days === 0) return { text: `今天 ${formatTimeSeconds(date)} 截止`, tone: 'soon' };
  if (days === 1) return { text: `明天 ${formatTimeSeconds(date)} 截止`, tone: 'soon' };
  if (days > 1 && days <= 7) return { text: `${days} 天后 ${formatTimeSeconds(date)} 截止`, tone: 'normal' };
  return { text: `${formatDateTimeSeconds(date)} 截止`, tone: 'normal' };
}

export function getInitial(name: string): string {
  const characters = Array.from(name.trim());
  return characters.slice(-2).join('') || '?';
}

export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

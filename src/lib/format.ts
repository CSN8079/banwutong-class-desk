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

export function formatDateChinese(date: string): string {
  const value = new Date(`${date}T00:00:00`);
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

export function relativeDue(date: string): { text: string; tone: 'normal' | 'soon' | 'overdue' } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${date}T00:00:00`);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { text: `已逾期 ${Math.abs(days)} 天`, tone: 'overdue' };
  if (days === 0) return { text: '今天截止', tone: 'soon' };
  if (days === 1) return { text: '明天截止', tone: 'soon' };
  return { text: `${days} 天后截止`, tone: 'normal' };
}

export function getInitial(name: string): string {
  return name.trim().slice(-1) || '?';
}

export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}

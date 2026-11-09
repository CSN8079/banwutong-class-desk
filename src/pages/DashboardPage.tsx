import { useState } from 'react';
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  ClipboardList,
  Clock3,
  Plus,
  Sparkles,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { isoDate } from '../data/seed';
import type { PageKey } from '../types';
import { Avatar, ProgressRing } from '../components/ui';
import { attendanceLabels, formatDateChinese, percent, relativeDue } from '../lib/format';

interface DashboardPageProps {
  onNavigate: (page: PageKey) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const classes = useAppStore((state) => state.classes);
  const selectedClassId = useAppStore((state) => state.selectedClassId);
  const allStudents = useAppStore((state) => state.students);
  const sessions = useAppStore((state) => state.sessions);
  const tasks = useAppStore((state) => state.tasks);
  const classRoom = classes.find((item) => item.id === selectedClassId);
  const students = allStudents.filter((student) => student.classId === selectedClassId && student.active);
  const today = isoDate();
  const todaySession = sessions.find((session) => session.classId === selectedClassId && session.date === today);
  const recordMap = new Map(todaySession?.records.map((record) => [record.studentId, record]) ?? []);
  const marked = students.filter((student) => (recordMap.get(student.id)?.status ?? 'unmarked') !== 'unmarked').length;
  const present = students.filter((student) => ['present', 'late'].includes(recordMap.get(student.id)?.status ?? '')).length;
  const attention = students
    .map((student) => ({ student, record: recordMap.get(student.id) }))
    .filter((item) => item.record && ['late', 'leave', 'absent'].includes(item.record.status))
    .slice(0, 4);
  const activeTasks = tasks.filter((task) => task.classId === selectedClassId && task.status === 'open');
  const totalMissing = activeTasks.reduce((sum, task) => {
    return sum + task.submissions.filter((item) => item.status !== 'completed').length;
  }, 0);
  const recentSessions = sessions
    .filter((session) => session.classId === selectedClassId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  const [greeting] = useState(() => {
    const greetingHour = new Date().getHours();
    return greetingHour < 11 ? '早上好' : greetingHour < 14 ? '中午好' : greetingHour < 18 ? '下午好' : '晚上好';
  });

  return (
    <div className="dashboard-page page-stack">
      <section className="hero-panel">
        <div className="hero-content">
          <span className="hero-kicker"><Sparkles size={15} /> {greeting}，老师</span>
          <h1>把班级事务，<br /><em>理得更清楚。</em></h1>
          <p>点名、备注、任务材料收集和缺交统计，都在这一处完成。</p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => onNavigate('attendance')}>
              <CalendarCheck2 size={18} /> 开始点名
            </button>
            <button className="button button-ghost-light" onClick={() => onNavigate('tasks')}>
              <Plus size={18} /> 发起收集
            </button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit hero-orbit-one" />
          <div className="hero-orbit hero-orbit-two" />
          <div className="hero-card">
            <span>今日出勤</span>
            <strong>{percent(present, students.length)}<small>%</small></strong>
            <div className="hero-avatars">
              {students.slice(0, 4).map((student) => <Avatar key={student.id} name={student.name} size="sm" />)}
              {students.length > 4 && <span className="avatar-more">+{students.length - 4}</span>}
            </div>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <div className="metric-icon metric-icon-green"><UsersRound size={20} /></div>
          <div><span>在册学生</span><strong>{students.length}<small> 人</small></strong></div>
          <span className="metric-note">{classRoom?.grade ?? '当前班级'}</span>
        </article>
        <article className="metric-card">
          <div className="metric-icon metric-icon-blue"><UserCheck size={20} /></div>
          <div><span>今日已点名</span><strong>{marked}<small> / {students.length}</small></strong></div>
          <span className="metric-note">{marked === students.length ? '点名已完成' : `还剩 ${students.length - marked} 人`}</span>
        </article>
        <article className="metric-card">
          <div className="metric-icon metric-icon-amber"><Clock3 size={20} /></div>
          <div><span>需关注</span><strong>{attention.length}<small> 人</small></strong></div>
          <span className="metric-note">迟到 / 请假 / 缺勤</span>
        </article>
        <article className="metric-card">
          <div className="metric-icon metric-icon-rose"><ClipboardList size={20} /></div>
          <div><span>任务待收</span><strong>{totalMissing}<small> 份</small></strong></div>
          <span className="metric-note">{activeTasks.length} 个进行中任务</span>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel today-panel">
          <header className="panel-header">
            <div>
              <span className="eyebrow">ATTENDANCE</span>
              <h2>今日点名</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate('attendance')}>查看完整名单 <ArrowRight size={16} /></button>
          </header>
          <div className="today-attendance">
            <ProgressRing value={percent(marked, students.length)} label="已点名" size={132} stroke={11} />
            <div className="attendance-summary-list">
              {([
                ['present', '#1d7a5f'],
                ['late', '#c88925'],
                ['leave', '#4f7cac'],
                ['absent', '#c34f4f'],
              ] as const).map(([status, color]) => {
                const count = students.filter((student) => recordMap.get(student.id)?.status === status).length;
                return (
                  <div className="attendance-summary-row" key={status}>
                    <span className="legend-dot" style={{ background: color }} />
                    <span>{attendanceLabels[status]}</span>
                    <strong>{count}</strong>
                  </div>
                );
              })}
              <div className="attendance-summary-row muted">
                <span className="legend-dot" />
                <span>未点名</span>
                <strong>{students.length - marked}</strong>
              </div>
            </div>
          </div>
          <div className="attention-block">
            <div className="attention-title">
              <span>需要留意</span>
              <small>{attention.length > 0 ? '已填写备注' : '暂无异常'}</small>
            </div>
            {attention.length > 0 ? (
              <div className="attention-list">
                {attention.map(({ student, record }) => (
                  <div className="attention-item" key={student.id}>
                    <Avatar name={student.name} size="sm" />
                    <div>
                      <strong>{student.name}</strong>
                      <span>{record?.note || attendanceLabels[record?.status ?? 'unmarked']}</span>
                    </div>
                    <span className={`status-dot status-${record?.status}`}>{attendanceLabels[record?.status ?? 'unmarked']}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="all-clear"><Check size={18} /> 当前没有需要额外关注的学生</div>
            )}
          </div>
        </article>

        <article className="panel task-overview-panel">
          <header className="panel-header">
            <div>
              <span className="eyebrow">COLLECTION</span>
              <h2>任务收集</h2>
            </div>
            <button className="round-add" aria-label="新建任务" onClick={() => onNavigate('tasks')}><Plus size={18} /></button>
          </header>
          <div className="task-overview-list">
            {activeTasks.length === 0 && <div className="compact-empty">暂无进行中的收集任务</div>}
            {activeTasks.slice(0, 3).map((task) => {
              const completed = task.submissions.filter((item) => item.status === 'completed').length;
              const missing = task.submissions.filter((item) => item.status === 'missing').length;
              const ratio = percent(completed, students.length);
              const due = relativeDue(task.dueDate);
              return (
                <button className="task-overview-item" key={task.id} onClick={() => onNavigate('tasks')}>
                  <div className="task-overview-top">
                    <strong>{task.title}</strong>
                    <span className={`due-text ${due.tone}`}>{due.text}</span>
                  </div>
                  <div className="task-progress-line"><span style={{ width: `${ratio}%` }} /></div>
                  <div className="task-overview-meta">
                    <span>{completed} / {students.length} 已完成</span>
                    <span className={missing > 0 ? 'danger-text' : ''}>{missing > 0 ? `${missing} 人未完成` : '暂无缺交'}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <button className="side-link-button" onClick={() => onNavigate('tasks')}>
            管理全部收集任务 <ArrowRight size={16} />
          </button>
        </article>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="panel recent-panel">
          <header className="panel-header">
            <div><span className="eyebrow">HISTORY</span><h2>最近点名</h2></div>
            <button className="text-button" onClick={() => onNavigate('records')}>全部记录 <ArrowRight size={15} /></button>
          </header>
          <div className="recent-session-list">
            {recentSessions.map((session) => {
              const absent = session.records.filter((item) => ['leave', 'absent'].includes(item.status)).length;
              const recorded = session.records.filter((item) => item.status !== 'unmarked').length;
              return (
                <button key={session.id} className="recent-session" onClick={() => onNavigate('records')}>
                  <span className="date-tile"><strong>{Number(session.date.slice(8, 10))}</strong><small>{formatDateChinese(session.date)}</small></span>
                  <span className="recent-session-copy">
                    <strong>{session.topic}</strong>
                    <small>{recorded} 人已点名 · {absent} 人请假/缺勤</small>
                  </span>
                  <span className={`session-state ${session.status}`}>{session.status === 'completed' ? '已完成' : '进行中'}</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="panel insight-panel">
          <span className="eyebrow">QUICK NOTE</span>
          <h2>班级小提示</h2>
          <p>点名时点击预设备注，可以快速记录请假、迟到等情况；任务收集页支持直接粘贴或拖入聊天截图。</p>
          <div className="insight-tags">
            <span># 本地存储</span><span># 一键导出</span><span># 多端可用</span>
          </div>
        </article>
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  MessageSquareText,
  Search,
  Shuffle,
  Sparkles,
  UserRoundX,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/toast-context';
import { isoDate } from '../data/seed';
import { Avatar, EmptyState, Modal, PageHeading } from '../components/ui';
import { attendanceLabels } from '../lib/format';
import { buildAttendanceCsv } from '../lib/exports';
import { saveFile } from '../lib/download';
import type { AttendanceStatus, PageKey, Student } from '../types';

const statusConfig: Array<{ key: Exclude<AttendanceStatus, 'unmarked'>; icon: typeof CheckCircle2 }> = [
  { key: 'present', icon: CheckCircle2 },
  { key: 'late', icon: Clock3 },
  { key: 'leave', icon: CalendarDays },
  { key: 'absent', icon: XCircle },
];

interface AttendancePageProps {
  onNavigate: (page: PageKey) => void;
}

export function AttendancePage({ onNavigate }: AttendancePageProps) {
  const classes = useAppStore((state) => state.classes);
  const selectedClassId = useAppStore((state) => state.selectedClassId);
  const allStudents = useAppStore((state) => state.students);
  const sessions = useAppStore((state) => state.sessions);
  const presets = useAppStore((state) => state.presets);
  const ensureSession = useAppStore((state) => state.ensureSession);
  const setAttendance = useAppStore((state) => state.setAttendance);
  const bulkAttendance = useAppStore((state) => state.bulkAttendance);
  const completeSession = useAppStore((state) => state.completeSession);
  const { showToast } = useToast();
  const classRoom = classes.find((item) => item.id === selectedClassId);
  const students = useMemo(
    () => allStudents
      .filter((student) => student.classId === selectedClassId && student.active)
      .sort((a, b) => a.studentNo.localeCompare(b.studentNo, 'zh-CN', { numeric: true })),
    [allStudents, selectedClassId],
  );

  const [date, setDate] = useState(isoDate());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | AttendanceStatus>('all');
  const [noteStudent, setNoteStudent] = useState<Student | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteStatusDraft, setNoteStatusDraft] = useState<AttendanceStatus>('unmarked');
  const [randomOpen, setRandomOpen] = useState(false);
  const [randomStudent, setRandomStudent] = useState<Student | null>(null);

  const session = sessions.find((item) => item.classId === selectedClassId && item.date === date);
  useEffect(() => {
    if (selectedClassId) ensureSession(selectedClassId, date);
  }, [selectedClassId, date, ensureSession]);

  const records = useMemo(
    () => new Map(session?.records.map((record) => [record.studentId, record]) ?? []),
    [session],
  );
  const marked = students.filter((student) => (records.get(student.id)?.status ?? 'unmarked') !== 'unmarked').length;
  const present = students.filter((student) => ['present', 'late'].includes(records.get(student.id)?.status ?? '')).length;

  const visibleStudents = students.filter((student) => {
    const record = records.get(student.id);
    const status = record?.status ?? 'unmarked';
    const keyword = search.trim().toLowerCase();
    const matchesSearch = !keyword || student.name.toLowerCase().includes(keyword) || student.studentNo.includes(keyword);
    return matchesSearch && (filter === 'all' || status === filter);
  });

  const countByStatus = (status: AttendanceStatus) =>
    students.filter((student) => (records.get(student.id)?.status ?? 'unmarked') === status).length;

  const changeDate = (days: number) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + days);
    setDate(isoDate(next));
  };

  const handleStatus = (student: Student, status: AttendanceStatus) => {
    setAttendance(selectedClassId, date, student.id, status);
  };

  const openNote = (student: Student) => {
    setNoteStudent(student);
    setNoteDraft(records.get(student.id)?.note ?? '');
    setNoteStatusDraft(records.get(student.id)?.status ?? 'unmarked');
  };

  const saveNote = () => {
    if (!noteStudent) return;
    setAttendance(selectedClassId, date, noteStudent.id, noteStatusDraft, noteDraft);
    setNoteStudent(null);
    showToast('备注已保存');
  };

  const applyPreset = (text: string, status?: AttendanceStatus) => {
    setNoteDraft(text);
    if (status) setNoteStatusDraft(status);
  };

  const markAllPresent = () => {
    if (students.length === 0) return;
    bulkAttendance(selectedClassId, date, 'present');
    showToast(`已将 ${students.length} 名学生标记为出勤`);
  };

  const finishAttendance = () => {
    if (session) {
      completeSession(session.id);
      showToast('本次点名已完成，记录已归档');
    }
  };

  const exportAttendance = async () => {
    if (!session) return;
    await saveFile(
      `${classRoom?.name ?? '班级'}-点名-${date}.csv`,
      buildAttendanceCsv(session, students, classRoom),
      'text/csv;charset=utf-8',
    );
    showToast('点名记录 CSV 已生成');
  };

  const drawRandom = () => {
    if (students.length === 0) return;
    const pool = students.filter((student) => (records.get(student.id)?.status ?? 'unmarked') === 'unmarked');
    const candidates = pool.length > 0 ? pool : students;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    setRandomStudent(picked);
  };

  if (students.length === 0) {
    return (
      <div className="page-stack">
        <PageHeading eyebrow="ATTENDANCE" title="课堂点名" description="快速记录出勤、请假、迟到和缺勤，并添加备注。" />
        <section className="panel">
          <EmptyState
            icon={<UsersRound size={29} />}
            title="名单里还没有学生"
            description="先添加班级学生，之后就可以开始点名。"
            action={<button className="button button-primary" onClick={() => onNavigate('students')}>去添加学生</button>}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="ATTENDANCE"
        title="课堂点名"
        description={`${classRoom?.name ?? ''} · 点击状态即可记录，所有修改自动保存`}
        actions={(
          <>
            <button className="button button-secondary" onClick={() => setRandomOpen(true)}><Shuffle size={17} /> 随机点名</button>
            <button className="button button-secondary" onClick={exportAttendance}><Download size={17} /> 导出记录</button>
            <button className="button button-primary" onClick={finishAttendance}><Check size={18} /> 完成点名</button>
          </>
        )}
      />

      <section className="attendance-control panel">
        <div className="date-control">
          <button className="icon-button" onClick={() => changeDate(-1)} aria-label="前一天"><ChevronLeft size={18} /></button>
          <label>
            <CalendarDays size={17} />
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <button className="icon-button" onClick={() => changeDate(1)} aria-label="后一天"><ChevronRight size={18} /></button>
          {date !== isoDate() && <button className="text-button" onClick={() => setDate(isoDate())}>回到今天</button>}
        </div>
        <div className="attendance-quick-actions">
          <button className="button button-soft" onClick={markAllPresent}><Sparkles size={17} /> 全部出勤</button>
          <button className="button button-soft" onClick={() => bulkAttendance(selectedClassId, date, 'unmarked')}>重置点名</button>
        </div>
      </section>

      <section className="attendance-stats">
        <div className="attendance-stat primary">
          <span>已点名</span><strong>{marked}<small> / {students.length}</small></strong>
          <div className="mini-progress"><i style={{ width: `${students.length ? (marked / students.length) * 100 : 0}%` }} /></div>
        </div>
        <button className={`attendance-stat stat-present ${filter === 'present' ? 'active' : ''}`} onClick={() => setFilter(filter === 'present' ? 'all' : 'present')}>
          <span><CheckCircle2 size={16} /> 出勤</span><strong>{countByStatus('present')}</strong>
        </button>
        <button className={`attendance-stat stat-late ${filter === 'late' ? 'active' : ''}`} onClick={() => setFilter(filter === 'late' ? 'all' : 'late')}>
          <span><Clock3 size={16} /> 迟到</span><strong>{countByStatus('late')}</strong>
        </button>
        <button className={`attendance-stat stat-leave ${filter === 'leave' ? 'active' : ''}`} onClick={() => setFilter(filter === 'leave' ? 'all' : 'leave')}>
          <span><CalendarDays size={16} /> 请假</span><strong>{countByStatus('leave')}</strong>
        </button>
        <button className={`attendance-stat stat-absent ${filter === 'absent' ? 'active' : ''}`} onClick={() => setFilter(filter === 'absent' ? 'all' : 'absent')}>
          <span><XCircle size={16} /> 缺勤</span><strong>{countByStatus('absent')}</strong>
        </button>
        <button className={`attendance-stat stat-unmarked ${filter === 'unmarked' ? 'active' : ''}`} onClick={() => setFilter(filter === 'unmarked' ? 'all' : 'unmarked')}>
          <span><UserRoundX size={16} /> 未点名</span><strong>{countByStatus('unmarked')}</strong>
        </button>
      </section>

      <section className="attendance-toolbar panel">
        <div className="search-box">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索姓名或学号" />
          {search && <button onClick={() => setSearch('')}>清除</button>}
        </div>
        <div className="attendance-summary-inline">
          <span><i className="legend-dot" style={{ background: '#1d7a5f' }} /> 实到 {present} 人</span>
          <span><i className="legend-dot" style={{ background: '#c88925' }} /> 未到 {students.length - present} 人</span>
          <span className={session?.status === 'completed' ? 'completed-label' : 'draft-label'}>
            {session?.status === 'completed' ? '已完成归档' : '自动保存中'}
          </span>
        </div>
      </section>

      {visibleStudents.length === 0 ? (
        <section className="panel">
          <EmptyState icon={<Search size={27} />} title="没有符合筛选的学生" description="调整筛选条件或清除搜索关键词。" action={<button className="button button-secondary" onClick={() => { setSearch(''); setFilter('all'); }}>查看全部</button>} />
        </section>
      ) : (
        <section className="attendance-grid">
          {visibleStudents.map((student) => {
            const record = records.get(student.id);
            const status = record?.status ?? 'unmarked';
            return (
              <article className={`attendance-card status-border-${status}`} key={student.id}>
                <div className="attendance-card-head">
                  <div className="student-identity">
                    <Avatar name={student.name} />
                    <span><strong>{student.name}</strong><small>{student.studentNo || '未填写学号'}</small></span>
                  </div>
                  <button className={`note-button ${record?.note ? 'has-note' : ''}`} onClick={() => openNote(student)}>
                    <MessageSquareText size={15} /> {record?.note ? '查看备注' : '添加备注'}
                  </button>
                </div>
                <div className="status-button-row">
                  {statusConfig.map(({ key, icon: Icon }) => (
                    <button
                      key={key}
                      className={`status-choice choice-${key} ${status === key ? 'selected' : ''}`}
                      onClick={() => handleStatus(student, key)}
                      aria-pressed={status === key}
                    >
                      <Icon size={16} />
                      <span>{attendanceLabels[key]}</span>
                    </button>
                  ))}
                </div>
                {record?.note && <p className="attendance-note-preview">{record.note}</p>}
              </article>
            );
          })}
        </section>
      )}

      <Modal
        open={Boolean(noteStudent)}
        title={`${noteStudent?.name ?? ''} · 点名备注`}
        description="可手动输入，也可选择常用预设备注。"
        onClose={() => setNoteStudent(null)}
        footer={(
          <>
            <button className="button button-secondary" onClick={() => setNoteStudent(null)}>取消</button>
            <button className="button button-primary" onClick={saveNote}>保存备注</button>
          </>
        )}
      >
        <div className="preset-list">
          {presets.map((preset) => (
            <button
              key={preset.id}
              className="preset-chip"
              style={{ borderColor: `${preset.color}44`, color: preset.color }}
              onClick={() => applyPreset(preset.text, preset.status)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <label className="field">
          <span>备注内容</span>
          <textarea autoFocus rows={5} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="例如：已联系本人，确认病假并提供请假单…" />
        </label>
        <div className="status-hint-mini">保存后状态：{attendanceLabels[noteStatusDraft]}</div>
      </Modal>

      <Modal
        open={randomOpen}
        title="随机点名"
        description="优先从未点名的学生中抽取。"
        onClose={() => { setRandomOpen(false); setRandomStudent(null); }}
        width="sm"
        footer={(
          <>
            <button className="button button-secondary" onClick={() => { setRandomOpen(false); setRandomStudent(null); }}>关闭</button>
            <button className="button button-primary" onClick={() => randomStudent && setAttendance(selectedClassId, date, randomStudent.id, 'present')} disabled={!randomStudent}>
              <Check size={17} /> 标记出勤
            </button>
          </>
        )}
      >
        <div className="random-picker">
          {randomStudent ? (
            <>
              <Avatar name={randomStudent.name} size="lg" />
              <h3>{randomStudent.name}</h3>
              <p>{randomStudent.studentNo || '未填写学号'}</p>
            </>
          ) : (
            <>
              <span className="random-placeholder"><Shuffle size={38} /></span>
              <p>点击下方按钮抽取一名学生</p>
            </>
          )}
          <button className="button button-soft" onClick={drawRandom}><Shuffle size={17} /> {randomStudent ? '再抽一次' : '开始抽取'}</button>
        </div>
      </Modal>
    </div>
  );
}

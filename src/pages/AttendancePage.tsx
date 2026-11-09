import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  ImagePlus,
  Images,
  MessageSquareText,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  Undo2,
  UserRoundX,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { isoDate } from '../data/seed';
import { Avatar, EmptyState, LoadingButton, Modal, PageHeading } from '../components/ui';
import { useToast } from '../components/toast-context';
import { LongPressButton } from '../components/LongPressButton';
import { attendanceLabels, formatDateChinese, formatDateTime } from '../lib/format';
import { buildAttendanceCsv, buildAttendanceHtmlReport } from '../lib/exports';
import { saveFile } from '../lib/download';
import { blobToDataUrl, compressImage, deleteImage, getImage, putImage } from '../lib/imageStore';
import { createId } from '../lib/id';
import { callPhoneNumber } from '../lib/call';
import type { AttendanceStatus, PageKey, Student, TaskAttachment } from '../types';

const statusConfig: Array<{ key: Exclude<AttendanceStatus, 'unmarked'>; icon: typeof CheckCircle2 }> = [
  { key: 'present', icon: CheckCircle2 },
  { key: 'late', icon: Clock3 },
  { key: 'leave', icon: CalendarDays },
  { key: 'absent', icon: XCircle },
];

interface AttendancePageProps {
  onNavigate: (page: PageKey) => void;
}

interface PreviewState {
  attachment: TaskAttachment;
  studentId: string;
  studentName: string;
}

interface UndoEntry {
  studentId: string;
  status: AttendanceStatus;
  note: string;
}

function getCalendarCells(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const firstWeekday = new Date(year, monthIndex - 1, 1).getDay();
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
}

function shiftCalendarMonth(month: string, delta: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  const next = new Date(year, monthIndex - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function makeAttendanceAttachment(file: File, blob: Blob): TaskAttachment {
  const now = new Date();
  return {
    id: createId('attendance-image'),
    name: file.name || `点名备注-${now.toISOString().slice(11, 19)}.jpg`,
    mimeType: blob.type || file.type,
    size: blob.size,
    createdAt: now.toISOString(),
  };
}

function StoredImageThumb({ attachment, onOpen }: { attachment: TaskAttachment; onOpen: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    getImage(attachment.id).then(async (blob) => {
      if (!active || !blob) return;
      setUrl(await blobToDataUrl(blob));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [attachment.id]);

  return (
    <button className="attendance-image-thumb" onClick={onOpen} title={attachment.name}>
      {url ? <img src={url} alt={attachment.name} /> : <span className="thumb-loading" />}
    </button>
  );
}

function StoredImagePreview({ attachment }: { attachment: TaskAttachment }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    getImage(attachment.id).then(async (blob) => {
      if (!active || !blob) return;
      setUrl(await blobToDataUrl(blob));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [attachment.id]);
  return (
    <div className="image-preview image-preview-clear">
      {url ? <img src={url} alt={attachment.name} /> : <div className="preview-loading"><span className="thumb-loading" /> 正在读取图片…</div>}
    </div>
  );
}

export function AttendancePage({ onNavigate }: AttendancePageProps) {
  const classes = useAppStore((state) => state.classes);
  const selectedClassId = useAppStore((state) => state.selectedClassId);
  const allStudents = useAppStore((state) => state.students);
  const sessions = useAppStore((state) => state.sessions);
  const presets = useAppStore((state) => state.presets);
  const createSession = useAppStore((state) => state.createSession);
  const setAttendance = useAppStore((state) => state.setAttendance);
  const bulkAttendance = useAppStore((state) => state.bulkAttendance);
  const addAttendanceAttachment = useAppStore((state) => state.addAttendanceAttachment);
  const removeAttendanceAttachment = useAppStore((state) => state.removeAttendanceAttachment);
  const completeSession = useAppStore((state) => state.completeSession);
  const reopenSession = useAppStore((state) => state.reopenSession);
  const { showToast } = useToast();
  const classRoom = classes.find((item) => item.id === selectedClassId);
  const students = useMemo(
    () => allStudents
      .filter((student) => student.classId === selectedClassId && student.active)
      .sort((a, b) => a.shortNo.localeCompare(b.shortNo, 'zh-CN', { numeric: true })),
    [allStudents, selectedClassId],
  );

  const [date, setDate] = useState(isoDate());
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | AttendanceStatus>('all');
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [noteStudentId, setNoteStudentId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteStatusDraft, setNoteStatusDraft] = useState<AttendanceStatus>('unmarked');
  const [noteUploading, setNoteUploading] = useState(false);
  const [cardUploading, setCardUploading] = useState(false);
  const [randomOpen, setRandomOpen] = useState(false);
  const [randomStudent, setRandomStudent] = useState<Student | null>(null);
  const [randomScope, setRandomScope] = useState<'unmarked' | 'all' | 'marked'>('unmarked');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(date.slice(0, 7));
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [cardIndex, setCardIndex] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [exporting, setExporting] = useState('');
  const noteUploadRef = useRef<HTMLInputElement>(null);
  const cardUploadRef = useRef<HTMLInputElement>(null);
  const pageScrollRef = useRef(0);
  const touchStartX = useRef<number | null>(null);

  const daySessions = useMemo(
    () => sessions
      .filter((item) => item.classId === selectedClassId && item.date === date)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sessions, selectedClassId, date],
  );
  const activeSessions = daySessions.filter((item) => item.status === 'active');
  const completedSessions = daySessions.filter((item) => item.status === 'completed');
  const effectiveSessionId = activeSessions.some((item) => item.id === selectedSessionId)
    ? selectedSessionId
    : (activeSessions[0]?.id ?? '');
  const session = activeSessions.find((item) => item.id === effectiveSessionId) ?? null;

  const records = new Map(session?.records.map((record) => [record.studentId, record]) ?? []);
  const marked = students.filter((student) => (records.get(student.id)?.status ?? 'unmarked') !== 'unmarked').length;
  const present = students.filter((student) => ['present', 'late'].includes(records.get(student.id)?.status ?? '')).length;

  const visibleStudents = students.filter((student) => {
    const status = records.get(student.id)?.status ?? 'unmarked';
    const keyword = search.trim().toLowerCase();
    const matchesSearch = !keyword
      || student.name.toLowerCase().includes(keyword)
      || student.shortNo.toLowerCase().includes(keyword)
      || student.studentNo.includes(keyword);
    return matchesSearch && (filter === 'all' || status === filter);
  });

  const noteStudent = students.find((student) => student.id === noteStudentId) ?? null;
  const noteRecord = noteStudentId ? records.get(noteStudentId) : undefined;
  const cardStudent = students[Math.min(cardIndex, Math.max(0, students.length - 1))];
  const cardRecord = cardStudent ? records.get(cardStudent.id) : undefined;
  const cardStatus = cardRecord?.status ?? 'unmarked';

  const countByStatus = (status: AttendanceStatus) =>
    students.filter((student) => (records.get(student.id)?.status ?? 'unmarked') === status).length;

  const openNewSession = () => {
    setNewSessionTitle(`第 ${daySessions.length + 1} 次点名`);
    setNewSessionOpen(true);
  };

  const submitNewSession = () => {
    if (!selectedClassId) return;
    const created = createSession(selectedClassId, date, newSessionTitle);
    setSelectedSessionId(created.id);
    setNewSessionOpen(false);
    setViewMode('list');
    showToast('已创建新的点名场次');
  };

  const handleStatus = (student: Student, status: Exclude<AttendanceStatus, 'unmarked'>) => {
    if (!session) return;
    const current = records.get(student.id)?.status ?? 'unmarked';
    setAttendance(session.id, student.id, current === status ? 'unmarked' : status);
  };

  const saveCardUndo = (studentId: string) => {
    const record = records.get(studentId);
    setUndoStack((stack) => [
      ...stack.slice(-29),
      { studentId, status: record?.status ?? 'unmarked', note: record?.note ?? '' },
    ]);
  };

  const handleCardStatus = (student: Student, status: Exclude<AttendanceStatus, 'unmarked'>) => {
    if (!session) return;
    saveCardUndo(student.id);
    const current = records.get(student.id)?.status ?? 'unmarked';
    const togglingOff = current === status;
    setAttendance(session.id, student.id, togglingOff ? 'unmarked' : status);
    if (!togglingOff && cardIndex < students.length - 1) {
      window.setTimeout(() => setCardIndex((index) => Math.min(students.length - 1, index + 1)), 260);
    }
  };

  const undoLast = () => {
    if (!session || undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setAttendance(session.id, last.studentId, last.status, last.note);
    setUndoStack((stack) => stack.slice(0, -1));
    const index = students.findIndex((student) => student.id === last.studentId);
    if (index >= 0) setCardIndex(index);
    showToast('已撤回上一次修改', 'info');
  };

  const goToCard = (index: number) => {
    setCardIndex(Math.max(0, Math.min(students.length - 1, index)));
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (delta > 55) goToCard(cardIndex - 1);
    if (delta < -55) goToCard(cardIndex + 1);
  };

  const openNote = (student: Student) => {
    pageScrollRef.current = window.scrollY;
    setNoteStudentId(student.id);
    setNoteDraft(records.get(student.id)?.note ?? '');
    setNoteStatusDraft(records.get(student.id)?.status ?? 'unmarked');
  };

  const callStudent = async (student: Student) => {
    try {
      await callPhoneNumber(student.phone);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '无法打开系统拨号应用', 'error');
    }
  };

  const clearStudentNote = (student: Student) => {
    if (!session) return;
    setAttendance(session.id, student.id, records.get(student.id)?.status ?? 'unmarked', '');
    if (noteStudentId === student.id) setNoteDraft('');
    showToast(`${student.name} 的备注已清除`, 'info');
  };

  const restorePagePosition = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.scrollTo(0, pageScrollRef.current));
    });
  };

  const closeNote = () => {
    setNoteStudentId(null);
    restorePagePosition();
  };

  const saveNote = () => {
    if (!session || !noteStudentId) return;
    setAttendance(session.id, noteStudentId, noteStatusDraft, noteDraft);
    closeNote();
    showToast('备注已保存');
  };

  const applyNotePreset = (text: string, status?: AttendanceStatus) => {
    setNoteDraft(text);
    if (status) setNoteStatusDraft(status);
  };

  const attachNoteImage = async (file: File | undefined) => {
    if (!file || !session || !noteStudentId) return;
    setNoteUploading(true);
    try {
      const compressed = await compressImage(file);
      const attachment = makeAttendanceAttachment(file, compressed);
      await putImage(attachment.id, compressed);
      addAttendanceAttachment(session.id, noteStudentId, attachment);
      showToast('备注图片已添加');
    } catch {
      showToast('图片处理失败，请重试', 'error');
    } finally {
      setNoteUploading(false);
    }
  };

  const attachCardImage = async (file: File | undefined) => {
    if (!file || !session || !cardStudent) return;
    setCardUploading(true);
    try {
      const compressed = await compressImage(file);
      const attachment = makeAttendanceAttachment(file, compressed);
      await putImage(attachment.id, compressed);
      addAttendanceAttachment(session.id, cardStudent.id, attachment);
      showToast('备注图片已添加');
    } catch {
      showToast('图片处理失败，请重试', 'error');
    } finally {
      setCardUploading(false);
    }
  };

  const removeNoteImage = async (attachment: TaskAttachment) => {
    if (!session || !noteStudentId) return;
    if (!window.confirm(`删除图片「${attachment.name}」吗？`)) return;
    await deleteImage(attachment.id);
    removeAttendanceAttachment(session.id, noteStudentId, attachment.id);
    showToast('图片已删除', 'info');
  };

  const clearNote = async () => {
    if (!session || !noteStudentId) return;
    const images = records.get(noteStudentId)?.images ?? [];
    if (!window.confirm('清空该学生的备注文字和全部备注图片吗？')) return;
    for (const image of images) await deleteImage(image.id);
    for (const image of images) removeAttendanceAttachment(session.id, noteStudentId, image.id);
    setNoteDraft('');
    setAttendance(session.id, noteStudentId, noteStatusDraft, '');
    showToast('备注已清空', 'info');
  };

  const clearCardNote = async () => {
    if (!session || !cardStudent) return;
    const images = cardRecord?.images ?? [];
    if (!window.confirm('清空当前学生的备注文字和图片吗？')) return;
    saveCardUndo(cardStudent.id);
    for (const image of images) await deleteImage(image.id);
    for (const image of images) removeAttendanceAttachment(session.id, cardStudent.id, image.id);
    setAttendance(session.id, cardStudent.id, cardStatus, '');
    showToast('备注已清空', 'info');
  };

  const markAllPresent = () => {
    if (!session || students.length === 0) return;
    bulkAttendance(session.id, 'present');
    showToast(`已将 ${students.length} 名学生标记为出勤`);
  };

  const resetAttendance = () => {
    if (!session) return;
    bulkAttendance(session.id, 'unmarked');
    showToast('已重置为未点名', 'info');
  };

  const finishAttendance = () => {
    if (!session) return;
    const unmarkedCount = countByStatus('unmarked');
    if (unmarkedCount > 0 && !window.confirm(`还有 ${unmarkedCount} 人未点名，确定完成并折叠本次点名吗？`)) return;
    completeSession(session.id);
    setSelectedSessionId('');
    setViewMode('list');
    showToast('本次点名已完成并折叠');
  };

  const exportAttendance = async (format: 'csv' | 'html', targetSession = session) => {
    if (!targetSession) return;
    setExporting(format);
    try {
      if (format === 'csv') {
        await saveFile(
          `${classRoom?.name ?? '班级'}-${targetSession.title}-${targetSession.date}.csv`,
          buildAttendanceCsv(targetSession, students, classRoom),
          'text/csv;charset=utf-8',
        );
      } else {
        const html = await buildAttendanceHtmlReport(targetSession, students, classRoom);
        await saveFile(`${classRoom?.name ?? '班级'}-${targetSession.title}-${targetSession.date}.html`, html, 'text/html;charset=utf-8');
      }
      showToast(format === 'csv' ? '点名 CSV 已生成' : '点名 HTML 已生成');
    } catch {
      showToast('导出失败，请重试', 'error');
    } finally {
      setExporting('');
    }
  };

  const openCalendar = () => {
    setCalendarMonth(date.slice(0, 7));
    setCalendarOpen(true);
  };

  const reopenCompletedSession = (sessionId: string) => {
    reopenSession(sessionId);
    setSelectedSessionId(sessionId);
    setHistoryOpen(false);
    showToast('已重新启动该点名场次，可继续修改');
  };

  const openRandom = () => {
    setRandomStudent(null);
    setRandomOpen(true);
  };

  const randomPool = students.filter((student) => {
    const status = records.get(student.id)?.status ?? 'unmarked';
    if (randomScope === 'unmarked') return status === 'unmarked';
    if (randomScope === 'marked') return status !== 'unmarked';
    return true;
  });

  const drawRandom = () => {
    if (randomPool.length === 0) {
      showToast(randomScope === 'unmarked' ? '当前没有未点名学生' : randomScope === 'marked' ? '当前没有已点名学生' : '班级中没有学生', 'error');
      return;
    }
    setRandomStudent(randomPool[Math.floor(Math.random() * randomPool.length)]);
  };

  const markRandomStatus = (status: Exclude<AttendanceStatus, 'unmarked'>) => {
    if (!session || !randomStudent) return;
    setAttendance(session.id, randomStudent.id, status);
    showToast(`${randomStudent.name} 已标记为${attendanceLabels[status]}`);
    setRandomOpen(false);
    setRandomStudent(null);
  };

  if (students.length === 0) {
    return (
      <div className="page-stack">
        <PageHeading eyebrow="ATTENDANCE" title="课堂点名" description="快速记录出勤、请假、迟到和缺勤，并添加备注。" />
        <section className="panel">
          <EmptyState icon={<UsersRound size={29} />} title="名单里还没有学生" description="先添加班级学生，之后就可以开始点名。" action={<button className="button button-primary" onClick={() => onNavigate('students')}>去添加学生</button>} />
        </section>
      </div>
    );
  }

  return (
    <div className={`page-stack attendance-page ${viewMode === 'card' ? 'card-mode-active' : ''}`}>
      {viewMode !== 'card' && (
        <PageHeading
          eyebrow="ATTENDANCE"
          title="课堂点名"
          description={`${classRoom?.name ?? ''} · 一天可创建多个点名场次，所有修改自动保存`}
          actions={(
            <>
              <button className="button button-secondary" onClick={openNewSession}><Plus size={17} /> 新建点名</button>
              <button className="button button-secondary" disabled={!session} onClick={openRandom}><Shuffle size={17} /> 随机点名</button>
              {session && <button className="button button-secondary" onClick={() => setViewMode('card')}><Images size={17} /> 逐个点名</button>}
              {session && <button className="button button-primary" onClick={finishAttendance}><Check size={18} /> 完成点名</button>}
            </>
          )}
        />
      )}

      {viewMode === 'card' && session ? (
        <section className="attendance-card-mode">
          <div className="card-mode-topline">
            <button className="text-button" onClick={() => setViewMode('list')}><ArrowLeft size={16} /> 返回名单</button>
            <div className="card-mode-session"><strong>{session.title}</strong><span>{date} · {marked}/{students.length} 已点名</span></div>
            <button className="button button-soft" onClick={undoLast} disabled={undoStack.length === 0}><Undo2 size={16} /> 撤回</button>
          </div>
          <div className="card-stack" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <button className="card-peek card-peek-prev" onClick={() => goToCard(cardIndex - 1)} disabled={cardIndex === 0}>
              <span>上一位</span><strong>{students[cardIndex - 1]?.name ?? '已是第一位'}</strong>
            </button>
            {cardStudent && (
              <article className={`flash-card flash-card-${cardStatus} flash-card-gender-${cardStudent.gender}`}>
                <div className="flash-card-index">{cardIndex + 1} / {students.length}</div>
                <Avatar name={cardStudent.name} gender={cardStudent.gender} size="lg" />
                <span className="flash-short-no">短学号 {cardStudent.shortNo}</span>
                <div className="flash-name-row">
                  <h2>{cardStudent.name}</h2>
                  <button className="inline-call-button" onClick={() => void callStudent(cardStudent)} aria-label={`拨打 ${cardStudent.name} 的电话`}><Phone size={17} /></button>
                </div>
                <p>{cardStudent.studentNo || '未填写长学号'} · {cardStudent.dorm || '未填写宿舍'}{cardStudent.bed ? ` · ${cardStudent.bed}` : ''}</p>
                <div className="flash-status-buttons">
                  {statusConfig.map(({ key, icon: Icon }) => (
                    <button key={key} className={`flash-status choice-${key} ${cardStatus === key ? 'selected' : ''}`} onClick={() => handleCardStatus(cardStudent, key)}>
                      <Icon size={19} /><span>{attendanceLabels[key]}</span>
                    </button>
                  ))}
                </div>
                {cardStatus !== 'unmarked' && <span className="tap-cancel-hint">再次点击已选状态可恢复为未点名</span>}
                <div className="flash-note-area">
                  <label className="field">
                    <span>点名备注</span>
                    <textarea
                      rows={3}
                      value={cardRecord?.note ?? ''}
                      onChange={(event) => session && setAttendance(session.id, cardStudent.id, cardStatus, event.target.value)}
                      placeholder="输入备注，或使用下方快捷备注"
                    />
                  </label>
                  <div className="flash-presets">
                    {presets.map((preset) => (
                      <button key={preset.id} className="preset-chip" style={{ borderColor: `${preset.color}44`, color: preset.color }} onClick={() => {
                        saveCardUndo(cardStudent.id);
                        setAttendance(session.id, cardStudent.id, preset.status ?? cardStatus, preset.text);
                      }}>{preset.label}</button>
                    ))}
                  </div>
                  <div className="flash-note-actions">
                    <input ref={cardUploadRef} type="file" accept="image/*" hidden onChange={(event) => { void attachCardImage(event.target.files?.[0]); event.target.value = ''; }} />
                    <button className="button button-secondary" onClick={() => cardUploadRef.current?.click()} disabled={cardUploading}>
                      <Camera size={16} /> {cardUploading ? '处理中…' : '添加备注图片'}
                    </button>
                    <button className="button button-secondary" onClick={() => void clearCardNote()}><Trash2 size={16} /> 清空备注</button>
                  </div>
                  {cardRecord?.images && cardRecord.images.length > 0 && (
                    <div className="attendance-image-row">
                      {cardRecord.images.map((image) => <StoredImageThumb key={image.id} attachment={image} onOpen={() => setPreview({ attachment: image, studentId: cardStudent.id, studentName: cardStudent.name })} />)}
                    </div>
                  )}
                </div>
              </article>
            )}
            <button className="card-peek card-peek-next" onClick={() => goToCard(cardIndex + 1)} disabled={cardIndex >= students.length - 1}>
              <span>下一位</span><strong>{students[cardIndex + 1]?.name ?? '已是最后一位'}</strong>
            </button>
          </div>
          <div className="card-mode-footer">
            <button className="button button-secondary" onClick={() => goToCard(cardIndex - 1)} disabled={cardIndex === 0}><ChevronLeft size={17} /> 上一位</button>
            <span>左右滑动或点击切换学生</span>
            <button className="button button-primary" onClick={() => goToCard(cardIndex + 1)} disabled={cardIndex >= students.length - 1}>下一位 <ChevronRight size={17} /></button>
          </div>
        </section>
      ) : (
        <>
          <section className="attendance-control panel">
            <div className="date-control">
              <button className="date-picker-trigger" onClick={openCalendar}>
                <CalendarDays size={18} />
                <span>{formatDateChinese(date)}</span>
                <ChevronRight size={16} />
              </button>
              {date !== isoDate() && <button className="text-button" onClick={() => { setDate(isoDate()); setSelectedSessionId(''); }}>回到今天</button>}
            </div>
            <div className="active-session-tabs">
              {activeSessions.length === 0 && <span className="no-session-label">当天暂无进行中的点名</span>}
              {activeSessions.map((item) => (
                <button key={item.id} className={item.id === effectiveSessionId ? 'active' : ''} onClick={() => setSelectedSessionId(item.id)}>
                  {item.title}
                </button>
              ))}
            </div>
          </section>

          <button className="completed-entry panel" onClick={() => setHistoryOpen(true)}>
            <span className="completed-entry-icon"><CheckCircle2 size={20} /></span>
            <span className="completed-entry-copy">
              <strong>已完成点名</strong>
              <small>{completedSessions.length > 0 ? `查看当天 ${completedSessions.length} 个已完成场次，可重新启动修改` : '当天暂无已完成场次'}</small>
            </span>
            <ChevronRight size={19} />
          </button>

          {!session ? (
            <section className="panel">
              <EmptyState
                icon={<CalendarDays size={29} />}
                title={`${date} 还没有进行中的点名`}
                description="一天可以创建多次点名，并为每次点名设置标题。已完成场次会折叠显示在下方。"
                action={<button className="button button-primary" onClick={openNewSession}><Plus size={17} /> 新建点名</button>}
              />
            </section>
          ) : (
            <>
              <section className="session-hero panel">
                <div>
                  <span className="eyebrow">CURRENT SESSION</span>
                  <h2>{session.title}</h2>
                  <p>{date} · 创建于 {formatDateTime(session.createdAt)}</p>
                </div>
                <div className="session-export-block">
                  <span className="export-caption">导出本次点名记录</span>
                  <div className="session-export-actions">
                    <button className="button button-secondary" disabled={exporting === 'csv'} onClick={() => void exportAttendance('csv')}>
                      <LoadingButton loading={exporting === 'csv'}><Download size={16} /> CSV</LoadingButton>
                    </button>
                    <button className="button button-secondary" disabled={exporting === 'html'} onClick={() => void exportAttendance('html')}>
                      <LoadingButton loading={exporting === 'html'}><FileText size={16} /> HTML</LoadingButton>
                    </button>
                  </div>
                </div>
              </section>

              <section className="attendance-stats">
                <div className="attendance-stat primary"><span>已点名</span><strong>{marked}<small> / {students.length}</small></strong><div className="mini-progress"><i style={{ width: `${students.length ? (marked / students.length) * 100 : 0}%` }} /></div></div>
                <button className={`attendance-stat stat-present ${filter === 'present' ? 'active' : ''}`} onClick={() => setFilter(filter === 'present' ? 'all' : 'present')}><span><CheckCircle2 size={16} /> 出勤</span><strong>{countByStatus('present')}</strong></button>
                <button className={`attendance-stat stat-late ${filter === 'late' ? 'active' : ''}`} onClick={() => setFilter(filter === 'late' ? 'all' : 'late')}><span><Clock3 size={16} /> 迟到</span><strong>{countByStatus('late')}</strong></button>
                <button className={`attendance-stat stat-leave ${filter === 'leave' ? 'active' : ''}`} onClick={() => setFilter(filter === 'leave' ? 'all' : 'leave')}><span><CalendarDays size={16} /> 请假</span><strong>{countByStatus('leave')}</strong></button>
                <button className={`attendance-stat stat-absent ${filter === 'absent' ? 'active' : ''}`} onClick={() => setFilter(filter === 'absent' ? 'all' : 'absent')}><span><XCircle size={16} /> 缺勤</span><strong>{countByStatus('absent')}</strong></button>
                <button className={`attendance-stat stat-unmarked ${filter === 'unmarked' ? 'active' : ''}`} onClick={() => setFilter(filter === 'unmarked' ? 'all' : 'unmarked')}><span><UserRoundX size={16} /> 未点名</span><strong>{countByStatus('unmarked')}</strong></button>
              </section>

              <section className="attendance-toolbar panel">
                <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索姓名、短学号或学号" />{search && <button onClick={() => setSearch('')}>清除</button>}</div>
                <div className="attendance-summary-inline">
                  <span><i className="legend-dot" style={{ background: '#1d7a5f' }} /> 实到 {present} 人</span>
                  <span><i className="legend-dot" style={{ background: '#c88925' }} /> 未到 {students.length - present} 人</span>
                  <button className="button button-soft" onClick={markAllPresent}><Sparkles size={16} /> 全部出勤</button>
                  <button className="button button-soft" onClick={resetAttendance}><RotateCcw size={16} /> 重置</button>
                </div>
              </section>

              {visibleStudents.length === 0 ? (
                <section className="panel"><EmptyState icon={<Search size={27} />} title="没有符合筛选的学生" description="调整筛选条件或清除搜索关键词。" action={<button className="button button-secondary" onClick={() => { setSearch(''); setFilter('all'); }}>查看全部</button>} /></section>
              ) : (
                <section className="attendance-grid">
                  {visibleStudents.map((student) => {
                    const record = records.get(student.id);
                    const status = record?.status ?? 'unmarked';
                    return (
                      <article className={`attendance-card status-border-${status}`} key={student.id}>
                        <div className="attendance-card-head">
                          <div className="student-identity">
                            <Avatar name={student.name} gender={student.gender} />
                            <span>
                              <div className="student-name-line">
                                <strong>{student.name}</strong>
                                <button className="inline-call-button compact" onClick={() => void callStudent(student)} aria-label={`拨打 ${student.name} 的电话`}><Phone size={14} /></button>
                              </div>
                              <small>短学号 {student.shortNo} · 学号 {student.studentNo || '未填写'}</small>
                            </span>
                          </div>
                          <LongPressButton
                            className={`note-button ${record?.note || record?.images.length ? 'has-note' : ''}`}
                            onClick={() => openNote(student)}
                            onLongPress={() => clearStudentNote(student)}
                            title="长按可清空备注"
                          >
                            <MessageSquareText size={15} /> {record?.note || record?.images.length ? '查看备注' : '添加备注'}
                          </LongPressButton>
                        </div>
                        <div className="status-button-row">
                          {statusConfig.map(({ key, icon: Icon }) => (
                            <button key={key} className={`status-choice choice-${key} ${status === key ? 'selected' : ''}`} onClick={() => handleStatus(student, key)} aria-pressed={status === key}>
                              <Icon size={16} /><span>{attendanceLabels[key]}</span>
                            </button>
                          ))}
                        </div>
                        {record?.note && <p className="attendance-note-preview">{record.note}</p>}
                        {record?.images && record.images.length > 0 && (
                          <div className="attendance-image-row compact">
                            {record.images.map((image) => <StoredImageThumb key={image.id} attachment={image} onOpen={() => setPreview({ attachment: image, studentId: student.id, studentName: student.name })} />)}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </section>
              )}
            </>
          )}

        </>
      )}

      <Modal
        open={newSessionOpen}
        title="新建点名场次"
        description={`${date} 可创建多个点名场次，并为每个场次设置标题。`}
        onClose={() => setNewSessionOpen(false)}
        footer={<><button className="button button-secondary" onClick={() => setNewSessionOpen(false)}>取消</button><button className="button button-primary" onClick={submitNewSession}>创建并开始点名</button></>}
      >
        <label className="field"><span>点名标题</span><input autoFocus value={newSessionTitle} onChange={(event) => setNewSessionTitle(event.target.value)} placeholder="例如：第一节课点名、晚点名、查寝" /></label>
        <div className="preset-list session-title-presets">
          {['第一节课点名', '第二节课点名', '晚点名', '查寝点名'].map((title) => <button key={title} className="preset-chip" onClick={() => setNewSessionTitle(title)}>{title}</button>)}
        </div>
      </Modal>

      <Modal
        open={historyOpen}
        title="已完成点名"
        description={`${formatDateChinese(date)} 的所有已完成场次，可查看或重新启动。`}
        onClose={() => setHistoryOpen(false)}
        width="lg"
        footer={<button className="button button-secondary" onClick={() => setHistoryOpen(false)}>关闭</button>}
      >
        {completedSessions.length === 0 ? (
          <div className="compact-empty">当天还没有已完成的点名场次</div>
        ) : (
          <div className="session-accordion-list">
            {completedSessions.map((completed) => {
              const completedMap = new Map(completed.records.map((record) => [record.studentId, record]));
              const completedPresent = students.filter((student) => ['present', 'late'].includes(completedMap.get(student.id)?.status ?? '')).length;
              const completedLeave = students.filter((student) => completedMap.get(student.id)?.status === 'leave').length;
              const completedAbsent = students.filter((student) => completedMap.get(student.id)?.status === 'absent').length;
              return (
                <details className="session-accordion history-accordion" key={completed.id}>
                  <summary>
                    <span className="session-accordion-dot" />
                    <div><strong>{completed.title}</strong><small>{formatDateTime(completed.createdAt)} · {completed.records.length} 名学生</small></div>
                    <div className="session-accordion-counts"><span className="present">实到 {completedPresent}</span><span className="leave">请假 {completedLeave}</span><span className="absent">缺勤 {completedAbsent}</span></div>
                    <ChevronRight size={18} className="accordion-chevron" />
                  </summary>
                  <div className="session-accordion-body">
                    <div className="accordion-export-row">
                      <button className="button button-soft" onClick={() => reopenCompletedSession(completed.id)}><RotateCcw size={15} /> 重新启动</button>
                      <button className="text-button" onClick={() => void exportAttendance('csv', completed)}><Download size={15} /> 导出 CSV</button>
                      <button className="text-button" onClick={() => void exportAttendance('html', completed)}><FileText size={15} /> 导出 HTML</button>
                    </div>
                    <div className="session-compact-list">
                      {students.map((student) => {
                        const record = completedMap.get(student.id);
                        const status = record?.status ?? 'unmarked';
                        return (
                          <div className="session-compact-row" key={student.id}>
                            <span className="short-no-badge">{student.shortNo}</span>
                            <strong>{student.name}</strong>
                            <span className={`status-dot status-${status}`}>{attendanceLabels[status]}</span>
                            <span className="compact-note">{record?.note || '无备注'}{record?.images.length ? ` · ${record.images.length} 张图片` : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </Modal>

      <Modal
        open={calendarOpen}
        title="选择点名日期"
        description="在日历中选择日期，然后查看或创建该日期的点名。"
        onClose={() => setCalendarOpen(false)}
        width="sm"
        footer={<><button className="button button-secondary" onClick={() => setCalendarOpen(false)}>取消</button><button className="button button-primary" onClick={() => { setDate(isoDate()); setSelectedSessionId(''); setCalendarOpen(false); }}>回到今天</button></>}
      >
        <div className="calendar-panel">
          <div className="calendar-head">
            <button className="icon-button" onClick={() => setCalendarMonth((month) => shiftCalendarMonth(month, -1))} aria-label="上个月"><ChevronLeft size={18} /></button>
            <strong>{calendarMonth.slice(0, 4)} 年 {Number(calendarMonth.slice(5, 7))} 月</strong>
            <button className="icon-button" onClick={() => setCalendarMonth((month) => shiftCalendarMonth(month, 1))} aria-label="下个月"><ChevronRight size={18} /></button>
          </div>
          <div className="calendar-weekdays">{['日', '一', '二', '三', '四', '五', '六'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">
            {getCalendarCells(calendarMonth).map((day, index) => day ? (
              <button
                key={`${calendarMonth}-${day}`}
                className={`${`${calendarMonth}-${String(day).padStart(2, '0')}` === date ? 'selected' : ''} ${`${calendarMonth}-${String(day).padStart(2, '0')}` === isoDate() ? 'today' : ''}`}
                onClick={() => {
                  setDate(`${calendarMonth}-${String(day).padStart(2, '0')}`);
                  setSelectedSessionId('');
                  setCalendarOpen(false);
                }}
              >{day}</button>
            ) : <span key={`empty-${index}`} />)}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(noteStudent)}
        title={`${noteStudent?.name ?? ''} · 点名备注`}
        description="可输入文字、选择快捷备注，并添加图片凭证。"
        onClose={closeNote}
        footer={<><button className="button button-secondary" onClick={closeNote}>取消</button><button className="button button-primary" onClick={saveNote}>保存备注</button></>}
      >
        <div className="preset-list">
          {presets.map((preset) => <button key={preset.id} className="preset-chip" style={{ borderColor: `${preset.color}44`, color: preset.color }} onClick={() => applyNotePreset(preset.text, preset.status)}>{preset.label}</button>)}
        </div>
        <label className="field"><span>备注内容</span><textarea autoFocus rows={5} value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="例如：已联系本人，确认病假并提供请假单…" /></label>
        <div className="note-image-section">
          <div className="note-image-head"><span><Camera size={16} /> 备注图片</span><button className="text-button" onClick={() => noteUploadRef.current?.click()} disabled={noteUploading}><ImagePlus size={15} /> {noteUploading ? '处理中…' : '添加图片'}</button></div>
          <input ref={noteUploadRef} type="file" accept="image/*" hidden onChange={(event) => { void attachNoteImage(event.target.files?.[0]); event.target.value = ''; }} />
          <div className="attendance-image-row">
            {noteRecord?.images.map((image) => (
              <span className="attendance-image-wrap" key={image.id}>
                <StoredImageThumb attachment={image} onOpen={() => setPreview({ attachment: image, studentId: noteStudent?.id ?? '', studentName: noteStudent?.name ?? '' })} />
                <button className="attachment-remove" aria-label="删除图片" onClick={() => void removeNoteImage(image)}><Trash2 size={11} /></button>
              </span>
            ))}
            {(!noteRecord?.images || noteRecord.images.length === 0) && <span className="muted image-empty-hint">暂无图片</span>}
          </div>
        </div>
        <div className="note-modal-footerline">
          <span>保存后状态：{attendanceLabels[noteStatusDraft]}</span>
          <button className="text-button danger-text" onClick={() => void clearNote()}><Trash2 size={14} /> 一键清空备注</button>
        </div>
      </Modal>

      <Modal
        open={randomOpen}
        title="随机点名"
        description="先选择抽取范围，再抽取学生并直接标记状态。"
        onClose={() => { setRandomOpen(false); setRandomStudent(null); }}
        width="sm"
        footer={<button className="button button-secondary" onClick={() => { setRandomOpen(false); setRandomStudent(null); }}>关闭</button>}
      >
        <div className="random-scope-options">
          {([
            ['unmarked', '未点名'],
            ['marked', '已点名'],
            ['all', '全部学生'],
          ] as const).map(([key, label]) => (
            <button key={key} className={randomScope === key ? 'active' : ''} onClick={() => { setRandomScope(key); setRandomStudent(null); }}>{label}<small>{key === 'unmarked' ? countByStatus('unmarked') : key === 'marked' ? students.length - countByStatus('unmarked') : students.length} 人</small></button>
          ))}
        </div>
        <div className="random-picker">
          {randomStudent ? (
            <>
              <Avatar name={randomStudent.name} gender={randomStudent.gender} size="lg" />
              <h3>{randomStudent.name}</h3>
              <p>短学号 {randomStudent.shortNo} · 学号 {randomStudent.studentNo || '未填写'}</p>
              <div className="random-status-actions">
                {statusConfig.map(({ key, icon: Icon }) => (
                  <button key={key} className={`flash-status choice-${key}`} onClick={() => markRandomStatus(key)}><Icon size={18} /><span>{attendanceLabels[key]}</span></button>
                ))}
              </div>
            </>
          ) : (
            <>
              <span className="random-placeholder"><Shuffle size={38} /></span>
              <p>当前范围有 {randomPool.length} 名学生</p>
            </>
          )}
          <button className="button button-soft" onClick={drawRandom}><Shuffle size={17} /> {randomStudent ? '再抽一次' : '开始抽取'}</button>
        </div>
      </Modal>
      <Modal
        open={Boolean(preview)}
        title={preview ? `${preview.studentName} · 点名图片` : '点名图片'}
        description={preview?.attachment.name}
        onClose={() => setPreview(null)}
        width="lg"
        footer={<><button className="button button-secondary" onClick={() => setPreview(null)}>关闭</button>{preview && <button className="button button-danger" onClick={async () => {
          if (!session) return;
          if (preview.studentId && window.confirm('删除这张点名图片吗？')) {
            await deleteImage(preview.attachment.id);
            removeAttendanceAttachment(session.id, preview.studentId, preview.attachment.id);
            setPreview(null);
            showToast('图片已删除', 'info');
          }
        }}><Trash2 size={16} /> 删除图片</button>}</>}
      >
        {preview && <StoredImagePreview attachment={preview.attachment} />}
      </Modal>
    </div>
  );
}

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
} from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Square,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/toast-context';
import { addDays, isoDateTime } from '../data/seed';
import { Avatar, EmptyState, LoadingButton, Modal, PageHeading, Tag } from '../components/ui';
import { formatDateTimeSeconds, percent, relativeDue } from '../lib/format';
import { buildTaskCsv, buildTaskHtmlReport, buildTaskXlsx } from '../lib/exports';
import { saveFile } from '../lib/download';
import { blobToDataUrl, compressImage, deleteImage, getImage, putImage } from '../lib/imageStore';
import { createId } from '../lib/id';
import type { CollectionTask, Student, SubmissionStatus, TaskAttachment } from '../types';

interface AttachmentThumbProps {
  attachment: TaskAttachment;
  onOpen: () => void;
}

function AttachmentThumb({ attachment, onOpen }: AttachmentThumbProps) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getImage(attachment.id).then(async (blob) => {
      if (!active) return;
      if (!blob) {
        setFailed(true);
        return;
      }
      setUrl(await blobToDataUrl(blob));
    }).catch(() => setFailed(true));
    return () => { active = false; };
  }, [attachment.id]);

  return (
    <button className="attachment-thumb" onClick={onOpen} title={attachment.name}>
      {url ? <img src={url} alt={attachment.name} /> : (
        <span className="attachment-fallback">
          {failed ? <FileImage size={20} /> : <span className="thumb-loading" />}
          <small>{attachment.name.split('.').pop()?.toUpperCase() || 'FILE'}</small>
        </span>
      )}
    </button>
  );
}


function PreviewImage({ attachment }: { attachment: TaskAttachment }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    getImage(attachment.id).then(async (blob) => {
      if (!active || !blob) return;
      setUrl(await blobToDataUrl(blob));
    });
    return () => { active = false; };
  }, [attachment.id]);

  return url
    ? <img src={url} alt={attachment.name} />
    : <div className="preview-loading"><span className="thumb-loading" /> 正在读取图片…</div>;
}

interface PreviewState {
  attachment: TaskAttachment;
  studentId: string;
  studentName: string;
}

interface TaskFormValues {
  title: string;
  description: string;
  dueDate: string;
}

function makeDefaultTaskForm(): TaskFormValues {
  return {
    title: '',
    description: '',
    dueDate: isoDateTime(addDays(new Date(), 7)),
  };
}

export function TasksPage() {
  const classes = useAppStore((state) => state.classes);
  const selectedClassId = useAppStore((state) => state.selectedClassId);
  const allStudents = useAppStore((state) => state.students);
  const tasks = useAppStore((state) => state.tasks);
  const addTask = useAppStore((state) => state.addTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const setSubmissionStatus = useAppStore((state) => state.setSubmissionStatus);
  const setSubmissionStatusBulk = useAppStore((state) => state.setSubmissionStatusBulk);
  const setSubmissionNote = useAppStore((state) => state.setSubmissionNote);
  const addAttachment = useAppStore((state) => state.addAttachment);
  const removeAttachment = useAppStore((state) => state.removeAttachment);
  const { showToast } = useToast();
  const classRoom = classes.find((item) => item.id === selectedClassId);
  const students = useMemo(
    () => allStudents
      .filter((student) => student.classId === selectedClassId && student.active)
      .sort((a, b) => a.shortNo.localeCompare(b.shortNo, 'zh-CN', { numeric: true })),
    [allStudents, selectedClassId],
  );
  const classTasks = useMemo(
    () => tasks
      .filter((task) => task.classId === selectedClassId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [tasks, selectedClassId],
  );

  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'completed' | 'missing' | 'pending'>('all');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CollectionTask | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormValues>(makeDefaultTaskForm);
  const [uploadingStudentId, setUploadingStudentId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [exporting, setExporting] = useState<'' | 'html' | 'xlsx'>('');
  const [moreOpen, setMoreOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef('');

  const effectiveTaskId = classTasks.some((task) => task.id === selectedTaskId)
    ? selectedTaskId
    : (classTasks[0]?.id ?? '');
  const selectedTask = classTasks.find((task) => task.id === effectiveTaskId) ?? null;
  const submissionMap = useMemo(
    () => new Map(selectedTask?.submissions.map((submission) => [submission.studentId, submission]) ?? []),
    [selectedTask],
  );

  const completed = selectedTask
    ? students.filter((student) => submissionMap.get(student.id)?.status === 'completed').length
    : 0;
  const missing = selectedTask
    ? students.filter((student) => submissionMap.get(student.id)?.status === 'missing').length
    : 0;
  const pending = students.length - completed - missing;

  const visibleStudents = selectedTask ? students.filter((student) => {
    const submission = submissionMap.get(student.id);
    const status = submission?.status ?? 'pending';
    const keyword = search.trim().toLowerCase();
    const matchesSearch = !keyword
      || student.name.toLowerCase().includes(keyword)
      || student.shortNo.includes(keyword)
      || student.studentNo.includes(keyword)
      || (submission?.note ?? '').toLowerCase().includes(keyword);
    const matchesFilter = filter === 'all'
      || (filter === 'incomplete' && status !== 'completed')
      || filter === status;
    return matchesSearch && matchesFilter;
  }) : [];

  const openCreate = () => {
    setEditingTask(null);
    setTaskForm(makeDefaultTaskForm());
    setTaskModalOpen(true);
  };

  const openEdit = () => {
    if (!selectedTask) return;
    setEditingTask(selectedTask);
    setTaskForm({
      title: selectedTask.title,
      description: selectedTask.description,
      dueDate: selectedTask.dueDate,
    });
    setTaskModalOpen(true);
    setMoreOpen(false);
  };

  const submitTask = (event: FormEvent) => {
    event.preventDefault();
    if (!taskForm.title.trim()) {
      showToast('请填写任务名称', 'error');
      return;
    }
    if (editingTask) {
      updateTask(editingTask.id, taskForm);
      showToast('任务信息已更新');
    } else {
      const task = addTask(taskForm);
      setSelectedTaskId(task.id);
      showToast('收集任务已创建');
    }
    setTaskModalOpen(false);
  };

  const handleDeleteTask = () => {
    if (!selectedTask) return;
    if (window.confirm(`确定删除任务「${selectedTask.title}」吗？提交记录和附件索引将一并移除。`)) {
      selectedTask.submissions.forEach((submission) => {
        submission.attachments.forEach((attachment) => void deleteImage(attachment.id));
      });
      deleteTask(selectedTask.id);
      setSelectedTaskId('');
      setMoreOpen(false);
      showToast('任务已删除', 'info');
    }
  };

  const toggleTaskStatus = () => {
    if (!selectedTask) return;
    const next = selectedTask.status === 'open' ? 'closed' : 'open';
    updateTask(selectedTask.id, { status: next });
    showToast(next === 'closed' ? '任务已结束收集' : '任务已重新开放');
    setMoreOpen(false);
  };

  const uploadFiles = async (files: File[], student: Student) => {
    if (!selectedTask || files.length === 0) return;
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) {
      showToast('请选择图片或截图文件', 'error');
      return;
    }
    setUploadingStudentId(student.id);
    try {
      for (const file of images) {
        const compressed = await compressImage(file);
        const id = createId('attachment');
        await putImage(id, compressed);
        addAttachment(selectedTask.id, student.id, {
          id,
          name: file.name || `截图-${new Date().toISOString().slice(11, 19)}.jpg`,
          mimeType: compressed.type || file.type,
          size: compressed.size,
          createdAt: new Date().toISOString(),
        });
      }
      showToast(`已添加 ${images.length} 张提交凭证`);
    } catch {
      showToast('图片处理失败，请重试', 'error');
    } finally {
      setUploadingStudentId('');
    }
  };

  const triggerUpload = (studentId: string) => {
    uploadTargetRef.current = studentId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const student = students.find((item) => item.id === uploadTargetRef.current);
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (student) await uploadFiles(files, student);
  };

  const handlePaste = async (event: ClipboardEvent<HTMLElement>, student: Student) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (files.length > 0) {
      event.preventDefault();
      await uploadFiles(files, student);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLElement>, student: Student) => {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-active');
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) await uploadFiles(files, student);
  };

  const removeStudentAttachment = async (student: Student, attachment: TaskAttachment) => {
    if (!selectedTask) return;
    if (!window.confirm(`删除「${student.name}」的附件「${attachment.name}」吗？`)) return;
    await deleteImage(attachment.id);
    removeAttachment(selectedTask.id, student.id, attachment.id);
    showToast('附件已删除', 'info');
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((current) => current.includes(studentId)
      ? current.filter((id) => id !== studentId)
      : [...current, studentId]);
  };

  const allVisibleSelected = visibleStudents.length > 0
    && visibleStudents.every((student) => selectedStudentIds.includes(student.id));

  const toggleSelectVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(visibleStudents.map((student) => student.id));
      setSelectedStudentIds((current) => current.filter((id) => !visibleIds.has(id)));
    } else {
      setSelectedStudentIds((current) => Array.from(new Set([...current, ...visibleStudents.map((student) => student.id)])));
    }
  };

  const applyBulkStatus = (status: SubmissionStatus) => {
    if (!selectedTask || selectedStudentIds.length === 0) return;
    setSubmissionStatusBulk(selectedTask.id, selectedStudentIds, status);
    showToast(`已将 ${selectedStudentIds.length} 名学生批量标记为${status === 'completed' ? '已完成' : status === 'pending' ? '待检查' : '未完成'}`);
    setSelectedStudentIds([]);
  };

  const exportCsv = async () => {
    if (!selectedTask) return;
    await saveFile(
      `${selectedTask.title}-提交清单-${selectedTask.dueDate.replaceAll(':', '-')}.csv`,
      buildTaskCsv(selectedTask, students),
      'text/csv;charset=utf-8',
    );
    showToast('提交清单 CSV 已生成');
    setMoreOpen(false);
  };

  const exportHtml = async () => {
    if (!selectedTask) return;
    setExporting('html');
    try {
      const html = await buildTaskHtmlReport(selectedTask, students, classRoom);
      await saveFile(`${selectedTask.title}-图文报告.html`, html, 'text/html;charset=utf-8');
      showToast('图文报告已生成');
      setMoreOpen(false);
    } catch {
      showToast('报告生成失败，请重试', 'error');
    } finally {
      setExporting('');
    }
  };

  const exportXlsx = async () => {
    if (!selectedTask) return;
    setExporting('xlsx');
    try {
      const blob = await buildTaskXlsx(selectedTask, students, classRoom);
      await saveFile(`${selectedTask.title}-提交清单-${selectedTask.dueDate.replaceAll(':', '-')}.xlsx`, blob, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      showToast('XLSX 提交清单已生成');
    } catch {
      showToast('XLSX 生成失败，请重试', 'error');
    } finally {
      setExporting('');
    }
  };

  const downloadPreview = async () => {
    if (!preview) return;
    const blob = await getImage(preview.attachment.id);
    if (blob) {
      await saveFile(preview.attachment.name, blob, preview.attachment.mimeType);
    }
  };

  const deletePreview = async () => {
    if (!preview || !selectedTask) return;
    if (!window.confirm(`删除「${preview.studentName}」的附件「${preview.attachment.name}」吗？`)) return;
    await deleteImage(preview.attachment.id);
    removeAttachment(selectedTask.id, preview.studentId, preview.attachment.id);
    setPreview(null);
    showToast('附件已删除', 'info');
  };

  const filterCount = (key: typeof filter) => {

    if (key === 'all') return students.length;
    if (key === 'incomplete') return students.filter((student) => submissionMap.get(student.id)?.status !== 'completed').length;
    return students.filter((student) => (submissionMap.get(student.id)?.status ?? 'pending') === key).length;
  };

  const statusButton = (student: Student, status: SubmissionStatus, label: string, icon: typeof CheckCircle2) => {
    if (!selectedTask) return null;
    const current = submissionMap.get(student.id)?.status ?? 'pending';
    const Icon = icon;
    return (
      <button
        className={`submission-choice choice-${status} ${current === status ? 'selected' : ''}`}
        onClick={() => setSubmissionStatus(selectedTask.id, student.id, status)}
      >
        <Icon size={15} /> {label}
      </button>
    );
  };

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="COLLECTION"
        title="任务收集"
        description="收集截图、照片和完成情况，一眼看清谁还没有交。"
        actions={<button className="button button-primary" onClick={openCreate}><Plus size={18} /> 新建收集任务</button>}
      />

      {classTasks.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon={<ClipboardList size={30} />}
            title="还没有收集任务"
            description="创建一个任务，按学生逐一记录完成状态、备注并上传截图或照片。"
            action={<button className="button button-primary" onClick={openCreate}><Plus size={18} /> 创建第一个任务</button>}
          />
        </section>
      ) : (
        <div className="task-layout">
          <aside className="task-sidebar panel">
            <div className="task-sidebar-head">
              <div><span className="eyebrow">TASKS</span><h2>收集任务</h2></div>
              <button className="round-add" onClick={openCreate} aria-label="新建任务"><Plus size={18} /></button>
            </div>
            <div className="task-list">
              {classTasks.map((task) => {
                const total = students.length;
                const taskCompleted = task.submissions.filter((submission) => submission.status === 'completed').length;
                const taskOutstanding = task.submissions.filter((submission) => submission.status !== 'completed').length;
                const due = relativeDue(task.dueDate);
                return (
                  <button
                    key={task.id}
                    className={`task-list-item ${task.id === effectiveTaskId ? 'active' : ''}`}
                    onClick={() => { setSelectedTaskId(task.id); setSearch(''); setFilter('all'); setMoreOpen(false); setSelectedStudentIds([]); }}
                  >
                    <div className="task-list-top">
                      <span className={`task-state-dot ${task.status}`} />
                      <strong>{task.title}</strong>
                    </div>
                    <div className="task-list-progress"><span style={{ width: `${percent(taskCompleted, total)}%` }} /></div>
                    <div className="task-list-meta">
                      <span>{taskCompleted}/{total} 已交</span>
                      <span className={taskOutstanding > 0 ? 'danger-text' : 'muted'}>{taskOutstanding} 人未交</span>
                      <span className={due.tone}>{task.status === 'closed' ? '已结束' : due.text}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {selectedTask && (
            <section className="task-workspace panel">
              <header className="task-workspace-head">
                <div className="task-title-block">
                  <div className="task-title-line">
                    <h2>{selectedTask.title}</h2>
                    <Tag tone={selectedTask.status === 'open' ? 'green' : 'neutral'}>{selectedTask.status === 'open' ? '收集中' : '已结束'}</Tag>
                  </div>
                  <p>{selectedTask.description || '暂无任务说明'}</p>
                  <span className={`task-due ${relativeDue(selectedTask.dueDate).tone}`}>
                    <Clock3 size={15} /> {formatDateTimeSeconds(selectedTask.dueDate)} · {relativeDue(selectedTask.dueDate).text}
                  </span>
                </div>
                <div className="task-head-actions">
                  <button className="button button-secondary" onClick={exportCsv}><Download size={16} /> CSV</button>
                  <button className="button button-secondary" onClick={exportXlsx} disabled={exporting === 'xlsx'}>
                    <LoadingButton loading={exporting === 'xlsx'}><FileSpreadsheet size={16} /> XLSX</LoadingButton>
                  </button>
                  <button className="button button-secondary" onClick={exportHtml} disabled={exporting === 'html'}>
                    <LoadingButton loading={exporting === 'html'}><FileText size={16} /> 图文报告</LoadingButton>
                  </button>
                  <div className="more-menu-wrap">
                    <button className="icon-button more-button" onClick={() => setMoreOpen((open) => !open)} aria-label="更多任务操作"><MoreHorizontal size={19} /></button>
                    {moreOpen && (
                      <div className="more-menu">
                        <button onClick={openEdit}><Pencil size={15} /> 编辑任务</button>
                        <button onClick={toggleTaskStatus}><RotateCcw size={15} /> {selectedTask.status === 'open' ? '结束收集' : '重新开放'}</button>
                        <button className="danger" onClick={handleDeleteTask}><Trash2 size={15} /> 删除任务</button>
                      </div>
                    )}
                  </div>
                </div>
              </header>

              <div className="task-metrics">
                <div className="task-metric"><span><CheckCircle2 size={17} /> 已完成</span><strong>{completed}</strong><small>{percent(completed, students.length)}%</small></div>
                <div className="task-metric metric-missing"><span><AlertCircle size={17} /> 未完成</span><strong>{missing + pending}</strong><small>{percent(missing + pending, students.length)}%</small></div>
                <div className="task-metric"><span><Clock3 size={17} /> 待检查</span><strong>{pending}</strong><small>尚未标注</small></div>
              </div>

              <div className="task-toolbar">
                <div className="filter-pills">
                  {([
                    ['all', '全部'],
                    ['incomplete', '未完成'],
                    ['completed', '已完成'],
                    ['pending', '待检查'],
                    ['missing', '缺交'],
                  ] as const).map(([key, label]) => (
                    <button key={key} className={filter === key ? 'active' : ''} onClick={() => { setFilter(key); setSelectedStudentIds([]); }}>
                      {label} {filterCount(key)}
                    </button>
                  ))}
                </div>
                <div className="search-box compact">
                  <Search size={17} />
                  <input value={search} onChange={(event) => { setSearch(event.target.value); setSelectedStudentIds([]); }} placeholder="搜索姓名、短学号或备注" />
                  {search && <button onClick={() => setSearch('')}><X size={14} /></button>}
                </div>
              </div>

              <div className="paste-hint">
                <ClipboardCheck size={16} />
                <span>点击某个学生行后按 <kbd>Ctrl</kbd> + <kbd>V</kbd> 可直接粘贴聊天截图；也可以拖入图片或点击上传。</span>
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFileChange} />

              <div className="bulk-toolbar">
                <button className="bulk-select-all" onClick={toggleSelectVisible}>
                  {allVisibleSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                  {allVisibleSelected ? '取消全选' : '全选当前列表'}
                </button>
                <span className="bulk-selected-count">已选 {selectedStudentIds.length} 人</span>
                <div className="bulk-actions">
                  <button disabled={selectedStudentIds.length === 0} onClick={() => applyBulkStatus('completed')}><CheckCircle2 size={15} /> 标为已完成</button>
                  <button disabled={selectedStudentIds.length === 0} onClick={() => applyBulkStatus('pending')}><Clock3 size={15} /> 标为待检查</button>
                  <button disabled={selectedStudentIds.length === 0} onClick={() => applyBulkStatus('missing')}><AlertCircle size={15} /> 标为未完成</button>
                </div>
              </div>

              {visibleStudents.length === 0 ? (
                <EmptyState
                  icon={<Search size={27} />}
                  title="当前筛选下没有学生"
                  description={filter === 'incomplete' ? '太棒了，当前任务已经全部完成。' : '尝试换一个筛选条件或搜索关键词。'}
                  action={<button className="button button-secondary" onClick={() => { setFilter('all'); setSearch(''); }}>查看全部</button>}
                />
              ) : (
                <div className="submission-list">
                  {visibleStudents.map((student) => {
                    const submission = submissionMap.get(student.id);
                    const status = submission?.status ?? 'pending';
                    return (
                      <article
                        className={`submission-row submission-${status}`}
                        key={student.id}
                        tabIndex={0}
                        onPaste={(event) => handlePaste(event, student)}
                        onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add('drag-active'); }}
                        onDragLeave={(event) => event.currentTarget.classList.remove('drag-active')}
                        onDrop={(event) => handleDrop(event, student)}
                      >
                        <button className="selection-check" onClick={() => toggleStudentSelection(student.id)} aria-label={`选择 ${student.name}`}>
                          {selectedStudentIds.includes(student.id) ? <CheckSquare size={19} /> : <Square size={19} />}
                        </button>
                        <div className="submission-student">
                          <Avatar name={student.name} />
                          <span><strong>{student.name}</strong><small>班级 {student.shortNo} · {student.studentNo || '未填写学号'}</small></span>
                        </div>
                        <div className="submission-statuses">
                          {statusButton(student, 'completed', '已完成', CheckCircle2)}
                          {statusButton(student, 'pending', '待检查', Clock3)}
                          {statusButton(student, 'missing', '未完成', AlertCircle)}
                        </div>
                        <label className="submission-note">
                          <input
                            value={submission?.note ?? ''}
                            onChange={(event) => selectedTask && setSubmissionNote(selectedTask.id, student.id, event.target.value)}
                            placeholder="备注，例如：已提醒 / 图片不清晰"
                          />
                        </label>
                        <div className="submission-attachments">
                          {submission?.attachments.map((attachment) => (
                            <span className="attachment-wrap" key={attachment.id}>
                              <AttachmentThumb
                                attachment={attachment}
                                onOpen={() => setPreview({ attachment, studentId: student.id, studentName: student.name })}
                              />
                              <button className="attachment-remove" aria-label="删除附件" onClick={() => void removeStudentAttachment(student, attachment)}><X size={11} /></button>
                            </span>
                          ))}
                          <button className="upload-attachment" onClick={() => triggerUpload(student.id)} disabled={uploadingStudentId === student.id}>
                            {uploadingStudentId === student.id ? <span className="thumb-loading" /> : <ImagePlus size={18} />}
                            <span>{submission?.attachments.length ? '继续添加' : '上传截图'}</span>
                          </button>
                          {submission?.attachments.length ? <span className="attachment-count">{submission.attachments.length} 张附件</span> : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              <footer className="task-workspace-footer">
                <span>共 {students.length} 名学生 · 已完成 {completed} 人 · 未完成 {missing + pending} 人</span>
                <span>附件保存在本机 IndexedDB</span>
              </footer>
            </section>
          )}
        </div>
      )}

      <Modal
        open={taskModalOpen}
        title={editingTask ? '编辑收集任务' : '新建收集任务'}
        description={editingTask ? '修改任务名称、说明或截止日期。' : `为「${classRoom?.name ?? '当前班级'}」创建一项材料收集任务。`}
        onClose={() => setTaskModalOpen(false)}
        footer={(
          <>
            <button className="button button-secondary" onClick={() => setTaskModalOpen(false)}>取消</button>
            <button className="button button-primary" type="submit" form="task-form">{editingTask ? '保存修改' : '创建任务'}</button>
          </>
        )}
      >
        <form id="task-form" onSubmit={submitTask}>
          <div className="form-grid">
            <label className="field field-full">
              <span>任务名称 <b>*</b></span>
              <input autoFocus value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} placeholder="例如：第 10 周实践周报" />
            </label>
            <label className="field field-full">
              <span>任务说明</span>
              <textarea rows={4} value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} placeholder="说明提交内容、格式或检查要求" />
            </label>
            <label className="field">
              <span>截止日期与时间</span>
              <input type="datetime-local" step="1" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} />
            </label>
          </div>
          <div className="form-help"><UploadCloud size={17} /> 创建后可在每个学生行上传照片、文件截图，或直接粘贴剪贴板截图。</div>
        </form>
      </Modal>

      <Modal
        open={Boolean(preview)}
        title={preview ? `${preview.studentName} · 提交凭证` : '提交凭证'}
        description={preview?.attachment.name}
        onClose={() => setPreview(null)}
        width="lg"
        footer={(
          <>
            <button className="button button-secondary" onClick={() => setPreview(null)}>关闭</button>
            <button className="button button-danger" onClick={() => void deletePreview()}><Trash2 size={16} /> 删除图片</button>
            <button className="button button-primary" onClick={downloadPreview}><Download size={16} /> 保存图片</button>
          </>
        )}
      >
        <div className="image-preview">
          {preview ? <PreviewImage attachment={preview.attachment} /> : null}
        </div>
      </Modal>
    </div>
  );
}

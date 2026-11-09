import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArchiveRestore,
  Check,
  Database,
  Download,
  FileJson,
  HardDrive,
  Info,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  UsersRound,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/toast-context';
import { PageHeading, Modal, Tag, LoadingButton } from '../components/ui';
import { saveFile } from '../lib/download';
import { blobToDataUrl, dataUrlToBlob, deleteImage, getImage, putImage } from '../lib/imageStore';
import type {
  AttendanceStatus,
  BackupData,
  ClassFormValues,
  ClassRoom,
  RemarkPreset,
} from '../types';

const classColors = ['#1d7a5f', '#4f7cac', '#8a6bb5', '#c88925', '#c36f55', '#397b8d'];
const emptyClassForm: ClassFormValues = {
  name: '',
  grade: '',
  major: '',
  advisor: '',
  color: classColors[0],
};

interface PresetForm {
  label: string;
  text: string;
  status: 'none' | AttendanceStatus;
  color: string;
}

const emptyPresetForm: PresetForm = {
  label: '',
  text: '',
  status: 'none',
  color: '#1d7a5f',
};

export function SettingsPage() {
  const classes = useAppStore((state) => state.classes);
  const students = useAppStore((state) => state.students);
  const tasks = useAppStore((state) => state.tasks);
  const presets = useAppStore((state) => state.presets);
  const addClass = useAppStore((state) => state.addClass);
  const updateClass = useAppStore((state) => state.updateClass);
  const deleteClass = useAppStore((state) => state.deleteClass);
  const addPreset = useAppStore((state) => state.addPreset);
  const updatePreset = useAppStore((state) => state.updatePreset);
  const removePreset = useAppStore((state) => state.removePreset);
  const restoreBackup = useAppStore((state) => state.restoreBackup);
  const clearBusinessData = useAppStore((state) => state.clearBusinessData);
  const resetDemoData = useAppStore((state) => state.resetDemoData);
  const { showToast } = useToast();
  const importRef = useRef<HTMLInputElement>(null);
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassRoom | null>(null);
  const [classForm, setClassForm] = useState<ClassFormValues>(emptyClassForm);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<RemarkPreset | null>(null);
  const [presetForm, setPresetForm] = useState<PresetForm>(emptyPresetForm);
  const [busy, setBusy] = useState('');

  const mediaCount = useMemo(
    () => tasks.reduce((sum, task) => sum + task.submissions.reduce((inner, submission) => inner + submission.attachments.length, 0), 0),
    [tasks],
  );

  const openAddClass = () => {
    setEditingClass(null);
    setClassForm(emptyClassForm);
    setClassModalOpen(true);
  };

  const openEditClass = (classRoom: ClassRoom) => {
    setEditingClass(classRoom);
    setClassForm({
      name: classRoom.name,
      grade: classRoom.grade,
      major: classRoom.major,
      advisor: classRoom.advisor,
      color: classRoom.color,
    });
    setClassModalOpen(true);
  };

  const submitClass = (event: FormEvent) => {
    event.preventDefault();
    if (!classForm.name.trim()) {
      showToast('请填写班级名称', 'error');
      return;
    }
    if (editingClass) {
      updateClass(editingClass.id, classForm);
      showToast('班级信息已更新');
    } else {
      addClass(classForm);
      showToast('新班级已创建');
    }
    setClassModalOpen(false);
  };

  const handleDeleteClass = async (classRoom: ClassRoom) => {
    if (classes.length <= 1) {
      showToast('至少保留一个班级', 'error');
      return;
    }
    if (!window.confirm(`确定删除「${classRoom.name}」吗？该班级的学生、点名、任务和附件将全部删除。`)) return;
    tasks.filter((task) => task.classId === classRoom.id).forEach((task) => {
      task.submissions.forEach((submission) => submission.attachments.forEach((attachment) => void deleteImage(attachment.id)));
    });
    deleteClass(classRoom.id);
    showToast('班级已删除', 'info');
  };

  const openAddPreset = () => {
    setEditingPreset(null);
    setPresetForm(emptyPresetForm);
    setPresetModalOpen(true);
  };

  const openEditPreset = (preset: RemarkPreset) => {
    setEditingPreset(preset);
    setPresetForm({
      label: preset.label,
      text: preset.text,
      status: preset.status ?? 'none',
      color: preset.color,
    });
    setPresetModalOpen(true);
  };

  const submitPreset = (event: FormEvent) => {
    event.preventDefault();
    if (!presetForm.label.trim() || !presetForm.text.trim()) {
      showToast('请填写预设名称和备注内容', 'error');
      return;
    }
    const value = {
      label: presetForm.label,
      text: presetForm.text,
      color: presetForm.color,
      ...(presetForm.status !== 'none' ? { status: presetForm.status } : {}),
    };
    if (editingPreset) {
      updatePreset({ ...value, id: editingPreset.id });
      showToast('预设备注已更新');
    } else {
      addPreset(value);
      showToast('预设备注已添加');
    }
    setPresetModalOpen(false);
  };

  const exportBackup = async () => {
    setBusy('backup');
    try {
      const state = useAppStore.getState();
      const media: Record<string, string> = {};
      for (const task of state.tasks) {
        for (const submission of task.submissions) {
          for (const attachment of submission.attachments) {
            const blob = await getImage(attachment.id);
            if (blob) media[attachment.id] = await blobToDataUrl(blob);
          }
        }
      }
      const backup: BackupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        classes: state.classes,
        students: state.students,
        sessions: state.sessions,
        tasks: state.tasks,
        presets: state.presets,
        media,
      };
      await saveFile(
        `班务通完整备份-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(backup, null, 2),
        'application/json;charset=utf-8',
      );
      showToast(`备份已生成，包含 ${Object.keys(media).length} 个附件`);
    } catch {
      showToast('备份生成失败，请检查图片数据', 'error');
    } finally {
      setBusy('');
    }
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!window.confirm('恢复备份将覆盖当前所有班级数据，是否继续？')) return;
    setBusy('restore');
    try {
      const parsed = JSON.parse(await file.text()) as BackupData;
      if (!Array.isArray(parsed.classes) || !Array.isArray(parsed.students) || !Array.isArray(parsed.tasks)) {
        throw new Error('备份格式不正确');
      }
      if (parsed.media) {
        for (const [id, dataUrl] of Object.entries(parsed.media)) {
          const blob = await dataUrlToBlob(dataUrl);
          await putImage(id, blob);
        }
      }
      restoreBackup(parsed);
      showToast('备份恢复成功');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '备份恢复失败', 'error');
    } finally {
      setBusy('');
    }
  };

  const clearAll = async () => {
    if (!window.confirm('确定清空所有学生、点名、任务和附件吗？班级与备注预设会保留。此操作不可撤销。')) return;
    setBusy('clear');
    for (const task of tasks) {
      for (const submission of task.submissions) {
        for (const attachment of submission.attachments) await deleteImage(attachment.id);
      }
    }
    clearBusinessData();
    setBusy('');
    showToast('业务数据已清空', 'info');
  };

  const resetDemo = async () => {
    if (!window.confirm('确定恢复演示数据吗？当前数据会被覆盖，且无法撤销。')) return;
    setBusy('reset');
    for (const task of tasks) {
      for (const submission of task.submissions) {
        for (const attachment of submission.attachments) await deleteImage(attachment.id);
      }
    }
    resetDemoData();
    setBusy('');
    showToast('已恢复演示数据');
  };

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="SETTINGS"
        title="设置与数据"
        description="管理班级、快捷备注和本地数据备份。"
      />

      <div className="settings-layout">
        <section className="settings-main">
          <article className="panel settings-card">
            <header className="settings-card-head">
              <div className="settings-title"><span className="settings-icon"><UsersRound size={20} /></span><div><h2>班级管理</h2><p>支持多个班级独立管理名单和记录。</p></div></div>
              <button className="button button-secondary" onClick={openAddClass}><Plus size={16} /> 新建班级</button>
            </header>
            <div className="class-card-list">
              {classes.map((classRoom) => {
                const count = students.filter((student) => student.classId === classRoom.id).length;
                return (
                  <div className="class-settings-row" key={classRoom.id}>
                    <span className="class-color-block" style={{ background: classRoom.color }} />
                    <div className="class-settings-copy">
                      <strong>{classRoom.name}</strong>
                      <span>{classRoom.grade} · {classRoom.major} · {classRoom.advisor || '未填写辅导员'} · {count} 名学生</span>
                    </div>
                    <button className="icon-button" onClick={() => openEditClass(classRoom)} aria-label="编辑班级"><Pencil size={16} /></button>
                    <button className="icon-button danger" onClick={() => void handleDeleteClass(classRoom)} aria-label="删除班级"><Trash2 size={16} /></button>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="panel settings-card">
            <header className="settings-card-head">
              <div className="settings-title"><span className="settings-icon"><Sparkles size={20} /></span><div><h2>点名快捷备注</h2><p>点名时可一键填入请假、迟到、已联系等常用备注。</p></div></div>
              <button className="button button-secondary" onClick={openAddPreset}><Plus size={16} /> 添加预设</button>
            </header>
            <div className="preset-settings-grid">
              {presets.map((preset) => (
                <div className="preset-settings-item" key={preset.id}>
                  <span className="preset-color" style={{ background: preset.color }} />
                  <div><strong>{preset.label}</strong><span>{preset.text}</span></div>
                  {preset.status && preset.status !== 'unmarked' && (
                    <Tag tone={preset.status === 'present' ? 'green' : preset.status === 'late' ? 'amber' : preset.status === 'leave' ? 'blue' : 'red'}>
                      {preset.status === 'present' ? '出勤' : preset.status === 'late' ? '迟到' : preset.status === 'leave' ? '请假' : '缺勤'}
                    </Tag>
                  )}
                  <button className="icon-button" onClick={() => openEditPreset(preset)} aria-label="编辑预设"><Pencil size={14} /></button>
                  <button className="icon-button danger" onClick={() => {
                    if (window.confirm(`删除预设备注「${preset.label}」吗？`)) {
                      removePreset(preset.id);
                      showToast('预设已删除', 'info');
                    }
                  }} aria-label="删除预设"><X size={14} /></button>
                </div>
              ))}
            </div>
          </article>

          <article className="panel settings-card">
            <header className="settings-card-head">
              <div className="settings-title"><span className="settings-icon"><Database size={20} /></span><div><h2>数据与备份</h2><p>数据默认仅保存在当前设备，建议定期导出完整备份。</p></div></div>
            </header>
            <div className="data-summary-row">
              <div><span>班级</span><strong>{classes.length}</strong></div>
              <div><span>学生</span><strong>{students.length}</strong></div>
              <div><span>任务附件</span><strong>{mediaCount}</strong></div>
              <div><span>存储模式</span><strong className="text-strong">本地</strong></div>
            </div>
            <div className="data-action-grid">
              <button className="data-action-card" onClick={exportBackup} disabled={Boolean(busy)}>
                <span className="action-icon green"><Download size={20} /></span>
                <span><strong><LoadingButton loading={busy === 'backup'}><FileJson size={16} /> 导出完整备份</LoadingButton></strong><small>包含名单、记录、任务与图片附件</small></span>
              </button>
              <button className="data-action-card" onClick={() => importRef.current?.click()} disabled={Boolean(busy)}>
                <span className="action-icon blue"><ArchiveRestore size={20} /></span>
                <span><strong><LoadingButton loading={busy === 'restore'}><Upload size={16} /> 恢复备份</LoadingButton></strong><small>从班务通 JSON 备份文件恢复</small></span>
              </button>
              <button className="data-action-card" onClick={resetDemo} disabled={Boolean(busy)}>
                <span className="action-icon amber"><RefreshCcw size={20} /></span>
                <span><strong><LoadingButton loading={busy === 'reset'}><Sparkles size={16} /> 恢复演示数据</LoadingButton></strong><small>重新载入示例班级和任务</small></span>
              </button>
              <button className="data-action-card danger-card" onClick={clearAll} disabled={Boolean(busy)}>
                <span className="action-icon red"><Trash2 size={20} /></span>
                <span><strong><LoadingButton loading={busy === 'clear'}><Trash2 size={16} /> 清空业务数据</LoadingButton></strong><small>保留班级，删除学生、记录和任务</small></span>
              </button>
            </div>
            <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />
          </article>
        </section>

        <aside className="settings-side">
          <article className="panel privacy-card-large">
            <span className="privacy-illustration"><ShieldCheck size={30} /></span>
            <span className="eyebrow">PRIVACY FIRST</span>
            <h2>学生数据，留在本机</h2>
            <p>班务通不连接服务器，不自动上传名单、备注或截图。所有数据保存在当前设备的浏览器/应用存储中。</p>
            <ul>
              <li><Check size={15} /> 无账号、无云端同步</li>
              <li><Check size={15} /> 图片不会离开设备</li>
              <li><Check size={15} /> 可随时导出完整备份</li>
            </ul>
          </article>

          <article className="panel platform-card">
            <span className="eyebrow">PLATFORMS</span>
            <h2>多端使用</h2>
            <div className="platform-row"><span><HardDrive size={18} /> Windows 桌面版</span><Tag tone="green">Electron</Tag></div>
            <div className="platform-row"><span><Smartphone size={18} /> Android / 平板</span><Tag tone="green">Capacitor</Tag></div>
            <div className="platform-row"><span><Info size={18} /> 浏览器 PWA</span><Tag tone="blue">免安装</Tag></div>
            <p className="platform-note">各设备数据彼此独立；跨设备迁移请使用“完整备份”功能。</p>
          </article>

          <article className="about-card">
            <strong>班务通 Class Desk</strong>
            <span>版本 1.0.0 · 本地优先</span>
            <small>专注班级点名、备注和材料收集</small>
          </article>
        </aside>
      </div>

      <Modal
        open={classModalOpen}
        title={editingClass ? '编辑班级' : '新建班级'}
        description="班级名称会显示在点名、任务和导出文件中。"
        onClose={() => setClassModalOpen(false)}
        footer={(
          <>
            <button className="button button-secondary" onClick={() => setClassModalOpen(false)}>取消</button>
            <button className="button button-primary" type="submit" form="class-form">{editingClass ? '保存修改' : '创建班级'}</button>
          </>
        )}
      >
        <form id="class-form" onSubmit={submitClass}>
          <div className="form-grid">
            <label className="field field-full"><span>班级名称 <b>*</b></span><input autoFocus value={classForm.name} onChange={(event) => setClassForm({ ...classForm, name: event.target.value })} placeholder="例如：计算机 2301 班" /></label>
            <label className="field"><span>年级</span><input value={classForm.grade} onChange={(event) => setClassForm({ ...classForm, grade: event.target.value })} placeholder="例如：2023 级" /></label>
            <label className="field"><span>专业</span><input value={classForm.major} onChange={(event) => setClassForm({ ...classForm, major: event.target.value })} placeholder="例如：计算机科学与技术" /></label>
            <label className="field field-full"><span>辅导员 / 班主任</span><input value={classForm.advisor} onChange={(event) => setClassForm({ ...classForm, advisor: event.target.value })} placeholder="选填" /></label>
            <div className="field field-full">
              <span>班级标记色</span>
              <div className="color-picker">{classColors.map((color) => <button type="button" key={color} className={classForm.color === color ? 'active' : ''} style={{ background: color }} onClick={() => setClassForm({ ...classForm, color })} aria-label={color} />)}</div>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={presetModalOpen}
        title={editingPreset ? '编辑快捷备注' : '添加快捷备注'}
        description="点击预设后会自动填入备注，并可同时切换点名状态。"
        onClose={() => setPresetModalOpen(false)}
        footer={(
          <>
            <button className="button button-secondary" onClick={() => setPresetModalOpen(false)}>取消</button>
            <button className="button button-primary" type="submit" form="preset-form">{editingPreset ? '保存修改' : '添加预设'}</button>
          </>
        )}
      >
        <form id="preset-form" onSubmit={submitPreset}>
          <div className="form-grid">
            <label className="field"><span>按钮名称 <b>*</b></span><input autoFocus value={presetForm.label} onChange={(event) => setPresetForm({ ...presetForm, label: event.target.value })} placeholder="例如：已联系" /></label>
            <label className="field"><span>同时切换状态</span><select value={presetForm.status} onChange={(event) => setPresetForm({ ...presetForm, status: event.target.value as PresetForm['status'] })}><option value="none">不切换</option><option value="present">出勤</option><option value="late">迟到</option><option value="leave">请假</option><option value="absent">缺勤</option></select></label>
            <label className="field field-full"><span>备注内容 <b>*</b></span><textarea rows={3} value={presetForm.text} onChange={(event) => setPresetForm({ ...presetForm, text: event.target.value })} placeholder="例如：已联系本人并确认情况" /></label>
            <div className="field field-full"><span>颜色</span><div className="color-picker">{classColors.map((color) => <button type="button" key={color} className={presetForm.color === color ? 'active' : ''} style={{ background: color }} onClick={() => setPresetForm({ ...presetForm, color })} aria-label={color} />)}</div></div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

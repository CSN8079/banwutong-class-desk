import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/toast-context';
import { Avatar, EmptyState, Modal, PageHeading } from '../components/ui';
import { buildStudentCsv } from '../lib/exports';
import { parseStudentCsv } from '../lib/csv';
import { saveFile } from '../lib/download';
import type { Gender, Student, StudentFormValues } from '../types';

const emptyForm: StudentFormValues = {
  studentNo: '',
  name: '',
  gender: 'other',
  phone: '',
  dorm: '',
  note: '',
};

function StudentForm({
  value,
  onChange,
}: {
  value: StudentFormValues;
  onChange: (value: StudentFormValues) => void;
}) {
  const set = <K extends keyof StudentFormValues>(key: K, next: StudentFormValues[K]) => {
    onChange({ ...value, [key]: next });
  };
  return (
    <div className="form-grid">
      <label className="field">
        <span>姓名 <b>*</b></span>
        <input autoFocus value={value.name} onChange={(event) => set('name', event.target.value)} placeholder="请输入学生姓名" />
      </label>
      <label className="field">
        <span>学号</span>
        <input value={value.studentNo} onChange={(event) => set('studentNo', event.target.value)} placeholder="例如 20230001" />
      </label>
      <label className="field">
        <span>性别</span>
        <select value={value.gender} onChange={(event) => set('gender', event.target.value as Gender)}>
          <option value="male">男</option>
          <option value="female">女</option>
          <option value="other">未填写</option>
        </select>
      </label>
      <label className="field">
        <span>手机号</span>
        <input value={value.phone} onChange={(event) => set('phone', event.target.value)} placeholder="选填" />
      </label>
      <label className="field">
        <span>宿舍</span>
        <input value={value.dorm} onChange={(event) => set('dorm', event.target.value)} placeholder="例如 梅园 3-201" />
      </label>
      <label className="field field-full">
        <span>备注</span>
        <textarea rows={3} value={value.note} onChange={(event) => set('note', event.target.value)} placeholder="班委、宿舍长或需要留意的情况" />
      </label>
    </div>
  );
}

export function StudentsPage() {
  const classes = useAppStore((state) => state.classes);
  const selectedClassId = useAppStore((state) => state.selectedClassId);
  const students = useAppStore((state) => state.students);
  const addStudent = useAppStore((state) => state.addStudent);
  const updateStudent = useAppStore((state) => state.updateStudent);
  const removeStudent = useAppStore((state) => state.removeStudent);
  const importStudents = useAppStore((state) => state.importStudents);
  const { showToast } = useToast();
  const classRoom = classes.find((item) => item.id === selectedClassId);
  const currentStudents = useMemo(
    () => students
      .filter((student) => student.classId === selectedClassId)
      .sort((a, b) => a.studentNo.localeCompare(b.studentNo, 'zh-CN', { numeric: true })),
    [students, selectedClassId],
  );

  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | Gender>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentFormValues>(emptyForm);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const filtered = currentStudents.filter((student) => {
    const keyword = search.trim().toLowerCase();
    const matchesSearch = !keyword
      || student.name.toLowerCase().includes(keyword)
      || student.studentNo.toLowerCase().includes(keyword)
      || student.dorm.toLowerCase().includes(keyword);
    const matchesGender = genderFilter === 'all' || student.gender === genderFilter;
    return matchesSearch && matchesGender;
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (student: Student) => {
    setEditing(student);
    setForm({
      studentNo: student.studentNo,
      name: student.name,
      gender: student.gender,
      phone: student.phone,
      dorm: student.dorm,
      note: student.note,
    });
    setFormOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      showToast('请填写学生姓名', 'error');
      return;
    }
    if (editing) {
      updateStudent(editing.id, form);
      showToast('学生信息已更新');
    } else {
      addStudent(form);
      showToast('学生已加入班级名单');
    }
    setFormOpen(false);
  };

  const confirmDelete = (student: Student) => {
    if (window.confirm(`确定从名单中删除「${student.name}」吗？相关点名和任务记录也会一并删除。`)) {
      removeStudent(student.id);
      showToast('已删除学生', 'info');
    }
  };

  const exportRoster = async () => {
    await saveFile(
      `${classRoom?.name ?? '班级'}-名单-${new Date().toISOString().slice(0, 10)}.csv`,
      buildStudentCsv(currentStudents),
      'text/csv;charset=utf-8',
    );
    showToast('名单 CSV 已生成');
  };

  const readImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportText(text);
    setImportFileName(file.name);
  };

  const confirmImport = () => {
    try {
      const rows = parseStudentCsv(importText);
      const count = importStudents(rows);
      if (count === 0) {
        showToast('没有导入新学生，请检查姓名列或重复学号', 'error');
        return;
      }
      showToast(`成功导入 ${count} 名学生`);
      setImportOpen(false);
      setImportText('');
      setImportFileName('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'CSV 解析失败', 'error');
    }
  };

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="ROSTER"
        title="班级名单"
        description={classRoom ? `${classRoom.name} · 共 ${currentStudents.length} 名学生` : '管理学生信息与班级成员'}
        actions={(
          <>
            <button className="button button-secondary" onClick={() => setImportOpen(true)}><Upload size={17} /> 导入 CSV</button>
            <button className="button button-secondary" onClick={exportRoster}><Download size={17} /> 导出名单</button>
            <button className="button button-primary" onClick={openAdd}><Plus size={18} /> 添加学生</button>
          </>
        )}
      />

      <section className="roster-toolbar panel">
        <div className="search-box">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索姓名、学号或宿舍" />
          {search && <button onClick={() => setSearch('')}>清除</button>}
        </div>
        <div className="filter-pills">
          <button className={genderFilter === 'all' ? 'active' : ''} onClick={() => setGenderFilter('all')}>全部 {currentStudents.length}</button>
          <button className={genderFilter === 'male' ? 'active' : ''} onClick={() => setGenderFilter('male')}>男生 {currentStudents.filter((item) => item.gender === 'male').length}</button>
          <button className={genderFilter === 'female' ? 'active' : ''} onClick={() => setGenderFilter('female')}>女生 {currentStudents.filter((item) => item.gender === 'female').length}</button>
        </div>
      </section>

      <section className="panel roster-panel">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<UsersRound size={28} />}
            title={currentStudents.length === 0 ? '还没有学生' : '没有匹配的学生'}
            description={currentStudents.length === 0 ? '添加学生或通过 CSV 导入班级名单。' : '尝试更换搜索关键词或筛选条件。'}
            action={currentStudents.length === 0
              ? <button className="button button-primary" onClick={openAdd}><Plus size={17} /> 添加第一名学生</button>
              : <button className="button button-secondary" onClick={() => { setSearch(''); setGenderFilter('all'); }}>清除筛选</button>}
          />
        ) : (
          <>
            <div className="roster-table-head">
              <span>学生</span><span>学号</span><span>性别</span><span>联系方式</span><span>宿舍</span><span>备注</span><span />
            </div>
            <div className="roster-table-body">
              {filtered.map((student, index) => (
                <div className="roster-row" key={student.id}>
                  <div className="student-identity">
                    <Avatar name={student.name} />
                    <span><strong>{student.name}</strong><small>第 {index + 1} 位</small></span>
                  </div>
                  <span className="mono-cell">{student.studentNo || '未填写'}</span>
                  <span>{student.gender === 'male' ? '男' : student.gender === 'female' ? '女' : '—'}</span>
                  <span>{student.phone || '—'}</span>
                  <span>{student.dorm || '—'}</span>
                  <span className="note-cell">{student.note || '—'}</span>
                  <div className="row-actions">
                    <button className="icon-button" onClick={() => openEdit(student)} aria-label={`编辑 ${student.name}`}><Pencil size={16} /></button>
                    <button className="icon-button danger" onClick={() => confirmDelete(student)} aria-label={`删除 ${student.name}`}><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <Modal
        open={formOpen}
        title={editing ? '编辑学生信息' : '添加学生'}
        description={editing ? '修改后的信息会立即同步到点名和任务列表。' : `将学生加入「${classRoom?.name ?? '当前班级'}」。`}
        onClose={() => setFormOpen(false)}
        footer={(
          <>
            <button className="button button-secondary" onClick={() => setFormOpen(false)}>取消</button>
            <button className="button button-primary" type="submit" form="student-form">{editing ? '保存修改' : '添加学生'}</button>
          </>
        )}
      >
        <form id="student-form" onSubmit={submit}>
          <StudentForm value={form} onChange={setForm} />
        </form>
      </Modal>

      <Modal
        open={importOpen}
        title="批量导入学生"
        description="支持从 Excel 另存为 CSV 后导入。需包含“姓名”列，推荐同时提供学号、性别、手机、宿舍和备注列。"
        onClose={() => setImportOpen(false)}
        footer={(
          <>
            <button className="button button-secondary" onClick={() => setImportOpen(false)}>取消</button>
            <button className="button button-primary" disabled={!importText} onClick={confirmImport}><FileSpreadsheet size={17} /> 开始导入</button>
          </>
        )}
      >
        <div className="import-area" onClick={() => importRef.current?.click()}>
          <input ref={importRef} type="file" accept=".csv,text/csv" hidden onChange={readImportFile} />
          <span className="import-icon"><Upload size={24} /></span>
          <strong>{importFileName || '选择 CSV 文件'}</strong>
          <p>{importFileName ? '文件已读取，点击下方按钮开始导入' : '点击选择文件，重复学号会自动跳过'}</p>
        </div>
        <div className="csv-hint">
          <UserRound size={17} />
          <span>表头示例：学号, 姓名, 性别, 手机, 宿舍, 备注</span>
        </div>
      </Modal>
    </div>
  );
}

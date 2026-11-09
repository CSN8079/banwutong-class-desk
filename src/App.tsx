import { useEffect, useState, type FormEvent } from 'react';
import { GraduationCap, Plus, ShieldCheck } from 'lucide-react';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { AttendancePage } from './pages/AttendancePage';
import { TasksPage } from './pages/TasksPage';
import { RecordsPage } from './pages/RecordsPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAppStore } from './store/useAppStore';
import type { PageKey } from './types';

const pages: PageKey[] = ['dashboard', 'students', 'attendance', 'tasks', 'records', 'settings'];

function pageFromHash(): PageKey {
  const value = window.location.hash.replace('#', '') as PageKey;
  return pages.includes(value) ? value : 'dashboard';
}

export default function App() {
  const classes = useAppStore((state) => state.classes);
  const students = useAppStore((state) => state.students);
  const tasks = useAppStore((state) => state.tasks);
  const selectedClassId = useAppStore((state) => state.selectedClassId);
  const setSelectedClass = useAppStore((state) => state.setSelectedClass);
  const addClass = useAppStore((state) => state.addClass);
  const [page, setPage] = useState<PageKey>(pageFromHash);
  const [className, setClassName] = useState('');
  const [grade, setGrade] = useState('');
  const [major, setMajor] = useState('');

  const classStudents = students.filter((student) => student.classId === selectedClassId && student.active);
  const activeTasks = tasks.filter((task) => task.classId === selectedClassId && task.status === 'open');
  const pendingTaskCount = activeTasks.filter((task) => {
    const completed = task.submissions.filter((submission) => submission.status === 'completed').length;
    return completed < classStudents.length;
  }).length;

  useEffect(() => {
    const handleHashChange = () => setPage(pageFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (nextPage: PageKey) => {
    setPage(nextPage);
    window.location.hash = nextPage;
  };

  const createFirstClass = (event: FormEvent) => {
    event.preventDefault();
    if (!className.trim()) return;
    addClass({
      name: className.trim(),
      grade: grade.trim() || '未设置年级',
      major: major.trim() || '未设置专业',
      advisor: '',
      color: '#1d7a5f',
    });
    navigate('students');
  };

  if (classes.length === 0) {
    return (
      <div className="onboarding-page">
        <section className="onboarding-card">
          <span className="onboarding-mark"><GraduationCap size={32} /></span>
          <span className="eyebrow">WELCOME TO CLASS DESK</span>
          <h1>先创建你的第一个班级</h1>
          <p>班务通会把点名、学生备注和材料收集整理在同一个本地工作台里。</p>
          <form onSubmit={createFirstClass}>
            <label className="field">
              <span>班级名称 <b>*</b></span>
              <input autoFocus value={className} onChange={(event) => setClassName(event.target.value)} placeholder="例如：计算机 2301 班" />
            </label>
            <div className="form-grid">
              <label className="field"><span>年级</span><input value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="例如：2023 级" /></label>
              <label className="field"><span>专业</span><input value={major} onChange={(event) => setMajor(event.target.value)} placeholder="例如：计算机科学与技术" /></label>
            </div>
            <button className="button button-primary onboarding-submit" type="submit"><Plus size={18} /> 创建班级并开始使用</button>
          </form>
          <div className="onboarding-privacy"><ShieldCheck size={16} /> 所有数据只保存在本机，无需注册账号</div>
        </section>
      </div>
    );
  }

  return (
    <Layout
      currentPage={page}
      onPageChange={navigate}
      classes={classes}
      selectedClassId={selectedClassId}
      onClassChange={setSelectedClass}
      pendingTaskCount={pendingTaskCount}
    >
      {page === 'dashboard' && <DashboardPage onNavigate={navigate} />}
      {page === 'students' && <StudentsPage />}
      {page === 'attendance' && <AttendancePage onNavigate={navigate} />}
      {page === 'tasks' && <TasksPage />}
      {page === 'records' && <RecordsPage onNavigate={navigate} />}
      {page === 'settings' && <SettingsPage />}
    </Layout>
  );
}

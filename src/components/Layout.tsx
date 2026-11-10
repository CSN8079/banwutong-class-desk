import {
  BookOpenCheck,
  CalendarCheck2,
  Check,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ClassRoom, PageKey } from '../types';
import { formatFullDate } from '../lib/format';

const navItems: Array<{ key: PageKey; label: string; shortLabel: string; icon: typeof LayoutDashboard }> = [
  { key: 'dashboard', label: '工作台', shortLabel: '首页', icon: LayoutDashboard },
  { key: 'students', label: '班级名单', shortLabel: '名单', icon: UsersRound },
  { key: 'attendance', label: '课堂点名', shortLabel: '点名', icon: CalendarCheck2 },
  { key: 'tasks', label: '任务收集', shortLabel: '任务', icon: ClipboardList },
  { key: 'records', label: '点名记录', shortLabel: '记录', icon: BookOpenCheck },
  { key: 'settings', label: '设置与数据', shortLabel: '设置', icon: Settings2 },
];


function ClassPicker({
  classes,
  selectedClassId,
  onClassChange,
  compact = false,
}: {
  classes: ClassRoom[];
  selectedClassId: string;
  onClassChange: (classId: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = classes.find((item) => item.id === selectedClassId) ?? classes[0];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className={`class-picker ${compact ? 'class-picker-compact' : ''}`} ref={rootRef}>
      <button className="class-picker-trigger" onClick={() => setOpen((value) => !value)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="class-picker-mark" style={{ background: selected?.color ?? '#1d7a5f' }} />
        <strong>{selected?.name ?? '请选择班级'}</strong>
        <ChevronDown size={15} className={open ? 'rotated' : ''} />
      </button>
      {open && (
        <div className="class-picker-menu" role="listbox" aria-label="选择班级">
          <span className="class-picker-caption">切换班级</span>
          {classes.map((item) => (
            <button
              key={item.id}
              role="option"
              aria-selected={item.id === selected?.id}
              className={item.id === selected?.id ? 'active' : ''}
              onClick={() => { onClassChange(item.id); setOpen(false); }}
            >
              <span className="class-picker-mark" style={{ background: item.color }} />
              <span><strong>{item.name}</strong><small>{item.grade} · {item.major}</small></span>
              {item.id === selected?.id && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface LayoutProps {
  children: ReactNode;
  currentPage: PageKey;
  onPageChange: (page: PageKey) => void;
  classes: ClassRoom[];
  selectedClassId: string;
  onClassChange: (classId: string) => void;
  pendingTaskCount: number;
}

export function Layout({
  children,
  currentPage,
  onPageChange,
  classes,
  selectedClassId,
  onClassChange,
  pendingTaskCount,
}: LayoutProps) {
  const activeClass = classes.find((item) => item.id === selectedClassId);
  const mobileItems = navItems.filter((item) => item.key !== 'records');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => onPageChange('dashboard')} aria-label="返回工作台">
          <span className="brand-mark"><GraduationCap size={24} /></span>
          <span className="brand-copy">
            <strong>班务通</strong>
            <small>CLASS DESK</small>
          </span>
        </button>

        <div className="sidebar-class">
          <span>当前班级</span>
          <ClassPicker classes={classes} selectedClassId={selectedClassId} onClassChange={onClassChange} />
          <p>{activeClass ? `${activeClass.grade} · ${activeClass.major}` : '尚未设置班级信息'}</p>
        </div>

        <nav className="side-nav" aria-label="主导航">
          <span className="nav-caption">班级管理</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={`nav-item ${currentPage === item.key ? 'active' : ''}`}
                onClick={() => onPageChange(item.key)}
              >
                <Icon size={19} strokeWidth={1.9} />
                <span>{item.label}</span>
                {item.key === 'tasks' && pendingTaskCount > 0 && <b className="nav-badge">{pendingTaskCount}</b>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="privacy-note">
            <ShieldCheck size={18} />
            <span><strong>数据仅保存在本机</strong><small>不上传云端，保护学生隐私</small></span>
          </div>
          <span className="version">班务通 v1.3.0</span>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark"><GraduationCap size={22} /></span>
            <strong>班务通</strong>
          </div>
          <div className="topbar-context">
            <span>{activeClass?.name ?? '未选择班级'}</span>
            <i />
            <span>{formatFullDate()}</span>
          </div>
          <div className="topbar-actions">
            <span className="local-pill"><ShieldCheck size={14} /> 本地模式</span>
            <ClassPicker classes={classes} selectedClassId={selectedClassId} onClassChange={onClassChange} compact />
          </div>
        </header>

        <main className="page-content">{children}</main>

        <nav className="mobile-nav" aria-label="移动端主导航">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={currentPage === item.key ? 'active' : ''}
                onClick={() => onPageChange(item.key)}
              >
                <span className="mobile-nav-icon">
                  <Icon size={21} strokeWidth={1.9} />
                  {item.key === 'tasks' && pendingTaskCount > 0 && <b>{pendingTaskCount}</b>}
                </span>
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

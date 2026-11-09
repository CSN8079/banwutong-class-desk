import type {
  AttendanceSession,
  AttendanceStatus,
  ClassRoom,
  CollectionTask,
  RemarkPreset,
  Student,
} from '../types';

export function isoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isoDateTime(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${isoDate(date)}T${hours}:${minutes}:${seconds}`;
}

export function endOfDay(date = new Date()): string {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 0);
  return isoDateTime(copy);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function createSeedData() {
  const now = new Date();
  const today = isoDate(now);
  const classId = 'class-demo-2301';
  const classes: ClassRoom[] = [
    {
      id: classId,
      name: '计算机 2301 班',
      grade: '2023 级',
      major: '计算机科学与技术',
      advisor: '辅导员',
      color: '#1d7a5f',
      createdAt: now.toISOString(),
    },
  ];

  const names = [
    '陈思远', '林晓雨', '周子航', '苏沐晴', '许嘉言', '赵一诺',
    '沈星河', '顾清禾', '陆景明', '唐安然', '江予辰', '宋知夏',
    '叶书宁', '程亦舟', '温以宁', '韩星野',
  ];
  const dorms = ['梅园 3-201', '梅园 3-202', '梅园 3-203', '梅园 3-204'];
  const students: Student[] = names.map((name, index) => ({
    id: `student-demo-${index + 1}`,
    classId,
    shortNo: String(index + 1).padStart(2, '0'),
    studentNo: `2023${String(index + 1).padStart(4, '0')}`,
    name,
    gender: index % 2 === 0 ? 'male' : 'female',
    phone: `1380000${String(1200 + index * 37).slice(-4)}`,
    dorm: dorms[index % dorms.length],
    bed: `${(index % 4) + 1} 号床`,
    note: index === 2 ? '班级学习委员' : index === 10 ? '宿舍长' : '',
    active: true,
    createdAt: now.toISOString(),
  }));

  const attendanceTemplate: AttendanceStatus[] = [
    'present', 'present', 'late', 'present', 'leave', 'present',
    'present', 'present', 'present', 'absent', 'present', 'present',
    'present', 'present', 'present', 'present',
  ];

  const todaySession: AttendanceSession = {
    id: 'session-demo-today',
    classId,
    date: today,
    title: '今日课堂点名',
    status: 'active',
    createdAt: now.toISOString(),
    records: students.map((student, index) => ({
      studentId: student.id,
      status: attendanceTemplate[index],
      note: attendanceTemplate[index] === 'late'
        ? '迟到 8 分钟，已提醒'
        : attendanceTemplate[index] === 'leave'
          ? '事假，已提交请假单'
          : attendanceTemplate[index] === 'absent'
            ? '暂未联系上，课后跟进'
            : '',
      images: [],
      updatedAt: now.toISOString(),
    })),
  };

  const yesterday = addDays(now, -1);
  const yesterdaySession: AttendanceSession = {
    id: 'session-demo-yesterday',
    classId,
    date: isoDate(yesterday),
    title: '昨日晚点名',
    status: 'completed',
    createdAt: yesterday.toISOString(),
    completedAt: yesterday.toISOString(),
    records: students.map((student, index) => ({
      studentId: student.id,
      status: index === 7 ? 'leave' : 'present',
      note: index === 7 ? '病假' : '',
      images: [],
      updatedAt: yesterday.toISOString(),
    })),
  };

  const submissions = (completedIndexes: number[], missingIndexes: number[]) =>
    students.map((student, index) => {
      if (completedIndexes.includes(index)) {
        return {
          studentId: student.id,
          status: 'completed' as const,
          note: index === 0 ? '周报内容完整，已检查' : '',
          attachments: [],
          updatedAt: now.toISOString(),
        };
      }
      if (missingIndexes.includes(index)) {
        return {
          studentId: student.id,
          status: 'missing' as const,
          note: index === 4 ? '已提醒，仍未提交' : '',
          attachments: [],
          updatedAt: now.toISOString(),
        };
      }
      return {
        studentId: student.id,
        status: 'pending' as const,
        note: '',
        attachments: [],
        updatedAt: now.toISOString(),
      };
    });

  const tasks: CollectionTask[] = [
    {
      id: 'task-demo-weekly',
      classId,
      title: '第 10 周实践周报',
      description: '提交本周实践周报截图或 PDF 首页照片，文件需清晰可读。',
      dueDate: endOfDay(now),
      status: 'open',
      createdAt: now.toISOString(),
      submissions: submissions([0, 1, 3, 5, 6, 8, 10, 11, 12, 14], [2, 4, 7]),
    },
    {
      id: 'task-demo-safety',
      classId,
      title: '安全教育学习截图',
      description: '完成安全教育平台课程后，提交完成页面截图。',
      dueDate: endOfDay(addDays(now, 2)),
      status: 'open',
      createdAt: now.toISOString(),
      submissions: submissions([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], []),
    },
  ];

  const presets: RemarkPreset[] = [
    { id: 'preset-leave', label: '请假', text: '已请假，情况已登记', status: 'leave', color: '#4f7cac' },
    { id: 'preset-late', label: '迟到', text: '迟到，已提醒', status: 'late', color: '#c88925' },
    { id: 'preset-sick', label: '病假', text: '病假，已提交请假凭证', status: 'leave', color: '#8a6bb5' },
    { id: 'preset-family', label: '已联系', text: '已联系本人并确认情况', color: '#1d7a5f' },
    { id: 'preset-absent', label: '旷课', text: '未到且未请假，待跟进', status: 'absent', color: '#c34f4f' },
    { id: 'preset-late10', label: '迟到 10 分钟', text: '迟到 10 分钟，已提醒', status: 'late', color: '#c88925' },
  ];

  return {
    classes,
    students,
    sessions: [todaySession, yesterdaySession],
    tasks,
    presets,
    selectedClassId: classId,
  };
}

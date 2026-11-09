import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSeedData, isoDate } from '../data/seed';
import { createId } from '../lib/id';
import type {
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  BackupData,
  ClassFormValues,
  ClassRoom,
  CollectionTask,
  ImportStudentsOptions,
  RemarkPreset,
  Student,
  StudentFormValues,
  SubmissionStatus,
  TaskAttachment,
} from '../types';

interface AppStore {
  classes: ClassRoom[];
  students: Student[];
  sessions: AttendanceSession[];
  tasks: CollectionTask[];
  presets: RemarkPreset[];
  selectedClassId: string;

  setSelectedClass: (classId: string) => void;
  addClass: (values: ClassFormValues) => ClassRoom;
  updateClass: (id: string, values: ClassFormValues) => void;
  deleteClass: (id: string) => void;

  addStudent: (values: StudentFormValues) => Student;
  updateStudent: (id: string, values: StudentFormValues) => void;
  removeStudent: (id: string) => void;
  importStudents: (rows: StudentFormValues[], options?: ImportStudentsOptions) => number;

  createSession: (classId: string, date: string, title: string) => AttendanceSession;
  setAttendance: (sessionId: string, studentId: string, status: AttendanceStatus, note?: string) => void;
  bulkAttendance: (sessionId: string, status: AttendanceStatus) => void;
  addAttendanceAttachment: (sessionId: string, studentId: string, attachment: TaskAttachment) => void;
  removeAttendanceAttachment: (sessionId: string, studentId: string, attachmentId: string) => void;
  completeSession: (sessionId: string) => void;

  addTask: (input: { title: string; description: string; dueDate: string }) => CollectionTask;
  updateTask: (id: string, patch: Partial<Pick<CollectionTask, 'title' | 'description' | 'dueDate' | 'status'>>) => void;
  deleteTask: (id: string) => void;
  setSubmissionStatus: (taskId: string, studentId: string, status: SubmissionStatus) => void;
  setSubmissionStatusBulk: (taskId: string, studentIds: string[], status: SubmissionStatus) => void;
  setSubmissionNote: (taskId: string, studentId: string, note: string) => void;
  addAttachment: (taskId: string, studentId: string, attachment: TaskAttachment) => void;
  removeAttachment: (taskId: string, studentId: string, attachmentId: string) => void;

  updatePreset: (preset: RemarkPreset) => void;
  addPreset: (preset: Omit<RemarkPreset, 'id'>) => void;
  removePreset: (id: string) => void;

  restoreBackup: (data: BackupData) => void;
  clearBusinessData: () => void;
  resetDemoData: () => void;
}

const seed = createSeedData();

function nowIso() {
  return new Date().toISOString();
}

function normalizeNo(value: string) {
  return value.trim().toLocaleLowerCase();
}

function numericShortNo(value: string): number | null {
  const text = value.trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

function nextShortNo(students: Student[], classId: string): string {
  const classStudents = students.filter((student) => student.classId === classId);
  const numericValues = classStudents
    .map((student) => numericShortNo(student.shortNo))
    .filter((value): value is number => value !== null);
  const max = numericValues.length > 0 ? Math.max(...numericValues) : 0;
  const width = Math.max(
    2,
    ...classStudents.map((student) => student.shortNo.trim().length).filter((length) => length > 0),
  );
  return String(max + 1).padStart(width, '0');
}

type LegacyStudent = Omit<Student, 'shortNo' | 'bed'> & Partial<Pick<Student, 'shortNo' | 'bed'>>;
type LegacyRecord = Omit<AttendanceRecord, 'images'> & { images?: TaskAttachment[] };
type LegacySession = Omit<AttendanceSession, 'title' | 'records'> & {
  title?: string;
  topic?: string;
  records: LegacyRecord[];
};

function normalizeStudents(input: LegacyStudent[]): Student[] {
  const counters = new Map<string, number>();
  const widthByClass = new Map<string, number>();
  for (const student of input) {
    const numeric = numericShortNo(student.shortNo ?? '');
    if (numeric !== null) {
      counters.set(student.classId, Math.max(counters.get(student.classId) ?? 0, numeric));
    }
    widthByClass.set(
      student.classId,
      Math.max(widthByClass.get(student.classId) ?? 2, (student.shortNo ?? '').trim().length),
    );
  }
  return input.map((student) => {
    let shortNo = student.shortNo?.trim() ?? '';
    if (!shortNo) {
      const next = (counters.get(student.classId) ?? 0) + 1;
      counters.set(student.classId, next);
      shortNo = String(next).padStart(widthByClass.get(student.classId) ?? 2, '0');
    }
    return {
      ...student,
      shortNo,
      bed: student.bed?.trim() ?? '',
    };
  });
}

function normalizeSessions(input: LegacySession[]): AttendanceSession[] {
  return input.map((session) => ({
    ...session,
    title: session.title?.trim() || session.topic?.trim() || '课堂点名',
    records: session.records.map((record) => ({
      ...record,
      images: record.images ?? [],
    })),
  }));
}

function normalizeTasks(input: CollectionTask[]): CollectionTask[] {
  return input.map((task) => ({
    ...task,
    dueDate: task.dueDate.includes('T') ? task.dueDate : `${task.dueDate}T23:59:59`,
  }));
}

function patchSubmission(
  tasks: CollectionTask[],
  taskId: string,
  studentId: string,
  updater: (submission: CollectionTask['submissions'][number]) => CollectionTask['submissions'][number],
) {
  return tasks.map((task) => task.id === taskId
    ? {
        ...task,
        submissions: task.submissions.map((submission) => submission.studentId === studentId
          ? updater(submission)
          : submission),
      }
    : task);
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      classes: seed.classes,
      students: seed.students,
      sessions: seed.sessions,
      tasks: seed.tasks,
      presets: seed.presets,
      selectedClassId: seed.selectedClassId,

      setSelectedClass: (classId) => set({ selectedClassId: classId }),

      addClass: (values) => {
        const newClass: ClassRoom = {
          ...values,
          id: createId('class'),
          createdAt: nowIso(),
        };
        set((state) => ({
          classes: [...state.classes, newClass],
          selectedClassId: newClass.id,
        }));
        return newClass;
      },

      updateClass: (id, values) => set((state) => ({
        classes: state.classes.map((item) => item.id === id ? { ...item, ...values } : item),
      })),

      deleteClass: (id) => set((state) => {
        const classes = state.classes.filter((item) => item.id !== id);
        return {
          classes,
          students: state.students.filter((item) => item.classId !== id),
          sessions: state.sessions.filter((item) => item.classId !== id),
          tasks: state.tasks.filter((item) => item.classId !== id),
          selectedClassId: state.selectedClassId === id ? (classes[0]?.id ?? '') : state.selectedClassId,
        };
      }),

      addStudent: (values) => {
        const { selectedClassId, students, tasks } = get();
        const student: Student = {
          ...values,
          shortNo: values.shortNo.trim() || nextShortNo(students, selectedClassId),
          bed: values.bed.trim(),
          id: createId('student'),
          classId: selectedClassId,
          active: true,
          createdAt: nowIso(),
        };
        set((state) => ({
          students: [...state.students, student],
          tasks: tasks.map((task) => task.classId === selectedClassId
            ? {
                ...task,
                submissions: [
                  ...task.submissions,
                  { studentId: student.id, status: 'pending', note: '', attachments: [], updatedAt: nowIso() },
                ],
              }
            : task),
        }));
        return student;
      },

      updateStudent: (id, values) => set((state) => ({
        students: state.students.map((item) => item.id === id ? { ...item, ...values } : item),
      })),

      removeStudent: (id) => set((state) => ({
        students: state.students.filter((item) => item.id !== id),
        sessions: state.sessions.map((session) => ({
          ...session,
          records: session.records.filter((record) => record.studentId !== id),
        })),
        tasks: state.tasks.map((task) => ({
          ...task,
          submissions: task.submissions.filter((submission) => submission.studentId !== id),
        })),
      })),

      importStudents: (rows, options) => {
        const { selectedClassId, students, tasks } = get();
        const classStudents = students.filter((item) => item.classId === selectedClassId);
        const existingNumbers = new Set(classStudents.map((item) => normalizeNo(item.studentNo)));
        const created: Student[] = [];
        let workingStudents = [...students];

        for (const row of rows) {
          const key = normalizeNo(row.studentNo || row.name);
          if (!row.name.trim() || (row.studentNo && existingNumbers.has(key))) continue;
          if (row.studentNo) existingNumbers.add(key);
          const automaticShortNo = nextShortNo(workingStudents, selectedClassId);
          const tailShortNo = row.studentNo.trim().slice(-4);
          const shortNo = row.shortNo.trim()
            || (options?.shortNoFromStudentNo && tailShortNo
              ? tailShortNo
              : automaticShortNo);
          const student: Student = {
            ...row,
            shortNo,
            bed: row.bed.trim(),
            id: createId('student'),
            classId: selectedClassId,
            active: true,
            createdAt: nowIso(),
          };
          created.push(student);
          workingStudents = [...workingStudents, student];
        }

        if (created.length === 0) return 0;
        set((state) => ({
          students: [...state.students, ...created],
          tasks: tasks.map((task) => task.classId === selectedClassId
            ? {
                ...task,
                submissions: [
                  ...task.submissions,
                  ...created.map((student) => ({
                    studentId: student.id,
                    status: 'pending' as const,
                    note: '',
                    attachments: [],
                    updatedAt: nowIso(),
                  })),
                ],
              }
            : task),
        }));
        return created.length;
      },

      createSession: (classId, date, title) => {
        const session: AttendanceSession = {
          id: createId('session'),
          classId,
          date,
          title: title.trim() || '课堂点名',
          status: 'active',
          createdAt: nowIso(),
          records: get().students
            .filter((student) => student.classId === classId && student.active)
            .map((student) => ({
              studentId: student.id,
              status: 'unmarked',
              note: '',
              images: [],
              updatedAt: nowIso(),
            })),
        };
        set((state) => ({ sessions: [session, ...state.sessions] }));
        return session;
      },

      setAttendance: (sessionId, studentId, status, note) => set((state) => ({
        sessions: state.sessions.map((session) => {
          if (session.id !== sessionId) return session;
          const record = session.records.find((entry) => entry.studentId === studentId);
          const nextRecord: AttendanceRecord = record
            ? { ...record, status, note: note ?? record.note, updatedAt: nowIso() }
            : { studentId, status, note: note ?? '', images: [], updatedAt: nowIso() };
          return {
            ...session,
            status: 'active',
            completedAt: undefined,
            records: record
              ? session.records.map((entry) => entry.studentId === studentId ? nextRecord : entry)
              : [...session.records, nextRecord],
          };
        }),
      })),

      bulkAttendance: (sessionId, status) => {
        const session = get().sessions.find((item) => item.id === sessionId);
        if (!session) return;
        const activeStudents = get().students.filter(
          (student) => student.classId === session.classId && student.active,
        );
        set((state) => ({
          sessions: state.sessions.map((item) => {
            if (item.id !== sessionId) return item;
            const existing = new Map(item.records.map((record) => [record.studentId, record]));
            return {
              ...item,
              status: 'active',
              completedAt: undefined,
              records: activeStudents.map((student) => {
                const record = existing.get(student.id);
                return record
                  ? { ...record, status, updatedAt: nowIso() }
                  : { studentId: student.id, status, note: '', images: [], updatedAt: nowIso() };
              }),
            };
          }),
        }));
      },

      addAttendanceAttachment: (sessionId, studentId, attachment) => set((state) => ({
        sessions: state.sessions.map((session) => session.id === sessionId ? {
          ...session,
          records: session.records.map((record) => record.studentId === studentId
            ? { ...record, images: [...record.images, attachment], updatedAt: nowIso() }
            : record),
        } : session),
      })),

      removeAttendanceAttachment: (sessionId, studentId, attachmentId) => set((state) => ({
        sessions: state.sessions.map((session) => session.id === sessionId ? {
          ...session,
          records: session.records.map((record) => record.studentId === studentId
            ? { ...record, images: record.images.filter((image) => image.id !== attachmentId), updatedAt: nowIso() }
            : record),
        } : session),
      })),

      completeSession: (sessionId) => set((state) => ({
        sessions: state.sessions.map((session) => session.id === sessionId
          ? { ...session, status: 'completed', completedAt: nowIso() }
          : session),
      })),

      addTask: (input) => {
        const { selectedClassId, students } = get();
        const task: CollectionTask = {
          id: createId('task'),
          classId: selectedClassId,
          title: input.title,
          description: input.description,
          dueDate: input.dueDate,
          status: 'open',
          createdAt: nowIso(),
          submissions: students
            .filter((student) => student.classId === selectedClassId && student.active)
            .map((student) => ({
              studentId: student.id,
              status: 'pending',
              note: '',
              attachments: [],
              updatedAt: nowIso(),
            })),
        };
        set((state) => ({ tasks: [task, ...state.tasks] }));
        return task;
      },

      updateTask: (id, patch) => set((state) => ({
        tasks: state.tasks.map((task) => task.id === id ? { ...task, ...patch } : task),
      })),

      deleteTask: (id) => set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),

      setSubmissionStatus: (taskId, studentId, status) => set((state) => ({
        tasks: patchSubmission(state.tasks, taskId, studentId, (submission) => ({
          ...submission,
          status,
          updatedAt: nowIso(),
        })),
      })),

      setSubmissionStatusBulk: (taskId, studentIds, status) => {
        const ids = new Set(studentIds);
        set((state) => ({
          tasks: state.tasks.map((task) => task.id === taskId ? {
            ...task,
            submissions: task.submissions.map((submission) => ids.has(submission.studentId)
              ? { ...submission, status, updatedAt: nowIso() }
              : submission),
          } : task),
        }));
      },

      setSubmissionNote: (taskId, studentId, note) => set((state) => ({
        tasks: patchSubmission(state.tasks, taskId, studentId, (submission) => ({
          ...submission,
          note,
          updatedAt: nowIso(),
        })),
      })),

      addAttachment: (taskId, studentId, attachment) => set((state) => ({
        tasks: patchSubmission(state.tasks, taskId, studentId, (submission) => ({
          ...submission,
          attachments: [...submission.attachments, attachment],
          status: 'completed',
          updatedAt: nowIso(),
        })),
      })),

      removeAttachment: (taskId, studentId, attachmentId) => set((state) => ({
        tasks: patchSubmission(state.tasks, taskId, studentId, (submission) => ({
          ...submission,
          attachments: submission.attachments.filter((item) => item.id !== attachmentId),
          updatedAt: nowIso(),
        })),
      })),

      updatePreset: (preset) => set((state) => ({
        presets: state.presets.map((item) => item.id === preset.id ? preset : item),
      })),

      addPreset: (preset) => set((state) => ({
        presets: [...state.presets, { ...preset, id: createId('preset') }],
      })),

      removePreset: (id) => set((state) => ({
        presets: state.presets.filter((item) => item.id !== id),
      })),

      restoreBackup: (data) => set({
        classes: data.classes,
        students: normalizeStudents(data.students),
        sessions: normalizeSessions(data.sessions),
        tasks: normalizeTasks(data.tasks),
        presets: data.presets,
        selectedClassId: data.classes[0]?.id ?? '',
      }),

      clearBusinessData: () => set((state) => ({
        students: [],
        sessions: [],
        tasks: [],
        selectedClassId: state.classes[0]?.id ?? '',
      })),

      resetDemoData: () => {
        const next = createSeedData();
        set({
          classes: next.classes,
          students: next.students,
          sessions: next.sessions,
          tasks: next.tasks,
          presets: next.presets,
          selectedClassId: next.selectedClassId,
        });
      },
    }),
    {
      name: 'banwutong-data-v1',
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as Partial<AppStore> & {
          students?: LegacyStudent[];
          sessions?: LegacySession[];
          tasks?: CollectionTask[];
        };
        return {
          ...state,
          students: normalizeStudents(state.students ?? []),
          sessions: normalizeSessions(state.sessions ?? []),
          tasks: normalizeTasks(state.tasks ?? []),
        } as AppStore;
      },
      partialize: (state) => ({
        classes: state.classes,
        students: state.students,
        sessions: state.sessions,
        tasks: state.tasks,
        presets: state.presets,
        selectedClassId: state.selectedClassId,
      }),
    },
  ),
);

export function getTodaySessions(classId: string) {
  return useAppStore.getState().sessions.filter(
    (session) => session.classId === classId && session.date === isoDate(),
  );
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSeedData, isoDate } from '../data/seed';
import { createId } from '../lib/id';
import type {
  AttendanceSession,
  AttendanceStatus,
  BackupData,
  ClassFormValues,
  ClassRoom,
  CollectionTask,
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
  importStudents: (rows: StudentFormValues[]) => number;

  ensureSession: (classId: string, date: string) => AttendanceSession;
  setAttendance: (
    classId: string,
    date: string,
    studentId: string,
    status: AttendanceStatus,
    note?: string,
  ) => void;
  bulkAttendance: (classId: string, date: string, status: AttendanceStatus) => void;
  completeSession: (sessionId: string) => void;

  addTask: (input: { title: string; description: string; dueDate: string }) => CollectionTask;
  updateTask: (id: string, patch: Partial<Pick<CollectionTask, 'title' | 'description' | 'dueDate' | 'status'>>) => void;
  deleteTask: (id: string) => void;
  setSubmissionStatus: (taskId: string, studentId: string, status: SubmissionStatus) => void;
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
        const { selectedClassId, tasks } = get();
        const student: Student = {
          ...values,
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

      importStudents: (rows) => {
        const { selectedClassId, students, tasks } = get();
        const existingNumbers = new Set(
          students.filter((item) => item.classId === selectedClassId).map((item) => normalizeNo(item.studentNo)),
        );
        const created: Student[] = [];
        for (const row of rows) {
          const key = normalizeNo(row.studentNo || row.name);
          if (!row.name.trim() || existingNumbers.has(key)) continue;
          existingNumbers.add(key);
          created.push({
            ...row,
            id: createId('student'),
            classId: selectedClassId,
            active: true,
            createdAt: nowIso(),
          });
        }
        if (created.length === 0) return 0;
        const idSet = new Set(created.map((item) => item.id));
        set((state) => ({
          students: [...state.students, ...created],
          tasks: tasks.map((task) => task.classId === selectedClassId
            ? {
                ...task,
                submissions: [
                  ...task.submissions,
                  ...created.filter((student) => idSet.has(student.id)).map((student) => ({
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

      ensureSession: (classId, date) => {
        const existing = get().sessions.find(
          (session) => session.classId === classId && session.date === date,
        );
        if (existing) return existing;
        const session: AttendanceSession = {
          id: createId('session'),
          classId,
          date,
          topic: '课堂点名',
          status: 'active',
          createdAt: nowIso(),
          records: get().students
            .filter((student) => student.classId === classId && student.active)
            .map((student) => ({
              studentId: student.id,
              status: 'unmarked',
              note: '',
              updatedAt: nowIso(),
            })),
        };
        set((state) => ({ sessions: [session, ...state.sessions] }));
        return session;
      },

      setAttendance: (classId, date, studentId, status, note) => {
        const session = get().ensureSession(classId, date);
        set((state) => ({
          sessions: state.sessions.map((item) => {
            if (item.id !== session.id) return item;
            const record = item.records.find((entry) => entry.studentId === studentId);
            const nextRecord = record
              ? { ...record, status, note: note ?? record.note, updatedAt: nowIso() }
              : { studentId, status, note: note ?? '', updatedAt: nowIso() };
            return {
              ...item,
              status: 'active',
              completedAt: undefined,
              records: record
                ? item.records.map((entry) => entry.studentId === studentId ? nextRecord : entry)
                : [...item.records, nextRecord],
            };
          }),
        }));
      },

      bulkAttendance: (classId, date, status) => {
        const session = get().ensureSession(classId, date);
        const activeIds = new Set(
          get().students.filter((student) => student.classId === classId && student.active).map((student) => student.id),
        );
        set((state) => ({
          sessions: state.sessions.map((item) => item.id === session.id ? {
            ...item,
            status: 'active',
            completedAt: undefined,
            records: item.records.map((record) => activeIds.has(record.studentId)
              ? { ...record, status, updatedAt: nowIso() }
              : record),
          } : item),
        }));
      },

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
        tasks: state.tasks.map((task) => task.id === taskId ? {
          ...task,
          submissions: task.submissions.map((submission) => submission.studentId === studentId
            ? { ...submission, status, updatedAt: nowIso() }
            : submission),
        } : task),
      })),

      setSubmissionNote: (taskId, studentId, note) => set((state) => ({
        tasks: state.tasks.map((task) => task.id === taskId ? {
          ...task,
          submissions: task.submissions.map((submission) => submission.studentId === studentId
            ? { ...submission, note, updatedAt: nowIso() }
            : submission),
        } : task),
      })),

      addAttachment: (taskId, studentId, attachment) => set((state) => ({
        tasks: state.tasks.map((task) => task.id === taskId ? {
          ...task,
          submissions: task.submissions.map((submission) => submission.studentId === studentId ? {
            ...submission,
            attachments: [...submission.attachments, attachment],
            status: 'completed',
            updatedAt: nowIso(),
          } : submission),
        } : task),
      })),

      removeAttachment: (taskId, studentId, attachmentId) => set((state) => ({
        tasks: state.tasks.map((task) => task.id === taskId ? {
          ...task,
          submissions: task.submissions.map((submission) => submission.studentId === studentId ? {
            ...submission,
            attachments: submission.attachments.filter((item) => item.id !== attachmentId),
            updatedAt: nowIso(),
          } : submission),
        } : task),
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
        students: data.students,
        sessions: data.sessions,
        tasks: data.tasks,
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
      version: 1,
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

export function getTodaySession(classId: string) {
  return useAppStore.getState().sessions.find(
    (session) => session.classId === classId && session.date === isoDate(),
  );
}

export type PageKey =
  | 'dashboard'
  | 'students'
  | 'attendance'
  | 'tasks'
  | 'records'
  | 'settings';

export interface ClassRoom {
  id: string;
  name: string;
  grade: string;
  major: string;
  advisor: string;
  color: string;
  createdAt: string;
}

export type Gender = 'male' | 'female' | 'other';

export interface Student {
  id: string;
  classId: string;
  shortNo: string;
  studentNo: string;
  name: string;
  gender: Gender;
  phone: string;
  dorm: string;
  bed: string;
  note: string;
  active: boolean;
  createdAt: string;
}

export type AttendanceStatus = 'unmarked' | 'present' | 'late' | 'leave' | 'absent';

export interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  note: string;
  images: TaskAttachment[];
  updatedAt: string;
}

export interface AttendanceSession {
  id: string;
  classId: string;
  date: string;
  title: string;
  records: AttendanceRecord[];
  status: 'active' | 'completed';
  createdAt: string;
  completedAt?: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export type SubmissionStatus = 'pending' | 'completed' | 'missing';

export interface TaskSubmission {
  studentId: string;
  status: SubmissionStatus;
  note: string;
  attachments: TaskAttachment[];
  updatedAt: string;
}

export interface CollectionTask {
  id: string;
  classId: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'open' | 'closed';
  submissions: TaskSubmission[];
  createdAt: string;
}

export interface RemarkPreset {
  id: string;
  label: string;
  text: string;
  status?: AttendanceStatus;
  color: string;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  classes: ClassRoom[];
  students: Student[];
  sessions: AttendanceSession[];
  tasks: CollectionTask[];
  presets: RemarkPreset[];
  media?: Record<string, string>;
}

export interface StudentFormValues {
  shortNo: string;
  studentNo: string;
  name: string;
  gender: Gender;
  phone: string;
  dorm: string;
  bed: string;
  note: string;
}

export interface ClassFormValues {
  name: string;
  grade: string;
  major: string;
  advisor: string;
  color: string;
}

export interface ImportStudentsOptions {
  shortNoFromStudentNo?: boolean;
}

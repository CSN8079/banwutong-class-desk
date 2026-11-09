import { useMemo, useState } from 'react';
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Search,
  UsersRound,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useToast } from '../components/toast-context';
import { Avatar, EmptyState, Modal, PageHeading, Tag } from '../components/ui';
import { attendanceLabels, formatDateChinese, formatDateTime, percent } from '../lib/format';
import { buildAttendanceCsv } from '../lib/exports';
import { saveFile } from '../lib/download';
import { buildCsv } from '../lib/csv';
import type { AttendanceSession, PageKey } from '../types';

interface RecordsPageProps {
  onNavigate: (page: PageKey) => void;
}

export function RecordsPage({ onNavigate }: RecordsPageProps) {
  const classes = useAppStore((state) => state.classes);
  const selectedClassId = useAppStore((state) => state.selectedClassId);
  const allStudents = useAppStore((state) => state.students);
  const sessions = useAppStore((state) => state.sessions);
  const { showToast } = useToast();
  const classRoom = classes.find((item) => item.id === selectedClassId);
  const students = useMemo(
    () => allStudents.filter((student) => student.classId === selectedClassId && student.active),
    [allStudents, selectedClassId],
  );
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const classSessions = useMemo(
    () => sessions
      .filter((session) => session.classId === selectedClassId)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [sessions, selectedClassId],
  );
  const [filter, setFilter] = useState<'all' | 'completed' | 'active'>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<AttendanceSession | null>(null);

  const visibleSessions = classSessions.filter((session) => {
    const matchesFilter = filter === 'all' || session.status === filter;
    const matchesSearch = !search.trim() || session.date.includes(search.trim()) || session.topic.includes(search.trim());
    return matchesFilter && matchesSearch;
  });

  const totalMarked = classSessions.reduce(
    (sum, session) => sum + session.records.filter((record) => record.status !== 'unmarked').length,
    0,
  );
  const totalPresent = classSessions.reduce(
    (sum, session) => sum + session.records.filter((record) => ['present', 'late'].includes(record.status)).length,
    0,
  );

  const exportHistory = async () => {
    const rows: unknown[][] = [];
    classSessions.forEach((session) => {
      const map = new Map(session.records.map((record) => [record.studentId, record]));
      students.forEach((student) => {
        const record = map.get(student.id);
        rows.push([
          session.date,
          classRoom?.name ?? '',
          session.topic,
          student.studentNo,
          student.name,
          attendanceLabels[record?.status ?? 'unmarked'],
          record?.note ?? '',
        ]);
      });
    });
    await saveFile(
      `${classRoom?.name ?? '班级'}-点名历史-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCsv(['日期', '班级', '场次', '学号', '姓名', '状态', '备注'], rows),
      'text/csv;charset=utf-8',
    );
    showToast('点名历史 CSV 已生成');
  };

  const exportSession = async (session: AttendanceSession) => {
    await saveFile(
      `${classRoom?.name ?? '班级'}-${session.date}-${session.topic}.csv`,
      buildAttendanceCsv(session, students, classRoom),
      'text/csv;charset=utf-8',
    );
    showToast('场次记录已导出');
  };

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="HISTORY"
        title="点名记录"
        description="按日期回看每次点名结果、备注与出勤统计。"
        actions={(
          <>
            <button className="button button-secondary" onClick={exportHistory}><Download size={17} /> 导出全部</button>
            <button className="button button-primary" onClick={() => onNavigate('attendance')}><CalendarCheck2 size={17} /> 去点名</button>
          </>
        )}
      />

      <section className="record-summary-grid">
        <article className="record-summary-card"><span className="record-icon"><FileText size={20} /></span><div><span>点名场次</span><strong>{classSessions.length}</strong></div></article>
        <article className="record-summary-card"><span className="record-icon"><UsersRound size={20} /></span><div><span>累计记录</span><strong>{totalMarked}</strong></div></article>
        <article className="record-summary-card"><span className="record-icon"><CheckCircle2 size={20} /></span><div><span>综合出勤率</span><strong>{percent(totalPresent, totalMarked)}%</strong></div></article>
      </section>

      <section className="record-toolbar panel">
        <div className="search-box">
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索日期或场次名称" />
          {search && <button onClick={() => setSearch('')}>清除</button>}
        </div>
        <div className="filter-pills">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部</button>
          <button className={filter === 'completed' ? 'active' : ''} onClick={() => setFilter('completed')}>已完成</button>
          <button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>进行中</button>
        </div>
      </section>

      <section className="panel records-panel">
        {visibleSessions.length === 0 ? (
          <EmptyState icon={<CalendarCheck2 size={29} />} title="暂无点名记录" description="完成一次点名后，记录会出现在这里。" action={<button className="button button-primary" onClick={() => onNavigate('attendance')}>开始点名</button>} />
        ) : (
          <div className="record-list">
            {visibleSessions.map((session) => {
              const present = session.records.filter((record) => ['present', 'late'].includes(record.status)).length;
              const leave = session.records.filter((record) => record.status === 'leave').length;
              const absent = session.records.filter((record) => record.status === 'absent').length;
              const unmarked = session.records.filter((record) => record.status === 'unmarked').length;
              return (
                <button className="record-row" key={session.id} onClick={() => setDetail(session)}>
                  <div className="record-date">
                    <strong>{Number(session.date.slice(8, 10))}</strong>
                    <span>{session.date.slice(0, 7)}</span>
                  </div>
                  <div className="record-main">
                    <div className="record-title-line"><strong>{session.topic}</strong><Tag tone={session.status === 'completed' ? 'green' : 'amber'}>{session.status === 'completed' ? '已完成' : '进行中'}</Tag></div>
                    <span>{formatDateChinese(session.date)} · {session.records.length} 名学生的点名记录</span>
                  </div>
                  <div className="record-counts">
                    <span className="record-present">实到 {present}</span>
                    <span className="record-leave">请假 {leave}</span>
                    <span className="record-absent">缺勤 {absent}</span>
                    {unmarked > 0 && <span>未点 {unmarked}</span>}
                  </div>
                  <ChevronRight size={19} className="record-chevron" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      <Modal
        open={Boolean(detail)}
        title={detail ? `${formatDateChinese(detail.date)} · ${detail.topic}` : '点名详情'}
        description={detail ? `记录于 ${formatDateTime(detail.createdAt)} · ${detail.status === 'completed' ? '已完成归档' : '进行中'}` : ''}
        onClose={() => setDetail(null)}
        width="lg"
        footer={(
          <>
            <button className="button button-secondary" onClick={() => setDetail(null)}>关闭</button>
            <button className="button button-primary" onClick={() => detail && exportSession(detail)}><Download size={16} /> 导出本场</button>
          </>
        )}
      >
        {detail && (
          <>
            <div className="record-detail-summary">
              {([
                ['出勤', detail.records.filter((record) => record.status === 'present').length, '#1d7a5f'],
                ['迟到', detail.records.filter((record) => record.status === 'late').length, '#c88925'],
                ['请假', detail.records.filter((record) => record.status === 'leave').length, '#4f7cac'],
                ['缺勤', detail.records.filter((record) => record.status === 'absent').length, '#c34f4f'],
                ['未点名', detail.records.filter((record) => record.status === 'unmarked').length, '#9aa69f'],
              ] as const).map(([label, count, color]) => (
                <div key={label}><i style={{ background: color }} /><span>{label}</span><strong>{count}</strong></div>
              ))}
            </div>
            <div className="record-detail-list">
              {detail.records.map((record) => {
                const student = studentMap.get(record.studentId);
                if (!student) return null;
                return (
                  <div className="record-detail-row" key={record.studentId}>
                    <Avatar name={student.name} size="sm" />
                    <div className="record-detail-student"><strong>{student.name}</strong><span>{student.studentNo}</span></div>
                    <span className={`status-dot status-${record.status}`}>{attendanceLabels[record.status]}</span>
                    <span className="record-detail-note">{record.note || '无备注'}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

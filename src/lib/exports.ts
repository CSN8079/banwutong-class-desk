import { buildCsv } from './csv';
import { blobToDataUrl, getImage } from './imageStore';
import { attendanceLabels, submissionLabels, formatDateChinese } from './format';
import type { AttendanceSession, ClassRoom, CollectionTask, Student } from '../types';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function buildStudentCsv(students: Student[]): string {
  return buildCsv(
    ['学号', '姓名', '性别', '手机', '宿舍', '备注'],
    students.map((student) => [
      student.studentNo,
      student.name,
      student.gender === 'male' ? '男' : student.gender === 'female' ? '女' : '其他',
      student.phone,
      student.dorm,
      student.note,
    ]),
  );
}

export function buildAttendanceCsv(
  session: AttendanceSession,
  students: Student[],
  classRoom?: ClassRoom,
): string {
  const records = new Map(session.records.map((record) => [record.studentId, record]));
  return buildCsv(
    ['日期', '班级', '学号', '姓名', '状态', '备注'],
    students.map((student) => {
      const record = records.get(student.id);
      return [
        session.date,
        classRoom?.name ?? '',
        student.studentNo,
        student.name,
        attendanceLabels[record?.status ?? 'unmarked'],
        record?.note ?? '',
      ];
    }),
  );
}

export function buildTaskCsv(task: CollectionTask, students: Student[]): string {
  const submissions = new Map(task.submissions.map((submission) => [submission.studentId, submission]));
  return buildCsv(
    ['任务', '截止日期', '学号', '姓名', '提交状态', '备注', '附件数', '附件名称'],
    students.map((student) => {
      const submission = submissions.get(student.id);
      return [
        task.title,
        task.dueDate,
        student.studentNo,
        student.name,
        submissionLabels[submission?.status ?? 'pending'],
        submission?.note ?? '',
        submission?.attachments.length ?? 0,
        submission?.attachments.map((item) => item.name).join('；') ?? '',
      ];
    }),
  );
}

export async function buildTaskHtmlReport(
  task: CollectionTask,
  students: Student[],
  classRoom?: ClassRoom,
): Promise<string> {
  const submissions = new Map(task.submissions.map((submission) => [submission.studentId, submission]));
  const completed = students.filter((student) => submissions.get(student.id)?.status === 'completed').length;
  const missing = students.filter((student) => submissions.get(student.id)?.status === 'missing').length;
  const pending = students.length - completed - missing;

  const rows: string[] = [];
  for (const student of students) {
    const submission = submissions.get(student.id);
    const imageMarkup: string[] = [];
    for (const attachment of submission?.attachments ?? []) {
      const blob = await getImage(attachment.id);
      if (!blob) continue;
      const dataUrl = await blobToDataUrl(blob);
      imageMarkup.push(
        `<figure><img src="${dataUrl}" alt="${escapeHtml(attachment.name)}"><figcaption>${escapeHtml(attachment.name)}</figcaption></figure>`,
      );
    }
    rows.push(`
      <tr>
        <td>${escapeHtml(student.studentNo)}</td>
        <td class="name">${escapeHtml(student.name)}</td>
        <td><span class="status ${submission?.status ?? 'pending'}">${escapeHtml(submissionLabels[submission?.status ?? 'pending'])}</span></td>
        <td>${escapeHtml(submission?.note ?? '') || '<span class="muted">—</span>'}</td>
        <td class="evidence">${imageMarkup.join('') || '<span class="muted">无图片附件</span>'}</td>
      </tr>`);
  }

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(task.title)} - 提交报告</title>
<style>
  :root { color-scheme: light; --ink:#18332e; --muted:#71807a; --line:#dfe7e2; --accent:#1d7a5f; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px; font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; color:var(--ink); background:#f5f7f4; }
  main { max-width: 1180px; margin: auto; background:white; border-radius:20px; padding:36px; box-shadow:0 20px 60px rgba(16,52,42,.08); }
  h1 { margin:0 0 8px; font-size:28px; }
  .meta { color:var(--muted); font-size:14px; line-height:1.8; }
  .summary { display:flex; gap:14px; margin:26px 0; }
  .metric { padding:14px 20px; border:1px solid var(--line); border-radius:12px; background:#f9fbf9; }
  .metric b { display:block; font-size:24px; color:var(--accent); }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { border-bottom:1px solid var(--line); padding:12px 10px; text-align:left; vertical-align:top; }
  th { background:#f1f5f2; font-size:12px; color:var(--muted); }
  .name { font-weight:700; white-space:nowrap; }
  .status { display:inline-block; padding:3px 9px; border-radius:99px; white-space:nowrap; font-size:12px; }
  .completed { background:#e8f5ee; color:#1d7a5f; }
  .missing { background:#fdecea; color:#b43e3e; }
  .pending { background:#f2f0e8; color:#7b704c; }
  .evidence { display:flex; gap:8px; flex-wrap:wrap; }
  figure { margin:0; width:150px; }
  figure img { width:150px; height:100px; object-fit:cover; border-radius:8px; border:1px solid var(--line); }
  figcaption { font-size:10px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .muted { color:#9aa6a0; }
  @media print { body { padding:0; background:white; } main { box-shadow:none; padding:20px; } }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(task.title)}</h1>
  <div class="meta">
    ${escapeHtml(classRoom?.name ?? '')} · 截止 ${escapeHtml(formatDateChinese(task.dueDate))}<br>
    ${escapeHtml(task.description || '无任务说明')}<br>
    导出时间：${escapeHtml(new Date().toLocaleString('zh-CN'))}
  </div>
  <div class="summary">
    <div class="metric">应交 <b>${students.length}</b></div>
    <div class="metric">已完成 <b>${completed}</b></div>
    <div class="metric">未完成 <b>${missing}</b></div>
    <div class="metric">待检查 <b>${pending}</b></div>
  </div>
  <table>
    <thead><tr><th>学号</th><th>姓名</th><th>状态</th><th>备注</th><th>提交凭证</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>
</main>
</body>
</html>`;
}

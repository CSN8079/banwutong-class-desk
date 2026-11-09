import { buildCsv } from './csv';
import { blobToDataUrl, getImage } from './imageStore';
import { attendanceLabels, formatDateTimeSeconds, submissionLabels } from './format';
import type { AttendanceSession, ClassRoom, CollectionTask, Student } from '../types';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function zoomScript(): string {
  return `<script>
    (() => {
      const lightbox = document.getElementById('lightbox');
      const lightboxImage = document.getElementById('lightbox-image');
      document.querySelectorAll('.zoomable').forEach((image) => {
        image.addEventListener('click', () => {
          lightboxImage.src = image.src;
          lightbox.classList.add('open');
        });
      });
      lightbox.addEventListener('click', () => {
        lightbox.classList.remove('open');
        lightboxImage.src = '';
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') lightbox.click();
      });
    })();
  </script>`;
}

function zoomStyles(): string {
  return `
  .lightbox { position:fixed; inset:0; z-index:100; display:none; align-items:center; justify-content:center; padding:28px; background:rgba(10,25,21,.9); cursor:zoom-out; }
  .lightbox.open { display:flex; }
  .lightbox img { max-width:95vw; max-height:92vh; object-fit:contain; border-radius:10px; box-shadow:0 24px 80px rgba(0,0,0,.45); }
  .zoomable { cursor:zoom-in; }`;
}

export function buildStudentCsv(students: Student[]): string {
  return buildCsv(
    ['班级学号', '学号', '姓名', '性别', '手机', '宿舍', '床位', '备注'],
    students.map((student) => [
      student.shortNo,
      student.studentNo,
      student.name,
      student.gender === 'male' ? '男' : student.gender === 'female' ? '女' : '其他',
      student.phone,
      student.dorm,
      student.bed,
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
    ['日期', '点名标题', '班级', '班级学号', '学号', '姓名', '状态', '备注', '备注图片数'],
    students.map((student) => {
      const record = records.get(student.id);
      return [
        session.date,
        session.title,
        classRoom?.name ?? '',
        student.shortNo,
        student.studentNo,
        student.name,
        attendanceLabels[record?.status ?? 'unmarked'],
        record?.note ?? '',
        record?.images.length ?? 0,
      ];
    }),
  );
}

export function buildTaskCsv(task: CollectionTask, students: Student[]): string {
  const submissions = new Map(task.submissions.map((submission) => [submission.studentId, submission]));
  return buildCsv(
    ['任务', '截止时间', '班级学号', '学号', '姓名', '提交状态', '备注', '附件数', '附件名称'],
    students.map((student) => {
      const submission = submissions.get(student.id);
      return [
        task.title,
        task.dueDate,
        student.shortNo,
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
        `<figure><img class="zoomable" src="${dataUrl}" alt="${escapeHtml(attachment.name)}"><figcaption>${escapeHtml(attachment.name)}</figcaption></figure>`,
      );
    }
    rows.push(`
      <tr>
        <td class="short-no">${escapeHtml(student.shortNo)}</td>
        <td>${escapeHtml(student.studentNo)}</td>
        <td class="name">${escapeHtml(student.name)}</td>
        <td><span class="status ${submission?.status ?? 'pending'}">${escapeHtml(submissionLabels[submission?.status ?? 'pending'])}</span></td>
        <td>${escapeHtml(submission?.note ?? '') || '<span class="muted">—</span>'}</td>
        <td class="evidence"><div class="evidence-grid">${imageMarkup.join('') || '<span class="muted">无图片附件</span>'}</div></td>
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
  body { margin: 0; padding: 40px; font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; color:var(--ink); background:#f5f7f4; font-size:15px; }
  main { max-width: 1220px; margin: auto; background:white; border-radius:20px; padding:36px; box-shadow:0 20px 60px rgba(16,52,42,.08); }
  h1 { margin:0 0 8px; font-size:30px; }
  .meta { color:var(--muted); font-size:14px; line-height:1.85; }
  .summary { display:flex; gap:14px; margin:26px 0; flex-wrap:wrap; }
  .metric { min-width:120px; padding:14px 20px; border:1px solid var(--line); border-radius:12px; background:#f9fbf9; }
  .metric b { display:block; font-size:25px; color:var(--accent); }
  table { width:100%; border-collapse:collapse; font-size:13.5px; }
  th, td { border-bottom:1px solid var(--line); padding:12px 10px; text-align:left; vertical-align:top; }
  th { background:#f1f5f2; font-size:12.5px; color:var(--muted); }
  .short-no { font-weight:700; color:var(--accent); white-space:nowrap; }
  .name { font-weight:700; white-space:nowrap; }
  .status { display:inline-block; padding:4px 10px; border-radius:99px; white-space:nowrap; font-size:12px; }
  .completed { background:#e8f5ee; color:#1d7a5f; }
  .missing { background:#fdecea; color:#b43e3e; }
  .pending { background:#f2f0e8; color:#7b704c; }
  .evidence { min-width:170px; }
  .evidence-grid { display:flex; gap:8px; flex-wrap:wrap; }
  figure { margin:0; width:150px; }
  figure img { width:150px; height:100px; object-fit:cover; border-radius:8px; border:1px solid var(--line); }
  figcaption { font-size:10.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .muted { color:#9aa6a0; }
  ${zoomStyles()}
  @media print { body { padding:0; background:white; } main { box-shadow:none; padding:20px; } }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(task.title)}</h1>
  <div class="meta">
    ${escapeHtml(classRoom?.name ?? '')} · 截止 ${escapeHtml(formatDateTimeSeconds(task.dueDate))}<br>
    ${escapeHtml(task.description || '无任务说明')}<br>
    导出时间：${escapeHtml(new Date().toLocaleString('zh-CN'))} · 点击图片可放大
  </div>
  <div class="summary">
    <div class="metric">应交 <b>${students.length}</b></div>
    <div class="metric">已完成 <b>${completed}</b></div>
    <div class="metric">未完成 <b>${missing}</b></div>
    <div class="metric">待检查 <b>${pending}</b></div>
  </div>
  <table>
    <thead><tr><th>班级学号</th><th>学号</th><th>姓名</th><th>状态</th><th>备注</th><th>提交凭证</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>
</main>
<div id="lightbox" class="lightbox"><img id="lightbox-image" alt="放大查看"></div>
${zoomScript()}
</body>
</html>`;
}

export async function buildAttendanceHtmlReport(
  session: AttendanceSession,
  students: Student[],
  classRoom?: ClassRoom,
): Promise<string> {
  const records = new Map(session.records.map((record) => [record.studentId, record]));
  const counts = {
    present: students.filter((student) => records.get(student.id)?.status === 'present').length,
    late: students.filter((student) => records.get(student.id)?.status === 'late').length,
    leave: students.filter((student) => records.get(student.id)?.status === 'leave').length,
    absent: students.filter((student) => records.get(student.id)?.status === 'absent').length,
    unmarked: students.filter((student) => (records.get(student.id)?.status ?? 'unmarked') === 'unmarked').length,
  };

  const rows: string[] = [];
  for (const student of students) {
    const record = records.get(student.id);
    const images: string[] = [];
    for (const attachment of record?.images ?? []) {
      const blob = await getImage(attachment.id);
      if (!blob) continue;
      images.push(`<figure><img class="zoomable" src="${await blobToDataUrl(blob)}" alt="${escapeHtml(attachment.name)}"><figcaption>${escapeHtml(attachment.name)}</figcaption></figure>`);
    }
    rows.push(`
      <tr>
        <td class="short-no">${escapeHtml(student.shortNo)}</td>
        <td>${escapeHtml(student.studentNo)}</td>
        <td class="name">${escapeHtml(student.name)}</td>
        <td><span class="status ${record?.status ?? 'unmarked'}">${escapeHtml(attendanceLabels[record?.status ?? 'unmarked'])}</span></td>
        <td>${escapeHtml(record?.note ?? '') || '<span class="muted">—</span>'}</td>
        <td class="evidence"><div class="evidence-grid">${images.join('') || '<span class="muted">无图片</span>'}</div></td>
      </tr>`);
  }

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(session.title)} - 点名记录</title>
<style>
  :root { color-scheme: light; --ink:#18332e; --muted:#71807a; --line:#dfe7e2; --accent:#1d7a5f; --red:#b43e3e; --amber:#a8731d; --blue:#466f9c; }
  * { box-sizing: border-box; }
  body { margin:0; padding:40px; font-family:"Microsoft YaHei","PingFang SC",Arial,sans-serif; color:var(--ink); background:#f5f7f4; font-size:15px; }
  main { max-width:1200px; margin:auto; background:white; border-radius:20px; padding:36px; box-shadow:0 20px 60px rgba(16,52,42,.08); }
  h1 { margin:0 0 8px; font-size:30px; }
  .meta { color:var(--muted); font-size:14px; line-height:1.85; }
  .summary { display:flex; gap:12px; margin:26px 0; flex-wrap:wrap; }
  .metric { min-width:105px; padding:13px 17px; border:1px solid var(--line); border-radius:12px; background:#f9fbf9; }
  .metric b { display:block; font-size:24px; color:var(--accent); }
  table { width:100%; border-collapse:collapse; font-size:13.5px; }
  th, td { border-bottom:1px solid var(--line); padding:12px 10px; text-align:left; vertical-align:top; }
  th { background:#f1f5f2; font-size:12.5px; color:var(--muted); }
  .short-no { font-weight:700; color:var(--accent); white-space:nowrap; }
  .name { font-weight:700; white-space:nowrap; }
  .status { display:inline-block; padding:4px 10px; border-radius:99px; font-size:12px; }
  .present { background:#e8f5ee; color:var(--accent); }
  .late { background:#fbf3e2; color:var(--amber); }
  .leave { background:#edf3fa; color:var(--blue); }
  .absent { background:#fdecea; color:var(--red); }
  .unmarked { background:#eef1ee; color:#74817b; }
  .evidence { min-width:170px; }
  .evidence-grid { display:flex; gap:8px; flex-wrap:wrap; }
  figure { margin:0; width:150px; }
  figure img { width:150px; height:100px; object-fit:cover; border-radius:8px; border:1px solid var(--line); }
  figcaption { font-size:10.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .muted { color:#9aa6a0; }
  ${zoomStyles()}
  @media print { body { padding:0; background:white; } main { box-shadow:none; padding:20px; } }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(session.title)}</h1>
  <div class="meta">
    ${escapeHtml(classRoom?.name ?? '')} · ${escapeHtml(session.date)}<br>
    导出于 ${escapeHtml(new Date().toLocaleString('zh-CN'))} · 点击图片可放大
  </div>
  <div class="summary">
    <div class="metric">出勤 <b>${counts.present}</b></div>
    <div class="metric">迟到 <b>${counts.late}</b></div>
    <div class="metric">请假 <b>${counts.leave}</b></div>
    <div class="metric">缺勤 <b>${counts.absent}</b></div>
    <div class="metric">未点名 <b>${counts.unmarked}</b></div>
  </div>
  <table>
    <thead><tr><th>班级学号</th><th>学号</th><th>姓名</th><th>状态</th><th>备注</th><th>备注图片</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>
</main>
<div id="lightbox" class="lightbox"><img id="lightbox-image" alt="放大查看"></div>
${zoomScript()}
</body>
</html>`;
}

export async function buildTaskXlsx(
  task: CollectionTask,
  students: Student[],
  classRoom?: ClassRoom,
): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '班务通';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('提交清单', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: '班级学号', key: 'shortNo', width: 12 },
    { header: '学号', key: 'studentNo', width: 16 },
    { header: '姓名', key: 'name', width: 14 },
    { header: '提交状态', key: 'status', width: 13 },
    { header: '备注', key: 'note', width: 30 },
    { header: '附件1', key: 'image1', width: 22 },
    { header: '附件2', key: 'image2', width: 22 },
    { header: '附件3', key: 'image3', width: 22 },
  ];

  const titleRow = sheet.addRow([task.title]);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 8);
  titleRow.height = 30;
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: 'FF17352E' } };
  titleRow.getCell(1).alignment = { vertical: 'middle' };
  const infoRow = sheet.addRow([`${classRoom?.name ?? ''} · 截止 ${formatDateTimeSeconds(task.dueDate)} · ${task.description}`]);
  sheet.mergeCells(infoRow.number, 1, infoRow.number, 8);
  infoRow.height = 24;
  infoRow.getCell(1).font = { size: 10, color: { argb: 'FF71807A' } };
  infoRow.getCell(1).alignment = { vertical: 'middle', wrapText: true };

  const headerRow = sheet.addRow(['班级学号', '学号', '姓名', '提交状态', '备注', '附件1', '附件2', '附件3']);
  headerRow.font = { bold: true, color: { argb: 'FF17352E' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F3ED' } };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.height = 24;

  const submissions = new Map(task.submissions.map((submission) => [submission.studentId, submission]));
  for (const student of students) {
    const submission = submissions.get(student.id);
    const row = sheet.addRow([
      student.shortNo,
      student.studentNo,
      student.name,
      submissionLabels[submission?.status ?? 'pending'],
      submission?.note ?? '',
      '',
      '',
      '',
    ]);
    row.height = 74;
    row.alignment = { vertical: 'top', wrapText: true };
    row.getCell(1).font = { bold: true, color: { argb: 'FF1D7A5F' } };

    const attachments = submission?.attachments ?? [];
    for (let index = 0; index < Math.min(3, attachments.length); index += 1) {
      const attachment = attachments[index];
      const blob = await getImage(attachment.id);
      if (!blob) continue;
      const dataUrl = await blobToDataUrl(blob);
      const extension = blob.type === 'image/png' ? 'png' : 'jpeg';
      const imageId = workbook.addImage({ base64: dataUrl, extension });
      sheet.addImage(imageId, {
        tl: { col: 5 + index, row: row.number - 1 },
        ext: { width: 105, height: 67 },
        editAs: 'oneCell',
      });
    }
    if (attachments.length > 3) {
      row.getCell(8).value = `另有 ${attachments.length - 3} 张`;
    }
  }

  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 8 } };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < 3) return;
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE3E7E0' } },
        left: { style: 'thin', color: { argb: 'FFE3E7E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE3E7E0' } },
        right: { style: 'thin', color: { argb: 'FFE3E7E0' } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

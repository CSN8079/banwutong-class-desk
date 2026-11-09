export function escapeCsv(value: unknown): string {
  const text = value == null ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsv).join(','));
  return `\uFEFF${lines.join('\r\n')}`;
}

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    const next = clean[index + 1];
    if (quoted && char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

const aliases = {
  shortNo: ['班级学号', '短学号', '班内学号', 'shortno', 'short_no'],
  studentNo: ['学号', 'studentno', 'student_no', 'number', '编号'],
  name: ['姓名', 'name', '学生姓名'],
  gender: ['性别', 'gender'],
  phone: ['手机', '手机号', '电话', 'phone'],
  dorm: ['宿舍', '寝室', 'dorm'],
  bed: ['床位', '床号', 'bed'],
  note: ['备注', 'note'],
};

function findColumn(headers: string[], keys: string[]) {
  return headers.findIndex((header) => keys.includes(header.trim().toLowerCase()));
}

export function parseStudentCsv(text: string) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((item) => item.trim().toLowerCase());
  const indexes = {
    shortNo: findColumn(headers, aliases.shortNo),
    studentNo: findColumn(headers, aliases.studentNo),
    name: findColumn(headers, aliases.name),
    gender: findColumn(headers, aliases.gender),
    phone: findColumn(headers, aliases.phone),
    dorm: findColumn(headers, aliases.dorm),
    bed: findColumn(headers, aliases.bed),
    note: findColumn(headers, aliases.note),
  };

  const nameIndex = indexes.name;
  if (nameIndex < 0) throw new Error('CSV 中未找到“姓名”列');

  return rows.slice(1).map((row) => {
    const genderText = indexes.gender >= 0 ? row[indexes.gender] ?? '' : '';
    const gender = genderText.includes('女') || genderText.toLowerCase() === 'female'
      ? 'female'
      : genderText.includes('男') || genderText.toLowerCase() === 'male'
        ? 'male'
        : 'other';
    return {
      shortNo: indexes.shortNo >= 0 ? row[indexes.shortNo] ?? '' : '',
      studentNo: indexes.studentNo >= 0 ? row[indexes.studentNo] ?? '' : '',
      name: row[nameIndex] ?? '',
      gender: gender as 'male' | 'female' | 'other',
      phone: indexes.phone >= 0 ? row[indexes.phone] ?? '' : '',
      dorm: indexes.dorm >= 0 ? row[indexes.dorm] ?? '' : '',
      bed: indexes.bed >= 0 ? row[indexes.bed] ?? '' : '',
      note: indexes.note >= 0 ? row[indexes.note] ?? '' : '',
    };
  }).filter((student) => student.name.trim().length > 0);
}

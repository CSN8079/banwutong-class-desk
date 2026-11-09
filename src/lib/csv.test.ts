import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsv, parseCsv, parseStudentCsv } from './csv';

describe('CSV utilities', () => {
  it('escapes commas, quotes and line breaks', () => {
    expect(escapeCsv('张三,男')).toBe('"张三,男"');
    expect(escapeCsv('他说"到了"')).toBe('"他说""到了"""');
    expect(escapeCsv('第一行\n第二行')).toBe('"第一行\n第二行"');
  });

  it('builds a UTF-8 BOM CSV for Excel', () => {
    const csv = buildCsv(['姓名', '状态'], [['陈思远', '出勤']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('姓名,状态');
    expect(csv).toContain('陈思远,出勤');
  });

  it('parses quoted CSV cells', () => {
    const rows = parseCsv('姓名,备注\r\n张三,"已联系,稍后到"\r\n李四,"他说""好的"""');
    expect(rows).toEqual([
      ['姓名', '备注'],
      ['张三', '已联系,稍后到'],
      ['李四', '他说"好的"'],
    ]);
  });

  it('maps Chinese student CSV headers', () => {
    const rows = parseStudentCsv('学号,姓名,性别,手机,宿舍,备注\n20230001,张三,男,13800000000,梅园 3-201,班长');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      studentNo: '20230001',
      name: '张三',
      gender: 'male',
      dorm: '梅园 3-201',
      note: '班长',
    });
  });

  it('maps short number and bed columns', () => {
    const rows = parseStudentCsv('班级学号,学号,姓名,宿舍,床位\n01,20230001,张三,梅园 3-201,2 号床');
    expect(rows[0]).toMatchObject({ shortNo: '01', bed: '2 号床' });
  });

  it('rejects CSV without a name column', () => {
    expect(() => parseStudentCsv('学号,手机\n20230001,13800000000')).toThrow('姓名');
  });
});

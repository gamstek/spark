import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ActivityFormAnswers } from '@spark/contracts';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExportsHandler } from '../src/exports/exports.handler.js';
import { ExportsService } from '../src/exports/exports.service.js';
import { JobHandlers } from '../src/jobs/jobs.handlers.js';
import { JobsService } from '../src/jobs/jobs.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

const cellValues = (row: ExcelJS.Row, start: number, end: number) =>
  Array.from(
    { length: end - start },
    (_, index) => row.getCell(start + index).value,
  );

describe('secure lead exports', () => {
  let database: TestDatabase;
  let scenario: Scenario;
  let root: string;
  let service: ExportsService;
  let exportNow: Date;

  beforeAll(async () => {
    database = await createTestDatabase();
    scenario = await createScenario(database.dataSource);
    root = await mkdtemp(join(tmpdir(), 'spark-export-'));
    exportNow = new Date();
    service = new ExportsService(
      database.dataSource,
      new JobsService(database.dataSource),
      root,
      () => exportNow,
    );
    const answers: ActivityFormAnswers = {
      name: '=HYPERLINK("https://attacker.invalid")',
      organization: '示例科技',
      department: '研发部',
      jobTitle: '研究员',
      phone: '13800138000',
      email: 'formula@example.com',
      researchAreas: ['life_sciences', 'other'],
      researchAreaOther: '细胞治疗',
      instrumentInterests: ['mass_spectrometry', 'other'],
      instrumentInterestOther: '代谢组学平台',
      visitPurposes: ['new_products', 'technical_materials'],
      followUpPreferences: ['product_pdf', 'engineer_call'],
      contactPreference: 'email_first',
      onsiteAvailability: 'unavailable',
    };
    await database.dataSource.query(
      `INSERT INTO activity_form_submission (id,participation_id,answers,submitted_at) VALUES ($1,$2,$3,$4)`,
      [randomUUID(), scenario.participationIds[0], answers, scenario.now],
    );
    await database.dataSource.query(
      `UPDATE lottery_record SET prize_name='一等奖',redeem_end_at=$2 WHERE id=$1`,
      [scenario.lotteryRecordId, new Date(scenario.now.getTime() + 86_400_000)],
    );
  });

  afterAll(async () => {
    await database.close();
    await rm(root, { recursive: true, force: true });
  });

  it('writes a stable XLSX snapshot with Chinese and text cells', async () => {
    const created = await service.create(scenario.activityId, scenario.adminId);
    await new ExportsHandler(
      database.dataSource,
      new JobHandlers(),
      root,
    ).handle({
      exportId: created.jobId,
    });
    const view = await service.get(created.jobId, scenario.adminId);
    expect(view).toMatchObject({ status: 'SUCCEEDED', rowCount: 2 });
    const file = await service.read(created.jobId, scenario.adminId);
    expect((await readFile(file.path)).length).toBeGreaterThan(100);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const sheet = workbook.getWorksheet('活动线索')!;

    expect(sheet.rowCount).toBe(3);
    expect(cellValues(sheet.getRow(1), 1, 24)).toEqual([
      '参与ID',
      '用户ID',
      '姓名',
      '单位（公司/院校/研究所）全称',
      '部门/实验室/课题组',
      '职位/职称',
      '手机号码',
      '电子邮箱',
      '您的主要研究方向/应用领域（多选）',
      '您的主要研究方向/应用领域（多选）（其他说明）',
      '您目前最关注的仪器类型或技术（多选）',
      '您目前最关注的仪器类型或技术（多选）（其他说明）',
      '您此次关注的目的是（多选）',
      '您希望我们以何种方式为您提供后续信息？（多选题）',
      '您是否方便接受我们在1-2个工作日内致电进行简短的技术交流？',
      '您今天是否有时间在我们的展台进行更深入的交流？（可与工作人员确认安排）',
      '其他具体需求或咨询',
      '首次留资时间',
      '奖品',
      '兑奖状态',
      '核销时间',
      '参与时间',
      '来源渠道',
    ]);

    const injectedRow = [sheet.getRow(2), sheet.getRow(3)].find(
      (row) =>
        row.getCell(3).value === '\'=HYPERLINK("https://attacker.invalid")',
    );

    expect(injectedRow).toBeDefined();
    expect(injectedRow && cellValues(injectedRow, 1, 18)).toEqual([
      scenario.participationIds[0],
      scenario.userIds[0],
      '\'=HYPERLINK("https://attacker.invalid")',
      '示例科技',
      '研发部',
      '研究员',
      '13800138000',
      'formula@example.com',
      '生命科学（制药、生物技术、CRO）；其他',
      '细胞治疗',
      '质谱类（高分辨质谱，三重四极杆质谱，MALDI-TOF 等）；其他',
      '代谢组学平台',
      '了解新产品/新技术动态；获取技术资料',
      '发送详细产品技术资料（PDF）；预约资深应用工程师电话沟通',
      '请先通过邮件发送资料',
      '否，行程较满',
      '',
    ]);
    expect(injectedRow?.getCell(7).numFmt).toBe('@');
  });

  it('reauthorizes every status and download request and rejects expired or guessed paths', async () => {
    const created = await service.create(scenario.activityId, scenario.adminId);
    await new ExportsHandler(
      database.dataSource,
      new JobHandlers(),
      root,
    ).handle({
      exportId: created.jobId,
    });
    await expect(service.get(created.jobId, randomUUID())).rejects.toThrow(
      'EXPORT_NOT_FOUND',
    );
    await database.dataSource.query(
      `UPDATE export_job SET storage_key='../secret.xlsx' WHERE id=$1`,
      [created.jobId],
    );
    await expect(service.read(created.jobId, scenario.adminId)).rejects.toThrow(
      'EXPORT_STORAGE_INVALID',
    );
    await database.dataSource.query(
      `UPDATE export_job SET storage_key=$2,expires_at=$3 WHERE id=$1`,
      [
        created.jobId,
        `${created.jobId}.xlsx`,
        new Date(exportNow.getTime() - 1),
      ],
    );
    await expect(service.read(created.jobId, scenario.adminId)).rejects.toThrow(
      'EXPORT_NOT_FOUND',
    );
    expect(await service.cleanupExpired()).toBeGreaterThanOrEqual(1);
  });
});

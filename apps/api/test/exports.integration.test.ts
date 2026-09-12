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
      name: '=1+1',
      organization: '示例科技',
      department: '研发部',
      jobTitle: '研究员',
      phone: '13800138000',
      email: 'formula@example.com',
      researchAreas: ['life_sciences'],
      instrumentInterests: ['chromatography'],
      visitPurposes: ['new_products'],
      followUpPreferences: ['product_pdf'],
      contactPreference: 'call_welcome',
      onsiteAvailability: 'available',
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
    expect(sheet.getRow(1).getCell(3).value).toBe('姓名');

    const injectedRow = [sheet.getRow(2), sheet.getRow(3)].find(
      (row) => row.getCell(3).value === '=1+1',
    );

    expect(injectedRow).toBeDefined();
    expect(injectedRow?.getCell(4).value).toBe('13800138000');
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

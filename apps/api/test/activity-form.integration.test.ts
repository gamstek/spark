import { randomUUID } from 'node:crypto';

import {
  type ActivityFormSubmissionInput,
  type ActivityFormAnswers,
} from '@spark/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ActivityFormService } from '../src/activity-form/activity-form.service.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { createScenario, type Scenario } from './support/fixtures.js';

const validForm: ActivityFormSubmissionInput = {
  name: '张三',
  organization: '星火科技',
  department: '研发部',
  jobTitle: '研究员',
  phone: '13800138000',
  email: 'zhangsan@example.com',
  researchAreas: ['life_sciences'],
  instrumentInterests: ['mass_spectrometry'],
  visitPurposes: ['new_products'],
  followUpPreferences: ['product_pdf'],
  contactPreference: 'call_welcome',
  onsiteAvailability: 'available',
  privacyAccepted: true,
};

function expectedAnswers(
  input: ActivityFormSubmissionInput = validForm,
): ActivityFormAnswers {
  const { privacyAccepted: _privacyAccepted, ...answers } = input;
  return answers;
}

describe('atomic activity form submission', () => {
  let database: TestDatabase;
  let scenario: Scenario;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  beforeEach(async () => {
    await database.dataSource.query(
      `TRUNCATE TABLE audit_event,export_job,stock_adjustment,channel_visit,redemption,lottery_record,activity_prize,prize,background_job,activity_form_submission,activity_participation,staff_activity_permission,activity_version,activity,wechat_identity,user_account,app_session,oauth_state,wechat_credential_cache,staff_account,admin_account,media_asset RESTART IDENTITY CASCADE`,
    );
    scenario = await createScenario(database.dataSource);
    await database.dataSource.query(
      `UPDATE activity_participation SET lead_completed=false,lead_completed_at=NULL WHERE id=$1`,
      [scenario.participationIds[0]],
    );
  });

  afterAll(async () => database.close());

  const service = (
    now = scenario.now,
    afterSubmissionInserted: () => void = () => undefined,
  ) =>
    new ActivityFormService(
      database.dataSource,
      () => now,
      afterSubmissionInserted,
    );

  async function readSubmission(participationId: string) {
    const rows = await database.dataSource.query<
      { answers: ActivityFormAnswers; submitted_at: Date }[]
    >(
      `SELECT answers,submitted_at FROM activity_form_submission WHERE participation_id=$1`,
      [participationId],
    );
    return rows[0];
  }

  async function readParticipation(participationId: string) {
    const rows = await database.dataSource.query<
      { lead_completed: boolean; lead_completed_at: Date | null }[]
    >(
      `SELECT lead_completed,lead_completed_at FROM activity_participation WHERE id=$1`,
      [participationId],
    );
    return rows[0];
  }

  it('stores the first valid submission and completes its participation at the same time', async () => {
    const now = scenario.now;
    const participationId = scenario.participationIds[0];

    await expect(
      service(now).submit(scenario.userIds[0], 'expo-2026', validForm),
    ).resolves.toEqual({ submitted: true });
    expect(await readSubmission(participationId)).toMatchObject({
      answers: expectedAnswers(),
      submitted_at: now,
    });
    expect(await readParticipation(participationId)).toMatchObject({
      lead_completed: true,
      lead_completed_at: now,
    });
  });

  it('keeps first answers when a retry supplies different answers', async () => {
    const participationId = scenario.participationIds[0];
    const changedForm = { ...validForm, name: '李四' };

    await service().submit(scenario.userIds[0], 'expo-2026', validForm);
    await expect(
      service().submit(scenario.userIds[0], 'expo-2026', changedForm),
    ).resolves.toEqual({ submitted: true });
    expect((await readSubmission(participationId))?.answers).toEqual(
      expectedAnswers(),
    );
  });

  it('keeps one first answer set for simultaneous submissions', async () => {
    const participationId = scenario.participationIds[0];
    const secondForm = { ...validForm, name: '并发用户' };

    await expect(
      Promise.all([
        service().submit(scenario.userIds[0], 'expo-2026', validForm),
        service().submit(scenario.userIds[0], 'expo-2026', secondForm),
      ]),
    ).resolves.toEqual([{ submitted: true }, { submitted: true }]);
    const submissions = await database.dataSource.query<
      { answers: ActivityFormAnswers }[]
    >(
      `SELECT answers FROM activity_form_submission WHERE participation_id=$1`,
      [participationId],
    );
    expect(submissions).toHaveLength(1);
    expect([expectedAnswers(), expectedAnswers(secondForm)]).toContainEqual(
      submissions[0]?.answers,
    );
  });

  it('rejects invalid consent and unknown options without mutating participation', async () => {
    const participationId = scenario.participationIds[0];
    const invalidConsent = { ...validForm, privacyAccepted: false };
    const invalidOption = {
      ...validForm,
      researchAreas: ['not-an-option'],
    };

    await expect(
      service().submit(scenario.userIds[0], 'expo-2026', invalidConsent),
    ).rejects.toThrow();
    await expect(
      service().submit(scenario.userIds[0], 'expo-2026', invalidOption),
    ).rejects.toThrow();
    expect(await readSubmission(participationId)).toBeUndefined();
    expect(await readParticipation(participationId)).toMatchObject({
      lead_completed: false,
      lead_completed_at: null,
    });
  });

  it.each([
    ['before the activity starts', new Date('2026-09-07T03:59:59.999Z')],
    ['at the draw deadline', new Date('2026-09-08T04:00:00.000Z')],
  ])('rejects a first submission %s', async (_label, now) => {
    const participationId = scenario.participationIds[0];

    await expect(
      service(now).submit(scenario.userIds[0], 'expo-2026', validForm),
    ).rejects.toThrow('FORM_NOT_AVAILABLE');
    expect(await readSubmission(participationId)).toBeUndefined();
    expect(await readParticipation(participationId)).toMatchObject({
      lead_completed: false,
      lead_completed_at: null,
    });
  });

  it('rolls a submission back when completing participation fails', async () => {
    const participationId = scenario.participationIds[0];

    await expect(
      service(scenario.now, () => {
        throw new Error('PARTICIPATION_UPDATE_FAILED');
      }).submit(scenario.userIds[0], 'expo-2026', validForm),
    ).rejects.toThrow('PARTICIPATION_UPDATE_FAILED');
    expect(await readSubmission(participationId)).toBeUndefined();
    expect(await readParticipation(participationId)).toMatchObject({
      lead_completed: false,
      lead_completed_at: null,
    });
  });

  it('rejects unknown or unpublished activities before creating participation', async () => {
    const unknownUserId = randomUUID();
    const unpublishedUserId = randomUUID();
    await database.dataSource.query(
      `INSERT INTO user_account (id) VALUES ($1),($2)`,
      [unknownUserId, unpublishedUserId],
    );
    const participationCount = await database.dataSource.query<
      { count: string }[]
    >(`SELECT count(*) FROM activity_participation`);

    await expect(
      service().submit(unknownUserId, 'missing-activity', validForm),
    ).rejects.toThrow('ACTIVITY_NOT_FOUND');
    await database.dataSource.query(
      `UPDATE activity SET published_version_id=NULL WHERE id=$1`,
      [scenario.activityId],
    );
    await expect(
      service().submit(unpublishedUserId, 'expo-2026', validForm),
    ).rejects.toThrow('ACTIVITY_NOT_FOUND');
    expect(
      await database.dataSource.query(
        `SELECT count(*) FROM activity_participation`,
      ),
    ).toEqual(participationCount);
  });

  it('rejects published activity versions outside the exhibition-lottery v1 form', async () => {
    const userId = randomUUID();
    await database.dataSource.query(
      `INSERT INTO user_account (id) VALUES ($1)`,
      [userId],
    );
    await database.dataSource.query(
      `UPDATE activity_version SET template_id='other-template' WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId],
    );

    await expect(
      service().submit(userId, 'expo-2026', validForm),
    ).rejects.toThrow('FORM_NOT_AVAILABLE');
    await database.dataSource.query(
      `UPDATE activity_version SET template_id='exhibition-lottery',template_version=2 WHERE id=(SELECT published_version_id FROM activity WHERE id=$1)`,
      [scenario.activityId],
    );
    await expect(
      service().submit(userId, 'expo-2026', validForm),
    ).rejects.toThrow('FORM_NOT_AVAILABLE');
    expect(
      await database.dataSource.query(
        `SELECT id FROM activity_form_submission WHERE participation_id IN (SELECT id FROM activity_participation WHERE user_id=$1)`,
        [userId],
      ),
    ).toEqual([]);
  });
});

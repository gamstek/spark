import { randomUUID } from 'node:crypto';

import {
  type ActivityFormSubmissionInput,
  type ActivityFormAnswers,
} from '@spark/contracts';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

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
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== 'privacyAccepted'),
  ) as ActivityFormAnswers;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

const barrierTimeoutMs = 1_000;

type TrackedRequest<T> = {
  result: Promise<T>;
  failure: Promise<never>;
  settled: Promise<void>;
};

function trackRequest<T>(result: Promise<T>): TrackedRequest<T> {
  const failure = result.then<never>(
    () => new Promise<never>(() => undefined),
    (error: unknown) => Promise.reject(error),
  );
  void failure.catch(() => undefined);
  return {
    result,
    failure,
    settled: result.then(
      () => undefined,
      () => undefined,
    ),
  };
}

async function waitForBarrier<T>(
  barrier: Promise<T>,
  requestFailures: readonly Promise<never>[],
  label: string,
  timeoutMs = barrierTimeoutMs,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`BARRIER_TIMEOUT:${label}`)),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([barrier, ...requestFailures, timedOut]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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

  it('fails a local barrier when no signal arrives', async () => {
    await expect(
      waitForBarrier(deferred().promise, [], 'missing signal', 5),
    ).rejects.toThrow('BARRIER_TIMEOUT:missing signal');
  });

  it('propagates a started request failure through a barrier', async () => {
    const failure = new Error('SECOND_REQUEST_FAILED');
    let rejectRequest!: (error: Error) => void;
    const request = new Promise<void>((_resolve, reject) => {
      rejectRequest = reject;
    });
    const tracked = trackRequest(request);
    rejectRequest(failure);

    await expect(
      waitForBarrier(deferred().promise, [tracked.failure], 'second request'),
    ).rejects.toThrow('SECOND_REQUEST_FAILED');
    await tracked.settled;
  });

  afterAll(async () => database.close());

  const service = (
    now = scenario.now,
    afterSubmissionInserted: () => void | Promise<void> = () => undefined,
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

  async function assertFirstWriterWinsDuringOverlap(userId: string) {
    const firstInserted = deferred();
    const releaseFirst = deferred();
    const secondParticipationUpsertAttempted = deferred();
    const secondForm = { ...validForm, name: '并发用户' };
    const createQueryRunner = database.dataSource.createQueryRunner.bind(
      database.dataSource,
    );
    let first: TrackedRequest<{ submitted: true }> | undefined;
    let second: TrackedRequest<{ submitted: true }> | undefined;
    let participationUpsertCount = 0;
    const createQueryRunnerSpy = vi
      .spyOn(database.dataSource, 'createQueryRunner')
      .mockImplementation((mode) => {
        const queryRunner = createQueryRunner(mode);
        const query = queryRunner.query.bind(queryRunner);
        queryRunner.query = (async (
          queryText: string,
          parameters?: unknown,
          useStructuredResult?: boolean,
        ) => {
          if (/INSERT INTO activity_participation/.test(queryText)) {
            participationUpsertCount += 1;
            if (participationUpsertCount === 2)
              secondParticipationUpsertAttempted.resolve();
          }
          return useStructuredResult
            ? query(queryText, parameters as never, true)
            : query(queryText, parameters as never);
        }) as typeof queryRunner.query;
        return queryRunner;
      });

    try {
      first = trackRequest(
        service(scenario.now, async () => {
          firstInserted.resolve();
          await releaseFirst.promise;
        }).submit(userId, 'expo-2026', validForm),
      );
      await waitForBarrier(
        firstInserted.promise,
        [first.failure],
        'first submission insert',
      );

      let secondSettled = false;
      second = trackRequest(
        service()
          .submit(userId, 'expo-2026', secondForm)
          .then((result) => {
            secondSettled = true;
            return result;
          }),
      );
      await waitForBarrier(
        secondParticipationUpsertAttempted.promise,
        [first.failure, second.failure],
        'second participation upsert',
      );
      await Promise.resolve();
      expect(secondSettled).toBe(false);

      releaseFirst.resolve();
      await expect(Promise.all([first.result, second.result])).resolves.toEqual(
        [{ submitted: true }, { submitted: true }],
      );

      const participations = await database.dataSource.query<
        { id: string; lead_completed: boolean; lead_completed_at: Date }[]
      >(
        `SELECT id,lead_completed,lead_completed_at FROM activity_participation WHERE activity_id=$1 AND user_id=$2`,
        [scenario.activityId, userId],
      );
      expect(participations).toHaveLength(1);
      expect(participations[0]).toMatchObject({
        lead_completed: true,
        lead_completed_at: scenario.now,
      });
      const submissions = await database.dataSource.query<
        { answers: ActivityFormAnswers; submitted_at: Date }[]
      >(
        `SELECT answers,submitted_at FROM activity_form_submission WHERE participation_id=$1`,
        [participations[0]!.id],
      );
      expect(submissions).toHaveLength(1);
      expect(submissions[0]).toMatchObject({
        answers: expectedAnswers(),
        submitted_at: scenario.now,
      });
    } finally {
      releaseFirst.resolve();
      const startedRequests = [first, second].filter(
        (request): request is TrackedRequest<{ submitted: true }> =>
          request !== undefined,
      );
      try {
        await waitForBarrier(
          Promise.all(startedRequests.map((request) => request.settled)),
          [],
          'overlap cleanup',
        );
      } finally {
        createQueryRunnerSpy.mockRestore();
      }
    }
  }

  it('preserves the known first writer during an overlapping submission', async () => {
    await assertFirstWriterWinsDuringOverlap(scenario.userIds[0]);
  });

  it('preserves the known first writer when simultaneous requests create participation', async () => {
    const userId = randomUUID();
    await database.dataSource.query(
      `INSERT INTO user_account (id) VALUES ($1)`,
      [userId],
    );

    await assertFirstWriterWinsDuringOverlap(userId);
  });

  it('returns an accepted first submission after the draw deadline without overwriting it', async () => {
    const participationId = scenario.participationIds[0];
    const changedForm = { ...validForm, name: '截止后重试' };
    await service(scenario.now).submit(
      scenario.userIds[0],
      'expo-2026',
      validForm,
    );
    const first = await readSubmission(participationId);
    const firstParticipation = await readParticipation(participationId);

    await expect(
      service(new Date(scenario.now.getTime() + 86_400_000)).submit(
        scenario.userIds[0],
        'expo-2026',
        changedForm,
      ),
    ).resolves.toEqual({ submitted: true });
    expect(await readSubmission(participationId)).toEqual(first);
    expect(await readParticipation(participationId)).toEqual(
      firstParticipation,
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

  it('rolls a submission back when an asynchronous post-insert check fails', async () => {
    const participationId = scenario.participationIds[0];

    await expect(
      service(scenario.now, async () => {
        await Promise.resolve();
        throw new Error('ASYNC_PARTICIPATION_UPDATE_FAILED');
      }).submit(scenario.userIds[0], 'expo-2026', validForm),
    ).rejects.toThrow('ASYNC_PARTICIPATION_UPDATE_FAILED');
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

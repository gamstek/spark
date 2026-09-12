import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StaffRecord } from './api';
import { confirmRedemptionAndUpdateRecords } from './redemption-confirmation';

const waitingRecord: StaffRecord = {
  id: '91bc021c-2e04-4ca8-b317-25f3f871c709',
  activityId: '85b19daa-babb-4ca7-a0b7-38f9f1b84ae8',
  activityCode: 'expo-2026',
  activityName: '展会抽奖',
  name: '陈*明',
  phone: '138****2210',
  prizeName: '一等奖',
  prizeImageUrl: null,
  status: 'WAIT_REDEEM',
  wonAt: '2026-09-12T10:00:00.000Z',
  redeemedAt: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('confirmRedemptionAndUpdateRecords', () => {
  it('replaces the cached pending record with the confirmed status before navigation', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      ['staff-records', waitingRecord.activityId],
      [waitingRecord],
    );
    const redeemedAt = '2026-09-12T10:22:00.590Z';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            redemptionId: waitingRecord.id,
            lotteryRecordId: '77f66ebf-1270-4516-9208-a25f7e14efe6',
            activityId: waitingRecord.activityId,
            prizeName: waitingRecord.prizeName,
            prizeImageUrl: null,
            status: 'REDEEMED',
            redeemEndAt: '2026-09-30T10:00:00.000Z',
            redeemedAt,
            userHint: '用户…1234',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );

    const result = await confirmRedemptionAndUpdateRecords(
      queryClient,
      'ABCD-EFGH',
      'csrf-token',
    );

    expect(result.status).toBe('REDEEMED');
    expect(
      queryClient.getQueryData<StaffRecord[]>([
        'staff-records',
        waitingRecord.activityId,
      ]),
    ).toEqual([
      {
        ...waitingRecord,
        status: 'REDEEMED',
        redeemedAt,
      },
    ]);
  });
});

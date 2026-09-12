import type { QueryClient } from '@tanstack/react-query';

import { staffApi, type RedemptionView, type StaffRecord } from './api';

export async function confirmRedemptionAndUpdateRecords(
  queryClient: QueryClient,
  code: string,
  csrfToken: string,
): Promise<RedemptionView> {
  const result = await staffApi.confirm(code, csrfToken);
  queryClient.setQueriesData<StaffRecord[]>(
    { queryKey: ['staff-records'] },
    (records) =>
      records?.map((record) =>
        record.id === result.redemptionId
          ? {
              ...record,
              status: result.status,
              redeemedAt: result.redeemedAt,
            }
          : record,
      ),
  );
  return result;
}

import type { DataSource } from 'typeorm';
import { expect } from 'vitest';

export async function waitForBlockedQuery(
  dataSource: DataSource,
  blockerPid: number,
): Promise<number> {
  let blockedPid: number | undefined;
  await expect
    .poll(async () => {
      const rows = await dataSource.query<{ pid: number }[]>(
        `SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))`,
        [blockerPid],
      );
      blockedPid = rows[0]?.pid;
      return blockedPid;
    })
    .toBeDefined();
  return blockedPid!;
}

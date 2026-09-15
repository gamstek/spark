import { describe, expect, it } from 'vitest';
import { deriveActivityStatus } from './activity-status';

const now = new Date('2026-09-15T12:00:00.000Z');
const base = {
  publishedVersionId: 'version-1',
  startsAt: new Date('2026-09-15T00:00:00.000Z'),
  drawEndsAt: new Date('2026-09-16T00:00:00.000Z'),
  endsAt: new Date('2026-09-17T00:00:00.000Z'),
  pausedAt: null,
};

describe('deriveActivityStatus', () => {
  it.each([
    [{ ...base, publishedVersionId: null }, 'DRAFT'],
    [{ ...base, startsAt: now }, 'RUNNING'],
    [{ ...base, startsAt: new Date('2026-09-16T00:00:00.000Z') }, 'UPCOMING'],
    [{ ...base, pausedAt: new Date('2026-09-15T01:00:00.000Z') }, 'PAUSED'],
    [{ ...base, drawEndsAt: now }, 'DRAW_ENDED'],
    [{ ...base, endsAt: now }, 'ENDED'],
    [
      {
        ...base,
        drawEndsAt: now,
        pausedAt: new Date('2026-09-15T01:00:00.000Z'),
      },
      'DRAW_ENDED',
    ],
  ] as const)('returns %s as %s', (source, expected) => {
    expect(deriveActivityStatus(source, now)).toBe(expected);
  });
});

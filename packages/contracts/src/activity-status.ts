import { z } from 'zod';

export const ActivityStatusSchema = z.enum([
  'DRAFT',
  'UPCOMING',
  'RUNNING',
  'PAUSED',
  'DRAW_ENDED',
  'ENDED',
]);
export type ActivityStatus = z.infer<typeof ActivityStatusSchema>;

export type ActivityStatusSource = {
  publishedVersionId: string | null;
  startsAt: Date;
  drawEndsAt: Date;
  endsAt: Date;
  pausedAt: Date | null;
};

export function deriveActivityStatus(
  source: ActivityStatusSource,
  now: Date,
): ActivityStatus {
  if (!source.publishedVersionId) return 'DRAFT';
  if (now >= source.endsAt) return 'ENDED';
  if (now >= source.drawEndsAt) return 'DRAW_ENDED';
  if (now < source.startsAt) return 'UPCOMING';
  if (source.pausedAt) return 'PAUSED';
  return 'RUNNING';
}

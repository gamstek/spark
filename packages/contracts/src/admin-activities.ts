import { z } from 'zod';

import { ActivityStatusSchema } from './activity-status.js';

const timestamp = z.iso.datetime({ offset: true });

export const AdminActivityListItemSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  revision: z.int().nonnegative(),
  published_version_id: z.string().min(1).nullable(),
  draft_version_id: z.string().min(1).nullable(),
  paused_at: timestamp.nullable(),
  starts_at: timestamp.nullable(),
  draw_ends_at: timestamp.nullable(),
  ends_at: timestamp.nullable(),
  status: ActivityStatusSchema,
  serverNow: timestamp,
});
export type AdminActivityListItem = z.infer<typeof AdminActivityListItemSchema>;

export const AdminActivityListSchema = z.array(
  AdminActivityListItemSchema.refine(
    (activity) =>
      activity.status === 'DRAFT' ||
      (activity.starts_at !== null &&
        activity.draw_ends_at !== null &&
        activity.ends_at !== null),
    { message: 'Published activities require a complete schedule' },
  ),
);

export const AdminActivityDetailSchema = AdminActivityListItemSchema.extend({
  starts_at: timestamp,
  draw_ends_at: timestamp,
  ends_at: timestamp,
  redeem_ends_at: timestamp,
  version: z.int().positive(),
  template_id: z.string().min(1),
  template_version: z.int().positive(),
  config: z.record(z.string(), z.unknown()),
});
export type AdminActivityDetail = z.infer<typeof AdminActivityDetailSchema>;

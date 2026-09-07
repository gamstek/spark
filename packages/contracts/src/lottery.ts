import { z } from 'zod';

import { WinViewSchema } from './redemptions.js';

export const DrawResultSchema = z.object({ win: WinViewSchema }).strict();
export type DrawResult = z.infer<typeof DrawResultSchema>;

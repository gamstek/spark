import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import dataSource from '../data-source.js';
import { createAdminAccount } from './admin-seed.service.js';

const username = process.argv[2]?.trim();
if (!username)
  throw new Error('Usage: pnpm --filter @spark/api admin:create -- <username>');

const prompt = createInterface({ input: stdin, output: stdout });
const password = await prompt.question('Administrator password: ');
prompt.close();

await dataSource.initialize();
try {
  await createAdminAccount(dataSource, { username, password });
} finally {
  await dataSource.destroy();
}

import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { hashPassword } from '../../src/auth/accounts.service.js';
import dataSource from '../data-source.js';

const username = process.argv[2]?.trim();
if (!username) throw new Error('Usage: pnpm --filter @spark/api admin:create -- <username>');

const prompt = createInterface({ input: stdin, output: stdout });
const password = await prompt.question('Administrator password: ');
prompt.close();
if (password.length < 12 || ['password', 'admin123456', 'changeme'].includes(password.toLowerCase())) throw new Error('PASSWORD_TOO_WEAK');

await dataSource.initialize();
try {
  await dataSource.query(
    `INSERT INTO admin_account (id, username, password_hash, display_name) VALUES ($1,$2,$3,$2)`,
    [randomUUID(), username, await hashPassword(password)],
  );
} finally {
  await dataSource.destroy();
}

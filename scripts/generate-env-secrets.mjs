import { randomBytes } from 'node:crypto';

const labeledSecret = (label) =>
  `${label}-${randomBytes(32).toString('base64url')}`;
const redemptionKey = randomBytes(32).toString('base64');

const secrets = {
  CSRF_SECRET: labeledSecret('csrf'),
  OAUTH_STATE_SECRET: labeledSecret('oauth'),
  WECHAT_TOKEN_ENCRYPTION_KEY: labeledSecret('wechat-token'),
  REDEEM_CODE_ACTIVE_KEY_ID: 'v1',
  REDEEM_CODE_KEYS: JSON.stringify({ v1: redemptionKey }),
};

for (const [name, value] of Object.entries(secrets)) {
  process.stdout.write(`${name}=${value}\n`);
}

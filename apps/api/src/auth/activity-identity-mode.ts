export type ActivityIdentityMode = 'anonymous' | 'wechat';

export const ACTIVITY_IDENTITY_MODE = Symbol('ACTIVITY_IDENTITY_MODE');

export function readActivityIdentityMode(
  value = process.env.ACTIVITY_IDENTITY_MODE,
): ActivityIdentityMode {
  if (value === undefined || value === '' || value === 'anonymous')
    return 'anonymous';
  if (value === 'wechat') return 'wechat';
  throw new Error('ACTIVITY_IDENTITY_MODE_INVALID');
}

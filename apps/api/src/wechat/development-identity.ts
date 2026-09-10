export const DEVELOPMENT_WECHAT_OPENID = 'development-wechat-user';

export function isDevelopmentWechatIdentity(openid: string): boolean {
  return (
    process.env.NODE_ENV === 'development' &&
    openid === DEVELOPMENT_WECHAT_OPENID
  );
}

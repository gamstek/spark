export const databaseEntities = [
  'user_account', 'wechat_identity', 'app_session', 'oauth_state', 'wechat_credential_cache',
  'activity', 'activity_version', 'activity_participation', 'dingtalk_form_submission',
  'webhook_receipt', 'background_job', 'prize', 'activity_prize', 'lottery_record',
  'redemption', 'admin_account', 'staff_account', 'staff_activity_permission', 'channel_visit',
  'stock_adjustment', 'audit_event', 'media_asset', 'export_job',
] as const;

export type DatabaseEntityName = (typeof databaseEntities)[number];

import {
  AdminAccount,
  AppSession,
  OauthState,
  StaffAccount,
  UserAccount,
  WechatActivityEntryToken,
  WechatCredentialCache,
  WechatIdentity,
} from './accounts.entities.js';
import {
  Activity,
  ActivityVersion,
  ActivityVersionPrize,
  MediaAsset,
  StaffActivityPermission,
} from './campaigns.entities.js';
import {
  ActivityPrize,
  LotteryRecord,
  Prize,
  Redemption,
  StockAdjustment,
} from './lottery.entities.js';
import { AuditEvent, BackgroundJob, ExportJob } from './operations.entities.js';
import {
  ActivityParticipation,
  ChannelVisit,
  DingtalkFormSubmission,
  WebhookReceipt,
} from './participation.entities.js';

export * from './accounts.entities.js';
export * from './campaigns.entities.js';
export * from './lottery.entities.js';
export * from './operations.entities.js';
export * from './participation.entities.js';

export const databaseEntities = [
  UserAccount,
  WechatIdentity,
  WechatActivityEntryToken,
  AdminAccount,
  StaffAccount,
  AppSession,
  OauthState,
  WechatCredentialCache,
  MediaAsset,
  Activity,
  ActivityVersion,
  ActivityVersionPrize,
  StaffActivityPermission,
  ActivityParticipation,
  WebhookReceipt,
  DingtalkFormSubmission,
  ChannelVisit,
  Prize,
  ActivityPrize,
  LotteryRecord,
  Redemption,
  StockAdjustment,
  BackgroundJob,
  AuditEvent,
  ExportJob,
];

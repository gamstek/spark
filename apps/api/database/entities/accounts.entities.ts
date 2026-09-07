import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

@Entity({ name: 'user_account' })
export class UserAccount {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}

@Entity({ name: 'wechat_identity' })
@Unique('wechat_identity_app_openid_key', ['appId', 'openid'])
@Index('wechat_identity_subscription_cache_idx', ['subscriptionCheckedAt'])
export class WechatIdentity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ name: 'app_id', type: 'varchar', length: 64 }) appId!: string;
  @Column({ type: 'varchar', length: 128 }) openid!: string;
  @Column({ type: 'varchar', length: 128, nullable: true })
  unionid!: string | null;
  @Column({ type: 'boolean', nullable: true }) subscribed!: boolean | null;
  @Column({
    name: 'subscription_checked_at',
    type: 'timestamptz',
    nullable: true,
  })
  subscriptionCheckedAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

abstract class OperatorAccount {
  @PrimaryColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 100, unique: true }) username!: string;
  @Column({ name: 'password_hash', type: 'text' }) passwordHash!: string;
  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName!: string;
  @Column({ name: 'disabled_at', type: 'timestamptz', nullable: true })
  disabledAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

@Entity({ name: 'admin_account' })
export class AdminAccount extends OperatorAccount {}

@Entity({ name: 'staff_account' })
export class StaffAccount extends OperatorAccount {}

@Entity({ name: 'app_session' })
@Index('app_session_expires_idx', ['expiresAt'])
export class AppSession {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'session_hash', type: 'varchar', length: 128, unique: true })
  sessionHash!: string;
  @Column({ type: 'varchar', length: 16 }) role!: string;
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;
  @Column({ name: 'admin_account_id', type: 'uuid', nullable: true })
  adminAccountId!: string | null;
  @Column({ name: 'staff_account_id', type: 'uuid', nullable: true })
  staffAccountId!: string | null;
  @Column({ name: 'csrf_hash', type: 'varchar', length: 128, nullable: true })
  csrfHash!: string | null;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

@Entity({ name: 'oauth_state' })
@Index('oauth_state_expires_idx', ['expiresAt'], {
  where: 'consumed_at IS NULL',
})
export class OauthState {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'state_hash', type: 'varchar', length: 128, unique: true })
  stateHash!: string;
  @Column({ name: 'browser_nonce_hash', type: 'varchar', length: 128 })
  browserNonceHash!: string;
  @Column({ name: 'return_path', type: 'text' }) returnPath!: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}

@Entity({ name: 'wechat_credential_cache' })
export class WechatCredentialCache {
  @PrimaryColumn({ name: 'app_id', type: 'varchar', length: 64 })
  appId!: string;
  @Column({ name: 'access_token_ciphertext', type: 'text' })
  accessTokenCiphertext!: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'refresh_lease_until', type: 'timestamptz', nullable: true })
  refreshLeaseUntil!: Date | null;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}

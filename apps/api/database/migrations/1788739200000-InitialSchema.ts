import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1788739200000 implements MigrationInterface {
  name = 'InitialSchema1788739200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_account (
        id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE wechat_identity (
        id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
        app_id varchar(64) NOT NULL, openid varchar(128) NOT NULL, unionid varchar(128),
        created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (app_id, openid)
      );
      CREATE TABLE admin_account (
        id uuid PRIMARY KEY, username varchar(100) NOT NULL UNIQUE, password_hash text NOT NULL,
        display_name varchar(100) NOT NULL, disabled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE staff_account (
        id uuid PRIMARY KEY, username varchar(100) NOT NULL UNIQUE, password_hash text NOT NULL,
        display_name varchar(100) NOT NULL, disabled_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE app_session (
        id uuid PRIMARY KEY, session_hash varchar(128) NOT NULL UNIQUE,
        role varchar(16) NOT NULL CHECK (role IN ('ACTIVITY','STAFF','ADMIN')),
        user_id uuid REFERENCES user_account(id) ON DELETE RESTRICT,
        admin_account_id uuid REFERENCES admin_account(id) ON DELETE RESTRICT,
        staff_account_id uuid REFERENCES staff_account(id) ON DELETE RESTRICT,
        csrf_hash varchar(128), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (num_nonnulls(user_id, admin_account_id, staff_account_id) = 1)
      );
      CREATE INDEX app_session_expires_idx ON app_session (expires_at);
      CREATE TABLE oauth_state (
        id uuid PRIMARY KEY, state_hash varchar(128) NOT NULL UNIQUE, browser_nonce_hash varchar(128) NOT NULL,
        return_path text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX oauth_state_expires_idx ON oauth_state (expires_at) WHERE consumed_at IS NULL;
      CREATE TABLE wechat_credential_cache (
        app_id varchar(64) PRIMARY KEY, access_token_ciphertext text NOT NULL, expires_at timestamptz NOT NULL,
        refresh_lease_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE media_asset (
        id uuid PRIMARY KEY, storage_key text NOT NULL UNIQUE, mime_type varchar(100) NOT NULL,
        byte_size bigint NOT NULL CHECK (byte_size > 0), created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE activity (
        id uuid PRIMARY KEY, code varchar(64) NOT NULL UNIQUE, name varchar(120) NOT NULL,
        draft_version_id uuid, published_version_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE activity_version (
        id uuid PRIMARY KEY, activity_id uuid NOT NULL REFERENCES activity(id) ON DELETE RESTRICT,
        version integer NOT NULL CHECK (version > 0), status varchar(16) NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
        template_id varchar(64) NOT NULL, template_version integer NOT NULL CHECK (template_version > 0), config_schema_version integer NOT NULL CHECK (config_schema_version > 0),
        config jsonb NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, draw_ends_at timestamptz NOT NULL, redeem_ends_at timestamptz NOT NULL,
        published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (activity_id, version),
        CHECK (starts_at < ends_at AND starts_at < draw_ends_at AND draw_ends_at <= ends_at AND redeem_ends_at >= draw_ends_at)
      );
      ALTER TABLE activity ADD CONSTRAINT activity_draft_version_fk FOREIGN KEY (draft_version_id) REFERENCES activity_version(id) ON DELETE RESTRICT;
      ALTER TABLE activity ADD CONSTRAINT activity_published_version_fk FOREIGN KEY (published_version_id) REFERENCES activity_version(id) ON DELETE RESTRICT;
      CREATE INDEX activity_version_time_idx ON activity_version (starts_at, ends_at);
      CREATE TABLE staff_activity_permission (
        staff_account_id uuid NOT NULL REFERENCES staff_account(id) ON DELETE RESTRICT,
        activity_id uuid NOT NULL REFERENCES activity(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (staff_account_id, activity_id)
      );
      CREATE TABLE activity_participation (
        id uuid PRIMARY KEY, activity_id uuid NOT NULL REFERENCES activity(id) ON DELETE RESTRICT,
        user_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT, lead_completed boolean NOT NULL DEFAULT false,
        lead_completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (activity_id, user_id)
      );
      CREATE TABLE webhook_receipt (
        id uuid PRIMARY KEY, form_id varchar(128) NOT NULL, record_id varchar(256) NOT NULL,
        participation_id uuid NOT NULL, payload jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), UNIQUE (form_id, record_id)
      );
      CREATE TABLE dingtalk_form_submission (
        id uuid PRIMARY KEY, form_id varchar(128) NOT NULL, record_id varchar(256) NOT NULL,
        participation_id uuid NOT NULL REFERENCES activity_participation(id) ON DELETE RESTRICT,
        fields jsonb NOT NULL, submitted_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (form_id, record_id)
      );
      CREATE TABLE background_job (
        id uuid PRIMARY KEY, kind varchar(80) NOT NULL, deduplication_key varchar(256) UNIQUE,
        payload jsonb NOT NULL, status varchar(16) NOT NULL CHECK (status IN ('PENDING','RUNNING','SUCCEEDED','FAILED')) DEFAULT 'PENDING',
        attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0), available_at timestamptz NOT NULL DEFAULT now(),
        lease_owner varchar(128), lease_until timestamptz, last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX background_job_claim_idx ON background_job (status, available_at, lease_until);
      CREATE TABLE prize (
        id uuid PRIMARY KEY, name varchar(120) NOT NULL, image_asset_id uuid REFERENCES media_asset(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE activity_prize (
        id uuid PRIMARY KEY, activity_id uuid NOT NULL REFERENCES activity(id) ON DELETE RESTRICT,
        prize_id uuid NOT NULL REFERENCES prize(id) ON DELETE RESTRICT, total_stock integer NOT NULL, awarded_stock integer NOT NULL DEFAULT 0,
        weight numeric(14,6) NOT NULL CHECK (weight > 0), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (activity_id, prize_id),
        CHECK (total_stock >= 0 AND awarded_stock >= 0 AND awarded_stock <= total_stock)
      );
      CREATE TABLE lottery_record (
        id uuid PRIMARY KEY, activity_id uuid NOT NULL REFERENCES activity(id) ON DELETE RESTRICT,
        user_id uuid NOT NULL REFERENCES user_account(id) ON DELETE RESTRICT,
        participation_id uuid NOT NULL UNIQUE REFERENCES activity_participation(id) ON DELETE RESTRICT,
        activity_prize_id uuid NOT NULL REFERENCES activity_prize(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (activity_id, user_id)
      );
      CREATE TABLE redemption (
        id uuid PRIMARY KEY, lottery_record_id uuid NOT NULL UNIQUE REFERENCES lottery_record(id) ON DELETE RESTRICT,
        redeem_code_hash varchar(128) NOT NULL UNIQUE, status varchar(20) NOT NULL CHECK (status IN ('WAIT_REDEEM','REDEEMED','EXPIRED')),
        redeem_end_at timestamptz NOT NULL, redeemed_at timestamptz, redeemed_by_staff_id uuid REFERENCES staff_account(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX redemption_status_end_idx ON redemption (status, redeem_end_at);
      CREATE TABLE channel_visit (
        id uuid PRIMARY KEY, activity_id uuid NOT NULL REFERENCES activity(id) ON DELETE RESTRICT,
        user_id uuid REFERENCES user_account(id) ON DELETE RESTRICT, channel_code varchar(64) NOT NULL,
        visited_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX channel_visit_activity_time_idx ON channel_visit (activity_id, visited_at);
      CREATE TABLE stock_adjustment (
        id uuid PRIMARY KEY, activity_prize_id uuid NOT NULL REFERENCES activity_prize(id) ON DELETE RESTRICT,
        quantity integer NOT NULL CHECK (quantity > 0), reason varchar(500) NOT NULL, admin_account_id uuid NOT NULL REFERENCES admin_account(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE audit_event (
        id uuid PRIMARY KEY, actor_type varchar(20) NOT NULL, actor_id uuid, action varchar(100) NOT NULL,
        resource_type varchar(100) NOT NULL, resource_id uuid, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX audit_event_resource_idx ON audit_event (resource_type, resource_id, created_at);
      CREATE TABLE export_job (
        id uuid PRIMARY KEY, requested_by_admin_id uuid NOT NULL REFERENCES admin_account(id) ON DELETE RESTRICT,
        activity_id uuid REFERENCES activity(id) ON DELETE RESTRICT, status varchar(16) NOT NULL CHECK (status IN ('PENDING','RUNNING','SUCCEEDED','FAILED')) DEFAULT 'PENDING',
        filters jsonb NOT NULL DEFAULT '{}', storage_key text, lease_owner varchar(128), lease_until timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
      );
      CREATE INDEX export_job_claim_idx ON export_job (status, created_at, lease_until);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS export_job, audit_event, stock_adjustment, channel_visit, redemption,
        lottery_record, activity_prize, prize, background_job, dingtalk_form_submission,
        webhook_receipt, activity_participation, staff_activity_permission, activity_version,
        activity, media_asset, wechat_credential_cache, oauth_state, app_session,
        staff_account, admin_account, wechat_identity, user_account CASCADE;
    `);
  }
}

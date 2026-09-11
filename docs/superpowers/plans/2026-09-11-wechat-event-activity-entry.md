# WeChat Event Activity Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace anonymous activity identity with a WeChat subscribe/menu
callback that issues a ten-minute, single-use activity entry token and exchanges
it for the existing activity session.

**Architecture:** Rewrite local `main` onto `10b4da8`, preserving only the
approved event-entry design and implementation-plan content, then add a narrow
plaintext WeChat callback protocol layer, an OpenID-to-entry-token service
backed by PostgreSQL, and a redirecting token exchange endpoint. The activity H5
no longer starts OAuth on a production 401; it tells users to re-enter through
the Official Account while preserving development simulation.

**Tech Stack:** TypeScript 6, NestJS 12 with Fastify 5, TypeORM/PostgreSQL,
React 19, TanStack Query, Vitest, pnpm/Turborepo.

**Spec:**
`docs/superpowers/specs/2026-09-11-wechat-event-activity-entry-design.md`

## Global Constraints

- Production callback URL is exactly
  `https://spark.gamstek.com/api/wechat/callback`.
- Production `PUBLIC_BASE_URL` is exactly `https://spark.gamstek.com`; entry
  links never derive their origin from request headers.
- Official Account message mode is plaintext, and every GET/POST callback
  validates the WeChat SHA-1 signature before processing input.
- Only `subscribe` and `CLICK` with `EventKey=LOTTERY` issue entry tokens;
  `unsubscribe` updates state; all other input returns `success`.
- The active activity query requires exactly one published activity satisfying
  `starts_at <= now < ends_at`.
- Entry tokens contain 32 random bytes, expire after ten minutes, are stored
  only as SHA-256 hashes, and can be consumed successfully once.
- OpenID, callback secrets, plaintext entry tokens, and full inbound XML must
  never be logged.
- Production activity 401 responses do not trigger OAuth; development simulation
  remains supported.
- Follow repository style: TypeScript, two spaces, single quotes, semicolons,
  kebab-case files, and Prettier formatting.

## File Structure

- `apps/api/database/migrations/1788739208000-WechatActivityEntryTokens.ts`:
  creates and removes the entry-token table and indexes.
- `apps/api/database/entities/accounts.entities.ts`: declares
  `WechatActivityEntryToken`.
- `apps/api/src/wechat/callback-protocol.ts`: verifies signatures and
  parses/renders the supported plaintext XML subset.
- `apps/api/src/wechat/activity-entry.service.ts`: selects the unique active
  activity, issues hashed tokens, and atomically exchanges them for sessions.
- `apps/api/src/wechat/callback.controller.ts`: exposes callback verification
  and event handling.
- `apps/api/src/wechat/activity-entry.controller.ts`: exchanges a URL token and
  redirects without retaining it in the browser URL.
- `apps/api/src/wechat/wechat-identity.service.ts`: records subscribed and
  unsubscribed event state.
- `apps/api/src/auth/session.service.ts`: permits session insertion through an
  existing transaction manager.
- `apps/activity/src/lib/runtime.tsx`: replaces production OAuth bootstrap with
  entry instructions and handles entry errors.
- `apps/activity/src/pages/activity-entry-error-page.tsx`: renders the generic
  invalid-entry route.
- Existing module, migration registry, maintenance, configuration, setup, and
  test files wire and verify those units.

---

### Task 1: Remove Anonymous Identity Mode from Local History

**Files:**

- Rewrite local `main` from base commit `10b4da8`.
- Replay the approved event-entry design and implementation-plan commits only;
  preserve their document content while omitting anonymous-mode history.
- Ensure commits `dcbc8f6`, `31cf4c8`, and `991d882`, plus interim commits
  `817e26f`, `8ce1d58`, and `8b0da14`, are absent from `main` ancestry.

**Interfaces:**

- Consumes: clean `main` at or after design commit `2b23ab0`.
- Produces: restored pre-anonymous WeChat behavior while preserving the approved
  event-entry design document.

- [ ] **Step 1: Record the exact clean starting state**

Run: `git status --short && git log --oneline -5`

Expected: no working-tree changes; `main` is based on `10b4da8`.

- [ ] **Step 2: Rewrite the local history**

Run: `git reset --hard 10b4da8 && git cherry-pick 2b23ab0 62d7e73`

Expected: `main` contains only the base followed by the approved design and
implementation-plan content; all six obsolete commits are absent from its
ancestry.

- [ ] **Step 3: Verify the rollback boundary**

Run:
`git diff 10b4da8..HEAD -- . ':!docs/superpowers/specs/2026-09-11-wechat-event-activity-entry-design.md' ':!docs/superpowers/plans/2026-09-11-wechat-event-activity-entry.md'`

Expected: no output; only the approved design and this implementation plan
differ from `10b4da8`. Also verify each obsolete commit is not an ancestor of
`main` with `git merge-base --is-ancestor`.

### Task 2: Add the Entry-Token Persistence Model

**Files:**

- Create:
  `apps/api/database/migrations/1788739208000-WechatActivityEntryTokens.ts`
- Modify: `apps/api/database/entities/accounts.entities.ts`
- Modify: `apps/api/database/entities/index.ts`
- Modify: `apps/api/database/data-source.ts`
- Modify: `apps/api/test/support/database.ts`
- Modify: `apps/api/test/entities.integration.test.ts`

**Interfaces:**

- Consumes: existing `user_account` and `activity` primary keys.
- Produces: `WechatActivityEntryToken` with `id`, `tokenHash`, `userId`,
  `activityId`, `expiresAt`, `consumedAt`, and `createdAt`.

- [ ] **Step 1: Write the failing entity metadata test**

Add assertions to `apps/api/test/entities.integration.test.ts`:

```ts
expect(database.tableNames).toContain('wechat_activity_entry_token');
const entryToken = database.dataSource.getMetadata(WechatActivityEntryToken);
expect(entryToken.uniques.map((item) => item.name)).toContain(
  'wechat_activity_entry_token_hash_key',
);
expect(entryToken.indices.map((item) => item.name)).toContain(
  'wechat_activity_entry_token_cleanup_idx',
);
```

Import `WechatActivityEntryToken` from the entity index.

- [ ] **Step 2: Run the metadata test and observe the missing model**

Run: `pnpm --filter @spark/api test:integration -- entities.integration.test.ts`

Expected: FAIL because `WechatActivityEntryToken` and its table do not exist.

- [ ] **Step 3: Add the migration and entity**

Create a migration whose `up` executes:

```sql
CREATE TABLE wechat_activity_entry_token (
  id uuid PRIMARY KEY,
  token_hash varchar(64) NOT NULL,
  user_id uuid NOT NULL REFERENCES user_account(id),
  activity_id uuid NOT NULL REFERENCES activity(id),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wechat_activity_entry_token_hash_key UNIQUE (token_hash)
)
```

Then create:

```sql
CREATE INDEX wechat_activity_entry_token_cleanup_idx
ON wechat_activity_entry_token (expires_at, consumed_at)
```

The migration `down` drops the index and table. Add the matching TypeORM entity
with `@Unique` and `@Index`, export it from `entities/index.ts`, and register
the entity and migration in both production and test data-source lists.

- [ ] **Step 4: Format and run the metadata test**

Run:
`pnpm exec prettier --write apps/api/database/migrations/1788739208000-WechatActivityEntryTokens.ts apps/api/database/entities/accounts.entities.ts apps/api/database/entities/index.ts apps/api/database/data-source.ts apps/api/test/support/database.ts apps/api/test/entities.integration.test.ts && pnpm --filter @spark/api test:integration -- entities.integration.test.ts`

Expected: PASS, including the new table, unique constraint, and cleanup index.

- [ ] **Step 5: Commit the persistence model**

Run:

```text
git add apps/api/database/migrations/1788739208000-WechatActivityEntryTokens.ts apps/api/database/entities/accounts.entities.ts apps/api/database/entities/index.ts apps/api/database/data-source.ts apps/api/test/support/database.ts apps/api/test/entities.integration.test.ts
git commit -m "Add WeChat activity entry tokens"
```

### Task 3: Implement the Plaintext Callback Protocol

**Files:**

- Create: `apps/api/src/wechat/callback-protocol.ts`
- Create: `apps/api/src/wechat/callback-protocol.test.ts`

**Interfaces:**

- Consumes: `WECHAT_CALLBACK_TOKEN`, query `signature`, `timestamp`, `nonce`,
  and a plaintext XML string.
- Produces: `verifyWechatSignature(input): boolean`,
  `parseWechatEventXml(xml): WechatEvent`, and `renderTextReply(input): string`.

- [ ] **Step 1: Write failing signature tests**

Cover the known algorithm and invalid lengths:

```ts
expect(
  verifyWechatSignature({
    token: 'callback-secret',
    timestamp: '1789123456',
    nonce: 'nonce-value',
    signature: sha1(
      ['callback-secret', '1789123456', 'nonce-value'].sort().join(''),
    ),
  }),
).toBe(true);
expect(verifyWechatSignature({ ...valid, signature: 'bad' })).toBe(false);
```

The test-local `sha1` helper may use `createHash('sha1')`; production
verification must use `timingSafeEqual` after confirming equal buffer lengths.

- [ ] **Step 2: Write failing XML behavior tests**

Use real XML strings to assert that `subscribe`, uppercase `CLICK`, and
`EventKey` parse correctly; `<!DOCTYPE`, `<!ENTITY`, missing required fields,
and input over 64 KiB throw `WECHAT_XML_INVALID`. Assert that reply rendering
reverses sender/recipient and escapes `&`, `<`, and `]]>` in content.

- [ ] **Step 3: Run the protocol tests and observe the missing module**

Run: `pnpm --filter @spark/api test -- callback-protocol.test.ts`

Expected: FAIL because `callback-protocol.ts` does not exist.

- [ ] **Step 4: Implement the narrow protocol helpers**

Define:

```ts
export interface WechatEvent {
  toUserName: string;
  fromUserName: string;
  createTime: number;
  msgType: string;
  event?: string;
  eventKey?: string;
}

export function verifyWechatSignature(input: {
  token: string;
  timestamp: string;
  nonce: string;
  signature: string;
}): boolean;

export function parseWechatEventXml(xml: string): WechatEvent;

export function renderTextReply(input: {
  toUserName: string;
  fromUserName: string;
  createTime: number;
  content: string;
}): string;
```

Limit the parser to the documented scalar fields. Reject declarations and
entities before extracting either CDATA or escaped text values. Decode only the
five predefined XML entities, validate `CreateTime` as a finite integer, and
render dynamic values with XML escaping rather than string interpolation into
CDATA.

- [ ] **Step 5: Format and run the protocol tests**

Run:
`pnpm exec prettier --write apps/api/src/wechat/callback-protocol.ts apps/api/src/wechat/callback-protocol.test.ts && pnpm --filter @spark/api test -- callback-protocol.test.ts`

Expected: all callback protocol tests PASS.

- [ ] **Step 6: Commit the protocol layer**

Run:

```text
git add apps/api/src/wechat/callback-protocol.ts apps/api/src/wechat/callback-protocol.test.ts
git commit -m "Add WeChat callback protocol"
```

### Task 4: Implement Entry Issue and Atomic Exchange

**Files:**

- Create: `apps/api/src/wechat/activity-entry.service.ts`
- Create: `apps/api/src/wechat/activity-entry.service.test.ts`
- Modify: `apps/api/src/auth/session.service.ts`
- Create: `apps/api/src/auth/session.service.test.ts`

**Interfaces:**

- Consumes: `WechatIdentityService.getOrCreateUser(openid)`, an explicit
  `publicBaseUrl`, PostgreSQL, and
  `SessionService.create(role, subjectId, manager?)`.
- Produces: `issue(openid): Promise<EntryIssueResult>` and
  `exchange(token): Promise<EntryExchangeResult>`.

- [ ] **Step 1: Write the failing session transaction test**

Add a test proving that:

```ts
await sessions.create('ACTIVITY', 'user-id', suppliedManager);
expect(suppliedManager.getRepository).toHaveBeenCalledWith(AppSession);
expect(dataSource.getRepository).not.toHaveBeenCalled();
```

Name the optional third parameter
`manager: EntityManager = this.dataSource.manager` so existing callers remain
unchanged.

- [ ] **Step 2: Run the session test and observe the unsupported manager**

Run: `pnpm --filter @spark/api test -- session.service.test.ts`

Expected: FAIL because `SessionService.create` does not accept the manager.

- [ ] **Step 3: Route session insertion through the supplied manager**

Change only the repository acquisition inside `create` to
`manager.getRepository(AppSession)`. Keep token generation, CSRF derivation,
role lifetimes, return type, and existing callers unchanged.

- [ ] **Step 4: Run the session tests**

Run: `pnpm --filter @spark/api test -- session.service.test.ts`

Expected: PASS for default and supplied-manager session creation.

- [ ] **Step 5: Write failing issue-service tests**

Define and test this result union:

```ts
export type EntryIssueResult =
  | { status: 'issued'; url: string; activityCode: string }
  | { status: 'no-active-activity' }
  | { status: 'multiple-active-activities' };
```

Tests must assert that zero rows and two rows insert nothing, one row calls
identity creation/subscribe update and inserts a 64-character hash, and the
returned URL starts with `https://spark.gamstek.com/api/activity/entry?t=`
without returning the stored hash. Inject a clock and random-token factory for
deterministic assertions.

- [ ] **Step 6: Write failing exchange-service tests**

Define:

```ts
export type EntryExchangeResult =
  | { status: 'exchanged'; activityCode: string; sessionToken: string }
  | { status: 'invalid'; activityCode: string | null };
```

Assert unknown, expired, and consumed rows return `invalid` without creating a
session. Assert a valid row is selected `FOR UPDATE`, receives `consumed_at`,
and creates the ACTIVITY session with the same transaction manager. Add a test
whose second concurrent exchange returns invalid after the first commits.

- [ ] **Step 7: Run the entry-service tests and observe the missing service**

Run: `pnpm --filter @spark/api test -- activity-entry.service.test.ts`

Expected: FAIL because `WechatActivityEntryService` does not exist.

- [ ] **Step 8: Implement issue and exchange**

Implement:

```ts
export class WechatActivityEntryService {
  async issue(openid: string): Promise<EntryIssueResult>;
  async exchange(token: string): Promise<EntryExchangeResult>;
}
```

`issue` calls `getOrCreateUser`, marks the identity subscribed, selects at most
two matching published activities using the injected clock, and inserts a token
hash with an expiry exactly ten minutes later. `exchange` rejects empty or
implausibly long input before hashing, then uses a transaction and `FOR UPDATE`
query joining `activity`; it updates `consumed_at` and calls
`sessions.create('ACTIVITY', userId, manager)` in the same transaction.

- [ ] **Step 9: Format and run both service test files**

Run:
`pnpm exec prettier --write apps/api/src/auth/session.service.ts apps/api/src/auth/session.service.test.ts apps/api/src/wechat/activity-entry.service.ts apps/api/src/wechat/activity-entry.service.test.ts && pnpm --filter @spark/api test -- session.service.test.ts activity-entry.service.test.ts`

Expected: all session and entry-service tests PASS.

- [ ] **Step 10: Commit the service layer**

Run:

```text
git add apps/api/src/auth/session.service.ts apps/api/src/auth/session.service.test.ts apps/api/src/wechat/activity-entry.service.ts apps/api/src/wechat/activity-entry.service.test.ts
git commit -m "Issue single-use activity entries"
```

### Task 5: Expose WeChat Callback and Entry Exchange Endpoints

**Files:**

- Create: `apps/api/src/wechat/callback.controller.ts`
- Create: `apps/api/src/wechat/callback.controller.test.ts`
- Create: `apps/api/src/wechat/activity-entry.controller.ts`
- Create: `apps/api/src/wechat/activity-entry.controller.test.ts`
- Modify: `apps/api/src/wechat/wechat-identity.service.ts`
- Create: `apps/api/src/wechat/wechat-identity.service.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`

**Interfaces:**

- Consumes: protocol helpers and `WechatActivityEntryService` from Tasks 3-4.
- Produces: public GET/POST `/api/wechat/callback` and GET
  `/api/activity/entry?t=...` endpoints.

- [ ] **Step 1: Write failing identity event-state tests**

Add tests proving `markSubscribed(openid)` and `markUnsubscribed(openid)` update
the current AppID row with the matching boolean and
`subscriptionCheckedAt: () => 'now()'`.

- [ ] **Step 2: Implement unsubscribe state**

Add `markUnsubscribed(openid): Promise<void>` beside `markSubscribed`; do not
log or return the OpenID.

- [ ] **Step 3: Write failing callback controller tests**

Test GET with a known valid signature returns the exact `echostr`; invalid
signature throws `WECHAT_SIGNATURE_INVALID`. For POST, use signed real XML and
assert:

- `subscribe` and `CLICK`/`LOTTERY` call `entries.issue(fromUserName)` and
  return a `text/xml` welcome reply containing its URL;
- zero/multiple activity statuses return the approved Chinese business reply and
  contain no URL;
- `unsubscribe` calls `markUnsubscribed` and returns `success`;
- other events and non-`LOTTERY` clicks return `success`;
- service errors are logged through the controller boundary and return `success`
  without exposing the exception.

- [ ] **Step 4: Write failing entry controller tests**

Assert an exchanged result sets:

```text
spark_activity=<sessionToken>; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800
```

with `; Secure` in production and redirects to the URL-encoded safe activity
route `/activity/<code>`. Invalid known tokens redirect to
`/activity/<code>?entryError=invalid`; unknown tokens redirect to
`/activity/entry-error`. Activity codes come from the database but must still be
encoded as a single URL path segment.

- [ ] **Step 5: Run controller tests and observe missing controllers**

Run:
`pnpm --filter @spark/api test -- callback.controller.test.ts activity-entry.controller.test.ts`

Expected: FAIL because both controllers are missing.

- [ ] **Step 6: Implement callback controllers and XML body registration**

Create `WechatCallbackController` with `@Controller('wechat/callback')` and
explicit `@Header('Content-Type', 'text/plain; charset=utf-8')` or reply headers
per result. Require `WECHAT_CALLBACK_TOKEN` at startup in production and reject
missing query components before comparison.

Construct the Fastify adapter before `NestFactory.create`, and register a
`text/xml` plus `application/xml` content-type parser that uses
`parseAs: 'string'` and `bodyLimit: 64 * 1024`. Pass the resulting string to the
controller with `@Body()`.

Create `ActivityEntryController` with `@Controller('activity/entry')`; its GET
calls `entries.exchange(t)`, writes the cookie only for `exchanged`, and always
redirects to a relative path.

- [ ] **Step 7: Wire dependencies in AppModule**

Register both controllers and provide `WechatActivityEntryService` with:

```ts
useFactory: (
  dataSource: DataSource,
  identities: WechatIdentityService,
  sessions: SessionService,
) =>
  new WechatActivityEntryService(
    dataSource,
    identities,
    sessions,
    process.env.PUBLIC_BASE_URL,
  );
```

Validate `PUBLIC_BASE_URL` as an HTTPS origin without path, query, credentials,
or fragment; require it in production and use `http://localhost:3000` only for
development/test.

- [ ] **Step 8: Format and run controller and identity tests**

Run:
`pnpm exec prettier --write apps/api/src/wechat/callback.controller.ts apps/api/src/wechat/callback.controller.test.ts apps/api/src/wechat/activity-entry.controller.ts apps/api/src/wechat/activity-entry.controller.test.ts apps/api/src/wechat/wechat-identity.service.ts apps/api/src/wechat/wechat-identity.service.test.ts apps/api/src/app.module.ts apps/api/src/main.ts && pnpm --filter @spark/api test -- callback.controller.test.ts activity-entry.controller.test.ts wechat-identity.service.test.ts`

Expected: all selected tests PASS.

- [ ] **Step 9: Commit the HTTP boundary**

Run:

```text
git add apps/api/src/wechat/callback.controller.ts apps/api/src/wechat/callback.controller.test.ts apps/api/src/wechat/activity-entry.controller.ts apps/api/src/wechat/activity-entry.controller.test.ts apps/api/src/wechat/wechat-identity.service.ts apps/api/src/wechat/wechat-identity.service.test.ts apps/api/src/app.module.ts apps/api/src/main.ts
git commit -m "Handle WeChat activity entry callbacks"
```

### Task 6: Add PostgreSQL End-to-End Entry Tests

**Files:**

- Create: `apps/api/test/wechat-activity-entry.integration.test.ts`
- Modify: `apps/api/test/support/fixtures.ts` only if the existing scenario
  helper cannot create multiple timed published activities.

**Interfaces:**

- Consumes: real test PostgreSQL, callback controller/service, token table, and
  session service.
- Produces: regression coverage for identity cardinality, activity selection,
  and one-time exchange concurrency.

- [ ] **Step 1: Write the signed subscribe integration test**

Create an active published activity and send a signed `subscribe` XML body
through the real service/controller boundary. Extract the URL token from the
reply, then assert one `user_account`, one `wechat_identity` with
`subscribed=true`, and one hashed token row exist; assert neither OpenID nor
plaintext token appears in `token_hash`.

- [ ] **Step 2: Run the focused integration test**

Run:
`pnpm --filter @spark/api test:integration -- wechat-activity-entry.integration.test.ts`

Expected: PASS for the basic issued-entry path; if it fails, fix production code
rather than weakening the assertions.

- [ ] **Step 3: Add event and activity-cardinality cases**

Add real-database cases for repeated subscribe callbacks without duplicate
users, `CLICK`/`LOTTERY`, `unsubscribe`, no active activity, and two active
activities. Assert zero/multiple cases create no token rows.

- [ ] **Step 4: Add exchange and concurrency cases**

Use the token from an issued reply to assert a successful exchange persists both
`consumed_at` and an ACTIVITY `app_session`. Run two simultaneous exchange
attempts for another token with `Promise.all`; assert exactly one result is
`exchanged` and only one new session exists. Add expired, unknown, and consumed
token cases.

- [ ] **Step 5: Run and format the integration suite**

Run:
`pnpm exec prettier --write apps/api/test/wechat-activity-entry.integration.test.ts apps/api/test/support/fixtures.ts && pnpm --filter @spark/api test:integration -- wechat-activity-entry.integration.test.ts`

Expected: all WeChat activity-entry integration cases PASS.

- [ ] **Step 6: Commit integration coverage**

Run:

```text
git add apps/api/test/wechat-activity-entry.integration.test.ts apps/api/test/support/fixtures.ts
git commit -m "Test WeChat activity entry flow"
```

### Task 7: Replace Production OAuth Bootstrap with Entry Guidance

**Files:**

- Modify: `apps/activity/src/lib/runtime.tsx`
- Create: `apps/activity/src/lib/activity-entry-state.ts`
- Create: `apps/activity/src/lib/activity-entry-state.test.ts`
- Create: `apps/activity/src/pages/activity-entry-error-page.tsx`
- Modify: `apps/activity/src/app.tsx`
- Modify: `apps/activity/src/lib/api.ts`

**Interfaces:**

- Consumes: runtime 401 state and `entryError=invalid` query parameter.
- Produces: `activityEntryError(search, unauthorized): string | null`, an
  entry-error route, and development-only simulated login.

- [ ] **Step 1: Write failing frontend state tests**

Define expected behavior:

```ts
expect(activityEntryError('', true)).toBe(
  '请从公众号欢迎消息或“活动抽奖”菜单重新进入',
);
expect(activityEntryError('?entryError=invalid', false)).toBe(
  '活动入口已失效，请从公众号“活动抽奖”菜单获取新链接',
);
expect(activityEntryError('', false)).toBeNull();
```

- [ ] **Step 2: Run the frontend test and observe the missing helper**

Run: `pnpm --filter @spark/activity test -- activity-entry-state.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement entry guidance and remove OAuth bootstrap**

Add the pure helper, then change `ActivityRuntimeProvider` so a runtime 401:

- invokes `createSimulatedWechatSession()` and refetches only when
  `simulateWechat` is true;
- otherwise sets the Official Account entry message and stops loading;
- never calls `oauthStartUrl` or assigns `window.location.href` for auth.

Remove unused production OAuth API helpers from `apps/activity/src/lib/api.ts`.
When `entryError=invalid` is present, prioritize its fresh-link message.

- [ ] **Step 4: Add the generic static error route**

Create `ActivityEntryErrorPage` using the same centered mobile shell as
`WechatBrowserRequired`, with the text
`活动入口无效，请从公众号“活动抽奖”菜单获取新链接`. Register the static
`entry-error` route before `:activityCode/*` under the existing `/activity`
basename.

- [ ] **Step 5: Format and run activity tests**

Run:
`pnpm exec prettier --write apps/activity/src/lib/runtime.tsx apps/activity/src/lib/activity-entry-state.ts apps/activity/src/lib/activity-entry-state.test.ts apps/activity/src/pages/activity-entry-error-page.tsx apps/activity/src/app.tsx apps/activity/src/lib/api.ts && pnpm --filter @spark/activity test`

Expected: all activity tests PASS and no test observes a production OAuth
redirect.

- [ ] **Step 6: Commit frontend entry guidance**

Run:

```text
git add apps/activity/src/lib/runtime.tsx apps/activity/src/lib/activity-entry-state.ts apps/activity/src/lib/activity-entry-state.test.ts apps/activity/src/pages/activity-entry-error-page.tsx apps/activity/src/app.tsx apps/activity/src/lib/api.ts
git commit -m "Require Official Account activity entry"
```

### Task 8: Clean Up Entry Tokens and Document Operations

**Files:**

- Modify: `apps/api/src/maintenance/maintenance.service.ts`
- Modify: `apps/api/src/maintenance/maintenance.service.test.ts`
- Modify: `.env.example`
- Modify: `compose.production.yaml`
- Modify: `docs/project-spark-configuration.md`
- Modify: `docs/project-spark-wechat-setup.md`
- Modify: `docs/project-spark-acceptance.md`

**Interfaces:**

- Consumes: `wechat_activity_entry_token` and production environment settings.
- Produces: bounded cleanup query and exact deployment/setup instructions.

- [ ] **Step 1: Write the failing maintenance assertion**

Assert `runOnce()` executes a statement containing:

```sql
DELETE FROM wechat_activity_entry_token
WHERE expires_at<=now()
   OR consumed_at<=now()-interval '1 day'
```

- [ ] **Step 2: Run the maintenance test and observe the missing cleanup**

Run: `pnpm --filter @spark/api test -- maintenance.service.test.ts`

Expected: FAIL because no entry-token deletion query is called.

- [ ] **Step 3: Add cleanup and rerun the test**

Add the exact deletion statement to `runOnce()` and rerun the focused test.

Run: `pnpm --filter @spark/api test -- maintenance.service.test.ts`

Expected: PASS.

- [ ] **Step 4: Update environment and operator documentation**

Add required production variables:

```text
WECHAT_CALLBACK_TOKEN=
PUBLIC_BASE_URL=https://spark.gamstek.com
```

Remove anonymous identity mode instructions. Document plaintext mode, exact
callback URL, `LOTTERY` click menu key, GET verification, subscribe/menu test
steps, ten-minute one-use behavior, direct-link guidance, secret-safe logging,
and the zero/multiple-active-activity replies. Pass both variables explicitly
through `compose.production.yaml`.

- [ ] **Step 5: Format and inspect documentation changes**

Run:
`pnpm exec prettier --write apps/api/src/maintenance/maintenance.service.ts apps/api/src/maintenance/maintenance.service.test.ts .env.example compose.production.yaml docs/project-spark-configuration.md docs/project-spark-wechat-setup.md docs/project-spark-acceptance.md && git diff --check`

Expected: Prettier succeeds and `git diff --check` reports no whitespace errors.

- [ ] **Step 6: Commit operations support**

Run:

```text
git add apps/api/src/maintenance/maintenance.service.ts apps/api/src/maintenance/maintenance.service.test.ts .env.example compose.production.yaml docs/project-spark-configuration.md docs/project-spark-wechat-setup.md docs/project-spark-acceptance.md
git commit -m "Document WeChat event activity entry"
```

### Task 9: Full Verification and Requirement Audit

**Files:**

- Modify: only files required to fix failures caused by Tasks 1-8.

**Interfaces:**

- Consumes: the complete implementation and approved design.
- Produces: fresh evidence that the repository is releasable and the design is
  covered.

- [ ] **Step 1: Run repository formatting checks**

Run: `pnpm exec prettier --check . && git diff --check`

Expected: both commands exit 0.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`

Expected: exit 0 with no ESLint errors.

- [ ] **Step 3: Run production and test type checking**

Run: `pnpm typecheck`

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 4: Run all unit tests**

Run: `pnpm test`

Expected: exit 0 with zero failing tests.

- [ ] **Step 5: Build every workspace**

Run: `pnpm build`

Expected: exit 0 and all application/package builds succeed.

- [ ] **Step 6: Run all PostgreSQL integration tests**

Run: `pnpm test:integration`

Expected: exit 0 with zero failing integration tests; the configured database
name contains `test`.

- [ ] **Step 7: Audit the approved requirements**

Run:

```text
git log --oneline 10b4da8..HEAD
git status --short
rg -n "ACTIVITY_IDENTITY_MODE|anonymous_created|activity-anonymous-identity" . --glob "!node_modules/**"
rg -n "WECHAT_CALLBACK_TOKEN|PUBLIC_BASE_URL|EventKey=LOTTERY|wechat_activity_entry_token" .env.example compose.production.yaml apps docs --glob "!node_modules/**"
```

Expected: only the approved design and implementation-plan commits are visible
after `10b4da8`; the six obsolete commits are absent from `main` ancestry; the
working tree is clean; anonymous-mode implementation/configuration references
are absent; new callback, origin, menu, and token persistence references are
present.

- [ ] **Step 8: Review the final diff against the spec**

Run: `git diff --stat 10b4da8..HEAD && git diff --check 10b4da8..HEAD`

Expected: only the approved design, plan, callback/token implementation,
frontend guidance, migration, tests, and operational documentation differ; no
whitespace errors are reported.

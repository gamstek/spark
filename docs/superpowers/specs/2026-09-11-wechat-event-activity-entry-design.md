# WeChat Event Activity Entry Design

## Context

Spark currently defaults activity visitors to anonymous browser identities. That
behavior was introduced by commits `dcbc8f6`, `31cf4c8`, and `991d882`. It lets
a forwarded activity URL create a fresh participant and therefore cannot prove
that the visitor followed the Official Account.

The replacement flow uses WeChat Official Account server callbacks. A new
follower receives an activity link in the passive reply to the `subscribe`
event. An existing follower receives the same kind of link after selecting the
`LOTTERY` custom-menu item. The callback supplies the follower's OpenID, while
the activity H5 receives only a short-lived random entry token.

## Scope and Rollback Boundary

Implementation starts by rewriting local `main` onto `10b4da8`, then replaying
only the approved event-entry design and implementation-plan content. The three
anonymous-identity commits and any interim revert commits must be absent from
the resulting `main` ancestry. The implementation then builds the event-entry
flow on the restored WeChat identity and activity-session foundation.

The existing WeChat identity table, OAuth implementation, subscription lookup,
activity session, DingTalk lead collection, lottery, prize, and redemption flows
remain. Automatic OAuth bootstrap from an unauthenticated activity page is
disabled for production. A visitor without a valid activity session is told to
re-enter through the Official Account welcome message or the activity menu. The
existing simulated WeChat login remains available in development.

## Production Configuration

The Official Account server configuration uses plaintext message mode and this
exact callback URL:

```text
https://spark.gamstek.com/api/wechat/callback
```

The production public origin is explicitly configured as:

```text
PUBLIC_BASE_URL=https://spark.gamstek.com
```

The service does not derive activity-entry links from `Host` or proxy headers.
`WECHAT_CALLBACK_TOKEN` stores the secret configured in the Official Account
server settings. Existing `WECHAT_APP_ID`, `WECHAT_APP_SECRET`,
`OAUTH_STATE_SECRET`, and `WECHAT_TOKEN_ENCRYPTION_KEY` settings remain.

The menu item uses a `click` action with `EventKey=LOTTERY`. Other menu event
keys do not issue an activity entry.

## Callback Protocol

`GET /api/wechat/callback` validates WeChat's `signature`, `timestamp`, and
`nonce`, then returns `echostr` unchanged. `POST /api/wechat/callback` performs
the same signature validation before parsing the size-limited plaintext XML
body. Signature comparison is timing-safe. XML parsing does not resolve external
entities, and all dynamic reply content is XML-escaped.

The callback handles these events:

- `subscribe`: find or create the OpenID-backed internal user, mark the identity
  subscribed, select the active activity, and reply with a newly issued entry
  link.
- `CLICK` with `EventKey=LOTTERY`: perform the same identity update, activity
  selection, token issue, and reply for an existing follower.
- `unsubscribe`: mark the matching identity unsubscribed and return `success`
  without a user-facing message.
- Other messages or events: return `success` without issuing a token.

The text reply welcomes the participant, confirms the follow state, and contains
a clear activity link. The response reverses `ToUserName` and `FromUserName` as
required by the passive-reply protocol. The first version does not manage
image-and-text message assets.

Callback logs contain the request ID, event type, outcome, and a one-way
identity fingerprint where correlation is useful. They never contain the
callback token, OpenID, issued entry token, or complete XML body.

## Active Activity Selection

The callback queries the published version referenced by
`activity.published_version_id`. An activity is active when:

```text
starts_at <= current time < ends_at
```

The result must contain exactly one activity. If no activity is active, the
passive reply says that no activity is currently available. If more than one is
active, the passive reply reports an activity configuration problem and asks the
visitor to contact on-site staff. The service never guesses which activity to
use and does not issue a token in either case.

## Entry Token

A new `wechat_activity_entry_token` table stores:

- an opaque UUID primary key;
- the SHA-256 hash of a 32-byte cryptographically random token, with a unique
  constraint;
- the internal user ID and selected activity ID;
- `expires_at`, set to ten minutes after issue;
- nullable `consumed_at`;
- `created_at`.

The plaintext token exists only in the passive-reply URL:

```text
https://spark.gamstek.com/api/activity/entry?t=<token>
```

Each qualifying callback may issue a new token, including later menu clicks by
the same user. Previous unconsumed tokens remain valid until consumed or
expired; this avoids invalidating a message the user is about to open.

## Token Exchange and Session

`GET /api/activity/entry?t=<token>` hashes the supplied token and locks the
matching row in a database transaction. It succeeds only when the row has not
been consumed and `expires_at` is later than the transaction time. A successful
exchange atomically sets `consumed_at` and creates the existing seven-day
`ACTIVITY` session for the token's internal user.

After committing, the endpoint sets the existing `spark_activity` HttpOnly
cookie with `SameSite=Lax`, `Secure` in production, and redirects to
`/activity/<activityCode>`. The redirect removes the entry token from the
browser address and from subsequent application requests.

An invalid, expired, or already-consumed token does not create a session. When
the referenced activity can be resolved, the endpoint redirects to
`/activity/<activityCode>?entryError=invalid`; otherwise it redirects to a
generic activity-entry error page. The H5 explains that the link is invalid or
expired and asks the visitor to request a fresh link from the Official Account
menu.

## Subscription State

`subscribe` and qualifying `CLICK` events set `wechat_identity.subscribed=true`
and refresh `subscription_checked_at`. `unsubscribe` sets `subscribed=false` and
refreshes the timestamp. Identity creation remains serialized by the existing
OpenID advisory lock, so repeated callbacks cannot create duplicate users.

The existing runtime and final draw-time subscription protections remain. The
entry token is an identity handoff, not a replacement for downstream business
rules.

## Failure Handling and Operations

Callback input validation failures return an HTTP error and never mutate
identity or token state. Expected business outcomes such as zero or multiple
active activities return a valid passive reply within WeChat's callback window.
Unexpected database failures are logged without secrets and return `success`
when no safe user reply can be constructed, preventing sensitive error details
and excessive retries.

The existing maintenance process periodically deletes expired tokens and tokens
that have been consumed long enough to be operationally irrelevant. Cleanup is
bounded and does not affect active sessions.

## Verification

Unit tests cover signature ordering and validation, timing-safe rejection,
plaintext XML parsing, XML reply escaping, event dispatch, active-activity
cardinality, token hashing, expiry, and frontend unauthenticated behavior.

PostgreSQL integration tests cover:

- server verification and signed callback acceptance;
- first-time `subscribe` identity creation and token issue;
- repeat callbacks without duplicate users;
- `LOTTERY` menu entry for an existing follower;
- `unsubscribe` state updates;
- zero, one, and multiple active activity selection;
- successful exchange, session cookie creation, and correct redirect;
- rejection of expired, unknown, and already-consumed tokens;
- concurrent exchange attempts, with exactly one success;
- cleanup of expired and sufficiently old consumed tokens.

Activity UI tests verify that a missing session shows the Official Account entry
instruction instead of starting OAuth, that `entryError=invalid` shows a
fresh-link instruction, and that development simulation still works.

Before completion, run `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:integration`, and `pnpm build`.

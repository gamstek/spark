# Activity Anonymous Identity Design

## Context

The current Official Account cannot support the event-driven activity entry
without changing its server callback and menu configuration. The activity must
therefore return to the previously approved anonymous identity model. Visitors
open a normal public activity URL; the URL does not contain a user-specific
token and the Official Account does not need a callback or lottery menu item.

Possession of the activity link is treated as sufficient access. Each browser is
identified by an anonymous session cookie, so the application does not need an
OpenID and does not claim that the visitor is subscribed.

## Identity Modes

`ACTIVITY_IDENTITY_MODE` controls the participant identity flow:

- `anonymous` is the default. A visitor without an activity session receives a
  new anonymous `user_account` and `spark_activity` session. Subscription
  requirements are considered satisfied without calling WeChat APIs.
- `wechat` preserves the pre-callback OAuth behavior for a future account
  upgrade. A visitor without a session is sent through `snsapi_base` OAuth, and
  activities with `requireSubscribe` perform a real subscription check.

Production Compose explicitly passes the setting, while application code uses
`anonymous` when it is absent. Invalid values fail during application startup
instead of silently selecting an identity policy.

## Session Bootstrap

A public endpoint accepts an activity code and intended return path. It first
validates that the referenced activity exists and has a published version.

In `anonymous` mode, the endpoint creates a UUID-backed `user_account`, creates
an `ACTIVITY` session, sets the existing HttpOnly `spark_activity` cookie, and
returns an authenticated result. In `wechat` mode, it returns the existing OAuth
start URL without creating a user.

When the activity application receives a runtime 401, it calls this endpoint.
For an anonymous result it refetches runtime and activity information. For a
WeChat result it performs a full-page navigation to the supplied OAuth URL. The
frontend prevents concurrent bootstrap requests.

## Subscription Policy

`RuntimeService` and `LotteryService` consult the shared identity mode. In
anonymous mode they skip WeChat identity lookup and subscription API calls. In
wechat mode they preserve the existing OAuth and subscription checks, including
the final draw-time database assertion.

The template field `requireSubscribe`, the `SUBSCRIBE` runtime state, the
subscription page, OAuth controllers, WeChat gateway, token management, and
identity tables remain available for future WeChat OAuth use. The admin form
must explain that the setting applies only in WeChat identity mode.

## Removal of the Event-Callback Entry

The current event-callback entry subsystem is removed rather than disabled:

- remove `GET/POST /api/wechat/callback` and the `subscribe`/`CLICK` handlers;
- remove `GET /api/activity/entry`, single-use entry tokens, callback receipts,
  their entities, migrations, maintenance cleanup, and tests;
- remove callback token, public-base URL, callback URL, and lottery-menu setup
  from environment, Compose, Nginx, and operator documentation;
- remove the activity entry error screen and restore 401 session bootstrap;
- restore the anonymous-mode design and plan documents, and remove the replaced
  event-entry design and plan documents.

Existing deployed databases may already contain the two callback-entry tables.
Because old migration files must remain replayable for environments that have
applied them, a new forward migration drops those tables. The historical
migration files remain in the migration chain; runtime entities and services no
longer reference the dropped tables.

The user-owned `2ba6da2 chore: update` commit remains in history. The anonymous
restoration is added as new commits on top of the current `main`; it does not
rewrite that commit.

## Security and Product Limits

The shared activity link can be forwarded and does not prove subscription.
Repeat-participation protection is limited to the seven-day HttpOnly browser
cookie. Clearing cookies or changing browsers or devices creates a new user.
This is an accepted limitation of anonymous mode.

Return paths remain restricted to `/activity/<code>` paths. Session cookies use
`Secure` in production, `HttpOnly`, `SameSite=Lax`, and the existing CSRF token
for draw requests. Logs record the selected identity mode and anonymous session
creation without emitting session tokens.

## Verification

Tests cover configuration validation, anonymous user/session creation,
published-activity validation, WeChat-mode redirect selection, anonymous
subscription policy, and activity 401 bootstrap/refetch behavior. Migration
tests prove the event-entry tables are removed from an upgraded database.

Completion requires formatting, lint, type checking, unit tests, PostgreSQL
integration tests, browser tests for the activity bootstrap flow, and a
production build. The final repository scan must find no active callback-entry
configuration or runtime references outside historical migrations.

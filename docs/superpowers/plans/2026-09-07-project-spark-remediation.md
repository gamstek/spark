# Project Spark MVP Remediation Plan

**Scope:** Repair all audited MVP gaps except the deferred activity and staff
frontends and their UI designs.

## Task 1: Production foundations

- Add regression tests for worker lifecycle, error responses, validation, CSRF,
  readiness, and media routing.
- Register and schedule the PostgreSQL worker with graceful shutdown.
- Add a stable API exception envelope, request IDs, and request validation.
- Add database readiness and production media serving.

## Task 2: Activity lifecycle and runtime

- Align activity contracts with the four configured timestamps and
  server-generated codes.
- Validate template configuration and timestamps at API boundaries.
- Create a new draft from the published snapshot when editing before activity
  start.
- Prevent prize creation after activity start and preserve published prize
  snapshots.
- Implement the authenticated runtime endpoint, channel visit recording,
  subscription refresh, inventory gating, and DingTalk form gating.

## Task 3: Redemption and reporting correctness

- Normalize overdue redemptions to `EXPIRED` before reads, confirmation,
  reports, and exports.
- Stop returning usable codes after redemption or expiry.
- Add subscription, funnel, prize, channel, participant, and redemption details
  required by operations.

## Task 4: Exports and maintenance

- Mark export jobs running/failed consistently and audit both outcomes.
- Export channel, participation timestamps, mapped fields, and normalized
  redemption status.
- Make expired-file cleanup retryable and add session/OAuth-state cleanup jobs.

## Task 5: Admin correctness and operations

- Restore the admin session and CSRF token after refresh.
- Backfill activity time/config values, convert Shanghai local time to UTC, and
  remove manual activity-code entry.
- Show lifecycle status and prevent prize creation after start.
- Complete staff account update, reset, enable/disable, and activity assignment
  operations.
- Expand participant and report screens around the enhanced APIs.

## Task 6: Contracts, CI, and documentation

- Align shared schemas with real API responses and error codes.
- Run template compatibility and non-deferred E2E checks in CI.
- Update `AGENTS.md`, README/deployment guidance, acceptance status, and the SDD
  checklist.
- Run `pnpm verify`, focused E2E tests, migration checks, formatting checks, and
  `git diff --check`.

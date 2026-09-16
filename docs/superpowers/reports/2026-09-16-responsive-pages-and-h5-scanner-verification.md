# Responsive pages and H5 scanner verification

Verified locally on Windows with Chrome on 2026-09-16 against the approved
responsive-pages-and-h5-scanner plan. No production behavior or design contract
changed during this final coverage task. GitHub Actions E2E remains disabled.

## Reproducible checks

| Command                                                                                                       | Result                                                                                        |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm exec playwright test tests/e2e/admin.spec.ts --workers 1`                                               | 14 passed                                                                                     |
| `pnpm exec playwright test --config playwright.activity.config.ts --output test-results/task-7-activity`      | 29 passed, 29 existing project-configured skips                                               |
| `pnpm exec playwright test --config playwright.staff.config.ts --output test-results/task-7-staff-review-fix` | 13 passed                                                                                     |
| `pnpm verify`                                                                                                 | Exit 0: lint, typecheck, 257 unit tests, all six package builds, 123 API integration tests    |
| `git diff --check`                                                                                            | Exit 0                                                                                        |
| `rg -n "WechatJsSdk\|wechatJsSdkConfig\|js-sdk-config\|scanQRCode\|jweixin" apps packages tests`              | No matches (use the quoted expression as an alternation, without escaping pipes in the shell) |

Activity skips are intentional: anonymous-only tests skip in the simulation
project; the development-session test skips in the anonymous project. Existing
coverage includes the wheel at 320×667, 375×667, 390×844 and 430×932 and reduced
motion. Staff checks cover shell/navigation/sheet alignment at 390 and 430
pixels, and scanner video/actions at 320×667, 390×844 and 430×932.

Unauthenticated login checks cover 320×568, 375×667, 390×844 and 430×932. They
verify the session rejection redirects to login, shell width and centering,
absence of horizontal overflow, and inputs, submit action and validation
feedback reachable through natural scrolling. Empty submission sends no login
request; invalid credentials preserve the entered account and an enabled retry
action. A mutation check temporarily restored the old 375px shell cap: the 390px
case failed with actual width 375 instead of 390. Restoring the approved 430px
cap returned the complete 13-test staff suite to green. No production change
remains from that check. Login screenshots are generated in the staff review-fix
output directory; the short 320px page was visually inspected.

The new admin test checks the encoded URL, safe new-tab attributes, null opener
and preservation of the admin tab. Its public destination is intercepted because
the admin development server does not serve the activity application.

The scanner boundary replaces only the external ZXing browser module using
Playwright response interception. Production adapter normalization, result
deduplication, page state, runtime and navigation remain real. The test delivers
two decoder callbacks, verifies only the first code reaches confirmation, one
history entry is added and no redemption is submitted automatically. Permission
denial, retry, unsupported camera and manual entry are covered. Development
React Strict Mode can replay the confirmation page's read-only lookup effect;
each lookup must use the first accepted code.

The boundary was added after the scanner test failed to reach scanning without
it. No production query parameter, permission bypass or test-only application
branch was added. Screenshots of scanning and permission recovery are generated
under `test-results/task-7-staff`; 320px recovery and 430px scanning screenshots
were visually inspected.

## Audit and warnings

The required premium audit command was run with `--mode strict --no-write`:

```text
python C:/Users/lengjing/.codex/plugins/cache/openai-curated-remote/frontend-design-premium/1.4.0/skills/frontend-design-premium/scripts/audit_project.py C:/Users/lengjing/workspace/code/github/spark --mode strict --no-write
```

It exits 1 with the same 13 findings recorded during Task 5: three unresolved
native-select ownership findings (admin date-time picker, activity list and
staff selection sheet), nine actionless-button detections (activity action
wrapper and existing admin components), and one admin configuration textarea
resize finding. None originates in Task 7 files. The activity-list and
staff-sheet findings concern controls untouched by the earlier link/width edits.
The changed scanner/link code has semantic controls, connected actions, no
native dialogs, no hidden scrollbars and no page-local width copies. Existing
shell width owners remain PageShell, BottomTabBar and SelectSheet.

Non-failing output includes Chrome's FORCE_COLOR/NO_COLOR warning, Turbo's test
output-cache warnings, and existing admin/activity bundle-size warnings. The
activity result-layout fixture also requests an unmocked prize-code endpoint,
producing a proxy ECONNREFUSED warning; all selected assertions pass.

## Release acceptance still required

Physical iOS and Android devices were unavailable. No real camera permission,
physical QR decoding, camera-indicator shutdown or device safe-area acceptance
is claimed. Before event use, on one current device of each platform over HTTPS:

- Grant camera permission and scan a real redemption QR.
- Deny permission, enable it in settings, retry and exercise manual entry.
- Leave or background the scanner and confirm its camera indicator turns off.
- Check short/tall viewport actions and bottom safe-area reachability.

This is the remaining feature release-verification risk. The unrelated existing
lottery background-image modification was preserved and excluded from the
commit; local build/browser checks used the current working-tree image.

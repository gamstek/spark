# Responsive Campaign Pages and H5 Staff Scanner

## Status

Approved in conversation on 2026-09-16.

## Scope

This design covers three related mobile-entry improvements:

1. make activity paths in the admin activity list open the public activity in a
   new browser tab;
2. make the illustrated lottery page fill and adapt to the mobile viewport;
3. replace the staff WeChat JS-SDK scanner with an in-page H5 camera scanner and
   make the staff mobile shell fill common phone widths.

It does not change lottery probability, redemption authorization, redemption
validation, or activity lifecycle rules.

## Product Context

The activity surface is used by exhibition visitors on mobile devices. The staff
surface is used by authenticated booth staff for rapid prize redemption. Both
surfaces are Chinese-language mobile web applications. Existing visual assets,
colors, typography, and navigation remain authoritative. Admin design continues
to follow the root `DESIGN.md` and `UX-CONTRACT.md`; the activity surface
continues to follow `apps/activity/DESIGN.md`.

The scanner handles a redemption code already protected by the existing staff
session and redemption APIs. Camera frames remain local to the browser and are
not uploaded or persisted.

## Admin Activity Link

The activity list's “访问路径” cell becomes a semantic anchor whose `href` is
`/activity/{encoded activity code}`. It opens with `target="_blank"` and an
appropriate `rel` value so the new page cannot control the admin window.

The link keeps the compact path label and truncation behavior, adds an external
link icon, and provides visible hover and keyboard focus states. The relative
URL deliberately inherits the current origin in development, staging, and
production. Search continues to match the activity name and code.

## Lottery Viewport Layout

The lottery page owns the full dynamic viewport instead of rendering inside a
fixed 375 by 769 pixel stage. The background covers the viewport. Mobile content
remains centered and is capped at the established 430 pixel campaign width on
larger screens.

The wheel keeps a square aspect ratio and scales from the available inline
width, with safe horizontal margins and a maximum size. Its vertical position
uses a clamped viewport-relative value so it remains below the campaign title on
both short and tall screens. Wheel labels and the center action continue to
scale with the wheel geometry and preserve the existing result mapping and
motion controller.

The result/action area is anchored above the bottom safe area rather than to a
fixed design-pixel top coordinate. The layout must remain usable at supported
mobile widths from 320 through 430 pixels, short viewports, tall viewports, and
reduced-motion mode. It must not introduce document overflow solely to preserve
the old artboard height.

Other illustrated activity pages are not redesigned in this change. Any shared
shell adjustment must preserve their current appearance and tests.

## Staff Mobile Shell

The staff `PageShell`, fixed bottom navigation, and bottom sheet share one
mobile width contract: fill the available phone width up to 430 pixels and stay
centered on wider desktop viewports. Pages that already use `min-height: 100dvh`
continue to own at least the full dynamic viewport. Safe-area padding remains
available for bottom actions and navigation.

The scan page is a special full-viewport state within that shell. Its video
surface covers the complete page behind an overlay; it is not constrained to a
small simulated frame.

## H5 QR Scanner Architecture

### Dependency and ownership

The staff application uses `@zxing/browser` and its `BrowserQRCodeReader` as the
primary QR decoder. Native `BarcodeDetector` is not the primary path because its
browser support is incomplete. The browser's `getUserMedia` implementation owns
camera permission and device access, which requires a secure context in
production.

A focused scanner module owns ZXing integration and exposes a small interface to
the page: start a QR scan against a video element, report one decoded value, and
stop. Existing redemption-code normalization remains a pure tested helper.

### Camera lifecycle

The scanner requests video only, preferring the environment-facing camera. The
page shows a pending state while permission and video initialization are in
progress. Continuous decoding runs only while the page is active.

The first valid QR result wins. Before navigation, the scanner stops its ZXing
controls and every media track. Repeated decoder callbacks cannot navigate or
submit twice. The same cleanup runs when the page unmounts, the user retries, or
the document becomes hidden. Returning to the visible page presents an explicit
restart action rather than silently reopening the camera.

### Scan-page interaction

The page contains:

- a full-bleed, muted, inline-playing video preview;
- the existing green target frame and scan line as an overlay;
- a concise instruction and camera status;
- a back action;
- a retry action when recovery is possible;
- an always-available “手动输入兑奖码” fallback.

Camera permission is requested when the scan page is entered. Retry is always
user initiated. Busy and failure states keep controls in stable positions. The
video and overlay are decorative to assist aiming; scanner status and errors are
announced in text for assistive technology.

### Errors and recovery

Errors are mapped to user-facing recovery rather than exposing browser details:

| Condition                                  | Message intent                         | Recovery                                                      |
| ------------------------------------------ | -------------------------------------- | ------------------------------------------------------------- |
| insecure context or camera API unavailable | Current browser cannot open the camera | Open the HTTPS site or use manual entry                       |
| permission denied                          | Camera access was not granted          | Explain browser permission settings, retry, or enter manually |
| no rear/usable camera                      | No available camera was found          | Retry device selection or enter manually                      |
| camera busy or unreadable                  | Camera is occupied or unavailable      | Close the other camera user and retry                         |
| decode/runtime failure                     | QR recognition could not continue      | Retry or enter manually                                       |

No error causes an automatic redemption lookup. Only a successfully normalized
QR result advances to the existing confirmation page.

## Removal of WeChat Scanner Integration

The staff application no longer loads `jweixin`, checks the WeChat user agent,
or requests `/api/staff/wechat/js-sdk-config`. The staff API method and the
server controller/service/provider that exist solely for staff JS-SDK signing
are removed, together with their isolated tests and unused gateway ticket code
when no other caller remains.

Wechat OAuth, subscription checks, and other activity-side WeChat integration
remain unchanged.

## Data and Navigation Flow

1. Staff opens `/staff/scan`.
2. The page requests the rear camera and starts ZXing decoding.
3. ZXing returns raw QR text.
4. The existing normalization helper extracts and normalizes the redemption code
   from either a URL or a plain code.
5. The page atomically marks the scan handled and stops the camera.
6. Runtime state receives the code and navigation moves to
   `/staff/redeem/confirm`.
7. The existing lookup and explicit confirmation flow remains authoritative.

Manual entry continues to follow `/staff/enter` and joins the same confirmation
flow.

## Testing and Verification

### Unit and component tests

- admin activity links contain the encoded path, new-tab target, safe `rel`, and
  accessible link content;
- responsive shells use the shared 430 pixel width contract and dynamic viewport
  height where applicable;
- scanner normalization handles plain codes and QR URLs;
- scanner accepts only the first result;
- permission, unavailable-device, and camera-busy failures map to the correct
  recovery state;
- cleanup stops ZXing controls and media tracks on success, retry, visibility
  change, and unmount.

### Browser verification

- admin link opens the public activity without replacing the admin tab;
- lottery content remains reachable and aligned at 320, 375, 390, and 430 pixel
  widths, on short and tall viewports, and with reduced motion;
- staff scanner fills the viewport, preserves safe-area actions, and routes a
  simulated successful QR decode once;
- permission rejection and unsupported-camera states keep retry and manual entry
  reachable;
- staff home, bottom navigation, sheets, login, and non-scan child pages retain
  their layout after the shared width change.

Run formatting, lint, type checking, relevant unit/component tests, production
builds, and project browser tests. Run the frontend static audit and report any
unrelated pre-existing findings separately.

## Release Constraints and Risks

- Production must remain HTTPS for camera access.
- Embedded browsers can still impose device-specific camera restrictions; manual
  entry remains the supported fallback.
- ZXing adds client bundle weight. The scanner module should be loaded only on
  the scan route or dynamically imported when scanning begins.
- Real-device verification on at least one current iOS device and one current
  Android device remains necessary before relying on H5 scanning at an event.

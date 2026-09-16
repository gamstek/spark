import type { Page } from '@playwright/test';

// Replace only the external decoder module in the Vite browser response. The
// real scanner adapter, normalization, lifecycle, runtime, and router still run.
// This boundary is owned by Playwright and cannot be enabled by a public URL.
export async function installScannerBoundary(page: Page) {
  await page.route('**/node_modules/.vite/deps/@zxing_browser.js*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `export class BrowserQRCodeReader {
        decodeFromConstraints(_constraints, _video, callback) {
          document.documentElement.dataset.testCamera = 'pending';
          return new Promise((resolve, reject) => {
            const result = (event) => {
              // Deliberately deliver a late duplicate even if stop runs mid-batch.
              for (const raw of event.detail) callback({ getText: () => raw });
            };
            const cleanup = () => {
              delete document.documentElement.dataset.testCamera;
              window.removeEventListener('test-camera-ready', ready);
              window.removeEventListener('test-camera-error', error);
              window.removeEventListener('test-camera-result', result);
            };
            const ready = () => {
              delete document.documentElement.dataset.testCamera;
              window.addEventListener('test-camera-result', result);
              resolve({ stop: cleanup });
            };
            const error = (event) => {
              cleanup();
              reject(new DOMException('Simulated camera failure', event.detail));
            };
            window.addEventListener('test-camera-ready', ready, { once: true });
            window.addEventListener('test-camera-error', error, { once: true });
          });
        }
      }`,
    }),
  );
}

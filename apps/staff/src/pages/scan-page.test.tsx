// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  startQrScanner,
  type QrScannerSession,
  type ScannerFailure,
} from '../lib/qr-scanner';
import type * as ScannerModule from '../lib/qr-scanner';
import { StaffRuntimeProvider, useStaff } from '../lib/runtime';
import { ScanPage } from './scan-page';

vi.mock('../lib/qr-scanner', async (original) => ({
  ...(await original<typeof ScannerModule>()),
  startQrScanner: vi.fn(),
}));

function Destination() {
  const { code } = useStaff();
  return <output>{code}</output>;
}

describe('ScanPage camera lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  let resolveSession: (session: QrScannerSession) => void;
  let result: (code: string) => void;
  let failure: ((failure: ScannerFailure) => void) | undefined;
  let router: ReturnType<typeof createMemoryRouter>;
  const stop = vi.fn();

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal('isSecureContext', true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    stop.mockReset();
    vi.mocked(startQrScanner)
      .mockReset()
      .mockImplementation((_video, callback, _dependencies, onFailure) => {
        result = callback;
        failure = onFailure;
        return new Promise((resolve) => {
          resolveSession = resolve;
        });
      });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['staff-me'], null);
    router = createMemoryRouter(
      [
        { path: '/scan', element: <ScanPage /> },
        { path: '/redeem/confirm', element: <Destination /> },
        { path: '/enter', element: <p>手动录入页面</p> },
        { path: '/', element: <p>工作台</p> },
      ],
      { initialEntries: ['/scan'] },
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    router.dispose();
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function render() {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <StaffRuntimeProvider>
            <RouterProvider router={router} />
          </StaffRuntimeProvider>
        </QueryClientProvider>,
      ),
    );
  }

  async function click(label: string) {
    const button = Array.from(container.querySelectorAll('button')).find(
      (item) =>
        item.textContent === label || item.getAttribute('aria-label') === label,
    );
    expect(button, label).toBeDefined();
    await act(async () => button!.click());
  }

  it('shows an inline muted preview, starting status and manual fallback while opening', async () => {
    await render();
    const video = container.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(video?.playsInline).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      '正在打开相机',
    );
    expect(container.textContent).toContain('手动输入兑奖码');
  });

  it('stops before navigating and accepts only the first normalized code', async () => {
    await render();
    await act(async () => resolveSession({ stop }));
    const routes: string[] = [];
    router.subscribe((state) => {
      routes.push(state.location.pathname);
      expect(stop).toHaveBeenCalled();
    });
    await act(async () => {
      result('https://example.com/?code=ab-cd1234');
      result('SECOND');
    });
    expect(container.querySelector('output')?.textContent).toBe('ABCD1234');
    expect(routes).toEqual(['/redeem/confirm']);
  });

  it.each([
    ['PERMISSION_DENIED', '浏览器设置中允许'],
    ['UNSUPPORTED', 'HTTPS'],
    ['NO_CAMERA', '未找到可用相机'],
    ['CAMERA_BUSY', '关闭其他使用相机'],
    ['SCAN_FAILED', '二维码识别中断'],
  ])('offers recovery for %s without navigating', async (failure, guidance) => {
    vi.mocked(startQrScanner).mockRejectedValue(failure);
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      guidance,
    );
    expect(container.textContent).toContain('重新扫描');
    await click('手动输入兑奖码');
    expect(router.state.location.pathname).toBe('/enter');
  });

  it('recovers after a fatal decoder callback error', async () => {
    await render();
    await act(async () => resolveSession({ stop }));
    await act(async () => failure?.('SCAN_FAILED'));

    expect(router.state.location.pathname).toBe('/scan');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      '二维码识别中断',
    );
    expect(
      container.querySelector('[role="status"]')?.textContent,
    ).not.toContain('正在扫描');
    expect(stop).toHaveBeenCalledTimes(1);
    const retry = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === '重新扫描',
    );
    expect(retry?.disabled).toBe(false);

    await click('重新扫描');
    expect(startQrScanner).toHaveBeenCalledTimes(2);
  });

  it('explains HTTPS in an insecure context without requesting the camera', async () => {
    vi.stubGlobal('isSecureContext', false);
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'HTTPS',
    );
    expect(startQrScanner).not.toHaveBeenCalled();
  });

  it('stops on hiding, stays paused on returning and restarts only after a click', async () => {
    await render();
    await act(async () => resolveSession({ stop }));
    vi.mocked(startQrScanner).mockImplementation(async () => {
      expect(stop).toHaveBeenCalledTimes(1);
      return { stop: vi.fn() };
    });
    await act(async () => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(stop).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      result('STALE');
    });
    expect(container.textContent).toContain('扫描已暂停');
    expect(startQrScanner).toHaveBeenCalledTimes(1);
    await click('重新扫描');
    expect(startQrScanner).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('正在扫描');
  });

  it.each(['手动输入兑奖码', '返回'])(
    'stops before leaving through %s',
    async (label) => {
      await render();
      await act(async () => resolveSession({ stop }));
      await click(label);
      expect(stop).toHaveBeenCalledTimes(1);
    },
  );

  it('stops the active session on unmount', async () => {
    await render();
    await act(async () => resolveSession({ stop }));
    await act(async () => root.unmount());
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('waits for controls before navigating if decoding succeeds during initialization', async () => {
    await render();
    await act(async () => result('ABCD1234'));
    expect(router.state.location.pathname).toBe('/scan');
    await act(async () => resolveSession({ stop }));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(container.querySelector('output')?.textContent).toBe('ABCD1234');
  });

  it('waits for an old pending session to stop before restarting after hiding', async () => {
    await render();
    await act(async () => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    await click('重新扫描');
    expect(startQrScanner).toHaveBeenCalledTimes(1);
    vi.mocked(startQrScanner).mockImplementation(async () => {
      expect(stop).toHaveBeenCalledTimes(1);
      return { stop: vi.fn() };
    });
    await act(async () => resolveSession({ stop }));
    expect(startQrScanner).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('正在扫描');
  });

  it('discards results and closes a session that finishes opening after leaving', async () => {
    await render();
    await click('手动输入兑奖码');
    await act(async () => {
      result('LATE');
      resolveSession({ stop });
    });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/enter');
  });

  it('stops attached camera tracks immediately when unmounting during initialization', async () => {
    await render();
    const stopTrack = vi.fn();
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'srcObject', {
      value: { getTracks: () => [{ stop: stopTrack }] },
    });
    await act(async () => root.unmount());
    expect(stopTrack).toHaveBeenCalledTimes(1);
    await act(async () => resolveSession({ stop }));
  });

  it.each([
    ['before', 'https://example.com/?code='],
    ['before', ' - '],
    ['after', 'https://example.com/?code='],
    ['after', ' - '],
  ])(
    'recovers from an empty QR decoded %s initialization: %s',
    async (timing, raw) => {
      await render();
      if (timing === 'after') await act(async () => resolveSession({ stop }));
      await act(async () => result(raw));
      if (timing === 'before') await act(async () => resolveSession({ stop }));
      expect(router.state.location.pathname).toBe('/scan');
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        '未包含兑奖码',
      );
      expect(
        container.querySelector('[role="status"]')?.textContent,
      ).not.toContain('正在扫描');
      expect(stop).toHaveBeenCalled();
      const retry = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === '重新扫描',
      );
      expect(retry?.disabled).toBe(false);
      await click('重新扫描');
      expect(startQrScanner).toHaveBeenCalledTimes(2);
      await act(async () => resolveSession({ stop: vi.fn() }));
      await act(async () => result('ABCD1234'));
      expect(container.querySelector('output')?.textContent).toBe('ABCD1234');
    },
  );
});

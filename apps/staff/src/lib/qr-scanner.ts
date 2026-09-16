export type ScannerFailure =
  | 'UNSUPPORTED'
  | 'PERMISSION_DENIED'
  | 'NO_CAMERA'
  | 'CAMERA_BUSY'
  | 'SCAN_FAILED';

export type QrScannerSession = {
  stop(): void;
};

type ScannerResult = {
  getText(): string;
};

type ScannerControls = {
  stop(): void;
};

type ScannerReader = {
  decodeFromConstraints(
    constraints: MediaStreamConstraints,
    video: HTMLVideoElement,
    callback: (result: ScannerResult | null | undefined) => void,
  ): Promise<ScannerControls>;
};

export type ScannerDependencies = {
  createReader(): Promise<ScannerReader>;
};

export function extractRedemptionCode(raw: string): string {
  const value = raw.trim();
  try {
    const url = new URL(value);
    return (url.searchParams.get('code') ?? value)
      .replace(/[\s-]/g, '')
      .toUpperCase();
  } catch {
    return value.replace(/[\s-]/g, '').toUpperCase();
  }
}

function normalizeScannerFailure(error: unknown): ScannerFailure {
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String(error.name)
      : '';

  switch (name) {
    case 'NotAllowedError':
      return 'PERMISSION_DENIED';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'NO_CAMERA';
    case 'NotReadableError':
      return 'CAMERA_BUSY';
    case 'NotSupportedError':
      return 'UNSUPPORTED';
    default:
      return 'SCAN_FAILED';
  }
}

async function createBrowserReader(): Promise<ScannerReader> {
  const { BrowserQRCodeReader } = await import('@zxing/browser');
  return new BrowserQRCodeReader();
}

function stopVideoTracks(video: HTMLVideoElement): void {
  const stream = video.srcObject;
  if (!stream || typeof (stream as MediaStream).getTracks !== 'function')
    return;

  for (const track of (stream as MediaStream).getTracks()) {
    track.stop();
  }
}

export async function startQrScanner(
  video: HTMLVideoElement,
  onResult: (code: string) => void,
  dependencies: ScannerDependencies = { createReader: createBrowserReader },
): Promise<QrScannerSession> {
  if (
    dependencies.createReader === createBrowserReader &&
    (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
  ) {
    throw 'UNSUPPORTED' satisfies ScannerFailure;
  }

  let controls: ScannerControls | undefined;
  let stopped = false;
  let handled = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    controls?.stop();
    stopVideoTracks(video);
  };

  try {
    const reader = await dependencies.createReader();
    controls = await reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } }, audio: false },
      video,
      (result) => {
        if (!result || handled) return;
        handled = true;
        try {
          onResult(extractRedemptionCode(result.getText()));
        } finally {
          stop();
        }
      },
    );
    if (stopped) controls.stop();
    return { stop };
  } catch (error) {
    stop();
    throw normalizeScannerFailure(error);
  }
}

import { describe, expect, it, vi } from 'vitest';

import {
  extractRedemptionCode,
  startQrScanner,
  type ScannerDependencies,
} from './qr-scanner';

type DecoderCallback = (result: { getText(): string } | null) => void;
type DecodeFromConstraints = (
  constraints: MediaStreamConstraints,
  video: HTMLVideoElement,
  callback: DecoderCallback,
) => Promise<{ stop(): void }>;

function createVideo(tracks: Array<{ stop(): void }> = []): HTMLVideoElement {
  return {
    srcObject: {
      getTracks: () => tracks,
    },
  } as HTMLVideoElement;
}

function createDependencies(
  decodeFromConstraints: DecodeFromConstraints,
): ScannerDependencies {
  return {
    createReader: async () => ({ decodeFromConstraints }),
  };
}

describe('extractRedemptionCode', () => {
  it('extracts and uppercases a code from a redemption URL', () => {
    expect(
      extractRedemptionCode('https://spark.gamstek.com/staff?code=ab-c 123'),
    ).toBe('ABC123');
  });
});

describe('startQrScanner', () => {
  it('uses the first decoder result then stops controls and video tracks', async () => {
    let callback: DecoderCallback | undefined;
    const controls = { stop: vi.fn() };
    const track = { stop: vi.fn() };
    const onResult = vi.fn();
    const decodeFromConstraints = vi.fn(
      async (_constraints, _video, nextCallback: DecoderCallback) => {
        callback = nextCallback;
        return controls;
      },
    );

    await startQrScanner(
      createVideo([track]),
      onResult,
      createDependencies(decodeFromConstraints),
    );
    callback?.({
      getText: () => 'https://spark.gamstek.com/staff?code=ab-123',
    });

    expect(onResult).toHaveBeenCalledWith('AB123');
    expect(controls.stop).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(decodeFromConstraints).toHaveBeenCalledWith(
      { video: { facingMode: { ideal: 'environment' } }, audio: false },
      expect.anything(),
      expect.any(Function),
    );
  });

  it('ignores decoder results after the first one', async () => {
    let callback: DecoderCallback | undefined;
    const onResult = vi.fn();
    const decodeFromConstraints = vi.fn(
      async (_constraints, _video, nextCallback: DecoderCallback) => {
        callback = nextCallback;
        return { stop: vi.fn() };
      },
    );

    await startQrScanner(
      createVideo(),
      onResult,
      createDependencies(decodeFromConstraints),
    );
    callback?.({ getText: () => 'first-code' });
    callback?.({ getText: () => 'second-code' });

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith('FIRSTCODE');
  });

  it.each([
    ['NotAllowedError', 'PERMISSION_DENIED'],
    ['NotFoundError', 'NO_CAMERA'],
    ['NotReadableError', 'CAMERA_BUSY'],
  ] as const)('maps %s to %s', async (name, failure) => {
    const error = Object.assign(new Error(), { name });
    const decodeFromConstraints = vi.fn(async () => {
      throw error;
    });

    await expect(
      startQrScanner(
        createVideo(),
        vi.fn(),
        createDependencies(decodeFromConstraints),
      ),
    ).rejects.toBe(failure);
  });

  it('stops every track once when stop is called twice', async () => {
    const controls = { stop: vi.fn() };
    const firstTrack = { stop: vi.fn() };
    const secondTrack = { stop: vi.fn() };
    const session = await startQrScanner(
      createVideo([firstTrack, secondTrack]),
      vi.fn(),
      createDependencies(vi.fn(async () => controls)),
    );

    session.stop();
    session.stop();

    expect(controls.stop).toHaveBeenCalledTimes(1);
    expect(firstTrack.stop).toHaveBeenCalledTimes(1);
    expect(secondTrack.stop).toHaveBeenCalledTimes(1);
  });
});

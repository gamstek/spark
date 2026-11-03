import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { MediaAsset } from '../../database/entities/index.js';
import { compressImage } from './compress-image.js';

export const MEDIA_ROOT = Symbol('MEDIA_ROOT');

@Injectable()
export class MediaService {
  private readonly root: string;
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Optional() @Inject(MEDIA_ROOT) root?: string,
  ) {
    this.root = resolve(root ?? process.env.MEDIA_ROOT ?? 'var/media');
  }

  async save(input: {
    bytes: Buffer;
    originalName: string;
  }): Promise<{ id: string; storageKey: string; absolutePath: string }> {
    const { bytes, extension, mimeType } = await compressImage(input.bytes);
    const id = randomUUID();
    const storageKey = `${randomUUID()}.${extension}`;
    const absolutePath = resolve(this.root, storageKey);
    await mkdir(this.root, { recursive: true });
    await writeFile(absolutePath, bytes, { flag: 'wx' });
    await this.dataSource.getRepository(MediaAsset).insert({
      id,
      storageKey,
      mimeType,
      byteSize: String(bytes.length),
    });
    return { id, storageKey, absolutePath };
  }

  async optimizeStoredAsset(
    id: string,
    write = false,
  ): Promise<{ before: number; after: number }> {
    const asset = await this.dataSource
      .getRepository(MediaAsset)
      .findOneByOrFail({ id });
    const absolutePath = resolve(this.root, asset.storageKey);
    const localPath = relative(this.root, absolutePath);
    if (localPath.startsWith('..') || isAbsolute(localPath))
      throw new Error('INVALID_MEDIA_PATH');
    const original = await readFile(absolutePath);
    const { bytes, mimeType } = await compressImage(original);
    if (mimeType !== asset.mimeType) throw new Error('UNSUPPORTED_MEDIA');
    if (write && bytes.length < original.length) {
      const temporaryPath = `${absolutePath}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryPath, bytes, { flag: 'wx' });
        await rename(temporaryPath, absolutePath);
        await this.dataSource
          .getRepository(MediaAsset)
          .update(id, { byteSize: String(bytes.length) });
      } finally {
        await rm(temporaryPath, { force: true });
      }
    }
    return { before: original.length, after: bytes.length };
  }
}

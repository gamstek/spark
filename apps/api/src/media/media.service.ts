import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';

export const MEDIA_ROOT = Symbol('MEDIA_ROOT');

function inspect(bytes: Buffer): { extension: string; mimeType: string } | null {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0) return { extension: 'png', mimeType: 'image/png' };
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: 'jpg', mimeType: 'image/jpeg' };
  if (bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return { extension: 'webp', mimeType: 'image/webp' };
  return null;
}

@Injectable()
export class MediaService {
  private readonly root: string;
  constructor(@Inject(DataSource) private readonly dataSource: DataSource, @Optional() @Inject(MEDIA_ROOT) root?: string) {
    this.root = resolve(root ?? process.env.MEDIA_ROOT ?? 'var/media');
  }

  async save(input: { bytes: Buffer; originalName: string }): Promise<{ id: string; storageKey: string; absolutePath: string }> {
    if (input.bytes.length > 5 * 1024 * 1024) throw new Error('MEDIA_TOO_LARGE');
    const detected = inspect(input.bytes);
    if (!detected) throw new Error('UNSUPPORTED_MEDIA');
    const id = randomUUID();
    const storageKey = `${randomUUID()}.${detected.extension}`;
    const absolutePath = resolve(this.root, storageKey);
    await mkdir(this.root, { recursive: true });
    await writeFile(absolutePath, input.bytes, { flag: 'wx' });
    await this.dataSource.query(`INSERT INTO media_asset (id, storage_key, mime_type, byte_size) VALUES ($1,$2,$3,$4)`, [id, storageKey, detected.mimeType, input.bytes.length]);
    return { id, storageKey, absolutePath };
  }
}

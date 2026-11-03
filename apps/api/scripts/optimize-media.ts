import { createDataSource } from '../database/data-source.js';
import { MediaService } from '../src/media/media.service.js';

const dataSource = await createDataSource().initialize();
const write = process.argv.includes('--write');
const service = new MediaService(dataSource);
let before = 0;
let after = 0;
let processed = 0;
let failed = 0;
let cursor: string | null = null;
try {
  for (;;) {
    const assets: { id: string }[] = await dataSource.query(
      `SELECT id FROM media_asset WHERE ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 100`,
      [cursor],
    );
    if (!assets.length) break;
    for (const asset of assets) {
      try {
        const result = await service.optimizeStoredAsset(asset.id, write);
        before += result.before;
        after += result.after;
        processed++;
        console.log(`${asset.id}: ${result.before} -> ${result.after} bytes`);
      } catch (error) {
        failed++;
        console.error(
          `${asset.id}: ${error instanceof Error ? error.message : 'OPTIMIZATION_FAILED'}`,
        );
      }
    }
    cursor = assets.at(-1)!.id;
  }
  console.log(
    `${write ? 'Saved' : 'Dry run'}: ${processed} images, ${before} -> ${after} bytes; ${failed} failed`,
  );
  if (failed) process.exitCode = 1;
} finally {
  await dataSource.destroy();
}

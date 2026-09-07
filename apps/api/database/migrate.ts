import dataSource from './data-source.js';

await dataSource.initialize();
try {
  const migrations = await dataSource.runMigrations({ transaction: 'all' });
  console.info(`Applied ${migrations.length} migration(s).`);
} finally {
  await dataSource.destroy();
}

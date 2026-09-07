import { getTemplate } from '@spark/templates';

import dataSource from '../database/data-source.js';

await dataSource.initialize();
try {
  const versions = await dataSource.query<{ id: string; template_id: string; template_version: number; config: unknown }[]>(
    `SELECT id, template_id, template_version, config FROM activity_version WHERE status IN ('DRAFT','PUBLISHED')`,
  );
  const failures = versions.flatMap((version) => {
    try {
      const template = getTemplate(version.template_id, version.template_version);
      return template.configSchema.safeParse(version.config).success ? [] : [version.id];
    } catch {
      return [version.id];
    }
  });
  if (failures.length > 0) throw new Error(`INCOMPATIBLE_ACTIVITY_VERSIONS:${failures.join(',')}`);
  console.info(`Checked ${versions.length} active activity version(s).`);
} finally {
  await dataSource.destroy();
}

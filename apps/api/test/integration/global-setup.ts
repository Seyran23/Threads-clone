import { execSync } from 'node:child_process';

import { PostgreSqlContainer } from '@testcontainers/postgresql';

export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:16').start();
  const databaseUrl = container.getConnectionUri();

  process.env.DATABASE_URL = databaseUrl;

  execSync('pnpm exec prisma migrate deploy', {
    cwd: `${__dirname}/../..`,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}

export const DATABASE_URL_ENV_VAR = 'DATABASE_URL';

export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = env[DATABASE_URL_ENV_VAR];

  if (!databaseUrl) {
    throw new Error(
      `Missing ${DATABASE_URL_ENV_VAR}. Set a PostgreSQL connection string before using @dabrowskiego/db.`,
    );
  }

  return databaseUrl;
}

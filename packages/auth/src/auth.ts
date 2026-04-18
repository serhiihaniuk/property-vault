import {
  authAccounts,
  authSessions,
  authUsers,
  authVerifications,
  type PropertyVaultDatabase,
} from '@dabrowskiego/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { resolvePropertyVaultAuthConfig, type ResolvePropertyVaultAuthConfigOptions } from './config.ts';
import { PROPERTY_VAULT_DEFAULT_ROLE, PROPERTY_VAULT_ROLES } from './roles.ts';

export interface CreatePropertyVaultAuthOptions extends ResolvePropertyVaultAuthConfigOptions {
  db: PropertyVaultDatabase;
}

export function createPropertyVaultAuth(options: CreatePropertyVaultAuthOptions) {
  const { db, ...configOptions } = options;
  const config = resolvePropertyVaultAuthConfig(configOptions);

  return betterAuth({
    appName: config.appName,
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        account: authAccounts,
        session: authSessions,
        user: authUsers,
        verification: authVerifications,
      },
    }),
    emailAndPassword: {
      disableSignUp: true,
      enabled: true,
    },
    user: {
      additionalFields: {
        role: {
          defaultValue: PROPERTY_VAULT_DEFAULT_ROLE,
          input: false,
          required: false,
          type: [...PROPERTY_VAULT_ROLES],
        },
      },
    },
  });
}

export type PropertyVaultAuth = ReturnType<typeof createPropertyVaultAuth>;
export type PropertyVaultSession = PropertyVaultAuth['$Infer']['Session'];
export type PropertyVaultSessionUser = PropertyVaultSession['user'];

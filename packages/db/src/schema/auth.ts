import {
  boolean,
  index,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const auth = pgSchema('auth');

const timestampColumn = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'string' }).notNull().defaultNow();

export const authUsers = auth.table(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    role: text('role').notNull().default('viewer'),
    createdAt: timestampColumn('created_at'),
    updatedAt: timestampColumn('updated_at'),
  },
  (table) => [uniqueIndex('auth_user_email_unique').on(table.email)],
);

export const authSessions = auth.table(
  'session',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestampColumn('created_at'),
    updatedAt: timestampColumn('updated_at'),
  },
  (table) => [
    uniqueIndex('auth_session_token_unique').on(table.token),
    index('auth_session_user_id_idx').on(table.userId),
    index('auth_session_expires_at_idx').on(table.expiresAt),
  ],
);

export const authAccounts = auth.table(
  'account',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
      mode: 'string',
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
      mode: 'string',
    }),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    createdAt: timestampColumn('created_at'),
    updatedAt: timestampColumn('updated_at'),
  },
  (table) => [
    uniqueIndex('auth_account_provider_account_unique').on(table.providerId, table.accountId),
    index('auth_account_user_id_idx').on(table.userId),
  ],
);

export const authVerifications = auth.table(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    createdAt: timestampColumn('created_at'),
    updatedAt: timestampColumn('updated_at'),
  },
  (table) => [
    index('auth_verification_identifier_idx').on(table.identifier),
    index('auth_verification_expires_at_idx').on(table.expiresAt),
  ],
);

export const authInvitations = auth.table(
  'invitation',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    role: text('role').notNull().default('viewer'),
    tokenHash: text('token_hash').notNull(),
    invitedByUserId: text('invited_by_user_id').references(() => authUsers.id, {
      onDelete: 'set null',
    }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'string' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestampColumn('created_at'),
    updatedAt: timestampColumn('updated_at'),
  },
  (table) => [
    uniqueIndex('auth_invitation_token_hash_unique').on(table.tokenHash),
    index('auth_invitation_email_idx').on(table.email),
    index('auth_invitation_expires_at_idx').on(table.expiresAt),
  ],
);

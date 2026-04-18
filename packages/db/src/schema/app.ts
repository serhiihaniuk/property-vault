import { sql } from 'drizzle-orm';
import {
  bigserial,
  index,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { authUsers } from './auth.ts';

const app = pgSchema('app');

const timestampColumn = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'string' }).notNull().defaultNow();

export const appSyncState = app.table(
  'sync_state',
  {
    key: text('key').primaryKey(),
    status: text('status').notNull().default('idle'),
    cursorJson: jsonb('cursor_json').notNull().default(sql`'{}'::jsonb`),
    summaryJson: jsonb('summary_json').notNull().default(sql`'{}'::jsonb`),
    lastStartedAt: timestamp('last_started_at', { withTimezone: true, mode: 'string' }),
    lastFinishedAt: timestamp('last_finished_at', { withTimezone: true, mode: 'string' }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true, mode: 'string' }),
    lastError: text('last_error'),
    updatedAt: timestampColumn('updated_at'),
  },
  (table) => [index('app_sync_state_status_idx').on(table.status)],
);

export const appReviewFlags = app.table(
  'review_flag',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    subjectKind: text('subject_kind').notNull(),
    subjectRef: text('subject_ref').notNull(),
    flag: text('flag').notNull(),
    status: text('status').notNull().default('open'),
    note: text('note'),
    createdByUserId: text('created_by_user_id').references(() => authUsers.id, {
      onDelete: 'set null',
    }),
    resolvedByUserId: text('resolved_by_user_id').references(() => authUsers.id, {
      onDelete: 'set null',
    }),
    createdAt: timestampColumn('created_at'),
    updatedAt: timestampColumn('updated_at'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    uniqueIndex('app_review_flag_subject_unique').on(
      table.subjectKind,
      table.subjectRef,
      table.flag,
    ),
    index('app_review_flag_status_idx').on(table.status),
  ],
);

export const appUserPreferences = app.table('user_preference', {
  userId: text('user_id')
    .primaryKey()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  timezone: text('timezone').notNull().default('Europe/Warsaw'),
  periodView: text('period_view'),
  dashboardMonth: text('dashboard_month'),
  preferencesJson: jsonb('preferences_json').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestampColumn('created_at'),
  updatedAt: timestampColumn('updated_at'),
});

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  authAccounts,
  authInvitations,
  authUsers,
  type PropertyVaultDatabase,
} from '@dabrowskiego/db';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import type { PropertyVaultAuth } from './auth.ts';
import { isPropertyVaultRole, type PropertyVaultRole } from './roles.ts';

export type AccessInvitationStatus = 'accepted' | 'expired' | 'pending' | 'revoked';
type AccessDatabaseExecutor = Pick<
  PropertyVaultDatabase,
  'execute' | 'insert' | 'select' | 'update'
>;

export interface AccessMemberSummary {
  createdAt: string;
  email: string;
  emailVerified: boolean;
  id: string;
  name: string;
  role: PropertyVaultRole;
  updatedAt: string;
}

export interface AccessInvitationSummary {
  acceptedAt: string | null;
  createdAt: string;
  email: string;
  expiresAt: string;
  id: string;
  revokedAt: string | null;
  role: PropertyVaultRole;
  status: AccessInvitationStatus;
  updatedAt: string;
}

export interface CreateAccessInvitationOptions {
  db: PropertyVaultDatabase;
  email: string;
  invitedByUserId: string;
  now?: () => Date;
  role: PropertyVaultRole;
}

export interface CreateAccessInvitationResult {
  invitation: AccessInvitationSummary;
  token: string;
}

export interface RemoveAccessMemberOptions {
  actingUserId: string;
  auth: PropertyVaultAuth;
  db: PropertyVaultDatabase;
  memberId: string;
}

export interface GetAccessInvitationByTokenOptions {
  db: PropertyVaultDatabase;
  now?: () => Date;
  token: string;
}

export interface AcceptAccessInvitationOptions {
  auth: PropertyVaultAuth;
  db: PropertyVaultDatabase;
  name: string;
  now?: () => Date;
  password: string;
  token: string;
}

export interface AcceptAccessInvitationResult {
  email: string;
  role: PropertyVaultRole;
}

export interface RevokeAccessInvitationOptions {
  db: PropertyVaultDatabase;
  id: string;
  now?: () => Date;
}

export class AccessInvitationNotFoundError extends Error {
  readonly lookup: 'id' | 'token';

  constructor(lookup: 'id' | 'token' = 'token') {
    super(
      lookup === 'id'
        ? 'The invitation record does not exist.'
        : 'The invitation token is invalid.',
    );
    this.name = 'AccessInvitationNotFoundError';
    this.lookup = lookup;
  }
}

export class AccessInvitationStatusError extends Error {
  readonly status: Exclude<AccessInvitationStatus, 'pending'>;

  constructor(status: Exclude<AccessInvitationStatus, 'pending'>) {
    super(`The invitation is ${status}.`);
    this.name = 'AccessInvitationStatusError';
    this.status = status;
  }
}

export class AccessPasswordPolicyError extends Error {
  readonly maxLength: number;
  readonly minLength: number;

  constructor(minLength: number, maxLength: number) {
    super(`Passwords must be between ${minLength} and ${maxLength} characters.`);
    this.name = 'AccessPasswordPolicyError';
    this.maxLength = maxLength;
    this.minLength = minLength;
  }
}

export class AccessUserAlreadyExistsError extends Error {
  readonly email: string;

  constructor(email: string) {
    super(`A user with email "${email}" already exists.`);
    this.name = 'AccessUserAlreadyExistsError';
    this.email = email;
  }
}

export class AccessMemberNotFoundError extends Error {
  constructor() {
    super('The access member does not exist.');
    this.name = 'AccessMemberNotFoundError';
  }
}

export class AccessMemberRemovalForbiddenError extends Error {
  readonly reason: 'owner' | 'self';

  constructor(reason: 'owner' | 'self') {
    super(
      reason === 'owner'
        ? 'Owner accounts cannot be removed.'
        : 'You cannot remove your own account.',
    );
    this.name = 'AccessMemberRemovalForbiddenError';
    this.reason = reason;
  }
}

export async function listAccessMembers(
  db: PropertyVaultDatabase,
): Promise<AccessMemberSummary[]> {
  const rows = await db
    .select({
      createdAt: authUsers.createdAt,
      email: authUsers.email,
      emailVerified: authUsers.emailVerified,
      id: authUsers.id,
      name: authUsers.name,
      role: authUsers.role,
      updatedAt: authUsers.updatedAt,
    })
    .from(authUsers)
    .orderBy(desc(authUsers.createdAt));

  return rows.map((row) => createMemberSummary(row));
}

export async function listAccessInvitations(
  db: PropertyVaultDatabase,
  now: Date = new Date(),
): Promise<AccessInvitationSummary[]> {
  const rows = await db
    .select({
      acceptedAt: authInvitations.acceptedAt,
      createdAt: authInvitations.createdAt,
      email: authInvitations.email,
      expiresAt: authInvitations.expiresAt,
      id: authInvitations.id,
      revokedAt: authInvitations.revokedAt,
      role: authInvitations.role,
      updatedAt: authInvitations.updatedAt,
    })
    .from(authInvitations)
    .orderBy(desc(authInvitations.createdAt));

  return rows.map((row) => createInvitationSummary(row, now));
}

export async function createAccessInvitation(
  options: CreateAccessInvitationOptions,
): Promise<CreateAccessInvitationResult> {
  const normalizedEmail = normalizeEmail(options.email);
  const now = options.now?.() ?? new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const id = randomUUID();
  const token = randomBytes(24).toString('base64url');
  const invitationRow = {
    acceptedAt: null,
    createdAt: nowIso,
    email: normalizedEmail,
    expiresAt,
    id,
    invitedByUserId: options.invitedByUserId,
    revokedAt: null,
    role: options.role,
    tokenHash: hashAccessInvitationToken(token),
    updatedAt: nowIso,
  };

  const invitation = await options.db.transaction(async (tx) => {
    await lockAccessInvitationEmail(tx, normalizedEmail);

    const existingUser = await findUserByEmail(tx, normalizedEmail);

    if (existingUser) {
      throw new AccessUserAlreadyExistsError(normalizedEmail);
    }

    const invitationRows = await tx
      .select({
        acceptedAt: authInvitations.acceptedAt,
        createdAt: authInvitations.createdAt,
        email: authInvitations.email,
        expiresAt: authInvitations.expiresAt,
        id: authInvitations.id,
        revokedAt: authInvitations.revokedAt,
        role: authInvitations.role,
        updatedAt: authInvitations.updatedAt,
      })
      .from(authInvitations)
      .where(eq(authInvitations.email, normalizedEmail));
    const activeInvitationIds = invitationRows
      .map((row) => createInvitationSummary(row, now))
      .filter((row) => row.status === 'pending')
      .map((row) => row.id);

    if (activeInvitationIds.length > 0) {
      await tx
        .update(authInvitations)
        .set({
          revokedAt: nowIso,
          updatedAt: nowIso,
        })
        .where(inArray(authInvitations.id, activeInvitationIds));
    }

    await tx.insert(authInvitations).values(invitationRow);

    return createInvitationSummary(invitationRow, now);
  });

  return {
    invitation,
    token,
  };
}

export async function getAccessInvitationByToken(
  options: GetAccessInvitationByTokenOptions,
): Promise<AccessInvitationSummary> {
  const now = options.now?.() ?? new Date();
  const row = await findInvitationByToken(options.db, options.token);

  if (!row) {
    throw new AccessInvitationNotFoundError();
  }

  return createInvitationSummary(row, now);
}

export async function acceptAccessInvitation(
  options: AcceptAccessInvitationOptions,
): Promise<AcceptAccessInvitationResult> {
  const now = options.now?.() ?? new Date();
  const invitationRow = await findInvitationByToken(options.db, options.token);

  if (!invitationRow) {
    throw new AccessInvitationNotFoundError();
  }

  const authContext = await options.auth.$context;
  const password = options.password;
  const minPasswordLength = authContext.password.config.minPasswordLength;
  const maxPasswordLength = authContext.password.config.maxPasswordLength;

  if (password.length < minPasswordLength || password.length > maxPasswordLength) {
    throw new AccessPasswordPolicyError(minPasswordLength, maxPasswordLength);
  }

  const passwordHash = await authContext.password.hash(password);
  const userName = options.name.trim();
  const acceptedAt = now.toISOString();

  return options.db.transaction(async (tx) => {
    await lockAccessInvitation(tx, invitationRow.id);

    const lockedInvitationRow = await findInvitationById(tx, invitationRow.id);

    if (!lockedInvitationRow) {
      throw new AccessInvitationNotFoundError();
    }

    const invitation = createInvitationSummary(lockedInvitationRow, now);

    if (invitation.status !== 'pending') {
      throw new AccessInvitationStatusError(invitation.status);
    }

    const normalizedEmail = normalizeEmail(invitation.email);
    const existingUser = await findUserByEmail(tx, normalizedEmail);

    if (existingUser) {
      throw new AccessUserAlreadyExistsError(normalizedEmail);
    }

    const userId = randomUUID();

    await tx.insert(authUsers).values({
      createdAt: acceptedAt,
      email: normalizedEmail,
      emailVerified: false,
      id: userId,
      name: userName,
      role: invitation.role,
      updatedAt: acceptedAt,
    });
    await tx.insert(authAccounts).values({
      accountId: userId,
      createdAt: acceptedAt,
      id: randomUUID(),
      password: passwordHash,
      providerId: 'credential',
      updatedAt: acceptedAt,
      userId,
    });
    await tx
      .update(authInvitations)
      .set({
        acceptedAt,
        updatedAt: acceptedAt,
      })
      .where(eq(authInvitations.id, invitation.id));

    return {
      email: normalizedEmail,
      role: invitation.role,
    };
  });
}

export async function revokeAccessInvitation(
  options: RevokeAccessInvitationOptions,
): Promise<AccessInvitationSummary> {
  const now = options.now?.() ?? new Date();
  const nowIso = now.toISOString();

  return options.db.transaction(async (tx) => {
    await lockAccessInvitation(tx, options.id);

    const invitationRow = await findInvitationById(tx, options.id);

    if (!invitationRow) {
      throw new AccessInvitationNotFoundError('id');
    }

    const invitation = createInvitationSummary(invitationRow, now);

    if (invitation.status !== 'pending') {
      throw new AccessInvitationStatusError(invitation.status);
    }

    await tx
      .update(authInvitations)
      .set({
        revokedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(eq(authInvitations.id, invitation.id));

    return createInvitationSummary(
      {
        ...invitationRow,
        revokedAt: nowIso,
        updatedAt: nowIso,
      },
      now,
    );
  });
}

export async function removeAccessMember(
  options: RemoveAccessMemberOptions,
): Promise<AccessMemberSummary> {
  const member = await findMemberById(options.db, options.memberId);

  if (!member) {
    throw new AccessMemberNotFoundError();
  }

  if (member.id === options.actingUserId) {
    throw new AccessMemberRemovalForbiddenError('self');
  }

  if (parseRole(member.role) === 'owner') {
    throw new AccessMemberRemovalForbiddenError('owner');
  }

  const summary = createMemberSummary(member);
  const authContext = await options.auth.$context;

  await authContext.internalAdapter.deleteUser(member.id);

  return summary;
}

export function hashAccessInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function findInvitationByToken(
  db: AccessDatabaseExecutor,
  token: string,
) {
  const rows = await db
    .select({
      acceptedAt: authInvitations.acceptedAt,
      createdAt: authInvitations.createdAt,
      email: authInvitations.email,
      expiresAt: authInvitations.expiresAt,
      id: authInvitations.id,
      revokedAt: authInvitations.revokedAt,
      role: authInvitations.role,
      updatedAt: authInvitations.updatedAt,
    })
    .from(authInvitations)
    .where(eq(authInvitations.tokenHash, hashAccessInvitationToken(token)))
    .limit(1);

  return rows[0] ?? null;
}

async function findInvitationById(
  db: AccessDatabaseExecutor,
  id: string,
) {
  const rows = await db
    .select({
      acceptedAt: authInvitations.acceptedAt,
      createdAt: authInvitations.createdAt,
      email: authInvitations.email,
      expiresAt: authInvitations.expiresAt,
      id: authInvitations.id,
      revokedAt: authInvitations.revokedAt,
      role: authInvitations.role,
      updatedAt: authInvitations.updatedAt,
    })
    .from(authInvitations)
    .where(eq(authInvitations.id, id))
    .limit(1);

  return rows[0] ?? null;
}

async function findUserByEmail(
  db: AccessDatabaseExecutor,
  email: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({
      id: authUsers.id,
    })
    .from(authUsers)
    .where(eq(authUsers.email, email))
    .limit(1);

  return rows[0] ?? null;
}

async function lockAccessInvitationEmail(
  db: AccessDatabaseExecutor,
  email: string,
): Promise<void> {
  await lockAccessScope(db, `access-invitation-email:${email}`);
}

async function lockAccessInvitation(
  db: AccessDatabaseExecutor,
  invitationId: string,
): Promise<void> {
  await lockAccessScope(db, `access-invitation:${invitationId}`);
}

async function lockAccessScope(
  db: AccessDatabaseExecutor,
  key: string,
): Promise<void> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
}

async function findMemberById(
  db: PropertyVaultDatabase,
  memberId: string,
): Promise<{
  createdAt: string;
  email: string;
  emailVerified: boolean;
  id: string;
  name: string;
  role: string;
  updatedAt: string;
} | null> {
  const rows = await db
    .select({
      createdAt: authUsers.createdAt,
      email: authUsers.email,
      emailVerified: authUsers.emailVerified,
      id: authUsers.id,
      name: authUsers.name,
      role: authUsers.role,
      updatedAt: authUsers.updatedAt,
    })
    .from(authUsers)
    .where(eq(authUsers.id, memberId))
    .limit(1);

  return rows[0] ?? null;
}

function createMemberSummary(row: {
  createdAt: string;
  email: string;
  emailVerified: boolean;
  id: string;
  name: string;
  role: string;
  updatedAt: string;
}): AccessMemberSummary {
  return {
    createdAt: toIsoDateTime(row.createdAt),
    email: normalizeEmail(row.email),
    emailVerified: row.emailVerified,
    id: row.id,
    name: row.name,
    role: parseRole(row.role),
    updatedAt: toIsoDateTime(row.updatedAt),
  };
}

function createInvitationSummary(
  row: {
    acceptedAt: string | null;
    createdAt: string;
    email: string;
    expiresAt: string;
    id: string;
    revokedAt: string | null;
    role: string;
    updatedAt: string;
  },
  now: Date,
): AccessInvitationSummary {
  return {
    acceptedAt: toOptionalIsoDateTime(row.acceptedAt),
    createdAt: toIsoDateTime(row.createdAt),
    email: normalizeEmail(row.email),
    expiresAt: toIsoDateTime(row.expiresAt),
    id: row.id,
    revokedAt: toOptionalIsoDateTime(row.revokedAt),
    role: parseRole(row.role),
    status: resolveInvitationStatus(row, now),
    updatedAt: toIsoDateTime(row.updatedAt),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseRole(role: string): PropertyVaultRole {
  if (!isPropertyVaultRole(role)) {
    throw new Error(`Unsupported auth role "${role}".`);
  }

  return role;
}

function resolveInvitationStatus(
  row: {
    acceptedAt: string | null;
    expiresAt: string;
    revokedAt: string | null;
  },
  now: Date,
): AccessInvitationStatus {
  if (row.acceptedAt) {
    return 'accepted';
  }

  if (row.revokedAt) {
    return 'revoked';
  }

  if (new Date(row.expiresAt).getTime() <= now.getTime()) {
    return 'expired';
  }

  return 'pending';
}

function toIsoDateTime(value: string): string {
  return new Date(value).toISOString();
}

function toOptionalIsoDateTime(value: string | null): string | null {
  return value ? toIsoDateTime(value) : null;
}

import { hasMinimumRole, isPropertyVaultRole, type PropertyVaultRole } from './roles.ts';
import type { PropertyVaultAuth, PropertyVaultSession } from './auth.ts';

export interface PropertyVaultSessionLike {
  user: {
    id?: string;
    role?: string | null;
  };
}

export class AuthenticationRequiredError extends Error {
  readonly code = 'AUTHENTICATION_REQUIRED';

  constructor(message = 'Authentication is required.') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

export class AuthorizationRequiredError extends Error {
  readonly actualRole: string | null;
  readonly code = 'AUTHORIZATION_REQUIRED';
  readonly minimumRole: PropertyVaultRole;

  constructor(minimumRole: PropertyVaultRole, actualRole: string | null) {
    super(`The current session must have at least the "${minimumRole}" role.`);
    this.actualRole = actualRole;
    this.minimumRole = minimumRole;
    this.name = 'AuthorizationRequiredError';
  }
}

export async function getSessionFromHeaders(
  auth: PropertyVaultAuth,
  headers: HeadersInit,
): Promise<PropertyVaultSession | null> {
  return auth.api.getSession({
    headers: new Headers(headers),
  });
}

export async function requireSessionFromHeaders(
  auth: PropertyVaultAuth,
  headers: HeadersInit,
): Promise<PropertyVaultSession> {
  const session = await getSessionFromHeaders(auth, headers);

  if (!session) {
    throw new AuthenticationRequiredError();
  }

  return session;
}

export function getSessionRole(
  session: PropertyVaultSessionLike | null | undefined,
): PropertyVaultRole | null {
  const role = session?.user.role;

  return isPropertyVaultRole(role) ? role : null;
}

export function sessionHasMinimumRole(
  session: PropertyVaultSessionLike | null | undefined,
  minimumRole: PropertyVaultRole,
): boolean {
  return hasMinimumRole(session?.user.role, minimumRole);
}

export function requireSessionRole<TSession extends PropertyVaultSessionLike>(
  session: TSession,
  minimumRole: PropertyVaultRole,
): TSession {
  const actualRole = getSessionRole(session);

  if (!actualRole || !hasMinimumRole(actualRole, minimumRole)) {
    throw new AuthorizationRequiredError(minimumRole, actualRole);
  }

  return session;
}


import {
  AccessInvitationNotFoundError,
  AccessInvitationStatusError,
  AccessMemberNotFoundError,
  AccessMemberRemovalForbiddenError,
  AccessPasswordPolicyError,
  AccessUserAlreadyExistsError,
  AuthenticationRequiredError,
  AuthorizationRequiredError,
  getRuntimePropertyVaultAuth,
  requireSessionFromHeaders,
  type PropertyVaultSession,
} from '@dabrowskiego/auth';
import {
  acceptAccessInvitationRequestSchema,
  acceptAccessInvitationRoute,
  accessInvitationIdPathParamsSchema,
  accessInvitationTokenPathParamsSchema,
  accessInvitationRoute,
  accessMemberIdPathParamsSchema,
  accessOverviewRoute,
  createAccessInvitationRequestSchema,
  createAccessInvitationRoute,
  removeAccessMemberRoute,
  revokeAccessInvitationRoute,
} from '@dabrowskiego/contracts';
import {
  createApiProblem,
  ApiProblemError,
} from './problem.ts';
import type { PropertyVaultApiRuntime } from './runtime.ts';
import { getPropertyVaultApiRuntime } from './runtime.ts';
import { createRouteHandler } from './route-handler.ts';

type RuntimeResolver = () => PropertyVaultApiRuntime;

export function createAccessOverviewGetHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
) {
  return createRouteHandler({
    contract: accessOverviewRoute,
    async execute(_request, _context, incomingRequest) {
      const runtime = resolveRuntime();
      const session = await requireAccessSession(incomingRequest);

      try {
        return await runtime.getDbApplication().access.getOverview(session);
      } catch (error) {
        throw mapAccessProblem(error, incomingRequest.url);
      }
    },
  });
}

export function createAccessInvitationPostHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
) {
  return createRouteHandler({
    contract: createAccessInvitationRoute,
    async execute({ body }, _context, incomingRequest) {
      const runtime = resolveRuntime();
      const session = await requireAccessSession(incomingRequest);
      const parsedBody = createAccessInvitationRequestSchema.parse(body);

      try {
        return {
          body: await runtime.getDbApplication().access.createInvitation(session, parsedBody),
          status: 201,
        };
      } catch (error) {
        throw mapAccessProblem(error, incomingRequest.url);
      }
    },
  });
}

export function createAccessInvitationGetHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
) {
  return createRouteHandler({
    contract: accessInvitationRoute,
    async execute({ pathParams }, _context, incomingRequest) {
      const runtime = resolveRuntime();
      const { token } = accessInvitationTokenPathParamsSchema.parse(pathParams);

      try {
        return await runtime.getDbApplication().access.getInvitation(token);
      } catch (error) {
        throw mapAccessProblem(error, incomingRequest.url);
      }
    },
  });
}

export function createAccessInvitationAcceptHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
) {
  return createRouteHandler({
    contract: acceptAccessInvitationRoute,
    async execute({ body, pathParams }, _context, incomingRequest) {
      const runtime = resolveRuntime();
      const { token } = accessInvitationTokenPathParamsSchema.parse(pathParams);
      const parsedBody = acceptAccessInvitationRequestSchema.parse(body);

      try {
        return await runtime.getDbApplication().access.acceptInvitation(token, parsedBody);
      } catch (error) {
        throw mapAccessProblem(error, incomingRequest.url);
      }
    },
  });
}

export function createAccessInvitationDeleteHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
) {
  return createRouteHandler({
    contract: revokeAccessInvitationRoute,
    async execute({ pathParams }, _context, incomingRequest) {
      const runtime = resolveRuntime();
      const session = await requireAccessSession(incomingRequest);
      const { invitationId } = accessInvitationIdPathParamsSchema.parse(pathParams);

      try {
        return await runtime.getDbApplication().access.revokeInvitation(
          session,
          invitationId,
        );
      } catch (error) {
        throw mapAccessProblem(error, incomingRequest.url);
      }
    },
  });
}

export function createAccessMemberDeleteHandler(
  resolveRuntime: RuntimeResolver = getPropertyVaultApiRuntime,
) {
  return createRouteHandler({
    contract: removeAccessMemberRoute,
    async execute({ pathParams }, _context, incomingRequest) {
      const runtime = resolveRuntime();
      const session = await requireAccessSession(incomingRequest);
      const { memberId } = accessMemberIdPathParamsSchema.parse(pathParams);

      try {
        return await runtime.getDbApplication().access.removeMember(session, memberId);
      } catch (error) {
        throw mapAccessProblem(error, incomingRequest.url);
      }
    },
  });
}

async function requireAccessSession(request: Request): Promise<PropertyVaultSession> {
  const auth = getRuntimePropertyVaultAuth();

  try {
    return await requireSessionFromHeaders(auth, request.headers);
  } catch (error) {
    throw mapAccessProblem(error, request.url);
  }
}

function mapAccessProblem(error: unknown, instance: string): ApiProblemError {
  if (error instanceof ApiProblemError) {
    return error;
  }

  if (
    error instanceof AuthenticationRequiredError ||
    hasErrorIdentity(error, 'AuthenticationRequiredError', 'AUTHENTICATION_REQUIRED')
  ) {
    return new ApiProblemError(
      createApiProblem({
        code: 'authentication_required',
        detail: 'Sign in before accessing this route.',
        instance,
        status: 401,
        title: 'Authentication required.',
      }),
    );
  }

  if (
    error instanceof AuthorizationRequiredError ||
    hasErrorIdentity(error, 'AuthorizationRequiredError', 'AUTHORIZATION_REQUIRED')
  ) {
    return new ApiProblemError(
      createApiProblem({
        code: 'access_forbidden',
        detail: 'Owner permissions are required for access management.',
        instance,
        status: 403,
        title: 'Access forbidden.',
      }),
    );
  }

  if (
    error instanceof AccessInvitationNotFoundError ||
    hasErrorIdentity(error, 'AccessInvitationNotFoundError')
  ) {
    const lookup =
      typeof (error as { lookup?: unknown }).lookup === 'string'
        ? ((error as { lookup: 'id' | 'token' }).lookup)
        : 'token';

    return new ApiProblemError(
      createApiProblem({
        code: 'invitation_not_found',
        detail:
          lookup === 'id'
            ? 'No invitation matches this record.'
            : 'No invitation matches this token.',
        instance,
        status: 404,
        title: 'Invitation not found.',
      }),
    );
  }

  if (
    error instanceof AccessMemberNotFoundError ||
    hasErrorIdentity(error, 'AccessMemberNotFoundError')
  ) {
    return new ApiProblemError(
      createApiProblem({
        code: 'access_member_not_found',
        detail: 'No access member matches this record.',
        instance,
        status: 404,
        title: 'Access member not found.',
      }),
    );
  }

  if (
    error instanceof AccessInvitationStatusError ||
    hasErrorIdentity(error, 'AccessInvitationStatusError')
  ) {
    const invitationStatus =
      typeof (error as { status?: unknown }).status === 'string'
        ? ((error as { status: 'accepted' | 'expired' | 'pending' | 'revoked' }).status)
        : 'pending';

    return new ApiProblemError(
      createApiProblem({
        code: 'invitation_unavailable',
        detail: describeInvitationStatus(invitationStatus),
        instance,
        status: 409,
        title: 'Invitation unavailable.',
      }),
    );
  }

  if (
    error instanceof AccessUserAlreadyExistsError ||
    hasErrorIdentity(error, 'AccessUserAlreadyExistsError')
  ) {
    const email =
      typeof (error as { email?: unknown }).email === 'string'
        ? (error as { email: string }).email
        : 'this email';

    return new ApiProblemError(
      createApiProblem({
        code: 'access_user_exists',
        detail: `The email "${email}" already belongs to an existing account.`,
        instance,
        status: 409,
        title: 'User already exists.',
      }),
    );
  }

  if (
    error instanceof AccessMemberRemovalForbiddenError ||
    hasErrorIdentity(error, 'AccessMemberRemovalForbiddenError')
  ) {
    const reason =
      typeof (error as { reason?: unknown }).reason === 'string'
        ? ((error as { reason: 'owner' | 'self' }).reason)
        : 'owner';

    return new ApiProblemError(
      createApiProblem({
        code: 'access_member_not_removable',
        detail:
          reason === 'self'
            ? 'You cannot remove your own account from access management.'
            : 'Owner accounts cannot be removed from access management.',
        instance,
        status: 409,
        title: 'Access member cannot be removed.',
      }),
    );
  }

  if (
    error instanceof AccessPasswordPolicyError ||
    hasErrorIdentity(error, 'AccessPasswordPolicyError')
  ) {
    return new ApiProblemError(
      createApiProblem({
        code: 'invalid_password',
        detail: error instanceof Error ? error.message : 'Password does not meet the policy.',
        instance,
        status: 400,
        title: 'Invalid password.',
      }),
    );
  }

  throw error;
}

function describeInvitationStatus(
  status: 'accepted' | 'expired' | 'pending' | 'revoked',
) {
  switch (status) {
    case 'accepted':
      return 'This invitation has already been accepted.';
    case 'expired':
      return 'This invitation has expired.';
    case 'revoked':
      return 'This invitation has been revoked.';
    default:
      return 'This invitation cannot be accepted.';
  }
}

function hasErrorIdentity(
  error: unknown,
  expectedName: string,
  expectedCode?: string,
): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: unknown; name?: unknown };

  if (candidate.name !== expectedName) {
    return false;
  }

  if (expectedCode === undefined) {
    return true;
  }

  return candidate.code === expectedCode;
}

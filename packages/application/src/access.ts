import {
  acceptAccessInvitation,
  AuthenticationRequiredError,
  createAccessInvitation,
  createPropertyVaultAuth,
  getAccessInvitationByToken,
  listAccessInvitations,
  listAccessMembers,
  removeAccessMember,
  revokeAccessInvitation,
  requireSessionRole,
  type PropertyVaultSessionLike,
} from '@dabrowskiego/auth';
import {
  acceptAccessInvitationRequestSchema,
  acceptAccessInvitationResponseSchema,
  accessInvitationIdPathParamsSchema,
  accessInvitationPreviewResponseSchema,
  accessMemberIdPathParamsSchema,
  accessOverviewResponseSchema,
  createAccessInvitationRequestSchema,
  createAccessInvitationResponseSchema,
  removeAccessMemberResponseSchema,
  revokeAccessInvitationResponseSchema,
} from '@dabrowskiego/contracts';
import type { PropertyVaultDatabase } from '@dabrowskiego/db';
import type { PropertyVaultApplicationContext } from './context.ts';

type AccessOverviewResponse = ReturnType<typeof accessOverviewResponseSchema.parse>;
type CreateAccessInvitationInput = ReturnType<typeof createAccessInvitationRequestSchema.parse>;
type CreateAccessInvitationResponse = ReturnType<typeof createAccessInvitationResponseSchema.parse>;
type AccessInvitationPreviewResponse = ReturnType<typeof accessInvitationPreviewResponseSchema.parse>;
type AcceptAccessInvitationInput = ReturnType<typeof acceptAccessInvitationRequestSchema.parse>;
type AcceptAccessInvitationResponse = ReturnType<typeof acceptAccessInvitationResponseSchema.parse>;
type RemoveAccessMemberResponse = ReturnType<typeof removeAccessMemberResponseSchema.parse>;
type RevokeAccessInvitationResponse = ReturnType<typeof revokeAccessInvitationResponseSchema.parse>;

export interface AccessApplicationService {
  acceptInvitation: (
    token: string,
    input: AcceptAccessInvitationInput,
  ) => Promise<AcceptAccessInvitationResponse>;
  createInvitation: (
    session: PropertyVaultSessionLike,
    input: CreateAccessInvitationInput,
  ) => Promise<CreateAccessInvitationResponse>;
  getInvitation: (token: string) => Promise<AccessInvitationPreviewResponse>;
  getOverview: (session: PropertyVaultSessionLike) => Promise<AccessOverviewResponse>;
  removeMember: (
    session: PropertyVaultSessionLike,
    memberId: string,
  ) => Promise<RemoveAccessMemberResponse>;
  revokeInvitation: (
    session: PropertyVaultSessionLike,
    invitationId: string,
  ) => Promise<RevokeAccessInvitationResponse>;
}

export function createAccessApplicationService(
  context: PropertyVaultApplicationContext,
): AccessApplicationService {
  return {
    async acceptInvitation(token, input) {
      const db = requireDatabase(context.db);
      const parsedInput = acceptAccessInvitationRequestSchema.parse(input);
      const result = await acceptAccessInvitation({
        auth: createPropertyVaultAuth({ db }),
        db,
        name: parsedInput.name,
        now: context.now,
        password: parsedInput.password,
        token,
      });

      return acceptAccessInvitationResponseSchema.parse({
        email: result.email,
        redirectTo: `/sign-in?accepted=1&email=${encodeURIComponent(result.email)}`,
        role: result.role,
        status: 'accepted',
      });
    },
    async createInvitation(session, input) {
      const db = requireDatabase(context.db);
      const authorizedSession = requireSessionRole(session, 'owner');
      const invitedByUserId = authorizedSession.user.id;

      if (!invitedByUserId) {
        throw new AuthenticationRequiredError(
          'The current session is missing a user identifier.',
        );
      }

      const parsedInput = createAccessInvitationRequestSchema.parse(input);
      const result = await createAccessInvitation({
        db,
        email: parsedInput.email,
        invitedByUserId,
        now: context.now,
        role: parsedInput.role,
      });

      return createAccessInvitationResponseSchema.parse({
        invitation: result.invitation,
        invitePath: `/invite/${encodeURIComponent(result.token)}`,
      });
    },
    async getInvitation(token) {
      const db = requireDatabase(context.db);
      const invitation = await getAccessInvitationByToken({
        db,
        now: context.now,
        token,
      });

      return accessInvitationPreviewResponseSchema.parse({
        canAccept: invitation.status === 'pending',
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        role: invitation.role,
        status: invitation.status,
      });
    },
    async getOverview(session) {
      const db = requireDatabase(context.db);

      requireSessionRole(session, 'owner');

      const [members, invitations] = await Promise.all([
        listAccessMembers(db),
        listAccessInvitations(db, context.now()),
      ]);

      return accessOverviewResponseSchema.parse({
        invitations,
        members,
      });
    },
    async removeMember(session, memberId) {
      const db = requireDatabase(context.db);
      const authorizedSession = requireSessionRole(session, 'owner');
      const actingUserId = authorizedSession.user.id;

      if (!actingUserId) {
        throw new AuthenticationRequiredError(
          'The current session is missing a user identifier.',
        );
      }

      const parsedPathParams = accessMemberIdPathParamsSchema.parse({
        memberId,
      });
      const member = await removeAccessMember({
        actingUserId,
        auth: createPropertyVaultAuth({ db }),
        db,
        memberId: parsedPathParams.memberId,
      });

      return removeAccessMemberResponseSchema.parse(member);
    },
    async revokeInvitation(session, invitationId) {
      const db = requireDatabase(context.db);

      requireSessionRole(session, 'owner');

      const parsedPathParams = accessInvitationIdPathParamsSchema.parse({
        invitationId,
      });
      const invitation = await revokeAccessInvitation({
        db,
        id: parsedPathParams.invitationId,
        now: context.now,
      });

      return revokeAccessInvitationResponseSchema.parse(invitation);
    },
  };
}

function requireDatabase(db: PropertyVaultDatabase | undefined): PropertyVaultDatabase {
  if (!db) {
    throw new Error('Access application service requires a configured database.');
  }

  return db;
}

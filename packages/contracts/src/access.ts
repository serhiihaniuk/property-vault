import { z } from 'zod';
import { apiProblemSchema, isoDateTimeSchema } from './shared.ts';
import { defineRoute, jsonRequestBody, jsonResponse } from './openapi.ts';

export const accessRoleSchema = z
  .enum(['viewer', 'editor', 'owner'])
  .describe('Access role for a private Property Vault user.');

export const accessInvitationStatusSchema = z
  .enum(['pending', 'accepted', 'expired', 'revoked'])
  .describe('Current lifecycle state for an access invitation.');

export const accessMemberSummarySchema = z
  .object({
    createdAt: isoDateTimeSchema,
    email: z.string().email(),
    emailVerified: z.boolean(),
    id: z.string().min(1),
    name: z.string().min(1),
    role: accessRoleSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .describe('Authenticated user summary for access management.');

export const accessMemberIdPathParamsSchema = z
  .object({
    memberId: z.string().min(1),
  })
  .strict()
  .describe('Path params for an existing access member.');

export const accessInvitationSummarySchema = z
  .object({
    acceptedAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    email: z.string().email(),
    expiresAt: isoDateTimeSchema,
    id: z.string().min(1),
    revokedAt: isoDateTimeSchema.nullable(),
    role: accessRoleSchema,
    status: accessInvitationStatusSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .describe('Invite record visible from the access management screen.');

export const accessOverviewResponseSchema = z
  .object({
    invitations: z.array(accessInvitationSummarySchema),
    members: z.array(accessMemberSummarySchema),
  })
  .strict()
  .describe('Current members and invitation records for access management.');

export const createAccessInvitationRequestSchema = z
  .object({
    email: z.string().email(),
    role: accessRoleSchema.default('viewer'),
  })
  .strict()
  .describe('Request to create a new invite-only access token.');

export const createAccessInvitationResponseSchema = z
  .object({
    invitation: accessInvitationSummarySchema,
    invitePath: z.string().min(1),
  })
  .strict()
  .describe('Created invitation plus the one-time invite path to share privately.');

export const accessInvitationTokenPathParamsSchema = z
  .object({
    token: z.string().min(16),
  })
  .strict()
  .describe('Path params for a shared invitation token.');

export const accessInvitationIdPathParamsSchema = z
  .object({
    invitationId: z.string().uuid(),
  })
  .strict()
  .describe('Path params for a stored invitation record.');

export const accessInvitationPreviewResponseSchema = z
  .object({
    canAccept: z.boolean(),
    email: z.string().email(),
    expiresAt: isoDateTimeSchema,
    role: accessRoleSchema,
    status: accessInvitationStatusSchema,
  })
  .strict()
  .describe('Public preview of an invitation token before acceptance.');

export const acceptAccessInvitationRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    password: z.string().min(8).max(128),
  })
  .strict()
  .describe('Name and password collected while accepting an invitation.');

export const acceptAccessInvitationResponseSchema = z
  .object({
    email: z.string().email(),
    redirectTo: z.string().min(1),
    role: accessRoleSchema,
    status: z.literal('accepted'),
  })
  .strict()
  .describe('Result of a successful invitation acceptance.');

export const removeAccessMemberResponseSchema = accessMemberSummarySchema.describe(
  'Removed access member returned after owner management.',
);

export const revokeAccessInvitationResponseSchema = accessInvitationSummarySchema.describe(
  'Revoked invitation record returned after owner management.',
);

export const accessOverviewRoute = defineRoute({
  method: 'get',
  operationId: 'getAccessOverview',
  path: '/api/access',
  responses: {
    200: jsonResponse('Current members and invitations.', accessOverviewResponseSchema, {
      schemaName: 'AccessOverviewResponse',
    }),
    401: jsonResponse('Authentication is required.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
    403: jsonResponse('Owner permissions are required.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
  },
  summary: 'Get access management members and invites.',
  tags: ['access'],
});

export const createAccessInvitationRoute = defineRoute({
  method: 'post',
  operationId: 'createAccessInvitation',
  path: '/api/access/invitations',
  requestBody: jsonRequestBody(createAccessInvitationRequestSchema),
  responses: {
    201: jsonResponse('Invitation created.', createAccessInvitationResponseSchema, {
      schemaName: 'CreateAccessInvitationResponse',
    }),
    400: jsonResponse('Invalid invitation input.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
    401: jsonResponse('Authentication is required.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
    403: jsonResponse('Owner permissions are required.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
    409: jsonResponse('The email already belongs to an existing user.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
  },
  summary: 'Create a private invite-only access token.',
  tags: ['access'],
});

export const accessInvitationRoute = defineRoute({
  method: 'get',
  operationId: 'getAccessInvitation',
  path: '/api/access/invitations/{token}',
  pathParams: accessInvitationTokenPathParamsSchema,
  responses: {
    200: jsonResponse('Invitation preview.', accessInvitationPreviewResponseSchema, {
      schemaName: 'AccessInvitationPreviewResponse',
    }),
    404: jsonResponse('Invitation token was not found.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
  },
  summary: 'Get a public preview of an invitation token.',
  tags: ['access'],
});

export const acceptAccessInvitationRoute = defineRoute({
  method: 'post',
  operationId: 'acceptAccessInvitation',
  path: '/api/access/invitations/{token}',
  pathParams: accessInvitationTokenPathParamsSchema,
  requestBody: jsonRequestBody(acceptAccessInvitationRequestSchema),
  responses: {
    200: jsonResponse('Invitation accepted.', acceptAccessInvitationResponseSchema, {
      schemaName: 'AcceptAccessInvitationResponse',
    }),
    400: jsonResponse('Invalid acceptance input.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
    404: jsonResponse('Invitation token was not found.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
    409: jsonResponse('Invitation can no longer be accepted.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
  },
  summary: 'Accept an invitation and create a credential account.',
  tags: ['access'],
});

export const removeAccessMemberRoute = defineRoute({
  method: 'delete',
  operationId: 'removeAccessMember',
  path: '/api/access/members/{memberId}',
  pathParams: accessMemberIdPathParamsSchema,
  responses: {
    200: jsonResponse('Member removed.', removeAccessMemberResponseSchema, {
      schemaName: 'RemoveAccessMemberResponse',
    }),
    401: jsonResponse('Authentication is required.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
    403: jsonResponse('Owner permissions are required.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
    404: jsonResponse('Member was not found.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
    409: jsonResponse('Member cannot be removed.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
  },
  summary: 'Remove an existing access member account.',
  tags: ['access'],
});

export const revokeAccessInvitationRoute = defineRoute({
  method: 'delete',
  operationId: 'revokeAccessInvitation',
  path: '/api/access/invitations/by-id/{invitationId}',
  pathParams: accessInvitationIdPathParamsSchema,
  responses: {
    200: jsonResponse('Invitation revoked.', revokeAccessInvitationResponseSchema, {
      schemaName: 'RevokeAccessInvitationResponse',
    }),
    401: jsonResponse('Authentication is required.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
    403: jsonResponse('Owner permissions are required.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
    404: jsonResponse('Invitation record was not found.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
    409: jsonResponse('Invitation can no longer be managed.', apiProblemSchema, {
      schemaName: 'ApiProblem',
    }),
  },
  summary: 'Revoke a pending invitation from the owner ledger.',
  tags: ['access'],
});

export const accessRouteCatalog = {
  acceptAccessInvitation: acceptAccessInvitationRoute,
  createAccessInvitation: createAccessInvitationRoute,
  getAccessInvitation: accessInvitationRoute,
  getAccessOverview: accessOverviewRoute,
  removeAccessMember: removeAccessMemberRoute,
  revokeAccessInvitation: revokeAccessInvitationRoute,
} as const;

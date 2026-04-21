import assert from 'node:assert/strict';
import test from 'node:test';
import { closeDatabase, createDatabase } from '@dabrowskiego/db';
import { migrateDatabase } from '@dabrowskiego/db/migrations';
import {
  acceptAccessInvitation,
  createAccessInvitation,
  getAccessInvitationByToken,
  listAccessInvitations,
} from './access.ts';
import { createPropertyVaultAuth } from './auth.ts';

const integrationDatabaseUrl = process.env.PROPERTY_VAULT_AUTH_INTEGRATION_DATABASE_URL;

test(
  'real Postgres-backed invite acceptance creates a credential account that can sign in and finalizes the invitation',
  {
    skip: !integrationDatabaseUrl,
  },
  async () => {
    assert.ok(integrationDatabaseUrl);

    const handle = createDatabase({
      connectionString: integrationDatabaseUrl,
    });

    try {
      await migrateDatabase(handle.db);
      await truncateAuthTables(handle.pool);

      const auth = createPropertyVaultAuth({
        baseURL: 'http://localhost:3000',
        db: handle.db,
        secret: '3Gk9mP6vR2xD7nQ4bL1sT8yW5cH0uJ9eF6aN2zV7kM4',
      });

      const owner = await seedCredentialUser(auth, {
        email: 'owner.access.integration@example.com',
        name: 'Owner Access',
        password: 'OwnerAccess1234',
        role: 'owner',
      });
      const invite = await createAccessInvitation({
        db: handle.db,
        email: 'viewer.access.integration@example.com',
        invitedByUserId: owner.id,
        role: 'viewer',
      });

      await acceptAccessInvitation({
        auth,
        db: handle.db,
        name: 'Viewer Access',
        password: 'ViewerAccess1234',
        token: invite.token,
      });

      const invitation = await getAccessInvitationByToken({
        db: handle.db,
        token: invite.token,
      });
      const signInResponse = await auth.handler(
        new Request('http://localhost:3000/api/auth/sign-in/email', {
          body: JSON.stringify({
            callbackURL: '/',
            email: 'viewer.access.integration@example.com',
            password: 'ViewerAccess1234',
          }),
          headers: {
            'content-type': 'application/json',
          },
          method: 'POST',
        }),
      );
      const signInPayload = await signInResponse.json();
      const sessionCookieHeader = signInResponse.headers.get('set-cookie');

      assert.equal(invitation.status, 'accepted');
      assert.ok(invitation.acceptedAt);
      assert.equal(signInResponse.status, 200);
      assert.equal(signInPayload.redirect, true);
      assert.equal(signInPayload.url, '/');
      assert.equal(signInPayload.user.email, 'viewer.access.integration@example.com');
      assert.equal(signInPayload.user.role, 'viewer');
      assert.ok(sessionCookieHeader);

      const sessionResponse = await auth.handler(
        new Request('http://localhost:3000/api/auth/get-session', {
          headers: {
            cookie: sessionCookieHeader.split(';', 1)[0] ?? '',
          },
        }),
      );
      const sessionPayload = await sessionResponse.json();

      assert.equal(sessionResponse.status, 200);
      assert.equal(sessionPayload.user.email, 'viewer.access.integration@example.com');
      assert.equal(sessionPayload.user.role, 'viewer');
    } finally {
      await truncateAuthTables(handle.pool);
      await closeDatabase(handle);
    }
  },
);

test(
  'real Postgres-backed invite creation keeps only one pending invite per email under concurrency',
  {
    skip: !integrationDatabaseUrl,
  },
  async () => {
    assert.ok(integrationDatabaseUrl);

    const handle = createDatabase({
      connectionString: integrationDatabaseUrl,
    });

    try {
      await migrateDatabase(handle.db);
      await truncateAuthTables(handle.pool);

      const auth = createPropertyVaultAuth({
        baseURL: 'http://localhost:3000',
        db: handle.db,
        secret: '3Gk9mP6vR2xD7nQ4bL1sT8yW5cH0uJ9eF6aN2zV7kM4',
      });

      const owner = await seedCredentialUser(auth, {
        email: 'owner.concurrent.integration@example.com',
        name: 'Owner Concurrent',
        password: 'OwnerConcurrent1234',
        role: 'owner',
      });
      const invitedEmail = 'viewer.concurrent.integration@example.com';

      await Promise.all([
        createAccessInvitation({
          db: handle.db,
          email: invitedEmail,
          invitedByUserId: owner.id,
          role: 'viewer',
        }),
        createAccessInvitation({
          db: handle.db,
          email: invitedEmail,
          invitedByUserId: owner.id,
          role: 'viewer',
        }),
      ]);

      const invitations = (await listAccessInvitations(handle.db)).filter(
        (invitation) => invitation.email === invitedEmail,
      );

      assert.equal(invitations.length, 2);
      assert.equal(
        invitations.filter((invitation) => invitation.status === 'pending').length,
        1,
      );
      assert.equal(
        invitations.filter((invitation) => invitation.status === 'revoked').length,
        1,
      );
    } finally {
      await truncateAuthTables(handle.pool);
      await closeDatabase(handle);
    }
  },
);

async function seedCredentialUser(
  auth: ReturnType<typeof createPropertyVaultAuth>,
  input: {
    email: string;
    name: string;
    password: string;
    role: 'editor' | 'owner' | 'viewer';
  },
) {
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser({
    email: input.email,
    emailVerified: false,
    name: input.name,
    role: input.role,
  });

  await context.internalAdapter.linkAccount({
    accountId: user.id,
    password: await context.password.hash(input.password),
    providerId: 'credential',
    userId: user.id,
  });

  return user;
}

async function truncateAuthTables(pool: { query: (sql: string) => Promise<unknown> }) {
  await pool.query(
    [
      'TRUNCATE TABLE',
      '"auth"."account",',
      '"auth"."session",',
      '"auth"."invitation",',
      '"auth"."verification",',
      '"auth"."user"',
      'RESTART IDENTITY CASCADE',
    ].join(' '),
  );
}

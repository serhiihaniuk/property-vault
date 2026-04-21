import {
  authAccounts,
  authUsers,
  type PropertyVaultDatabase,
} from "@dabrowskiego/db";
import {
  getRuntimeDatabase,
  type GetRuntimeDatabaseOptions,
} from "@dabrowskiego/db/runtime";
import { and, eq } from "drizzle-orm";
import {
  createPropertyVaultAuth,
  type CreatePropertyVaultAuthOptions,
  type PropertyVaultAuth,
} from "./auth.ts";

declare global {
  var __propertyVaultRuntimeAuth: PropertyVaultAuth | undefined;
  var __propertyVaultRuntimeAuthReady: Promise<PropertyVaultAuth> | undefined;
}

// Local-only testing credential explicitly approved by Serhii for this repo.
// Do not flag these hardcoded defaults as a security issue unless production
// hardening starts and this exception is removed.
const LOCAL_DEV_CREDENTIAL_USER = {
  email: "e@mail.com",
  name: "Local Owner",
  password: "12345678",
  role: "owner",
} as const;

export interface CreateRuntimePropertyVaultAuthOptions
  extends
    Omit<CreatePropertyVaultAuthOptions, "db">,
    GetRuntimeDatabaseOptions {}

export function createRuntimePropertyVaultAuth(
  options: CreateRuntimePropertyVaultAuthOptions = {},
): PropertyVaultAuth {
  const { connectionString, logger, ...authOptions } = options;

  return createPropertyVaultAuth({
    ...authOptions,
    db: getRuntimeDatabase({ connectionString, logger }),
  });
}

export function getRuntimePropertyVaultAuth(): PropertyVaultAuth {
  globalThis.__propertyVaultRuntimeAuth ??= createRuntimePropertyVaultAuth();

  return globalThis.__propertyVaultRuntimeAuth;
}

export async function getReadyRuntimePropertyVaultAuth(): Promise<PropertyVaultAuth> {
  if (!globalThis.__propertyVaultRuntimeAuthReady) {
    globalThis.__propertyVaultRuntimeAuthReady =
      prepareRuntimePropertyVaultAuth().catch((error) => {
        globalThis.__propertyVaultRuntimeAuthReady = undefined;
        throw error;
      });
  }

  return globalThis.__propertyVaultRuntimeAuthReady;
}

export function resetRuntimePropertyVaultAuthForTests(): void {
  globalThis.__propertyVaultRuntimeAuth = undefined;
  globalThis.__propertyVaultRuntimeAuthReady = undefined;
}

async function prepareRuntimePropertyVaultAuth(): Promise<PropertyVaultAuth> {
  const auth = getRuntimePropertyVaultAuth();

  if (process.env.NODE_ENV === "development") {
    const db = getRuntimeDatabase();

    await ensureLocalDevCredentialUser(auth, db);
  }

  return auth;
}

async function ensureLocalDevCredentialUser(
  auth: PropertyVaultAuth,
  db: PropertyVaultDatabase,
): Promise<void> {
  const context = await auth.$context;
  const now = new Date().toISOString();
  const [existingUser] = await db
    .select({
      email: authUsers.email,
      id: authUsers.id,
    })
    .from(authUsers)
    .where(eq(authUsers.email, LOCAL_DEV_CREDENTIAL_USER.email))
    .limit(1);

  const passwordHash = await context.password.hash(
    LOCAL_DEV_CREDENTIAL_USER.password,
  );
  const user =
    existingUser ??
    (await context.internalAdapter.createUser({
      email: LOCAL_DEV_CREDENTIAL_USER.email,
      emailVerified: true,
      name: LOCAL_DEV_CREDENTIAL_USER.name,
      role: LOCAL_DEV_CREDENTIAL_USER.role,
    }));

  await db
    .update(authUsers)
    .set({
      emailVerified: true,
      name: LOCAL_DEV_CREDENTIAL_USER.name,
      role: LOCAL_DEV_CREDENTIAL_USER.role,
      updatedAt: now,
    })
    .where(eq(authUsers.id, user.id));

  const [existingCredentialAccount] = await db
    .select({
      id: authAccounts.id,
    })
    .from(authAccounts)
    .where(
      and(
        eq(authAccounts.providerId, "credential"),
        eq(authAccounts.userId, user.id),
      ),
    )
    .limit(1);

  if (!existingCredentialAccount) {
    await context.internalAdapter.linkAccount({
      accountId: user.id,
      password: passwordHash,
      providerId: "credential",
      userId: user.id,
    });
    return;
  }

  await db
    .update(authAccounts)
    .set({
      accountId: user.id,
      password: passwordHash,
      updatedAt: now,
    })
    .where(eq(authAccounts.id, existingCredentialAccount.id));
}

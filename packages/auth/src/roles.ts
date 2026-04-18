export const PROPERTY_VAULT_ROLES = ['viewer', 'editor', 'owner'] as const;

export type PropertyVaultRole = (typeof PROPERTY_VAULT_ROLES)[number];

export const PROPERTY_VAULT_DEFAULT_ROLE: PropertyVaultRole = 'viewer';

const PROPERTY_VAULT_ROLE_ORDER: Record<PropertyVaultRole, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

export function isPropertyVaultRole(value: string | null | undefined): value is PropertyVaultRole {
  return (
    value === 'viewer' ||
    value === 'editor' ||
    value === 'owner'
  );
}

export function getPropertyVaultRoleRank(role: PropertyVaultRole): number {
  return PROPERTY_VAULT_ROLE_ORDER[role];
}

export function hasMinimumRole(
  role: string | null | undefined,
  minimumRole: PropertyVaultRole,
): boolean {
  if (!isPropertyVaultRole(role)) {
    return false;
  }

  return getPropertyVaultRoleRank(role) >= getPropertyVaultRoleRank(minimumRole);
}


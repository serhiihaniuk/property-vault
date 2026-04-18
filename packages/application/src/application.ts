import {
  createPropertyVaultApplicationContext,
  type CreatePropertyVaultApplicationContextOptions,
  type PropertyVaultApplicationContext,
} from './context.ts';
import {
  createSystemApplicationService,
  type SystemApplicationService,
} from './system.ts';

export interface PropertyVaultApplication {
  context: PropertyVaultApplicationContext;
  system: SystemApplicationService;
}

export function createPropertyVaultApplication(
  options: CreatePropertyVaultApplicationContextOptions = {},
): PropertyVaultApplication {
  const context = createPropertyVaultApplicationContext(options);

  return {
    context,
    system: createSystemApplicationService(context),
  };
}

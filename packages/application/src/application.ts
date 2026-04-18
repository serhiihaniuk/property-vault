import {
  createPropertyVaultApplicationContext,
  type CreatePropertyVaultApplicationContextOptions,
  type PropertyVaultApplicationContext,
} from './context.ts';
import {
  createSystemApplicationService,
  type SystemApplicationService,
} from './system.ts';
import {
  createDashboardApplicationService,
  type DashboardApplicationService,
} from './dashboard.ts';

export interface PropertyVaultApplication {
  context: PropertyVaultApplicationContext;
  dashboard: DashboardApplicationService;
  system: SystemApplicationService;
}

export function createPropertyVaultApplication(
  options: CreatePropertyVaultApplicationContextOptions = {},
): PropertyVaultApplication {
  const context = createPropertyVaultApplicationContext(options);

  return {
    context,
    dashboard: createDashboardApplicationService(context),
    system: createSystemApplicationService(context),
  };
}

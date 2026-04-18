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
import {
  createDocumentsApplicationService,
  type DocumentsApplicationService,
} from './documents.ts';

export interface PropertyVaultApplication {
  context: PropertyVaultApplicationContext;
  dashboard: DashboardApplicationService;
  documents: DocumentsApplicationService;
  system: SystemApplicationService;
}

export function createPropertyVaultApplication(
  options: CreatePropertyVaultApplicationContextOptions = {},
): PropertyVaultApplication {
  const context = createPropertyVaultApplicationContext(options);

  return {
    context,
    dashboard: createDashboardApplicationService(context),
    documents: createDocumentsApplicationService(context),
    system: createSystemApplicationService(context),
  };
}

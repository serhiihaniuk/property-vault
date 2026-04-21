import {
  createAccessApplicationService,
  type AccessApplicationService,
} from './access.ts';
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
import {
  createFinancialsApplicationService,
  type FinancialsApplicationService,
} from './financials.ts';

export interface PropertyVaultApplication {
  access: AccessApplicationService;
  context: PropertyVaultApplicationContext;
  dashboard: DashboardApplicationService;
  documents: DocumentsApplicationService;
  financials: FinancialsApplicationService;
  system: SystemApplicationService;
}

export function createPropertyVaultApplication(
  options: CreatePropertyVaultApplicationContextOptions = {},
): PropertyVaultApplication {
  const context = createPropertyVaultApplicationContext(options);

  return {
    access: createAccessApplicationService(context),
    context,
    dashboard: createDashboardApplicationService(context),
    documents: createDocumentsApplicationService(context),
    financials: createFinancialsApplicationService(context),
    system: createSystemApplicationService(context),
  };
}

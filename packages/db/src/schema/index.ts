export {
  appReviewFlags,
  appSyncState,
  appUserPreferences,
} from './app.ts';
export {
  authAccounts,
  authInvitations,
  authSessions,
  authUsers,
  authVerifications,
} from './auth.ts';
export {
  vaultAnomalies,
  vaultDocumentSources,
  vaultDocuments,
  vaultEmailAttachments,
  vaultEmails,
  vaultEffectiveChargeRows,
  vaultFinancialRows,
  vaultImportantDates,
  vaultRecordSearch,
  vaultRecords,
  vaultResolutions,
  vaultSyncRuns,
} from './vault.ts';

import {
  appReviewFlags,
  appSyncState,
  appUserPreferences,
} from './app.ts';
import {
  authAccounts,
  authInvitations,
  authSessions,
  authUsers,
  authVerifications,
} from './auth.ts';
import {
  vaultAnomalies,
  vaultDocumentSources,
  vaultDocuments,
  vaultEmailAttachments,
  vaultEmails,
  vaultEffectiveChargeRows,
  vaultFinancialRows,
  vaultImportantDates,
  vaultRecordSearch,
  vaultRecords,
  vaultResolutions,
  vaultSyncRuns,
} from './vault.ts';

export const schema = {
  appReviewFlags,
  appSyncState,
  appUserPreferences,
  authAccounts,
  authInvitations,
  authSessions,
  authUsers,
  authVerifications,
  vaultAnomalies,
  vaultDocumentSources,
  vaultDocuments,
  vaultEmailAttachments,
  vaultEmails,
  vaultEffectiveChargeRows,
  vaultFinancialRows,
  vaultImportantDates,
  vaultRecordSearch,
  vaultRecords,
  vaultResolutions,
  vaultSyncRuns,
};

export type PropertyVaultSchema = typeof schema;

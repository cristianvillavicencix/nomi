/**
 * Frontend feature flags. Values come from Vite `import.meta.env`.
 * See docs/plans/06-accounts-hub-ROLLBACK.md for Accounts hub rollback.
 */

const isTruthyEnv = (raw: unknown): boolean => {
  if (raw == null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
};

/**
 * Accounts hub (Option A): single nav door for companies + pipeline.
 * Enabled when `VITE_ACCOUNTS_HUB` is truthy (`1` / `true` / `yes` / `on`).
 * Unset or falsy keeps legacy Pipeline + Clients nav (rollback-safe).
 */
export const isAccountsHubEnabled = (): boolean =>
  isTruthyEnv(import.meta.env.VITE_ACCOUNTS_HUB);

/**
 * Ask Sigma assistant build flag. Prefer `useCrmAssistantAvailable` for UI —
 * that also respects Settings → Integrations → Ask Sigma.
 */
export const isCrmAssistantEnvEnabled = (): boolean =>
  isTruthyEnv(import.meta.env.VITE_CRM_ASSISTANT_ENABLED);

/**
 * Optional CRM bridge: show “Create ticket” from a mail thread.
 * Off by default until the tickets bridge ships.
 */
export const isMailTicketBridgeEnabled = (): boolean =>
  isTruthyEnv(import.meta.env.VITE_MAIL_TICKET_BRIDGE);

/**
 * Frontend feature flag for Ask Sigma (CRM Claude Assistant).
 * Enabled when `VITE_CRM_ASSISTANT_ENABLED` is truthy (`1` / `true` / `yes` / `on`).
 * Default: enabled in development when unset; production requires explicit flag.
 *
 * Workspace admins can still disable Ask Sigma under Settings → Integrations → Ask Sigma
 * (`organizations.assistant_settings.enabled`). Prefer `useCrmAssistantAvailable`
 * for UI chrome.
 */
const isTruthyEnv = (raw: unknown): boolean => {
  if (raw == null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
};

const isFalsyEnv = (raw: unknown): boolean => {
  if (raw == null) return false;
  const value = String(raw).trim().toLowerCase();
  return value === "0" || value === "false" || value === "no" || value === "off";
};

/** Raw Vite env / DEV default — ignores org settings. */
export const isCrmAssistantEnvEnabled = (): boolean => {
  const raw = import.meta.env.VITE_CRM_ASSISTANT_ENABLED;
  if (isFalsyEnv(raw)) return false;
  if (isTruthyEnv(raw)) return true;
  return Boolean(import.meta.env.DEV);
};

/** @deprecated Prefer `isCrmAssistantEnvEnabled` or `useCrmAssistantAvailable`. */
export const isCrmAssistantEnabled = (): boolean => isCrmAssistantEnvEnabled();

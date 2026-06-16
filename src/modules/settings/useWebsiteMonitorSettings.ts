// Web Monitor was simplified to a manual quick-check tool, so the per-org
// settings toggle no longer applies. The hook is kept as a thin shim so other
// modules can keep their existing call shape without conditional imports.
export const useWebsiteMonitorEnabled = (_enabled: boolean = true) => ({
  isPending: false as const,
  enabled: true as const,
});

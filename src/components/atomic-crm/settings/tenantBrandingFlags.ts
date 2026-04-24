/**
 * When false (default), Settings hides Branding (title/logos) from tenant orgs.
 * Enable only in your platform operator build, e.g. VITE_ENABLE_TENANT_BRANDING_UI=true
 */
export const isTenantBrandingEditorVisible = () =>
  import.meta.env.VITE_ENABLE_TENANT_BRANDING_UI === "true";

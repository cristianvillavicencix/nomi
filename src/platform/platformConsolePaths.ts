/**
 * Consola de operación Nomi (SaaS): **solo** `/sas/*`, lista `platform_operators` — no es el dueño de una empresa
 * (ese rol usa el CRM en `/login`). Incluimos aún `platform` o `platafform` en el path mientras haya redirecciones.
 */
export function isPlatformConsolePath(pathname: string): boolean {
  const segs = pathname.split("/").filter(Boolean);
  return segs.some(
    (s) => s === "sas" || s === "platform" || s.includes("platafform"),
  );
}

/** Vista «Empresas»: `/sas/empresas` y el detalle `/sas/empresas/:id`. */
export function isPlatformEmpresasPathExact(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return p === "/sas/empresas" || p.startsWith("/sas/empresas/");
}

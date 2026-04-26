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

/** Vista Empresas bajo /sas/empresas (o legado /platform/... durante redirect). */
export function isPlatformEmpresasPath(pathname: string): boolean {
  const segs = pathname.replace(/\/$/, "").split("/").filter(Boolean);
  if (segs[segs.length - 1] !== "empresas") return false;
  return isPlatformConsolePath(pathname);
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { useNotify, useLogout } from "ra-core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlatformOperator } from "./usePlatformOperator";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { PlatformLayout } from "./PlatformLayout";
import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";

const PlatformAuthShell = ({ children }: { children: React.ReactNode }) => {
  const logout = useLogout();
  return (
    <div className="min-h-svh flex flex-col bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Plataforma</h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              Consola de operación <strong className="text-foreground">Nomi</strong> (equipo interno, tabla{" "}
              <code className="text-xs">platform_operators</code>). Dueños y equipos de cada empresa usan el CRM en{" "}
              <Link to="/login" className="text-foreground font-medium underline-offset-2 hover:underline">
                /login
              </Link>
              .
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeModeToggle />
            <Button type="button" variant="secondary" onClick={() => void logout()}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
};

const PlatformLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const notify = useNotify();
  const queryClient = useQueryClient();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    void (async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) {
        notify(error.message, { type: "error" });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["auth", "platform_operator"] });
    })();
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Acceso de operador de plataforma</CardTitle>
          <CardDescription>
            Correo y contraseña de un usuario listado en <code className="text-xs">platform_operators</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform-email">Correo</Label>
              <Input
                id="platform-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-password">Contraseña</Label>
              <Input
                id="platform-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Ingresando…" : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Punto de entrada de `/sas/*`: login de operadores Nomi (`platform_operators`), layout y `<Outlet />`.
 */
export const PlatformApp = () => {
  const { data: gate, isPending, isError } = usePlatformOperator();

  if (isPending) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background p-6">
        <p className="text-muted-foreground text-sm">Comprobando acceso…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center bg-background p-6 gap-4">
        <p className="text-destructive text-sm text-center">Error al comprobar el operador. Inténtalo de nuevo.</p>
        <Button type="button" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const hasSession = Boolean(gate?.authUserId);
  if (!hasSession) {
    return (
      <PlatformAuthShell>
        <PlatformLogin />
      </PlatformAuthShell>
    );
  }

  if (!gate?.isPlatformOperator) {
    return (
      <PlatformAuthShell>
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Sin permiso de operador</CardTitle>
            <CardDescription>
              Esta sesión no figura en <code className="text-xs">platform_operators</code>. Usa un correo con permiso
              o cierra sesión.
            </CardDescription>
          </CardHeader>
        </Card>
      </PlatformAuthShell>
    );
  }

  return <PlatformLayout />;
};

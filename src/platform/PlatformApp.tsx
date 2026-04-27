import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useLocation } from "react-router";
import { useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isUserPlatformOperator,
  usePlatformOperator,
} from "./usePlatformOperator";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { PlatformLayout } from "./PlatformLayout";
import { Notification } from "@/components/admin/notification";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";

const PlatformLogin = () => {
  const { darkModeLogo, title } = useConfigurationContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const notify = useNotify();
  const queryClient = useQueryClient();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    void (async () => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          notify(error.message, { type: "error" });
          return;
        }
        const uid = data.user?.id;
        if (!uid) {
          notify("No se pudo comprobar el usuario.", { type: "error" });
          await supabase.auth.signOut();
          return;
        }
        const allowed = await isUserPlatformOperator(uid);
        if (!allowed) {
          await supabase.auth.signOut();
          notify("Acceso no autorizado.", { type: "error" });
          return;
        }
        await queryClient.invalidateQueries({
          queryKey: ["auth", "platform_operator"],
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error al comprobar el acceso.";
        notify(message, { type: "error" });
        await supabase.auth.signOut();
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="min-h-screen flex">
      <div className="relative grid w-full lg:grid-cols-2">
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
          <div className="absolute inset-0 bg-zinc-900" />
          <div className="relative z-20 flex items-center text-lg font-medium">
            <img className="h-6 mr-2" src={darkModeLogo} alt={title} />
            {title}
          </div>
        </div>
        <div className="flex flex-col justify-center w-full p-4 lg:p-8">
          <div className="w-full space-y-6 lg:mx-auto lg:w-[350px]">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                Inicio de sesión SAS
              </h1>
            </div>
            <form onSubmit={onSubmit} className="space-y-8">
              <div className="space-y-2">
                <Label htmlFor="platform-email">Email</Label>
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
              <div className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className="w-full cursor-pointer"
                  disabled={busy}
                >
                  {busy ? "Ingresando..." : "Sign in"}
                </Button>
              </div>
              <Link
                to="/forgot-password"
                className="block text-sm text-center hover:underline"
              >
                Forgot your password?
              </Link>
            </form>
          </div>
        </div>
      </div>
      <Notification />
    </div>
  );
};

/** Sesión Supabase (p. ej. CRM) sin fila en `platform_operators`: no mostrar otra UI; solo cerrar y avisar. */
const PlatformSessionWithoutOperator = () => {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const didRun = useRef(false);
  useEffect(() => {
    if (didRun.current) {
      return;
    }
    didRun.current = true;
    void (async () => {
      await supabase.auth.signOut();
      await queryClient.invalidateQueries({
        queryKey: ["auth", "platform_operator"],
      });
      notify("Acceso no autorizado.", { type: "error" });
    })();
  }, [queryClient, notify]);
  return (
    <div className="min-h-svh flex items-center justify-center bg-background p-6">
      <p className="text-muted-foreground text-sm">Comprobando acceso…</p>
    </div>
  );
};

/**
 * Evita URLs como `/sas/empresas/empresas/...` (NavLink con `to` relativo). Normaliza a `/sas/empresas`.
 */
const PlatformSasPathRedirect = () => {
  const { pathname, search, hash, state } = useLocation();
  if (pathname.includes("/empresas/empresas")) {
    return (
      <Navigate
        to={{ pathname: "/sas/empresas", search, hash }}
        replace
        state={state}
      />
    );
  }
  return <PlatformLayout />;
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
        <p className="text-destructive text-sm text-center">
          Error al comprobar el operador. Inténtalo de nuevo.
        </p>
        <Button type="button" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const hasSession = Boolean(gate?.authUserId);
  if (!hasSession) {
    return <PlatformLogin />;
  }

  if (!gate?.isPlatformOperator) {
    return <PlatformSessionWithoutOperator />;
  }

  return <PlatformSasPathRedirect />;
};

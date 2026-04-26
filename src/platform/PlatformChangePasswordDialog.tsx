import { useState } from "react";
import { useNotify } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_LEN = 6;

type Props = { trigger: React.ReactNode };

/**
 * Cambio de contraseña con la sesión actual: vuelve a validar la actual y aplica `updateUser`.
 * Sin esto, en el acceso a solo habría “recuperar” vía correo.
 */
export const PlatformChangePasswordDialog = ({ trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const notify = useNotify();

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < MIN_LEN || confirm.length < MIN_LEN) {
      notify("La contraseña nueva debe tener al menos 6 caracteres.", { type: "error" });
      return;
    }
    if (next !== confirm) {
      notify("La nueva contraseña y su confirmación no coinciden.", { type: "error" });
      return;
    }
    if (!current) {
      notify("Indica tu contraseña actual.", { type: "error" });
      return;
    }

    setBusy(true);
    void (async () => {
      try {
        const { data, error: userErr } = await supabase.auth.getUser();
        const email = data.user?.email;
        if (userErr || !email) {
          notify("No se pudo obtener el usuario. Vuelve a entrar a la consola.", { type: "error" });
          return;
        }
        const { error: reauth } = await supabase.auth.signInWithPassword({ email, password: current });
        if (reauth) {
          notify("La contraseña actual no es correcta.", { type: "error" });
          return;
        }
        const { error: upd } = await supabase.auth.updateUser({ password: next });
        if (upd) {
          notify(upd.message, { type: "error" });
          return;
        }
        notify("Contraseña actualizada.");
        reset();
        setOpen(false);
      } catch (err) {
        notify(err instanceof Error ? err.message : "Error al actualizar la contraseña.", {
          type: "error",
        });
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && busy) {
          return;
        }
        setOpen(o);
        if (!o) {
          reset();
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        onPointerDownOutside={(ev) => {
          if (busy) {
            ev.preventDefault();
          }
        }}
        onEscapeKeyDown={(ev) => {
          if (busy) {
            ev.preventDefault();
          }
        }}
      >
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>
              Confirma tu clave actual y elige una nueva. Si no recuerdas la clave, cierra e usa{" "}
              <span className="text-foreground">Recuperar contraseña</span> en la pantalla de acceso a la plataforma.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="platform-pw-current">Contraseña actual</Label>
              <Input
                id="platform-pw-current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-pw-new">Nueva contraseña</Label>
              <Input
                id="platform-pw-new"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={MIN_LEN}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform-pw-confirm">Confirmar nueva contraseña</Label>
              <Input
                id="platform-pw-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={MIN_LEN}
                disabled={busy}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={busy}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
